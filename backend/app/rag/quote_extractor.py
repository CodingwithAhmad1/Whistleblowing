"""LLM-based extraction of clean policy quotes from raw PDF chunks."""

import logging

from ..prompts.quote_extractor import QUOTE_EXTRACTOR_PROMPT

logger = logging.getLogger(__name__)


def extract_clean_quote(query: str, raw_text: str) -> str | None:
    """Use Gemini to extract a clean policy quote from a raw PDF chunk.

    Returns None if the chunk is mostly noise (NO_QUOTE) or on LLM failure.
    This is a fallback path — the re-ranker now extracts quotes inline.
    """
    try:
        from ..llm.generate import generate_with_fallback

        prompt = QUOTE_EXTRACTOR_PROMPT.format(query=query, raw_text=raw_text)
        result = generate_with_fallback(prompt, temperature=0.1, max_output_tokens=512)

        if not result or result == "NO_QUOTE":
            logger.info("Quote extraction returned no usable quote")
            return None

        logger.info(f"Clean quote extracted ({len(result)} chars from {len(raw_text)} chars raw)")
        return result

    except Exception as e:
        logger.warning(f"Quote extraction failed: {e}")
        return None
