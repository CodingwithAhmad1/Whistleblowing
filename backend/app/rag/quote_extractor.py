"""LLM-based extraction of clean policy quotes from raw PDF chunks."""

import logging

from ..llm.genai_config import get_client
from ..llm.model_fallback import get_active_model
from ..prompts.quote_extractor import QUOTE_EXTRACTOR_PROMPT

logger = logging.getLogger(__name__)


def extract_clean_quote(query: str, raw_text: str) -> str:
    """Use Gemini to extract a clean policy quote from a raw PDF chunk.

    Falls back to the raw text if LLM extraction fails.
    """
    try:
        from google.genai import types

        prompt = QUOTE_EXTRACTOR_PROMPT.format(query=query, raw_text=raw_text)
        model = get_active_model()
        client = get_client()

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=512,
            ),
        )
        result = (response.text or "").strip()

        if not result or result == "NO_QUOTE":
            logger.info("Quote extraction returned no usable quote, using raw text")
            return raw_text

        logger.info(f"Clean quote extracted ({len(result)} chars from {len(raw_text)} chars raw)")
        return result

    except Exception as e:
        logger.warning(f"Quote extraction failed: {e}, using raw text")
        return raw_text
