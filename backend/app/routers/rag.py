"""RAG endpoint for policy quote retrieval."""

import logging
from fastapi import APIRouter
from pydantic import BaseModel

from ..rag.service import get_policy_rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["rag"])


class PolicyQuoteRequest(BaseModel):
    form_data: dict


class PolicyQuoteResponse(BaseModel):
    quote: str | None = None
    section: str | None = None
    error: str | None = None


@router.post("/policy-quote", response_model=PolicyQuoteResponse)
async def get_policy_quote(req: PolicyQuoteRequest):
    """Retrieve the most relevant policy quote for the given form data."""
    # Build query from semantic fields
    parts = []
    for key in ("full_details_q1", "full_details_q2", "general_nature", "where_occurred"):
        val = req.form_data.get(key, "")
        if val and isinstance(val, str) and val.strip():
            parts.append(val.strip())

    if not parts:
        return PolicyQuoteResponse(error="no_query_text")

    query_text = " ".join(parts)
    service = get_policy_rag_service()
    result = service.query(query_text)

    if result is None:
        return PolicyQuoteResponse(error="policy_unavailable")

    return PolicyQuoteResponse(quote=result["quote"], section=result["section"])
