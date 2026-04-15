"""Provider registry - returns the active LLM provider (Gemini)."""

import logging
from .base import LLMProvider
from .gemini_provider import GeminiProvider

logger = logging.getLogger(__name__)

_provider: LLMProvider | None = None


def get_provider() -> LLMProvider:
    """Return the active LLM provider singleton.

    Does not load the Gemini client — that happens on ``initialize()`` or the
    first ``generate_stream`` so the HTTP server can bind before LLM setup.
    """
    global _provider
    if _provider is None:
        _provider = GeminiProvider()
        logger.info("Using LLM provider: gemini")
    return _provider


def peek_provider() -> LLMProvider | None:
    """Return the provider if it has been created, without instantiating it."""
    return _provider


def reset_provider() -> None:
    """Reset the cached provider (for testing or config reload)."""
    global _provider
    from .genai_config import reset_genai_config
    reset_genai_config()
    _provider = None
