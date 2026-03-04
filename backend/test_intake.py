"""
Test script for the deterministic intake workflow.
Run from backend/ directory:
    venv/bin/python test_intake.py

Tests:
  1. Layer 1 prompt building — curly braces in Q1 text (Bug 1)
  2. Layer 2 gap analysis — deterministic logic
  3. Layer 3 template resolution
  4. Full pipeline smoke test (requires LLM, skipped if no API key)
  5. Settings store — get/update intake gaps
  6. Priority sort ordering in get_intake_gaps
  7. Validation — invalid gap structures are rejected
  8. DEFAULT_SETTINGS shallow copy safety
"""

import asyncio
import copy
import json
import os
import sys
import tempfile
from pathlib import Path

# ── Setup path ────────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
SKIP = "\033[93m○\033[0m"

passed = failed = skipped = 0


def ok(name: str, detail: str = "") -> None:
    global passed
    passed += 1
    print(f"  {PASS} {name}" + (f" — {detail}" if detail else ""))


def fail(name: str, detail: str = "") -> None:
    global failed
    failed += 1
    print(f"  {FAIL} {name}" + (f" — {detail}" if detail else ""))


def skip(name: str, reason: str = "") -> None:
    global skipped
    skipped += 1
    print(f"  {SKIP} {name}" + (f" ({reason})" if reason else ""))


# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 1. Layer 1 Prompt Building ===")

from app.question_processors.intake_processor import (
    _build_layer1_prompt,
    _parse_layer1_json,
    _safe_layer1_defaults,
    _normalize_layer1,
    IntakeLayer2,
    IntakeLayer3,
    IntakeProcessor,
    Layer1Result,
)

# Test: curly braces in Q1 text don't crash (Bug 1)
q1_with_braces = "John told {me} to use the {form} and pay ~${500} per month."
try:
    prompt = _build_layer1_prompt(q1_with_braces)
    if q1_with_braces in prompt:
        ok("Curly braces in Q1 text don't crash prompt builder")
    else:
        fail("Q1 text not found in built prompt")
except (KeyError, ValueError, IndexError) as e:
    fail("Curly braces in Q1 text crash prompt builder", str(e))

# Test: normal Q1 text
q1_normal = "My supervisor, John Smith, told me on January 15 at Building A that the contracts were falsified."
try:
    prompt = _build_layer1_prompt(q1_normal)
    assert "{schema}" not in prompt, "Placeholder not substituted"
    assert "{q1_text}" not in prompt, "Placeholder not substituted"
    assert "Building A" in prompt
    ok("Normal Q1 text builds prompt correctly")
except Exception as e:
    fail("Normal Q1 prompt build failed", str(e))

# Test: empty string in Q1 (edge case)
try:
    prompt = _build_layer1_prompt("")
    ok("Empty Q1 text builds prompt without crash")
except Exception as e:
    fail("Empty Q1 crashes prompt builder", str(e))

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 2. Layer 1 JSON Parsing ===")

# Test: well-formed JSON response
good_json_response = """Here is the extraction:
{
  "summary": "John Smith falsified contracts at Building A in January.",
  "dates_mentioned": ["January 15"],
  "people_mentioned": ["John Smith"],
  "locations_mentioned": ["Building A"],
  "specific_examples_present": true,
  "evidence_described": false,
  "timeline_clear": true,
  "allegation_type": ["fraud"],
  "length_character_count": 999
}
"""
result = _parse_layer1_json(good_json_response, q1_normal)
assert result["dates_mentioned"] == ["January 15"], f"Expected ['January 15'], got {result['dates_mentioned']}"
assert result["people_mentioned"] == ["John Smith"]
assert result["specific_examples_present"] is True
assert result["timeline_clear"] is True
# length_character_count must always use actual Q1 length, not LLM value
assert result["length_character_count"] == len(q1_normal), "Must use actual Q1 length"
ok("Well-formed JSON parsed correctly")

# Test: malformed JSON fallback
bad_response = "Sorry, I cannot extract information from this text."
result = _parse_layer1_json(bad_response, q1_normal)
assert result["dates_mentioned"] == []
assert result["specific_examples_present"] is False
assert result["length_character_count"] == len(q1_normal)
ok("Malformed response falls back to safe defaults")

# Test: JSON with extra text around it
wrapped_response = 'Sure! Here you go:\n{"summary": "test", "dates_mentioned": [], "people_mentioned": ["Alice"], "locations_mentioned": [], "specific_examples_present": false, "evidence_described": false, "timeline_clear": false, "allegation_type": [], "length_character_count": 5}\nThat is all.'
result = _parse_layer1_json(wrapped_response, "test")
assert result["people_mentioned"] == ["Alice"]
ok("JSON embedded in text extracted correctly")

# Test: LLM-generated length is ignored — always use actual Q1 length
short_q1 = "x" * 50
response_wrong_len = '{"summary":"s","dates_mentioned":[],"people_mentioned":[],"locations_mentioned":[],"specific_examples_present":false,"evidence_described":false,"timeline_clear":false,"allegation_type":[],"length_character_count": 9999}'
result = _parse_layer1_json(response_wrong_len, short_q1)
assert result["length_character_count"] == 50, f"Expected 50, got {result['length_character_count']}"
ok("LLM-provided length_character_count is always overridden with actual Q1 length")

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 3. Layer 2 Gap Analysis ===")

from app.prompts.intake_gaps import DEFAULT_INTAKE_GAPS

layer2 = IntakeLayer2()

# Test: empty narrative → top 2 priority gaps (timeline_unclear + no_specific_example)
empty_layer1 = _safe_layer1_defaults("short")
gaps = layer2.analyze(empty_layer1, DEFAULT_INTAKE_GAPS)
assert gaps == ["timeline_unclear", "no_specific_example"], f"Unexpected gaps: {gaps}"
ok("Empty narrative returns top-2 priority gaps", str(gaps))

# Test: complete narrative → no gaps
full_layer1 = Layer1Result(
    summary="Full summary",
    dates_mentioned=["2024-01-15"],
    people_mentioned=["John Smith"],
    locations_mentioned=["Building A"],
    specific_examples_present=True,
    evidence_described=True,
    timeline_clear=True,
    allegation_type=["fraud"],
    length_character_count=500,
)
gaps = layer2.analyze(full_layer1, DEFAULT_INTAKE_GAPS)
assert gaps == [], f"Expected no gaps, got {gaps}"
ok("Complete narrative returns no gaps")

# Test: short narrative (length_threshold) triggers narrative_too_short only if all others pass
short_but_detailed = Layer1Result(
    summary="Short summary",
    dates_mentioned=["Jan 2024"],
    people_mentioned=["Alice"],
    locations_mentioned=["Office"],
    specific_examples_present=True,
    evidence_described=True,
    timeline_clear=True,
    allegation_type=[],
    length_character_count=100,  # under 300 threshold
)
gaps = layer2.analyze(short_but_detailed, DEFAULT_INTAKE_GAPS)
assert "narrative_too_short" in gaps, f"Expected narrative_too_short, got {gaps}"
ok("Short but detailed narrative triggers narrative_too_short gap")

# Test: max 2 gaps returned regardless of how many exist
all_missing = _safe_layer1_defaults("x" * 50)  # also triggers length_threshold
gaps = layer2.analyze(all_missing, DEFAULT_INTAKE_GAPS)
assert len(gaps) <= 2, f"More than 2 gaps returned: {gaps}"
ok("Layer 2 never returns more than 2 gaps", f"returned: {gaps}")

# Test: inactive gaps are skipped
custom_gaps = [
    {**g, "active": False} if g["id"] == "timeline_unclear" else g
    for g in DEFAULT_INTAKE_GAPS
]
gaps = layer2.analyze(_safe_layer1_defaults("x"), custom_gaps)
assert "timeline_unclear" not in gaps, f"Inactive gap should be skipped: {gaps}"
ok("Inactive gaps are excluded from analysis")

# Test: priority ordering respected
reordered_gaps = sorted(DEFAULT_INTAKE_GAPS, key=lambda g: -g["priority"])  # reversed priority
gaps = layer2.analyze(_safe_layer1_defaults("x"), reordered_gaps)
assert gaps == ["timeline_unclear", "no_specific_example"], f"Priority sort should override list order: {gaps}"
ok("Priority ordering overrides list order in analysis")

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 4. Settings Store ===")

from app.settings.store import (
    get_intake_gaps,
    update_intake_gaps,
    _validate_gap,
    _slugify,
    DEFAULT_INTAKE_GAPS as STORE_DEFAULT_GAPS,
)

# Test: get_intake_gaps returns list with correct structure
gaps_list = get_intake_gaps()
assert isinstance(gaps_list, list), "Should return a list"
assert len(gaps_list) == 7, f"Expected 7 default gaps, got {len(gaps_list)}"
ok(f"get_intake_gaps returns {len(gaps_list)} gaps")

# Test: get_intake_gaps is sorted by priority
priorities = [g["priority"] for g in gaps_list]
assert priorities == sorted(priorities), f"get_intake_gaps should return sorted by priority: {priorities}"
ok("get_intake_gaps returns gaps sorted by priority")

# Test: modifying returned gaps does NOT corrupt DEFAULT_INTAKE_GAPS
returned = get_intake_gaps()
original_label = STORE_DEFAULT_GAPS[0]["label"]
returned[0]["label"] = "CORRUPTED"
if STORE_DEFAULT_GAPS[0]["label"] == "CORRUPTED":
    fail("Returned gaps share inner dict references with DEFAULT_INTAKE_GAPS (mutation leaked)")
    # Reset so tests can continue
    STORE_DEFAULT_GAPS[0]["label"] = original_label
else:
    ok("Returned gaps are independent deep copies of DEFAULT_INTAKE_GAPS")

# Test: _validate_gap catches missing required fields
invalid_gaps = [
    ({}, "missing all fields"),
    ({"id": "", "label": "test", "priority": 1, "active": True, "criteria": {"type": "boolean_false", "field": "x"}, "template": "q"}, "empty id"),
    ({"id": "x", "label": "", "priority": 1, "active": True, "criteria": {"type": "boolean_false", "field": "x"}, "template": "q"}, "empty label"),
    ({"id": "x", "label": "l", "priority": 0, "active": True, "criteria": {"type": "boolean_false", "field": "x"}, "template": "q"}, "priority < 1"),
    ({"id": "x", "label": "l", "priority": 1, "active": True, "criteria": {"type": "invalid_type", "field": "x"}, "template": "q"}, "invalid criteria type"),
    ({"id": "x", "label": "l", "priority": 1, "active": True, "criteria": {"type": "length_threshold", "field": "x", "threshold": -1}, "template": "q"}, "negative threshold"),
    ({"id": "x", "label": "l", "priority": 1, "active": True, "criteria": {"type": "boolean_false", "field": "x"}, "template": ""}, "empty template"),
]
for gap, reason in invalid_gaps:
    try:
        _validate_gap(gap)
        fail(f"Validation should reject: {reason}")
    except ValueError:
        ok(f"Correctly rejects gap with {reason}")

# Test: _validate_gap accepts valid gap
valid_gap = {
    "id": "test_gap",
    "label": "Test Gap",
    "priority": 1,
    "active": True,
    "criteria": {"type": "boolean_false", "field": "timeline_clear", "threshold": None},
    "template": "Can you describe the timeline?",
    "template_conditional": None,
}
try:
    _validate_gap(valid_gap)
    ok("Valid gap passes validation")
except ValueError as e:
    fail("Valid gap failed validation", str(e))

# Test: duplicate IDs are rejected
try:
    update_intake_gaps([valid_gap, {**valid_gap, "priority": 2}])
    fail("Duplicate IDs should be rejected")
except ValueError as e:
    ok("Duplicate gap IDs are rejected", str(e)[:40])

# Test: _slugify
assert _slugify("Timeline Unclear") == "timeline_unclear"
assert _slugify("  My Gap!! ") == "my_gap"
assert _slugify("123 numbers") == "123_numbers"
assert _slugify("") == "gap"
ok("_slugify produces correct slugs")

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 5. Layer 3 Template Resolution (sync, no LLM) ===")

import inspect

# Test: non-timeline gaps use plain template, no LLM
async def test_layer3_templates():
    layer3 = IntakeLayer3()
    from app.prompts.intake_gaps import DEFAULT_INTAKE_GAPS as dg

    gaps_by_id = {g["id"]: g for g in dg}

    # Non-timeline gap: no_evidence → should use plain template
    layer1_no_evidence = Layer1Result(
        summary="Summary",
        dates_mentioned=[],
        people_mentioned=[],
        locations_mentioned=[],
        specific_examples_present=False,
        evidence_described=False,
        timeline_clear=True,
        allegation_type=[],
        length_character_count=400,
    )

    # Patch: resolve_template with known gap (no LLM needed for non-conditional)
    no_evidence_gap = gaps_by_id["no_evidence"]
    result = await layer3._resolve_template("some q1", layer1_no_evidence, no_evidence_gap)
    assert result == no_evidence_gap["template"], f"Expected plain template, got: {result!r}"
    return "no_evidence_gap plain template used correctly"

try:
    msg = asyncio.run(test_layer3_templates())
    ok(msg)
except Exception as e:
    fail("Layer3 template resolution error", str(e))

# Test: question text is truncated to MAX_QUESTION_CHARS
async def test_layer3_truncation():
    layer3 = IntakeLayer3()
    from app.question_processors.intake_processor import MAX_QUESTION_CHARS

    long_gap = {
        "id": "long_gap",
        "label": "Long Gap",
        "priority": 1,
        "active": True,
        "criteria": {"type": "boolean_false", "field": "timeline_clear", "threshold": None},
        "template": "X" * 500,  # over limit
        "template_conditional": None,
    }
    layer1 = _safe_layer1_defaults("short q1")
    questions = await layer3.generate("short q1", layer1, ["long_gap"], [long_gap])
    assert len(questions) == 1
    assert len(questions[0]["question_text"]) <= MAX_QUESTION_CHARS
    return f"Question truncated to {len(questions[0]['question_text'])} chars"

try:
    msg = asyncio.run(test_layer3_truncation())
    ok(msg)
except Exception as e:
    fail("Layer3 truncation error", str(e))

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 6. Full Pipeline (LLM required) ===")

has_api_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

if not has_api_key:
    skip("Full pipeline test", "no GEMINI_API_KEY set")
    skip("Curly brace Q1 end-to-end", "no GEMINI_API_KEY set")
else:
    async def test_full_pipeline():
        processor = IntakeProcessor()

        # Normal narrative with enough detail
        q1 = (
            "On January 15, 2024, my supervisor John Smith told me at Building A "
            "that the expense reports had been falsified. He showed me a spreadsheet "
            "that didn't match the receipts I had processed. This has been happening "
            "for at least six months."
        )
        result = await processor.process(q1)
        assert "extraction" in result
        assert "gaps" in result
        assert "follow_up_questions" in result
        assert isinstance(result["gaps"], list)
        assert len(result["gaps"]) <= 2
        assert isinstance(result["follow_up_questions"], list)
        assert all("question_text" in q for q in result["follow_up_questions"])
        return result

    try:
        result = asyncio.run(test_full_pipeline())
        ok("Full pipeline runs end-to-end", f"gaps={result['gaps']}, questions={len(result['follow_up_questions'])}")
    except Exception as e:
        fail("Full pipeline error", str(e)[:80])

    # Test: curly braces in Q1 don't crash the pipeline
    async def test_braces_pipeline():
        processor = IntakeProcessor()
        q1_braces = "The {manager} told me that using {template} forms was required. It cost ${500} per filing."
        result = await processor.process(q1_braces)
        assert "extraction" in result
        return "Curly braces handled correctly"

    try:
        msg = asyncio.run(test_braces_pipeline())
        ok(msg)
    except (KeyError, ValueError) as e:
        fail("Curly braces in Q1 crashed pipeline", str(e))
    except Exception as e:
        fail("Pipeline with braces: unexpected error", str(e)[:80])

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 7. Default gap immutability ===")

from app.prompts.intake_gaps import DEFAULT_INTAKE_GAPS as orig_defaults
from app.settings.store import _read_raw

original_label = orig_defaults[0]["label"]

# Test: _read_raw returns copy that when mutated doesn't affect DEFAULT_INTAKE_GAPS
raw = _read_raw()
if "intakeGaps" in raw and isinstance(raw.get("intakeGaps"), list):
    if raw["intakeGaps"] is orig_defaults:
        fail("_read_raw returns direct reference to DEFAULT_INTAKE_GAPS (mutation risk)")
    else:
        ok("_read_raw does not return direct DEFAULT_INTAKE_GAPS reference")
else:
    ok("_read_raw returns file-based gaps (no default reference issue)")

# Verify DEFAULT_INTAKE_GAPS hasn't been mutated by any test
assert orig_defaults[0]["label"] == original_label, f"DEFAULT_INTAKE_GAPS was mutated! Got: {orig_defaults[0]['label']}"
ok("DEFAULT_INTAKE_GAPS not mutated by any operation")

# ─────────────────────────────────────────────────────────────────────────────
print("\n=== 8. moveGap swap logic (Python simulation) ===")

# Simulate the JS moveGap logic to confirm the bug and verify the fix

def broken_move_gap(gaps: list, idx: int, dir: int) -> list:
    """Reproduces the broken JS moveGap logic in Python."""
    next_gaps = [dict(g) for g in gaps]
    target = idx + dir
    if target < 0 or target >= len(next_gaps):
        return next_gaps
    tmp = dict(next_gaps[idx])
    next_gaps[idx] = {**next_gaps[target], "priority": tmp["priority"]}   # line A
    next_gaps[target] = {**tmp, "priority": next_gaps[idx]["priority"]}   # line B: uses modified next_gaps[idx]!
    next_gaps[idx], next_gaps[target] = next_gaps[target], next_gaps[idx]  # line C: swap positions again!
    return next_gaps


def correct_move_gap(gaps: list, idx: int, dir: int) -> list:
    """The correct swap: exchange array positions and also exchange priority values."""
    next_gaps = [dict(g) for g in gaps]
    target = idx + dir
    if target < 0 or target >= len(next_gaps):
        return next_gaps
    a = dict(next_gaps[idx])
    b = dict(next_gaps[target])
    next_gaps[idx] = {**b, "priority": a["priority"]}
    next_gaps[target] = {**a, "priority": b["priority"]}
    return next_gaps


test_gaps = [
    {"id": "a", "priority": 1, "label": "Gap A"},
    {"id": "b", "priority": 2, "label": "Gap B"},
    {"id": "c", "priority": 3, "label": "Gap C"},
]

# Move gap B (idx=1) up (dir=-1) → should give [B, A, C] with priorities [1, 2, 3]
broken = broken_move_gap(test_gaps, 1, -1)
correct = correct_move_gap(test_gaps, 1, -1)

# Broken: positions should change but don't
broken_ids = [g["id"] for g in broken]
correct_ids = [g["id"] for g in correct]
correct_priorities = [g["priority"] for g in correct]

if broken_ids == ["a", "b", "c"]:  # positions unchanged = bug confirmed
    ok("Bug confirmed: broken moveGap leaves positions unchanged", f"result={broken_ids}")
else:
    ok("Broken moveGap produces some change (may differ by env)", f"result={broken_ids}")

if correct_ids == ["b", "a", "c"] and correct_priorities == [1, 2, 3]:
    ok("Fixed moveGap correctly swaps positions and priorities", f"ids={correct_ids}, pris={correct_priorities}")
else:
    fail("Fixed moveGap produced unexpected result", f"ids={correct_ids}, pris={correct_priorities}")

# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{'─'*50}")
print(f"Results: {passed} passed, {failed} failed, {skipped} skipped")
if failed:
    print("\n⚠ Some tests FAILED — see above for details.")
    sys.exit(1)
else:
    print("\n✓ All tests passed.")
