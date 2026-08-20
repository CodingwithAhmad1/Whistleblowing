"""Embedding service using Gemini text-embedding model."""

import logging
import math
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)

_service: Optional["EmbeddingService"] = None

# Gemini embedding batch limit is 100; stay well under it.
_BATCH_SIZE = 25


def _normalize(vector: list[float]) -> list[float]:
    """L2-normalize a vector. gemini-embedding-001 outputs are only guaranteed
    normalized at 3072 dims; smaller output_dimensionality values are not."""
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


class EmbeddingService:
    """Produces embeddings via Gemini embedding model. Lazy init."""

    def __init__(self):
        self._model = None

    def _ensure_initialized(self) -> None:
        if self._model is not None:
            return
        from ..llm.genai_config import ensure_genai_from_settings
        ensure_genai_from_settings()
        self._model = settings.GEMINI_EMBEDDING_MODEL
        logger.info(f"Embedding service initialized (model: {self._model})")

    def _embed_batch(self, texts: list[str], task_type: str) -> list[list[float]]:
        self._ensure_initialized()
        from google.genai import types
        from ..llm.genai_config import get_client
        client = get_client()
        result = client.models.embed_content(
            model=self._model,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=settings.EMBEDDING_DIMENSIONS,
            ),
        )
        vectors = [e.values for e in result.embeddings]
        if settings.EMBEDDING_DIMENSIONS != 3072:
            vectors = [_normalize(v) for v in vectors]
        return vectors

    def embed_text(self, text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
        """Embed a single text (a query by default). Returns vector of floats."""
        return self._embed_batch([text], task_type)[0]

    def embed_documents(
        self, texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT"
    ) -> list[list[float]]:
        """Embed multiple documents, batched."""
        vectors: list[list[float]] = []
        for start in range(0, len(texts), _BATCH_SIZE):
            vectors.extend(self._embed_batch(texts[start : start + _BATCH_SIZE], task_type))
        return vectors


def get_embedding_service() -> EmbeddingService:
    """Lazy singleton."""
    global _service
    if _service is None:
        _service = EmbeddingService()
    return _service
