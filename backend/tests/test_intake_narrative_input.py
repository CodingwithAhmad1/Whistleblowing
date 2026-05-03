"""Unit tests for Layer 1 labeled sections input (no LLM)."""

from app.question_processors.intake_processor import _build_layer1_sections


def test_build_sections_includes_followup_fields():
    """AI follow-up answers must appear as labeled sections."""
    q1 = "Something happened at work."
    fd = {
        "full_details_q2": "I reported it to HR on Monday.",
        "full_details_gap2": "No one else was there.",
        "sequence_of_events": "First A then B.",
        "evidence_description": "An email trail.",
    }
    text = _build_layer1_sections(q1, fd)
    assert "Something happened" in text
    assert "[NARRATIVE]" in text
    assert "[FOLLOW_UP_1]" in text
    assert "I reported it to HR" in text
    assert "[FOLLOW_UP_2]" in text
    assert "No one else" in text
    assert "[SEQUENCE]" in text
    assert "First A then B" in text
    assert "[EVIDENCE_DESCRIPTION]" in text
    assert "email trail" in text


def test_build_sections_sequence_before_followups():
    """Plan order: SEQUENCE block precedes FOLLOW_UP_* blocks."""
    q1 = "Main."
    fd = {
        "full_details_q2": "Answer1",
        "sequence_of_events": "Seq",
    }
    text = _build_layer1_sections(q1, fd)
    idx_seq = text.find("Seq")
    idx_fq2 = text.find("Answer1")
    assert idx_seq != -1 and idx_fq2 != -1 and idx_seq < idx_fq2
