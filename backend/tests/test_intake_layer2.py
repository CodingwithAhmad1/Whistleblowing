"""Unit tests for deterministic intake Layer 2 (gap selection + suppression)."""

from app.prompts.intake_gaps import DEFAULT_INTAKE_GAPS
from app.question_processors.intake_processor import IntakeLayer2


def _layer1_base(**overrides: object) -> dict:
    d: dict = {
        "summary": "",
        "dates_mentioned": [],
        "people_mentioned": [],
        "locations_mentioned": [],
        "specific_examples_present": True,
        "evidence_described": True,
        "timeline_clear": True,
        "witnesses_mentioned": True,
        "prior_reporting_mentioned": True,
        "impact_described": True,
        "retaliation_mentioned": True,
        "allegation_type": [],
        "length_character_count": 200,
        "_used_defaults": False,
    }
    d.update(overrides)
    return d


def test_suppresses_prior_reporting_when_management_aware_yes():
    l2 = IntakeLayer2()
    layer1 = _layer1_base(prior_reporting_mentioned=False)
    gaps = l2.analyze(
        layer1,
        DEFAULT_INTAKE_GAPS,
        {"management_aware": "yes"},
    )
    assert "no_prior_reporting" not in gaps
    assert gaps == []


def test_suppresses_no_specific_example_when_long_sequence_in_form():
    l2 = IntakeLayer2()
    layer1 = _layer1_base(
        specific_examples_present=False,
    )
    long_seq = "Lorem ipsum d " * 5  # >= 60 chars
    assert len(long_seq.strip()) >= 60
    gaps = l2.analyze(
        layer1,
        DEFAULT_INTAKE_GAPS,
        {"sequence_of_events": long_seq},
    )
    assert "no_specific_example" not in gaps
    assert gaps == []


def test_identifies_prior_reporting_gap_without_suppression_triggers():
    l2 = IntakeLayer2()
    layer1 = _layer1_base(
        specific_examples_present=True,
        prior_reporting_mentioned=False,
    )
    gaps = l2.analyze(layer1, DEFAULT_INTAKE_GAPS, {"management_aware": "no"})
    assert gaps == ["no_prior_reporting"]


def test_used_defaults_skips_all_gap_evaluation():
    l2 = IntakeLayer2()
    layer1 = _layer1_base(
        specific_examples_present=False,
        prior_reporting_mentioned=False,
        _used_defaults=True,
    )
    gaps = l2.analyze(
        layer1,
        DEFAULT_INTAKE_GAPS,
        {"management_aware": "yes", "sequence_of_events": "x" * 200},
    )
    assert gaps == []
