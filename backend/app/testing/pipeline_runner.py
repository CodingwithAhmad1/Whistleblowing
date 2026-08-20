"""AI pipeline test runner — runs 5-step sequential test against a fixture."""

import logging
import time
from datetime import datetime, timezone

from ..rag.sentence_builder import build_constructed_sentence
from ..question_processors.intake_processor import IntakeProcessor
from ..rag.service import get_policy_rag_service
from ..settings import get_intake_gaps

logger = logging.getLogger(__name__)

_intake_processor = IntakeProcessor()


def _run_step(step_name: str, fn):
    """Run a step function, capturing timing and errors."""
    t0 = time.monotonic()
    try:
        result = fn()
        elapsed = round((time.monotonic() - t0) * 1000)
        return {"status": "pass", "result": result, "time_ms": elapsed, "error": None}
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000)
        logger.warning(f"Pipeline test step '{step_name}' failed: {e}")
        return {"status": "fail", "result": None, "time_ms": elapsed, "error": str(e)}


async def _run_step_async(step_name: str, coro):
    """Run an async step, capturing timing and errors."""
    t0 = time.monotonic()
    try:
        result = await coro
        elapsed = round((time.monotonic() - t0) * 1000)
        return {"status": "pass", "result": result, "time_ms": elapsed, "error": None}
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000)
        logger.warning(f"Pipeline test step '{step_name}' failed: {e}")
        return {"status": "fail", "result": None, "time_ms": elapsed, "error": str(e)}


def _skip_step(reason: str = "Skipped due to prior step failure"):
    """Return a skip result."""
    return {"status": "skip", "result": None, "time_ms": 0, "error": reason}


def _validate_step(step_name: str, step_result: dict, expected: dict | None) -> list[str]:
    """Validate a step result against expected outcomes. Returns list of violation messages."""
    if expected is None:
        return []
    exp = expected.get(step_name)
    if not exp:
        return []

    violations: list[str] = []

    if "should_pass" in exp:
        if exp["should_pass"] and step_result["status"] != "pass":
            violations.append(f"Expected pass but got {step_result['status']}")
        elif not exp["should_pass"] and step_result["status"] == "pass":
            violations.append(f"Expected failure but step passed")

    result = step_result.get("result")

    if result and "min_length" in exp:
        if isinstance(result, str) and len(result) < exp["min_length"]:
            violations.append(f"Result length {len(result)} < expected min {exp['min_length']}")

    if "max_gaps" in exp and isinstance(result, list):
        if len(result) > exp["max_gaps"]:
            violations.append(f"Gap count {len(result)} > expected max {exp['max_gaps']}")

    if "min_gaps" in exp and isinstance(result, list):
        if len(result) < exp["min_gaps"]:
            violations.append(f"Gap count {len(result)} < expected min {exp['min_gaps']}")

    if exp.get("must_have_quote") and step_result["status"] == "pass":
        if result is None or (isinstance(result, dict) and not result.get("quote")):
            violations.append("Expected a policy quote but none was returned")

    if "expected_classification" in exp and step_result["status"] == "pass":
        got = (result or {}).get("classification") if isinstance(result, dict) else None
        if got != exp["expected_classification"]:
            violations.append(
                f"Coverage classified as {got!r}, expected {exp['expected_classification']!r}"
            )

    return violations


async def run_pipeline_test(fixture: dict) -> dict:
    """Run the full 5-step AI pipeline test for a single fixture.

    Steps:
      1. intake_layer1_extraction — LLM extracts structured JSON from Q1
      2. intake_layer2_gaps — Deterministic gap analysis on Layer 1 output
      3. intake_layer3_questions — Template-based question generation from gaps
      4. constructed_sentence — Gemini builds factual summary from form fields
      5. rag_retrieval — ChromaDB retrieval + LLM re-ranking

    Returns a structured result dict with per-step details and validation.
    """
    form_data = fixture["form_data"]
    q1_text = form_data.get("full_details_q1", "").strip()
    expected = fixture.get("expected")
    t_total = time.monotonic()
    gaps_config = get_intake_gaps()

    # Step 1: Intake Layer 1 — Extraction
    if q1_text:
        step1 = await _run_step_async(
            "intake_layer1_extraction",
            _intake_processor._layer1.extract(q1_text, form_data),
        )
    else:
        step1 = _skip_step("No Q1 text in fixture")
    extraction = step1["result"] if step1["status"] == "pass" else None
    # Make extraction JSON-serializable
    if extraction is not None:
        step1["result"] = dict(extraction)

    # Step 2: Intake Layer 2 — Gap Analysis
    if extraction:
        step2 = _run_step(
            "intake_layer2_gaps",
            lambda: _intake_processor._layer2.analyze(extraction, gaps_config),
        )
    else:
        step2 = _skip_step("No extraction available from Layer 1")
    identified_gaps = step2["result"] if step2["status"] == "pass" else []

    # Step 3: Intake Layer 3 — Question Generation
    if extraction and identified_gaps:
        step3 = _run_step(
            "intake_layer3_questions",
            lambda: _intake_processor._layer3.generate(identified_gaps, gaps_config),
        )
        # Serialize TypedDicts
        if step3["result"] is not None:
            step3["result"] = [dict(q) for q in step3["result"]]
    elif extraction and not identified_gaps:
        step3 = {"status": "pass", "result": [], "time_ms": 0, "error": None}
    else:
        step3 = _skip_step("No extraction or gaps available")

    # Step 4: Constructed Sentence
    step4 = _run_step("constructed_sentence", lambda: build_constructed_sentence(form_data))
    constructed_sentence = step4["result"] if step4["status"] == "pass" else None

    # Step 5: RAG Retrieval + Reranking
    query = constructed_sentence or q1_text
    if query:
        service = get_policy_rag_service()
        step5 = _run_step("rag_retrieval", lambda: service.query(query))
    else:
        step5 = _skip_step("No query text available")

    # Step 6: Dual-corpus coverage classification
    if query:
        from ..rag.coverage import classify_coverage

        step6 = _run_step(
            "coverage_classification",
            lambda: classify_coverage(query).model_dump(),
        )
    else:
        step6 = _skip_step("No query text available")

    total_ms = round((time.monotonic() - t_total) * 1000)

    # Validate each step against expected outcomes
    steps = {
        "intake_layer1_extraction": step1,
        "intake_layer2_gaps": step2,
        "intake_layer3_questions": step3,
        "constructed_sentence": step4,
        "rag_retrieval": step5,
        "coverage_classification": step6,
    }

    for step_name, step_data in steps.items():
        violations = _validate_step(step_name, step_data, expected)
        step_data["violations"] = violations

    # Determine overall status
    all_steps = list(steps.values())
    has_fail = any(s["status"] == "fail" for s in all_steps)
    has_skip = any(s["status"] == "skip" for s in all_steps)
    has_violations = any(s["violations"] for s in all_steps)

    if has_fail or has_violations:
        overall_status = "fail"
    elif has_skip:
        overall_status = "partial"
    else:
        overall_status = "pass"

    return {
        "fixture_id": fixture["id"],
        "fixture_label": fixture["label"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": overall_status,
        "total_time_ms": total_ms,
        "steps": steps,
    }
