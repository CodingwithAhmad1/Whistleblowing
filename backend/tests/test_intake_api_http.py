"""HTTP smoke tests for intake routes (no browser). Optional live LLM when API key is set."""

import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_intake_gaps_returns_200_and_nonempty_gaps() -> None:
    r = client.get("/api/intake/gaps")
    assert r.status_code == 200
    data = r.json()
    assert "gaps" in data
    gaps = data["gaps"]
    assert isinstance(gaps, list) and len(gaps) >= 1
    for g in gaps:
        assert g.get("id")
        assert g.get("template", "").strip()
        assert "criteria" in g
        assert g["criteria"].get("field")


@pytest.mark.integration
def test_post_intake_analyze_returns_extraction_when_llm_configured() -> None:
    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        pytest.skip("GEMINI_API_KEY or GOOGLE_API_KEY not set")

    body = {
        "q1_text": "I observed a policy violation during the March audit at the main office.",
        "form_data": {
            "general_nature": "Financial irregularity in expense claims.",
            "when_occurred": "March 2025",
            "where_occurred": "Building 1",
            "management_aware": "yes",
            "person_1_first": "Alex",
            "person_1_last": "Rivera",
            "sequence_of_events": "A" * 65,
            "has_supporting_materials": "yes",
            "evidence_description": "Email thread and spreadsheet saved on the share drive.",
        },
    }
    r = client.post("/api/questions/intake/analyze", json=body)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert "extraction" in payload
    assert "gaps" in payload
    assert "follow_up_questions" in payload
    assert "used_defaults" in payload

    ext = payload["extraction"]
    assert isinstance(ext.get("summary"), str)
    assert len(ext["summary"].strip()) > 0, "Summary should be non-empty for this rich form + narrative"
    for key in (
        "dates_mentioned",
        "people_mentioned",
        "locations_mentioned",
        "specific_examples_present",
        "evidence_described",
        "timeline_clear",
        "witnesses_mentioned",
        "prior_reporting_mentioned",
        "impact_described",
        "retaliation_mentioned",
        "allegation_type",
        "length_character_count",
    ):
        assert key in ext, f"Missing extraction key {key!r} (Feed Summary contract)"

    people_blob = " ".join(ext.get("people_mentioned", []))
    assert "Alex" in people_blob and "Rivera" in people_blob, (
        "Form person_1 should merge into people_mentioned for Feed Summary"
    )


def test_post_intake_analyze_422_on_empty_q1() -> None:
    r = client.post("/api/questions/intake/analyze", json={"q1_text": "   "})
    assert r.status_code == 422
