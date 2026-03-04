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
        from ..llm.genai_config import ensure_genai_from_settings
        ensure_genai_from_settings()
        self._model = settings.GEMINI_EMBEDDING_MODEL
        logger.info(f"Embedding service initialized (model: {self._model})")

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text. Returns vector of floats."""
        self._ensure_initialized()
        from ..llm.genai_config import get_client
        client = get_client()
        result = client.models.embed_content(
            model=self._model,
            contents=text,
        )
        return result.embeddings[0].values

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple documents."""
        return [self.embed_text(t) for t in texts]


def get_embedding_service() -> EmbeddingService:
    """Lazy singleton."""
    global _service
    if _service is None:
        _service = EmbeddingService()
    return _service
