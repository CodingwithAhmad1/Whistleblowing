"""RAG endpoints for policy quote retrieval and constructed sentence generation."""

import logging
from fastapi import APIRouter
from pydantic import BaseModel

from ..rag.service import get_policy_rag_service
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


@router.post("/policy-quote", response_model=PolicyQuoteResponse)
def get_policy_quote(req: PolicyQuoteRequest):
    """Retrieve the most relevant policy quote for the given form data.

    If `constructed_sentence` is provided, uses it as the query.
    Otherwise falls back to naive concatenation of semantic fields.
    """
    # Use constructed sentence if provided, otherwise build query from fields
    if req.constructed_sentence and req.constructed_sentence.strip():
        query_text = req.constructed_sentence.strip()
    else:
        parts = []
        for key in ("full_details_q1", "full_details_q2", "general_nature", "where_occurred"):
            val = req.form_data.get(key, "")
            if val and isinstance(val, str) and val.strip():
                parts.append(val.strip())

        if not parts:
            return PolicyQuoteResponse(error="no_query_text")

        query_text = " ".join(parts)

    logger.info(
        f"policy-quote: has_constructed_sentence={bool(req.constructed_sentence)}, "
        f"query_text={query_text[:120]!r}"
    )

    service = get_policy_rag_service()
    result = service.query(query_text)

    if result is None:
        logger.info("policy-quote result: no relevant policy found")
        return PolicyQuoteResponse(error="policy_unavailable")

    logger.info(
        f"policy-quote result: section={result['section']!r}, "
        f"score={result.get('relevance_score')}, sim={result.get('similarity', 0):.3f}"
    )
    return PolicyQuoteResponse(quote=result["quote"], section=result["section"])
