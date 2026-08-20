"""CRUD for /api/submissions (file path override for isolation)."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    path = tmp_path / "submissions.json"
    monkeypatch.setenv("REPORTIQ_SUBMISSIONS_PATH", str(path))
    from app.main import app

    return TestClient(app), path


def test_submissions_list_empty(client):
    c, _ = client
    r = c.get("/api/submissions")
    assert r.status_code == 200
    assert r.json() == []


def test_submissions_create_list_delete(client):
    c, p = client
    body = {
        "timestamp": "2026-04-25T12:00:00Z",
        "formData": {"organization_tier": "A", "country": "US", "incident_location": "NY"},
        "extraction": None,
        "gaps": [],
        "followUpQuestions": [],
    }
    r = c.post("/api/submissions", json=body)
    assert r.status_code == 201
    row = r.json()
    assert row["id"] == 1
    assert row["formData"]["country"] == "US"

    r = c.get("/api/submissions")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = c.delete("/api/submissions/1")
    assert r.status_code == 200
    assert c.get("/api/submissions").json() == []


def test_submissions_persists_to_file(client):
    c, p = client
    body = {
        "timestamp": "2026-04-25T12:00:00Z",
        "formData": {"x": "y"},
        "extraction": None,
        "gaps": [],
        "followUpQuestions": [],
    }
    c.post("/api/submissions", json=body)
    data = json.loads(p.read_text(encoding="utf-8"))
    assert data["next_id"] == 2
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == 1


def _minimal_body(ts="2026-04-25T12:00:00Z"):
    return {
        "timestamp": ts,
        "formData": {"x": "y"},
        "extraction": None,
        "gaps": [],
        "followUpQuestions": [],
    }


def test_submission_ids_never_reused_after_delete(client):
    c, _ = client
    r1 = c.post("/api/submissions", json=_minimal_body())
    r2 = c.post("/api/submissions", json=_minimal_body())
    assert (r1.json()["id"], r2.json()["id"]) == (1, 2)

    assert c.delete("/api/submissions/2").status_code == 200
    r3 = c.post("/api/submissions", json=_minimal_body())
    assert r3.json()["id"] == 3  # monotonic; id 2 is never reissued


def test_legacy_bare_list_file_is_readable(client):
    c, p = client
    p.write_text(
        json.dumps([{"id": 7, "timestamp": "2026-01-01T00:00:00Z", "formData": {"a": "b"}}]),
        encoding="utf-8",
    )
    r = c.get("/api/submissions")
    assert r.status_code == 200
    assert r.json()[0]["id"] == 7

    # Next create continues past the legacy max id and migrates the format.
    r2 = c.post("/api/submissions", json=_minimal_body())
    assert r2.json()["id"] == 8
    data = json.loads(p.read_text(encoding="utf-8"))
    assert data["next_id"] == 9
    assert [row["id"] for row in data["items"]] == [7, 8]


def test_coverage_field_round_trips(client):
    c, _ = client
    body = _minimal_body()
    body["coverage"] = {
        "classification": "legal_only",
        "policy_score": 0.31,
        "legal_score": 0.72,
        "refs": {},
    }
    r = c.post("/api/submissions", json=body)
    assert r.status_code == 201
    assert r.json()["coverage"]["classification"] == "legal_only"
    assert c.get("/api/submissions").json()[0]["coverage"]["legal_score"] == 0.72


def test_concurrent_creates_get_distinct_ids(client):
    import threading

    c, _ = client
    ids: list[int] = []
    lock = threading.Lock()

    def create():
        r = c.post("/api/submissions", json=_minimal_body())
        with lock:
            ids.append(r.json()["id"])

    threads = [threading.Thread(target=create) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(ids) == list(range(1, 9))


def test_submissions_roundtrip_extraction_breakdown(client):
    c, _ = client
    bd = {
        "from_answers": {
            "dates_mentioned": ["Jan"],
            "people_mentioned": ["A B"],
            "locations_mentioned": ["HQ"],
            "specific_examples_present": True,
            "evidence_described": False,
            "timeline_clear": True,
            "prior_reporting_mentioned": False,
        },
        "from_model": {
            "summary": "test",
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
            "length_character_count": 0,
            "used_defaults": False,
        },
    }
    body = {
        "timestamp": "2026-04-25T12:00:00Z",
        "formData": {"k": "v"},
        "extraction": {"summary": "m", "dates_mentioned": [], "people_mentioned": [], "locations_mentioned": [], "specific_examples_present": False, "evidence_described": False, "timeline_clear": False, "witnesses_mentioned": False, "prior_reporting_mentioned": False, "impact_described": False, "retaliation_mentioned": False, "allegation_type": [], "length_character_count": 0},
        "extractionBreakdown": bd,
        "gaps": [],
        "followUpQuestions": [],
    }
    r = c.post("/api/submissions", json=body)
    assert r.status_code == 201
    row = r.json()
    assert row["extractionBreakdown"]["from_answers"]["people_mentioned"] == ["A B"]
    r2 = c.get("/api/submissions")
    assert r2.json()[0]["extractionBreakdown"]["from_model"]["summary"] == "test"
