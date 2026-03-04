"""Q3 processor: generates policy excerpt via LLM. No fallback — AI must always generate."""

import logging
from typing import Any

from ..llm import get_provider, collect_stream
from ..prompts.display_content import FULL_DETAILS_Q3_QUESTION, DEFAULT_Q3_PROMPT_TEMPLATE, Q3_WORD_LIMIT
from .base import Q3Output
from .report_utils import (
    extract_incident_query,
    first_line,
    get_stored_prompt_template,
    truncate_to_words,
)

logger = logging.getLogger(__name__)


def _build_q3_prompt(report_data: dict[str, Any]) -> str:
    """Build prompt from template with context and word_limit."""
    context = extract_incident_query(report_data)
    template = get_stored_prompt_template("q3PromptTemplate", DEFAULT_Q3_PROMPT_TEMPLATE)
    try:
        return template.format(context=context, word_limit=Q3_WORD_LIMIT)
    except KeyError as e:
        msg = f"Invalid placeholder {e} in Q3 prompt template. Only {{context}} and {{word_limit}} are allowed."
        logger.warning(msg)
        raise ValueError(msg) from e


class Q3Processor:
    """Processor for Full Details Q3. Uses LLM to generate policy excerpt. No fallback."""

    async def process(self, report_data: dict[str, Any]) -> Q3Output:
        """Generate policy excerpt using LLM. Raises on failure."""
        provider = get_provider()
        prompt = _build_q3_prompt(report_data)
        excerpt = await collect_stream(provider, prompt, max_tokens=64)
        excerpt = truncate_to_words(first_line(excerpt), Q3_WORD_LIMIT + 2)
        if not excerpt:
            raise RuntimeError("Q3 AI returned empty excerpt")
        return {
            "policyExcerpt": excerpt,
            "question": FULL_DETAILS_Q3_QUESTION,
        }

    def get_fallback(self) -> Q3Output:
        """Not used — AI must always generate. Kept for protocol compatibility."""
        raise RuntimeError("Q3 has no fallback; AI must always generate")
