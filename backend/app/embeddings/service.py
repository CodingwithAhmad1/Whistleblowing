"""Embedding service using Gemini text-embedding model."""

import logging
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)

_service: Optional["EmbeddingService"] = None


class EmbeddingService:
    """Produces embeddings via Gemini embedding model. Lazy init."""

    def __init__(self):
        self._model = None

    def _ensure_initialized(self) -> None:
        if self._model is not None:
            return
        api_key = settings.GEMINI_API_KEY
        if not api_key or not api_key.strip():
            raise ValueError("GEMINI_API_KEY required for embeddings")
        import google.generativeai as genai
        genai.configure(api_key=api_key.strip())
        self._model = settings.GEMINI_EMBEDDING_MODEL
        logger.info(f"Embedding service initialized (model: {self._model})")

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text. Returns vector of floats."""
        self._ensure_initialized()
        import google.generativeai as genai
        result = genai.embed_content(
            model=self._model,
            content=text,
            task_type="retrieval_query",
        )
        return result["embedding"]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple documents."""
        return [self.embed_text(t) for t in texts]


def get_embedding_service() -> EmbeddingService:
    """Lazy singleton."""
    global _service
    if _service is None:
        _service = EmbeddingService()
    return _service
