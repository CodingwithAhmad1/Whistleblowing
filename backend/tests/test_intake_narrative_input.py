"""Unit tests for combined intake narrative (no LLM)."""

from app.question_processors.intake_processor import _build_narrative_input


def test_build_narrative_includes_followup_fields():
    """AI follow-up answers must appear in the Layer-1 narrative input."""
    q1 = "Something happened at work."
    fd = {
        "full_details_q2": "I reported it to HR on Monday.",
        "full_details_gap2": "No one else was there.",
        "sequence_of_events": "First A then B.",
        "evidence_description": "An email trail.",
    }
    narrative = _build_narrative_input(q1, fd)
    assert "Something happened" in narrative
    assert "Follow-up answer (AI question 1)" in narrative
    assert "I reported it to HR" in narrative
    assert "Follow-up answer (AI question 2)" in narrative
    assert "No one else" in narrative
    assert "Sequence of events" in narrative
    assert "Evidence described" in narrative


def test_build_narrative_followup_order_before_sequence():
    q1 = "Main."
    fd = {
        "full_details_q2": "Answer1",
        "sequence_of_events": "Seq",
    }
    narrative = _build_narrative_input(q1, fd)
    idx_fq2 = narrative.find("Answer1")
    idx_seq = narrative.find("Seq")
    assert idx_fq2 != -1 and idx_seq != -1 and idx_fq2 < idx_seq
