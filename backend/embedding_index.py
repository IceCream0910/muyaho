"""Build and search the local image index without calling Gemini or OpenAI."""

import argparse
import json
import os
import sqlite3
import time
from contextlib import closing
from functools import lru_cache
from pathlib import Path

import numpy as np

MODEL_ID = "google/embeddinggemma-2"
MODEL_REVISION = "75c274c824f336ceab700681334ea7f15c71edb5"
DIMENSIONS = 768
INDEX_FORMAT = f"{MODEL_ID}@{MODEL_REVISION}/image-rgb-fp32-{DIMENSIONS}/v1"
INDEX_PATH = Path(os.environ.get("EMBEDDING_INDEX_PATH", "./embedding-data/index.sqlite3"))
IMAGES_DIR = Path("./images")
STATE_PATH = Path("./processing_state.json")


class IndexUnavailable(Exception):
    pass


@lru_cache(maxsize=1)
def model():
    import torch
    from sentence_transformers import SentenceTransformer

    torch.set_num_threads(int(os.environ.get("EMBEDDING_CPU_THREADS", "2")))
    return SentenceTransformer(
        MODEL_ID,
        revision=MODEL_REVISION,
        device="cpu",
        config_kwargs={"audio_config": None},
        model_kwargs={"dtype": torch.float32},
    )


def validated_vectors(vectors, count):
    vectors = np.asarray(vectors, dtype="<f4")
    if vectors.shape != (count, DIMENSIONS) or not np.isfinite(vectors).all():
        raise ValueError("Invalid embedding dimensions or non-finite values")
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    if not np.isfinite(norms).all() or (norms <= 0).any():
        raise ValueError("Invalid embedding norm")
    return vectors / norms


def encode_images(paths):
    from PIL import Image, ImageOps

    inputs = []
    for path in paths:
        try:
            with Image.open(path) as image:
                # For animated formats, use the first frame.
                inputs.append({"image": ImageOps.exif_transpose(image).convert("RGB")})
        except (OSError, ValueError) as exc:
            raise ValueError(f"Cannot decode {path}") from exc
    return validated_vectors(
        model().encode(inputs, batch_size=len(inputs), show_progress_bar=False),
        len(inputs),
    )


def fingerprint(path):
    stat = path.stat()
    return f"{stat.st_size}:{stat.st_mtime_ns}:{stat.st_ctime_ns}"


def rebuild(index_path, images_dir, state_path, batch_size):
    started = time.perf_counter()
    entries = json.loads(state_path.read_text(encoding="utf-8"))["processed_images"]
    if not entries:
        raise ValueError("No registered images in processing_state.json")

    images_dir = images_dir.resolve()
    present = {}
    seen_ids = set()
    missing = []
    for filename, metadata in entries.items():
        image_id = metadata["image_id"]
        if not image_id or image_id in seen_ids:
            raise ValueError(f"Missing or duplicate image ID for {filename}")
        seen_ids.add(image_id)
        path = images_dir / filename
        if Path(filename).name != filename or path.resolve().parent != images_dir:
            raise ValueError(f"Invalid image filename: {filename}")
        if not path.is_file():
            missing.append(filename)
            continue
        present[image_id] = (path, fingerprint(path))

    for filename in missing:
        print(f"Missing registered image: {filename}")
    if not present:
        raise ValueError("No registered image files found; existing index was preserved")

    index_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(index_path)) as db, db:
        # Readers see the last complete index until this transaction commits.
        db.execute("BEGIN IMMEDIATE")
        db.execute("CREATE TABLE IF NOT EXISTS metadata (format TEXT NOT NULL)")
        db.execute("""CREATE TABLE IF NOT EXISTS embeddings (
            image_id TEXT PRIMARY KEY, filename TEXT NOT NULL,
            fingerprint TEXT NOT NULL, vector BLOB NOT NULL
        )""")
        if db.execute("SELECT format FROM metadata").fetchone() != (INDEX_FORMAT,):
            db.execute("DELETE FROM embeddings")
            db.execute("DELETE FROM metadata")
            db.execute("INSERT INTO metadata VALUES (?)", (INDEX_FORMAT,))

        cached = dict(
            (image_id, (filename, stamp)) for image_id, filename, stamp in
            db.execute("SELECT image_id, filename, fingerprint FROM embeddings")
        )
        stale = cached.keys() - present.keys()
        pending = [
            (image_id, path, stamp) for image_id, (path, stamp) in present.items()
            if cached.get(image_id) != (path.name, stamp)
        ]
        for offset in range(0, len(pending), batch_size):
            batch = pending[offset:offset + batch_size]
            vectors = encode_images([path for _, path, _ in batch])
            rows = []
            for (image_id, path, stamp), vector in zip(batch, vectors, strict=True):
                if fingerprint(path) != stamp:
                    raise ValueError(f"Image changed during indexing: {path}")
                rows.append((image_id, path.name, stamp, vector.tobytes()))
            db.executemany("INSERT OR REPLACE INTO embeddings VALUES (?, ?, ?, ?)", rows)
            print(f"Encoded {offset + len(batch)}/{len(pending)}")

        db.executemany("DELETE FROM embeddings WHERE image_id = ?", [(id_,) for id_ in stale])

    return {
        "registered": len(entries), "indexed": len(present), "missing": len(missing),
        "encoded": len(pending), "reused": len(present) - len(pending), "removed": len(stale),
        "seconds": round(time.perf_counter() - started, 2),
    }


def search(query, limit, index_path=INDEX_PATH):
    try:
        with closing(sqlite3.connect(f"{index_path.resolve().as_uri()}?mode=ro", uri=True)) as db:
            db.execute("BEGIN")
            if db.execute("SELECT format FROM metadata").fetchone() != (INDEX_FORMAT,):
                raise IndexUnavailable("Index format changed; rebuild the image index")
            rows = db.execute("SELECT image_id, vector FROM embeddings ORDER BY image_id").fetchall()
    except sqlite3.Error as exc:
        raise IndexUnavailable("Cannot read image index; build it and check the service logs") from exc
    if not rows:
        raise IndexUnavailable("Image index is empty")

    vectors = np.frombuffer(b"".join(vector for _, vector in rows), dtype="<f4")
    if vectors.size != len(rows) * DIMENSIONS:
        raise IndexUnavailable("Invalid image index; rebuild it")
    # A plain string can be interpreted as an image URL or file by the processor.
    query_vector = validated_vectors(
        model().encode_query([{"text": query}], show_progress_bar=False), 1
    )[0]
    scores = (vectors.reshape(-1, DIMENSIONS) @ query_vector).clip(-1, 1)
    order = np.argsort(-scores, kind="stable")[:limit]
    return [{"image_id": rows[i][0], "score": float(scores[i])} for i in order]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 32:
        parser.error("--batch-size must be between 1 and 32")
    print(json.dumps(rebuild(INDEX_PATH, IMAGES_DIR, STATE_PATH, args.batch_size)))


if __name__ == "__main__":
    main()
