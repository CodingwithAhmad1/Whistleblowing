"""Synchronous Gemini generation with the same quota fallback as the streaming path.

The reranker, quote extractor, sentence builder, and amendment generator call
`generate_content` directly; without this wrapper they never mark a 429ing
model exhausted and keep hitting it all day while cheaper models in the chain
sit unused. Mirrors GeminiProvider.generate_stream's rotation.
"""

from __future__ import annotations

import logging
import re
import time

from google.genai import types
from google.genai.errors import ClientError

from .genai_config import get_client
from .model_fallback import get_active_model, mark_model_exhausted

logger = logging.getLogger(__name__)

_RETRY_DELAY_RE = re.compile(r"retry in (\d+(?:\.\d+)?)s", re.IGNORECASE)
_MAX_MINUTE_WAITS_PER_MODEL = 2


def _is_per_minute_quota(error: ClientError) -> bool:
    """A 429 for a per-minute quota recovers in seconds — day-long exhaustion
    marking would needlessly burn through the whole fallback chain."""
    return "PerMinute" in str(error)


def _retry_delay_seconds(error: ClientError) -> float:
    m = _RETRY_DELAY_RE.search(str(error))
    return min(float(m.group(1)) + 1.0, 70.0) if m else 30.0


def generate_with_fallback(
    prompt: str,
    *,
    temperature: float,
    max_output_tokens: int,
) -> str:
    """One non-streaming generation; on 429, mark the model exhausted and retry
    with the next model in the chain. Raises the final error when the whole
    chain is exhausted (callers keep their own fail-closed handling)."""
    client = get_client()
    tried: set[str] = set()
    minute_waits: dict[str, int] = {}

    while True:
        model = get_active_model()
        if model in tried:
            raise RuntimeError(f"All Gemini models quota-exhausted. Tried: {sorted(tried)}")

        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                ),
            )
            return (response.text or "").strip()
        except ClientError as e:
            if e.code == 429 and _is_per_minute_quota(e):
                # Per-minute limit: wait it out and retry the SAME model rather
                # than declaring it dead for the day.
                waits = minute_waits.get(model, 0)
                if waits < _MAX_MINUTE_WAITS_PER_MODEL:
                    minute_waits[model] = waits + 1
                    delay = _retry_delay_seconds(e)
                    logger.warning(
                        "Model %r per-minute quota hit; waiting %.0fs (retry %d/%d)",
                        model, delay, waits + 1, _MAX_MINUTE_WAITS_PER_MODEL,
                    )
                    time.sleep(delay)
                    continue
            # 429 (daily / repeated) = quota exhausted; 404 = model retired.
            # Both mean "this model is unusable today" — rotate the chain.
            if e.code in (429, 404):
                logger.warning(
                    "Model %r unusable (%s), marking exhausted and rotating", model, e.code
                )
                mark_model_exhausted(model)
                tried.add(model)
                continue
            raise
