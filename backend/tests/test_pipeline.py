"""Integration tests for the AI pipeline.

These tests require a live Gemini API key and ChromaDB data.
Run with: cd backend && python -m pytest tests/test_pipeline.py -v
"""

import asyncio
import pytest

from app.testing.fixtures import TEST_FIXTURES
from app.testing.pipeline_runner import run_pipeline_test

# Mark all tests in this module as integration tests
pytestmark = pytest.mark.integration


# ── Module-scoped results cache (run each fixture only once) ─────────────────

@pytest.fixture(scope="module")
def pipeline_results():
    """Run all fixtures once and cache the results."""
    results = {}
    for f in TEST_FIXTURES:
        results[f["id"]] = asyncio.run(run_pipeline_test(f))
    return results


def _get_fixture_and_expected(fixture_id: str):
    """Helper to look up fixture expected config."""
    for f in TEST_FIXTURES:
        if f["id"] == fixture_id:
            return f.get("expected", {})
    return {}


# ── Parameterized fixture for per-fixture tests ─────────────────────────────

FIXTURE_IDS = [f["id"] for f in TEST_FIXTURES]


@pytest.fixture(params=FIXTURE_IDS)
def fixture_id(request):
    return request.param


# ── Tests ────────────────────────────────────────────────────────────────────

def test_pipeline_completes(pipeline_results, fixture_id):
    """Pipeline completes within 30s for each fixture."""
    result = pipeline_results[fixture_id]
    assert result["fixture_id"] == fixture_id
    assert result["total_time_ms"] < 30_000, (
        f"Pipeline exceeded 30s timeout ({result['total_time_ms']}ms)"
    )


def test_intake_extraction(pipeline_results, fixture_id):
    """Layer 1 extraction meets expected outcome."""
    result = pipeline_results[fixture_id]
    step = result["steps"]["intake_layer1_extraction"]
    expected = _get_fixture_and_expected(fixture_id).get("intake_layer1_extraction", {})

    if expected.get("should_pass"):
        assert step["status"] == "pass", f"Extraction failed: {step['error']}"
        assert isinstance(step["result"], dict), "Extraction result should be a dict"
    elif expected.get("should_pass") is False:
        assert step["status"] != "pass", "Expected extraction to fail but it passed"


def test_gap_analysis(pipeline_results, fixture_id):
    """Layer 2 gap analysis meets expected outcome."""
    result = pipeline_results[fixture_id]
    step = result["steps"]["intake_layer2_gaps"]
    expected = _get_fixture_and_expected(fixture_id).get("intake_layer2_gaps", {})

    if expected.get("should_pass"):
        assert step["status"] == "pass", f"Gap analysis failed: {step['error']}"

    if "min_gaps" in expected and step["status"] == "pass":
        assert len(step["result"]) >= expected["min_gaps"], (
            f"Expected >= {expected['min_gaps']} gaps, got {len(step['result'])}"
        )

    if "max_gaps" in expected and step["status"] == "pass":
        assert len(step["result"]) <= expected["max_gaps"], (
            f"Expected <= {expected['max_gaps']} gaps, got {len(step['result'])}"
        )


def test_question_generation(pipeline_results, fixture_id):
    """Layer 3 question generation meets expected outcome."""
    result = pipeline_results[fixture_id]
    step = result["steps"]["intake_layer3_questions"]
    expected = _get_fixture_and_expected(fixture_id).get("intake_layer3_questions", {})

    if expected.get("should_pass"):
        assert step["status"] == "pass", f"Question generation failed: {step['error']}"
        assert isinstance(step["result"], list), "Questions result should be a list"


def test_constructed_sentence(pipeline_results, fixture_id):
    """Constructed sentence meets expected outcome."""
    result = pipeline_results[fixture_id]
    step = result["steps"]["constructed_sentence"]
    expected = _get_fixture_and_expected(fixture_id).get("constructed_sentence", {})

    if expected.get("should_pass"):
        assert step["status"] == "pass", f"Sentence builder failed: {step['error']}"
        assert isinstance(step["result"], str) and len(step["result"]) > 0, (
            "Expected non-empty constructed sentence"
        )

    if "min_length" in expected and step["status"] == "pass" and step["result"]:
        assert len(step["result"]) >= expected["min_length"], (
            f"Sentence length {len(step['result'])} < expected min {expected['min_length']}"
        )


def test_rag_retrieval(pipeline_results, fixture_id):
    """RAG retrieval + reranking meets expected outcome."""
    result = pipeline_results[fixture_id]
    step = result["steps"]["rag_retrieval"]
    expected = _get_fixture_and_expected(fixture_id).get("rag_retrieval", {})

    if expected.get("should_pass"):
        assert step["status"] == "pass", f"RAG retrieval failed: {step['error']}"

    if expected.get("must_have_quote") and step["status"] == "pass":
        assert step["result"] is not None, "Expected a RAG result but got None"
        assert "quote" in step["result"], "Expected result to contain 'quote'"


def test_no_violations(pipeline_results, fixture_id):
    """No validation violations in any step."""
    result = pipeline_results[fixture_id]
    for step_name, step_data in result["steps"].items():
        violations = step_data.get("violations", [])
        assert not violations, (
            f"{step_name} has violations: {violations}"
        )


def test_result_structure(pipeline_results, fixture_id):
    """Result has the expected structure with all 5 steps."""
    result = pipeline_results[fixture_id]
    assert "fixture_id" in result
    assert "fixture_label" in result
    assert "timestamp" in result
    assert "overall_status" in result
    assert result["overall_status"] in ("pass", "fail", "partial")
    assert "total_time_ms" in result
    assert "steps" in result

    expected_steps = {
        "intake_layer1_extraction",
        "intake_layer2_gaps",
        "intake_layer3_questions",
        "constructed_sentence",
        "rag_retrieval",
    }
    assert set(result["steps"].keys()) == expected_steps

    for step_data in result["steps"].values():
        assert "status" in step_data
        assert step_data["status"] in ("pass", "fail", "skip")
        assert "time_ms" in step_data
        assert "violations" in step_data
