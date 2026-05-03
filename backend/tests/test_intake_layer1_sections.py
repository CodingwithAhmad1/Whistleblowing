"""Lock Layer-1 section labels and ordering used by prompts."""

from app.question_processors.intake_processor import (
    LAYER1_SECTION_ORDER,
    _build_layer1_sections,
)


def test_layer1_section_order_matches_documented_sequence():
    """Headers appear in LAYER1_SECTION_ORDER when each section has content."""
    fd = {
        "general_nature": "Chronology body",
        "sequence_of_events": "Seq body",
        "evidence_description": "Evidence body",
        "full_details_q2": "FU1 body",
        "full_details_gap2": "FU2 body",
        "persons_concealing": "Conceal body",
        "how_aware": "heard_it",
        "how_aware_other": "Via rumor",
        "when_occurred": "Monday",
        "where_occurred": "Office",
        "person_1_first": "A",
        "person_1_last": "B",
        "person_1_title": "Mgr",
    }
    text = _build_layer1_sections("Narrative line.", fd)
    positions: list[tuple[str, int]] = []
    for name in LAYER1_SECTION_ORDER:
        marker = f"[{name}]"
        idx = text.find(marker)
        assert idx != -1, f"missing section {name}"
        positions.append((name, idx))
    for i in range(1, len(positions)):
        assert positions[i][1] > positions[i - 1][1], (
            f"{positions[i][0]} should follow {positions[i - 1][0]}"
        )


def test_build_sections_omits_empty_blocks():
    """No headers for sections with no content."""
    assert "[CHRONOLOGY]" not in _build_layer1_sections("Only narrative.", None)
    assert "[NARRATIVE]" in _build_layer1_sections("Only narrative.", None)
