"""Public read-only intake configuration (no admin secrets)."""

from fastapi import APIRouter

from ..settings import get_intake_gaps

router = APIRouter()


@router.get("/intake/gaps")
def get_public_intake_gaps():
    """Return current intake gap configurations (ordered by priority)."""
    return {"gaps": get_intake_gaps()}
