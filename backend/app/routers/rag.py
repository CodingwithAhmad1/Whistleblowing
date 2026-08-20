"""RAG endpoints for policy quote retrieval and constructed sentence generation."""

import logging
from fastapi import APIRouter
from pydantic import BaseModel

from ..rag.coverage import CoverageResult, classify_coverage
from ..rag.service import RetrievalUnavailable, get_policy_rag_service
from ..rag.sentence_builder import build_constructed_sentence

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["rag"])


# ── Request / Response models ────────────────────────────────────────────────


class PolicyQuoteRequest(BaseModel):
    form_data: dict
    constructed_sentence: str | None = None


class PolicyQuoteResponse(BaseModel):
    quote: str | None = None
    section: str | None = None
    similarity: float | None = None
    relevance_score: int | None = None
    # Model-authored text, rendered visually separate from the verbatim quote.
    interpretation: str | None = None
    error: str | None = None


class CoverageRequest(BaseModel):
    form_data: dict
    constructed_sentence: str | None = None


class CoverageResponse(BaseModel):
    coverage: CoverageResult | None = None
    error: str | None = None


class ConstructSentenceRequest(BaseModel):
    form_data: dict


class ConstructSentenceResponse(BaseModel):
    sentence: str
    error: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/construct-sentence", response_model=ConstructSentenceResponse)
def construct_sentence(req: ConstructSentenceRequest):
    """Generate a constructed sentence from form data using Gemini LLM."""
    try:
        sentence = build_constructed_sentence(req.form_data)
        if not sentence:
            return ConstructSentenceResponse(sentence="", error="no_form_data")
        return ConstructSentenceResponse(sentence=sentence)
    except Exception as e:
        logger.error(f"Construct sentence endpoint failed: {e}")
        return ConstructSentenceResponse(sentence="", error=str(e))


def _resolve_query_text(form_data: dict, constructed_sentence: str | None) -> str | None:
    """Constructed sentence if provided, else naive concatenation of semantic fields."""
    if constructed_sentence and constructed_sentence.strip():
        return constructed_sentence.strip()
    parts = []
    for key in ("full_details_q1", "full_details_q2", "general_nature", "where_occurred"):
        val = form_data.get(key, "")
        if val and isinstance(val, str) and val.strip():
            parts.append(val.strip())
    return " ".join(parts) if parts else None


@router.post("/policy-quote", response_model=PolicyQuoteResponse)
def get_policy_quote(req: PolicyQuoteRequest):
    """Retrieve the most relevant policy quote for the given form data.

    If `constructed_sentence` is provided, uses it as the query.
    Otherwise falls back to naive concatenation of semantic fields.
    """
    query_text = _resolve_query_text(req.form_data, req.constructed_sentence)
    if not query_text:
        return PolicyQuoteResponse(error="no_query_text")

    logger.info(
        f"policy-quote: has_constructed_sentence={bool(req.constructed_sentence)}, "
        f"query_text={query_text[:120]!r}"
    )

    service = get_policy_rag_service()
    try:
        result = service.query(query_text)
    except RetrievalUnavailable as e:
        # Same non-fatal contract for the reporter flow, but logged distinctly:
        # this is an outage, not "no relevant policy exists".
        logger.warning("policy-quote unavailable: %s", e)
        return PolicyQuoteResponse(error="policy_unavailable")

    if result is None:
        logger.info("policy-quote result: no relevant policy found")
        return PolicyQuoteResponse(error="policy_unavailable")

    logger.info(
        f"policy-quote result: section={result['section']!r}, "
        f"score={result.get('relevance_score')}, sim={result.get('similarity', 0):.3f}"
    )
    return PolicyQuoteResponse(
        quote=result["quote"],
        section=result["section"],
        similarity=result.get("similarity"),
        relevance_score=result.get("relevance_score"),
        interpretation=result.get("interpretation"),
    )


@router.post("/coverage", response_model=CoverageResponse)
def get_coverage(req: CoverageRequest):
    """Classify dual-corpus coverage of the described conduct.

    Returns covered / legal_only / policy_only / uncovered with the best pinned
    excerpt per corpus. Absence of a match is attributed to the index, never
    to the conduct (see absence_notices).
    """
    query_text = _resolve_query_text(req.form_data, req.constructed_sentence)
    if not query_text:
        return CoverageResponse(error="no_query_text")

    try:
        return CoverageResponse(coverage=classify_coverage(query_text))
    except RetrievalUnavailable as e:
        # Never classify on a degraded pipeline — an outage must not be stored
        # as a coverage conclusion. The submission keeps coverage=null.
        logger.warning("coverage classification unavailable: %s", e)
        return CoverageResponse(error="retrieval_unavailable")
    except Exception as e:
        logger.exception("coverage classification failed")
        return CoverageResponse(error=str(e))
