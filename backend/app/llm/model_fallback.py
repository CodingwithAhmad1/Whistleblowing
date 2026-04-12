"""Model fallback chain for automatic quota-exhaustion recovery (in-process only)."""

import logging
from datetime import datetime, timezone

from ..config import settings

logger = logging.getLogger(__name__)

# Priority-ordered fallback chain (when preferred model is exhausted, try next).
MODEL_CHAIN: list[str] = [
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
]

_exhausted_models: set[str] = set()
_exhaustion_day_utc: str | None = None


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _ensure_fresh_day() -> None:
    """Clear exhaustion when the UTC date rolls over."""
    global _exhausted_models, _exhaustion_day_utc
    today = _today_utc()
    if _exhaustion_day_utc != today:
        _exhausted_models = set()
        _exhaustion_day_utc = today


def mark_model_exhausted(model: str) -> None:
    """Mark a model as quota-exhausted for today (this process only). Called on HTTP 429."""
    _ensure_fresh_day()
    _exhausted_models.add(model)
    logger.warning("Model %r marked quota-exhausted for %s (in-process)", model, _exhaustion_day_utc)


def is_model_exhausted(model: str) -> bool:
    """Return True if this process already hit 429 for the model today (UTC)."""
    _ensure_fresh_day()
    return model in _exhausted_models


def get_active_model() -> str:
    """
    Return the first non-exhausted model in the fallback chain.

    Starts from settings.GEMINI_MODEL. If that model is exhausted, walks the
    rest of the chain. If all models are exhausted, returns the last one as a
    best-effort fallback (the caller will receive a 429 and surface the error).
    """
    configured = settings.GEMINI_MODEL

    if configured in MODEL_CHAIN:
        idx = MODEL_CHAIN.index(configured)
        ordered = MODEL_CHAIN[idx:] + MODEL_CHAIN[:idx]
    else:
        ordered = [configured] + MODEL_CHAIN

    for model in ordered:
        if not is_model_exhausted(model):
            if model != configured:
                logger.info(
                    "Model %r exhausted, falling back to %r",
                    configured,
                    model,
                )
            return model

    logger.warning("All models in fallback chain are quota-exhausted; using last resort")
    return ordered[-1]
