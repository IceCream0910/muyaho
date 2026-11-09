"""Compare the site's enhanced keyword search against local embeddings."""

import argparse
import json
import math
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def post(base, endpoint, payload, *, missing_is_empty=False):
    request = Request(
        f"{base.rstrip('/')}/{endpoint}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=120) as response:
            return json.load(response)
    except HTTPError as exc:
        if missing_is_empty and exc.code == 404:
            return []
        raise RuntimeError(f"{request.full_url}: HTTP {exc.code}") from exc


def baseline(base, query, limit):
    keywords = post(base, "keywords", {"query": query})["related_keywords"]

    def direct(keyword):
        return post(base, "direct_search", {"query": keyword}, missing_is_empty=True)

    # Match the site's original-query-first order and parallel keyword requests.
    with ThreadPoolExecutor(max_workers=11) as executor:
        groups = executor.map(direct, [query, *keywords])
        unique = {}
        for group in groups:
            for result in group:
                image_id = result["image_id"]
                if image_id not in unique or result["score"] > unique[image_id]["score"]:
                    unique[image_id] = result
    return sorted(unique.values(), key=lambda row: -row["score"])[:limit]


def first_relevant_rank(results, relevant_ids):
    return next(
        (rank for rank, row in enumerate(results, 1) if row["image_id"] in relevant_ids),
        None,
    )


def measure(search, query, relevant_ids):
    started = time.perf_counter()
    results = search(query)
    elapsed_ms = (time.perf_counter() - started) * 1000
    rank = first_relevant_rank(results, relevant_ids)
    return {"ms": round(elapsed_ms, 2), "first_relevant_rank": rank, "results": results}


def summarize(cases, method):
    latencies = sorted(case[method]["ms"] for case in cases)
    ranks = [case[method]["first_relevant_rank"] for case in cases if case["relevant_ids"]]
    return {
        "labeled_queries": len(ranks),
        "hit_at_k": statistics.mean(rank is not None for rank in ranks) if ranks else None,
        "mrr_at_k": statistics.mean(1 / rank if rank else 0 for rank in ranks) if ranks else None,
        "median_ms": statistics.median(latencies),
        "p95_ms": latencies[math.ceil(len(latencies) * 0.95) - 1],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path)
    parser.add_argument("--legacy-url", default="http://127.0.0.1:6666")
    parser.add_argument("--embedding-url", default="http://127.0.0.1:6667")
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()
    if not 1 <= args.limit <= 100:
        parser.error("--limit must be between 1 and 100")

    cases = json.loads(args.cases.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        parser.error("cases must be a non-empty JSON array")
    for case in cases:
        if (
            not isinstance(case, dict)
            or not isinstance(case.get("query"), str)
            or not 1 <= len(case["query"].strip()) <= 500
            or not isinstance(case.get("relevant_ids", []), list)
            or not all(isinstance(id_, str) and id_ for id_ in case.get("relevant_ids", []))
        ):
            parser.error("each case requires a non-blank query and optional relevant_ids array")

    def legacy(query):
        return baseline(args.legacy_url, query, args.limit)

    def local(query):
        return post(args.embedding_url, "embedding_search", {"query": query, "limit": args.limit})

    # First query loads the model into the serving process. Track it separately.
    warmup_started = time.perf_counter()
    local(cases[0]["query"].strip())
    warmup_ms = (time.perf_counter() - warmup_started) * 1000

    evaluated = []
    for case in cases:
        query = case["query"].strip()
        ids = case.get("relevant_ids", [])
        evaluated.append({
            "query": query,
            "relevant_ids": ids,
            "legacy": measure(legacy, query, set(ids)),
            "embedding": measure(local, query, set(ids)),
        })
    print(json.dumps({
        "k": args.limit,
        "embedding_warmup_ms": round(warmup_ms, 2),
        "summary": {name: summarize(evaluated, name) for name in ("legacy", "embedding")},
        "queries": evaluated,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
