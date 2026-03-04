"""Provider registry - returns the active LLM provider based on config."""

import logging
from .base import LLMProvider
from .gemini_provider import GeminiProvider
from .claude_provider import ClaudeProvider
from .ollama_provider import OllamaProvider
from .local_phi import LocalPhiProvider
from ..config import settings

logger = logging.getLogger(__name__)

_provider: LLMProvider | None = None


def get_provider() -> LLMProvider:
    """Get the active LLM provider. Initializes on first call."""
    global _provider
    if _provider is None:
        provider_name = settings.LLM_PROVIDER
        if provider_name == "gemini":
            if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
                raise ValueError(
                    "GEMINI_API_KEY is required when LLM_PROVIDER=gemini. "
                    "Set it in .env or environment."
                )
            _provider = GeminiProvider()
        elif provider_name == "claude":
            if not settings.ANTHROPIC_API_KEY or not settings.ANTHROPIC_API_KEY.strip():
                raise ValueError(
                    "ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude. "
                    "Set it in .env or environment."
                )
            _provider = ClaudeProvider()
        elif provider_name == "ollama":
            _provider = OllamaProvider()
        elif provider_name == "local":
            _provider = LocalPhiProvider()
        else:
            raise ValueError(f"Unknown LLM_PROVIDER: {provider_name}")
        logger.info(f"Using LLM provider: {provider_name}")
    return _provider


def reset_provider() -> None:
    """Reset the cached provider (for testing or config reload)."""
    global _provider
    _provider = None
