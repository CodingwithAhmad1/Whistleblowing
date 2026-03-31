"""LLM-based re-ranking of policy quote candidates using Gemini."""

import json
import logging

from ..llm.genai_config import get_client
from ..llm.model_fallback import get_active_model
from ..prompts.reranker import RERANKER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

MIN_RELEVANCE_SCORE = 3


def rerank_candidates(query: str, candidates: list[dict]) -> list[dict]:
    """Re-rank policy quote candidates using Gemini LLM relevance scoring.

    Each candidate dict has: {"text": str, "metadata": dict, "similarity": float}.
    Returns candidates sorted by LLM relevance score (descending), filtered by MIN_RELEVANCE_SCORE.
    The top candidate includes a "clean_quote" field extracted by the LLM.
    Returns empty list on LLM failure (fail closed).
    """
    if not candidates:
        return []

    # Build numbered candidate list for the prompt
    numbered = []
    for i, c in enumerate(candidates):
        section = format_section(c["metadata"])
        numbered.append(f"[{i}] ({section}) {c['text'][:500]}")
    numbered_text = "\n\n".join(numbered)

    prompt = RERANKER_PROMPT_TEMPLATE.format(
        query=query,
        numbered_candidates=numbered_text,
    )

    try:
        from google.genai import types

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
        text = (response.text or "").strip()

        # Handle markdown-wrapped JSON (```json ... ```)
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        parsed = json.loads(text)

        # Support both old format (array) and new format (object with scores/best_quote)
        if isinstance(parsed, list):
            scores_list = parsed
            best_quote = None
        elif isinstance(parsed, dict):
            scores_list = parsed.get("scores", [])
            best_quote = parsed.get("best_quote")
            if best_quote and isinstance(best_quote, str):
                best_quote = best_quote.strip() or None
            else:
                best_quote = None
        else:
            logger.warning("Re-ranking: unexpected JSON structure")
            return []

        score_map = {item["index"]: item["score"] for item in scores_list}

        # Annotate copies of candidates with LLM scores
        scored = []
        for i, c in enumerate(candidates):
            copy = dict(c)
            copy["relevance_score"] = score_map.get(i, 0)
            scored.append(copy)

        # Filter and sort by relevance score
        relevant = [c for c in scored if c["relevance_score"] >= MIN_RELEVANCE_SCORE]
        relevant.sort(key=lambda c: c["relevance_score"], reverse=True)

        # Attach clean_quote to the top candidate if available
        if relevant and best_quote:
            relevant[0]["clean_quote"] = best_quote

        logger.info(
            f"Re-ranking: {len(candidates)} candidates → {len(relevant)} relevant "
            f"(scores: {[c['relevance_score'] for c in scored]})"
        )
        return relevant

    except Exception as e:
        logger.warning(f"Re-ranking failed: {e}; returning empty list (fail closed)")
        return []


def format_section(metadata: dict) -> str:
    """Format section info from chunk metadata."""
    section_title = metadata.get("section_title")
    page = metadata.get("page")
    if section_title and page:
        return f"{section_title} — Page {page}"
    elif section_title:
        return section_title
    elif page:
        return f"Page {page}"
    return "Unknown section"
