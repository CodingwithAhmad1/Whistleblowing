"""Q2 processor: generates a short question (e.g. 10 words) from report data via LLM. No fallback."""

import logging
from typing import Any

from ..llm import get_provider, collect_stream
from ..prompts.display_content import DEFAULT_Q2_PROMPT_TEMPLATE, Q2_WORD_LIMIT
from .base import Q2Output
from .report_utils import (
    extract_incident_parts,
    first_line,
    get_stored_prompt_template,
    truncate_to_words,
)

logger = logging.getLogger(__name__)


def _build_q2_prompt(report_data: dict[str, Any]) -> str:
    """Build prompt from template with context and word_limit."""
    parts = extract_incident_parts(report_data)
    context = "\n".join(parts) if parts else "No incident details provided yet."
    template = get_stored_prompt_template("q2PromptTemplate", DEFAULT_Q2_PROMPT_TEMPLATE)
    try:
        return template.format(context=context, word_limit=Q2_WORD_LIMIT)
    except KeyError as e:
        msg = f"Invalid placeholder {e} in Q2 prompt template. Only {{context}} and {{word_limit}} are allowed."
        logger.warning(msg)
        raise ValueError(msg) from e


class Q2Processor:
    """Processor for Full Details Q2. Uses LLM to generate a short question. No fallback."""

    async def process(self, report_data: dict[str, Any]) -> Q2Output:
        """Generate Q2 question using LLM. Raises on failure or no data."""
        parts = extract_incident_parts(report_data)
        if not parts:
            raise ValueError("No incident details provided; Q2 requires report data")
        provider = get_provider()
        prompt = _build_q2_prompt(report_data)
        content = await collect_stream(provider, prompt, max_tokens=64)
        content = truncate_to_words(first_line(content), Q2_WORD_LIMIT + 2)
        if not content:
            raise RuntimeError("Q2 AI returned empty content")
        return {"content": content}

    def get_fallback(self) -> Q2Output:
        """Not used — AI must always generate. Kept for protocol compatibility."""
        raise RuntimeError("Q2 has no fallback; AI must always generate")
