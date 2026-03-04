"""Provider registry - returns the active LLM provider (Gemini)."""

import logging
from .base import LLMProvider
from .gemini_provider import GeminiProvider

logger = logging.getLogger(__name__)

_provider: LLMProvider | None = None


def get_provider() -> LLMProvider:
    """Get the active LLM provider. Uses stored apiKey from settings when available."""
    global _provider
    from .genai_config import ensure_genai_from_settings
    ensure_genai_from_settings()
    if _provider is None:
        _provider = GeminiProvider()
        logger.info("Using LLM provider: gemini")
    return _provider


def reset_provider() -> None:
    """Reset the cached provider (for testing or config reload)."""
    global _provider
    from .genai_config import reset_genai_config
    reset_genai_config()
    _provider = None
