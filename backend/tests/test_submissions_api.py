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
    assert len(data) == 1
    assert data[0]["id"] == 1
