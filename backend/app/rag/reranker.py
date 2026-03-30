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
    Falls back to similarity-sorted input on LLM failure.
    """
    if not candidates:
        return []

    if len(candidates) == 1:
        # Single candidate — skip LLM call, but apply stricter similarity check
        if candidates[0].get("similarity", 0) >= 0.5:
            return [dict(candidates[0])]
        return []

    # Build numbered candidate list for the prompt
    numbered = []
    for i, c in enumerate(candidates):
        section = _format_section(c["metadata"])
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
                max_output_tokens=256,
            ),
        )
        text = (response.text or "").strip()

        # Parse JSON scores
        # Handle markdown-wrapped JSON (```json ... ```)
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        scores = json.loads(text)
        score_map = {item["index"]: item["score"] for item in scores}

        # Annotate copies of candidates with LLM scores
        scored = []
        for i, c in enumerate(candidates):
            copy = dict(c)
            copy["relevance_score"] = score_map.get(i, 0)
            scored.append(copy)

        # Filter and sort by relevance score
        relevant = [c for c in scored if c["relevance_score"] >= MIN_RELEVANCE_SCORE]
        relevant.sort(key=lambda c: c["relevance_score"], reverse=True)

        logger.info(
            f"Re-ranking: {len(candidates)} candidates → {len(relevant)} relevant "
            f"(scores: {[c['relevance_score'] for c in scored]})"
        )
        return relevant

    except Exception as e:
        logger.warning(f"Re-ranking failed: {e}, falling back to similarity ordering")
        # Graceful degradation: return copies sorted by embedding similarity
        return sorted([dict(c) for c in candidates], key=lambda c: c["similarity"], reverse=True)


def _format_section(metadata: dict) -> str:
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
