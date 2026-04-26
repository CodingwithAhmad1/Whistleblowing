"""Tests for algorithmic vs model extraction breakdown (no LLM)."""

from app.question_processors.extraction_augmentation import (
    algorithmic_from_form,
    build_extraction_breakdown,
    layer1_to_public_model_slice,
)
from app.question_processors.intake_processor import Layer1Result


def _sample_raw() -> Layer1Result:
    return {
        "summary": "A supervisor made inappropriate comments in the break room Tuesday.",
        "dates_mentioned": ["Tuesday"],
        "people_mentioned": ["Pat Lee"],
        "locations_mentioned": ["break room"],
        "specific_examples_present": True,
        "evidence_described": False,
        "timeline_clear": True,
        "witnesses_mentioned": True,
        "prior_reporting_mentioned": False,
        "impact_described": True,
        "retaliation_mentioned": False,
        "allegation_type": ["Hostile work environment"],
        "length_character_count": 100,
        "_used_defaults": False,
    }


def test_algorithmic_from_form_empty():
    a = algorithmic_from_form(None)
    assert a["dates_mentioned"] == []
    assert a["people_mentioned"] == []
    assert a["locations_mentioned"] == []
    assert a["prior_reporting_mentioned"] is False


def test_algorithmic_from_form_people_and_mgmt():
    fd = {
        "person_1_first": "Jordan",
        "person_1_last": "Blake",
        "when_occurred": "Jan 2026",
        "where_occurred": "Office 4",
        "incident_location": "NY HQ",
        "country": "US",
        "sequence_of_events": "x" * 65,
        "has_supporting_materials": "yes",
        "evidence_description": "x" * 25,
        "management_aware": "yes",
    }
    a = algorithmic_from_form(fd)
    assert "Jordan Blake" in a["people_mentioned"]
    assert "Jan 2026" in a["dates_mentioned"]
    assert a["locations_mentioned"]  # from where/country/incident
    assert a["specific_examples_present"] is True
    assert a["evidence_described"] is True
    assert a["timeline_clear"] is True
    assert a["prior_reporting_mentioned"] is True


def test_layer1_to_public_strips_internal_key():
    raw = _sample_raw()
    pub = layer1_to_public_model_slice(raw)
    assert "_used_defaults" not in pub
    assert pub["used_defaults"] is False
    assert pub["summary"] == raw["summary"]


def test_build_extraction_breakdown_shape():
    raw = _sample_raw()
    form = {
        "person_1_first": "Sam",
        "person_1_last": "R",
        "when_occurred": "March 1",
        "where_occurred": "HQ",
    }
    bd = build_extraction_breakdown(raw, form)
    assert set(bd.keys()) == {"from_answers", "from_model"}
    assert bd["from_model"]["summary"] == raw["summary"]
    assert "Sam R" in bd["from_answers"]["people_mentioned"]
    assert "March 1" in bd["from_answers"]["dates_mentioned"]
