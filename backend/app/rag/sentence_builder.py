"""Constructed sentence builder — synthesizes form fields into a factual summary via Gemini."""

import logging

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


_FALLBACK_KEYS = ("full_details_q1", "full_details_q2", "general_nature", "where_occurred")
_MAX_FALLBACK_CHARS = 500


def _naive_concatenation(form_data: dict) -> str:
    """Fallback: join the most semantically useful fields, capped for embedding quality."""
    parts: list[str] = []
    for key in _FALLBACK_KEYS:
        val = form_data.get(key, "")
        if val and isinstance(val, str) and val.strip():
            parts.append(val.strip())
    result = " ".join(parts) if parts else ""
    if len(result) > _MAX_FALLBACK_CHARS:
        # Truncate at word boundary
        result = result[:_MAX_FALLBACK_CHARS].rsplit(" ", 1)[0]
    return result


def build_constructed_sentence(form_data: dict) -> str:
    """Generate a concise factual summary sentence from all form fields.

    Uses Gemini with low temperature for near-deterministic output.
    Falls back to naive concatenation on failure.
    """
    field_pairs = _build_field_pairs(form_data)
    if not field_pairs:
        return ""

    try:
        from ..llm.generate import generate_with_fallback

        prompt = SENTENCE_PROMPT_TEMPLATE.format(field_pairs=field_pairs)
        text = generate_with_fallback(prompt, temperature=0.2, max_output_tokens=256)
        if text:
            logger.info(f"Constructed sentence generated ({len(text)} chars)")
            return text
        else:
            logger.warning("Constructed sentence: empty LLM response, falling back")
            return _naive_concatenation(form_data)
    except Exception as e:
        logger.warning(f"Constructed sentence generation failed: {e}, falling back")
        return _naive_concatenation(form_data)
