"""Constructed sentence builder — synthesizes form fields into a factual summary via Gemini."""

import logging

from ..llm.genai_config import get_client
from ..llm.model_fallback import get_active_model
from ..prompts.sentence_builder import SENTENCE_FIELDS, SENTENCE_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)


def _build_field_pairs(form_data: dict) -> str:
    """Format non-empty form fields as 'Label: value' lines."""
    lines: list[str] = []
    for field in SENTENCE_FIELDS:
        val = form_data.get(field["key"], "")
        if val and isinstance(val, str) and val.strip():
            lines.append(f"- {field['label']}: {val.strip()}")
    return "\n".join(lines)


def _naive_concatenation(form_data: dict) -> str:
    """Fallback: join non-empty semantic fields with spaces (current behavior)."""
    parts: list[str] = []
    for field in SENTENCE_FIELDS:
        val = form_data.get(field["key"], "")
        if val and isinstance(val, str) and val.strip():
            parts.append(val.strip())
    return " ".join(parts) if parts else ""


def build_constructed_sentence(form_data: dict) -> str:
    """Generate a concise factual summary sentence from all form fields.

    Uses Gemini with low temperature for near-deterministic output.
    Falls back to naive concatenation on failure.
    """
    field_pairs = _build_field_pairs(form_data)
    if not field_pairs:
        return ""

    try:
        from google.genai import types

        model = get_active_model()
        client = get_client()
        prompt = SENTENCE_PROMPT_TEMPLATE.format(field_pairs=field_pairs)

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=256,
            ),
        )
        text = (response.text or "").strip()
        if text:
            logger.info(f"Constructed sentence generated ({len(text)} chars) using {model}")
            return text
        else:
            logger.warning("Constructed sentence: empty LLM response, falling back")
            return _naive_concatenation(form_data)
    except Exception as e:
        logger.warning(f"Constructed sentence generation failed: {e}, falling back")
        return _naive_concatenation(form_data)
