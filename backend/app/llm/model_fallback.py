"""Model fallback chain for automatic quota-exhaustion recovery."""

import logging

from ..config import settings

logger = logging.getLogger(__name__)

# Priority-ordered fallback chain (when preferred model is exhausted, try next).
MODEL_CHAIN: list[str] = [
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
]


def get_active_model() -> str:
    """
    Return the first non-exhausted model in the fallback chain.

    Starts from settings.GEMINI_MODEL. If that model is exhausted, walks the
    rest of the chain. If all models are exhausted, returns the last one as a
    best-effort fallback (the caller will receive a 429 and surface the error).
    """
    from .usage_tracker import get_tracker

    tracker = get_tracker()
    configured = settings.GEMINI_MODEL

    # Build ordered list starting from the configured model
    if configured in MODEL_CHAIN:
        idx = MODEL_CHAIN.index(configured)
        ordered = MODEL_CHAIN[idx:] + MODEL_CHAIN[:idx]
    else:
        # Model set in env is outside the known chain — try it first
        ordered = [configured] + MODEL_CHAIN

    for model in ordered:
        if not tracker.is_exhausted(model):
            if model != configured:
                logger.info(
                    f"Model {configured!r} exhausted, falling back to {model!r}"
                )
            return model

    logger.warning("All models in fallback chain are quota-exhausted; using last resort")
    return ordered[-1]
