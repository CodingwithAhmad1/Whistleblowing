"""Regression tests for intake JSON extraction, narrative length, and outage semantics."""

from app.question_processors.intake_processor import (
    _extract_json_dict,
    _narrative_length,
)


# ── _extract_json_dict: balanced decode, not greedy regex ────────────────────


def test_plain_json():
    assert _extract_json_dict('{"a": 1}') == {"a": 1}


def test_json_with_trailing_prose_containing_braces():
    raw = '{"summary": "ok"} Note: fields like {this} are placeholders.'
    assert _extract_json_dict(raw) == {"summary": "ok"}


def test_json_with_leading_prose():
    raw = 'Here is the JSON you asked for: {"a": [1, 2]} thanks'
    assert _extract_json_dict(raw) == {"a": [1, 2]}


def test_nested_objects():
    raw = 'x {"outer": {"inner": {"deep": true}}} y'
    assert _extract_json_dict(raw) == {"outer": {"inner": {"deep": True}}}


def test_first_complete_object_wins():
    raw = '{"first": 1} {"second": 2}'
    assert _extract_json_dict(raw) == {"first": 1}


def test_false_start_brace_skipped():
    raw = "{not json} but {\"real\": true} follows"
    assert _extract_json_dict(raw) == {"real": True}


def test_no_json_returns_none():
    assert _extract_json_dict("no braces here") is None
    assert _extract_json_dict("{broken") is None


def test_non_dict_json_returns_none():
    assert _extract_json_dict("[1, 2, 3]") is None


# ── narrative length: reporter text, not prompt blocks ───────────────────────


def test_narrative_length_counts_q1_only():
    assert _narrative_length("abcde", None) == 5


def test_narrative_length_includes_followup_answers():
    fd = {"full_details_q2": "xx", "full_details_gap2": "yyy"}
    assert _narrative_length("abcde", fd) == 10


def test_narrative_length_ignores_structured_fields():
    """Structured metadata must not inflate the measured narrative length."""
    fd = {
        "when_occurred": "January 2026",
        "where_occurred": "A very long location description " * 10,
        "country": "Germany",
        "general_nature": "fraud" * 100,
    }
    assert _narrative_length("short", fd) == 5


# ── outage semantics: extraction failure is not "account complete" ───────────


def test_intake_result_flags_analysis_unavailable():
    import asyncio
    from unittest.mock import AsyncMock, patch

    from app.question_processors.intake_processor import IntakeProcessor, _safe_layer1_defaults

    processor = IntakeProcessor()
    failed = _safe_layer1_defaults("some narrative")
    assert failed["_used_defaults"] is True

    with patch.object(processor._layer1, "extract", new=AsyncMock(return_value=failed)):
        result = asyncio.run(processor.process("some narrative", None))

    assert result["analysis_available"] is False
    assert result["gaps"] == []  # [] + unavailable flag, never [] alone


def test_intake_result_available_on_success():
    import asyncio
    from unittest.mock import AsyncMock, patch

    from app.question_processors.intake_processor import (
        IntakeProcessor,
        _default_inference_partial,
        _default_strict_partial,
        _merge_layer1_passes,
    )

    processor = IntakeProcessor()
    ok = _merge_layer1_passes(
        True, True, _default_strict_partial(), _default_inference_partial(), 100
    )

    with patch.object(processor._layer1, "extract", new=AsyncMock(return_value=ok)):
        result = asyncio.run(processor.process("some narrative", None))

    assert result["analysis_available"] is True
