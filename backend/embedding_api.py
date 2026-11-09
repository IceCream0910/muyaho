"""Loopback API for evaluating local EmbeddingGemma image retrieval."""

import asyncio
import logging

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from embedding_index import IndexUnavailable, search

app = FastAPI()
inference_lock = asyncio.Lock()
logger = logging.getLogger(__name__)


class EmbeddingQuery(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=10, ge=1, le=100)


class SearchResult(BaseModel):
    image_id: str
    score: float


@app.post("/embedding_search")
async def embedding_search(request: EmbeddingQuery) -> list[SearchResult]:
    query = request.query.strip()
    if not query:
        raise HTTPException(422, "Query must not be blank")
    if inference_lock.locked():
        raise HTTPException(503, "Embedding inference is busy; try again")
    async with inference_lock:
        try:
            return await asyncio.to_thread(search, query, request.limit)
        except IndexUnavailable as exc:
            logger.warning("Image index unavailable", exc_info=True)
            raise HTTPException(503, str(exc)) from exc
        except Exception as exc:
            logger.exception("Embedding search failed")
            raise HTTPException(503, "Embedding search failed; check the service logs") from exc
