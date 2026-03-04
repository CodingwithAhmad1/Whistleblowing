"""Document store interface and in-memory implementation."""

import heapq
import math
from typing import Any, Optional
from dataclasses import dataclass


@dataclass
class SearchResult:
    id: str
    text: str
    metadata: dict[str, Any]
    score: float


class DocumentStore:
    """Abstract document store with vector search."""

    def add_document(self, doc_id: str, text: str, metadata: Optional[dict] = None) -> None:
        """Add a document. Embedding must be computed externally and stored."""
        raise NotImplementedError

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        """Search by embedding. Returns top-k results sorted by relevance."""
        raise NotImplementedError


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class InMemoryDocumentStore(DocumentStore):
    """In-memory document store with cosine similarity. Placeholder for ChromaDB/pgvector."""

    def __init__(self):
        self._docs: list[tuple[str, str, dict, list[float]]] = []

    def add_document(
        self,
        doc_id: str,
        text: str,
        metadata: Optional[dict] = None,
        embedding: Optional[list[float]] = None,
    ) -> None:
        if embedding is None:
            raise ValueError("InMemoryDocumentStore requires embedding when adding")
        self._docs.append((doc_id, text, metadata or {}, embedding))

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[SearchResult]:
        results = (
            SearchResult(id=doc_id, text=text, metadata=meta, score=_cosine_similarity(query_embedding, emb))
            for doc_id, text, meta, emb in self._docs
        )
        return heapq.nlargest(top_k, results, key=lambda r: r.score)
