"""LLM-based re-ranking of policy quote candidates using Gemini."""

import json
import logging

from ..config import settings
from ..prompts.reranker import RERANKER_PROMPT_TEMPLATE
from .verbatim import is_verbatim

logger = logging.getLogger(__name__)


def rerank_candidates(query: str, candidates: list[dict]) -> list[dict] | None:
    """Re-rank policy quote candidates using Gemini LLM relevance scoring.

    Each candidate dict has: {"text": str, "metadata": dict, "similarity": float}.
    Returns candidates sorted by LLM relevance score (descending), filtered by
    settings.RAG_MIN_RELEVANCE_SCORE.  The quoted candidate carries a
    "clean_quote" field, verified verbatim against that candidate's own text.

    Fail-closed semantics distinguish two cases so an LLM outage is never
    mistaken for "nothing relevant":
      []    → the LLM ran and no candidate met the threshold (genuine no-match)
      None  → the LLM call failed (quota, network, bad JSON) — unavailable
    """
    if not candidates:
        return []

    # Build numbered candidate list for the prompt (full text — the model judges
    # and quotes from exactly what the pipeline will later verify against).
    numbered = []
    for i, c in enumerate(candidates):
        section = format_section(c["metadata"])
        numbered.append(f"[{i}] ({section}) {c['text']}")
    numbered_text = "\n\n".join(numbered)

    prompt = RERANKER_PROMPT_TEMPLATE.format(
        query=query,
        numbered_candidates=numbered_text,
    )

    try:
        from ..llm.generate import generate_with_fallback

        text = generate_with_fallback(prompt, temperature=0.1, max_output_tokens=1024)

        # Handle markdown-wrapped JSON (```json ... ```)
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        parsed = json.loads(text)

        # Support legacy format (bare array of scores) and current object format.
        best_quote_text: str | None = None
        best_quote_index: int | None = None
        interpretation: str | None = None
        if isinstance(parsed, list):
            scores_list = parsed
        elif isinstance(parsed, dict):
            scores_list = parsed.get("scores", [])
            interp_val = parsed.get("interpretation")
            if isinstance(interp_val, str) and interp_val.strip():
                interpretation = interp_val.strip()
            best_quote = parsed.get("best_quote")
            if isinstance(best_quote, dict):
                text_val = best_quote.get("text")
                index_val = best_quote.get("index")
                if isinstance(text_val, str) and text_val.strip() and isinstance(index_val, int):
                    best_quote_text = text_val.strip()
                    best_quote_index = index_val
            elif isinstance(best_quote, str) and best_quote.strip():
                # Old prompt format: quote without an index. Only usable if we can
                # attribute it unambiguously — resolved after scoring below.
                best_quote_text = best_quote.strip()
        else:
            logger.warning("Re-ranking: unexpected JSON structure")
            return None

        score_map = {item["index"]: item["score"] for item in scores_list}

        # Annotate copies of candidates with LLM scores and their original index.
        scored = []
        for i, c in enumerate(candidates):
            copy = dict(c)
            copy["candidate_index"] = i
            copy["relevance_score"] = score_map.get(i, 0)
            scored.append(copy)

        # Filter and sort by relevance score
        min_score = settings.RAG_MIN_RELEVANCE_SCORE
        relevant = [c for c in scored if c["relevance_score"] >= min_score]
        relevant.sort(key=lambda c: c["relevance_score"], reverse=True)

        # Attach clean_quote to the candidate it was actually copied from.
        if relevant and best_quote_text:
            if best_quote_index is None:
                # Legacy format: attribute by verbatim match; require exactly one owner.
                owners = [c for c in relevant if is_verbatim(best_quote_text, c["text"])]
                target = owners[0] if len(owners) == 1 else None
            else:
                target = next(
                    (c for c in relevant if c["candidate_index"] == best_quote_index), None
                )
            if target is None:
                logger.warning(
                    "Re-ranking: best_quote index %s not among relevant candidates; discarding quote",
                    best_quote_index,
                )
            elif not is_verbatim(best_quote_text, target["text"]):
                logger.warning(
                    "Re-ranking: best_quote is not verbatim in candidate %s; discarding quote",
                    target["candidate_index"],
                )
            else:
                target["clean_quote"] = best_quote_text
                if interpretation:
                    # Model-authored text: kept in a separate field from the
                    # verbatim quote, rendered visually separate in the UI.
                    target["interpretation"] = interpretation

        logger.info(
            f"Re-ranking: {len(candidates)} candidates → {len(relevant)} relevant "
            f"(scores: {[c['relevance_score'] for c in scored]})"
        )
        return relevant

    except Exception as e:
        logger.warning(f"Re-ranking failed: {e}; unavailable (fail closed)")
        return None


def format_section(metadata: dict) -> str:
    """Format section info from chunk metadata."""
    section_title = metadata.get("section_title")
    page = metadata.get("page")
    article = metadata.get("article")
    if section_title and page:
        return f"{section_title} — Page {page}"
    elif section_title and article:
        return f"{section_title} — {article}"
    elif section_title:
        return section_title
    elif article:
        return str(article)
    elif page:
        return f"Page {page}"
    return "Unknown section"
