"""Manages google.genai Client instance with API key from env or settings."""

import logging
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)

_client = None
_last_configured_key: Optional[str] = None


def reset_genai_config() -> None:
    """Clear client state. Use when switching API keys (e.g. in tests)."""
    global _client, _last_configured_key
    _client = None
    _last_configured_key = None


def get_client(api_key: Optional[str] = None):
    """Return configured genai.Client, creating or recreating if key changed.

    Resolution order: explicit arg → admin settings.json apiKey → GEMINI_API_KEY env var.
    """
    global _client, _last_configured_key
    from google import genai
    from ..settings.store import get_settings as _get_settings
    admin_key = _get_settings().get("apiKey") or ""
    resolved = (
        (api_key and api_key.strip())
        or (admin_key and admin_key.strip())
        or (settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
    )
    if not resolved:
        raise ValueError("API key required. Set it in Admin settings or GEMINI_API_KEY in .env.")
    if _client is None or _last_configured_key != resolved:
        _client = genai.Client(api_key=resolved)
        _last_configured_key = resolved
        logger.debug("GenAI client created")
    return _client


def ensure_genai_configured(api_key: Optional[str] = None) -> None:
    """Validate API key and prepare client. Idempotent."""
    get_client(api_key)


def ensure_genai_from_settings() -> None:
    """Configure client using apiKey from settings (or env fallback). Idempotent."""
    get_client()
