"""Unit tests for form + Layer1 extraction merge (no LLM)."""

from app.question_processors.extraction_augmentation import (
    augment_extraction_with_form,
    build_fallback_summary,
)
from app.question_processors.intake_processor import Layer1Result


def _base_layer1(**overrides: object) -> Layer1Result:
    d: dict = {
        "summary": "LLM said something.",
        "dates_mentioned": [],
        "people_mentioned": [],
        "locations_mentioned": [],
        "specific_examples_present": False,
        "evidence_described": False,
        "timeline_clear": False,
        "witnesses_mentioned": False,
        "prior_reporting_mentioned": False,
        "impact_described": False,
        "retaliation_mentioned": False,
        "allegation_type": [],
        "length_character_count": 100,
        "_used_defaults": False,
    }
    d.update(overrides)
    return d  # type: ignore[return-value]


def test_fallback_summary_from_form():
    s = build_fallback_summary(
        {
            "general_nature": "Misuse of funds.",
            "when_occurred": "March 2024",
            "where_occurred": "Site A",
            "how_aware": "Email",
        }
    )
    assert "Misuse" in s
    assert "March" in s
    assert "Site A" in s
    assert "Email" in s or "became aware" in s


def test_augment_fills_empty_summary_with_fallback():
    layer1 = _base_layer1(
        summary="",
        _used_defaults=True,
    )
    out = augment_extraction_with_form(
        layer1,
        {
            "general_nature": "Fraud in procurement.",
            "when_occurred": "2023",
        },
    )
    assert out["summary"]
    assert "Fraud" in out["summary"] or "2023" in out["summary"]


def test_merge_dates_and_locations_deduped():
    layer1 = _base_layer1(
        dates_mentioned=["Jan 1"],
        locations_mentioned=["Old place"],
    )
    out = augment_extraction_with_form(
        layer1,
        {
            "when_occurred": "Jan 1",  # duplicate case-insensitive? "Jan 1" same - dedupe
            "incident_location": "Building 9",
            "country": "US",
        },
    )
    assert "Jan 1" in " ".join(out["dates_mentioned"])
    assert any("Building 9" in x for x in out["locations_mentioned"])
    assert any("US" in x for x in out["locations_mentioned"])


def test_people_merged_from_form():
    layer1 = _base_layer1(people_mentioned=["Alice"])
    out = augment_extraction_with_form(
        layer1,
        {
            "person_1_first": "Bob",
            "person_1_last": "Smith",
        },
    )
    joined = " ".join(out["people_mentioned"])
    assert "Alice" in joined
    assert "Bob Smith" in joined


def test_booleans_or_from_form():
    layer1 = _base_layer1(
        timeline_clear=False,
        evidence_described=False,
        specific_examples_present=False,
        prior_reporting_mentioned=False,
    )
    seq = "x" * 65
    out = augment_extraction_with_form(
        layer1,
        {
            "when_occurred": "Monday",
            "has_supporting_materials": "yes",
            "evidence_description": "y" * 25,
            "sequence_of_events": seq,
            "management_aware": "yes",
        },
    )
    assert out["timeline_clear"] is True
    assert out["evidence_described"] is True
    assert out["specific_examples_present"] is True
    assert out["prior_reporting_mentioned"] is True


def test_append_structured_context_when_summary_missing_when_where():
    layer1 = _base_layer1(summary="Only a narrative about behavior.")
    out = augment_extraction_with_form(
        layer1,
        {
            "when_occurred": "Q4 2024",
            "where_occurred": "Lab 2",
        },
    )
    s = out["summary"]
    assert "Structured form context" in s or "Q4" in s
    assert "Lab 2" in s
