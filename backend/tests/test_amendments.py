"""Tests for Component C: clustering thresholds, diff spans, unanchored rejection,
stores, and the reviewer-gate API."""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest


def _iso(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _submission(sid: int, classification: str, summary: str, days_ago: int = 1) -> dict:
    return {
        "id": sid,
        "timestamp": _iso(days_ago),
        "formData": {},
        "extraction": {
            "summary": summary,
            "allegation_type": ["safety"],
            "evidence_described": True,
            "retaliation_mentioned": False,
            "impact_described": True,
        },
        "coverage": {"classification": classification},
    }


@pytest.fixture(autouse=True)
def isolated_stores(tmp_path, monkeypatch):
    """Point the amendment stores at a temp dir."""
    import app.amendments.store as store_mod

    monkeypatch.setattr(store_mod, "DATA_DIR", tmp_path)
    monkeypatch.setattr(store_mod, "CLUSTERS_FILE", tmp_path / "coverage_clusters.json")
    monkeypatch.setattr(store_mod, "PROPOSALS_FILE", tmp_path / "amendment_proposals.json")
    yield tmp_path


# ── Clustering (C1): evidence gates ──────────────────────────────────────────


def _fake_vectors(mapping: dict[int, list[float]]):
    import numpy as np

    return {k: __import__("numpy").asarray(v, dtype=float) for k, v in mapping.items()}


def test_gather_inputs_filters_class_and_window():
    from app.amendments.clustering import gather_inputs

    subs = [
        _submission(1, "legal_only", "a", days_ago=5),
        _submission(2, "uncovered", "b", days_ago=5),
        _submission(3, "covered", "c", days_ago=5),        # wrong class
        _submission(4, "legal_only", "d", days_ago=200),   # outside window
        {"id": 5, "timestamp": "not-a-date", "coverage": {"classification": "legal_only"}},
    ]
    got = gather_inputs(subs, window_days=90)
    assert [s["id"] for s in got] == [1, 2]


def test_cluster_thresholds_gate_candidates(monkeypatch):
    """Similar reports cluster; the cluster is a candidate only at n_min."""
    from app.amendments import clustering

    monkeypatch.setattr(
        clustering, "get_amendment_config",
        lambda: {"nMin": 2, "simMin": 0.75, "windowDays": 90},
    )
    # Two near-identical vectors + one orthogonal
    vecs = {
        1: [1.0, 0.0, 0.0],
        2: [0.98, 0.2, 0.0],
        3: [0.0, 0.0, 1.0],
    }
    monkeypatch.setattr(clustering, "_embed_schemas", lambda subs: _fake_vectors(vecs))

    subs = [
        _submission(1, "legal_only", "unsafe machine guard removed"),
        _submission(2, "legal_only", "machine guard removed on line 2"),
        _submission(3, "uncovered", "completely unrelated parking issue"),
    ]
    clusters, cfg = clustering.cluster_submissions(subs)
    by_size = sorted(clusters, key=lambda c: len(c["member_submission_ids"]), reverse=True)
    assert by_size[0]["member_submission_ids"] == [1, 2]
    assert by_size[0]["is_candidate"] is True
    assert by_size[1]["member_submission_ids"] == [3]
    assert by_size[1]["is_candidate"] is False  # below nMin


def test_low_similarity_never_merges(monkeypatch):
    from app.amendments import clustering

    monkeypatch.setattr(
        clustering, "get_amendment_config",
        lambda: {"nMin": 2, "simMin": 0.9, "windowDays": 90},
    )
    vecs = {1: [1.0, 0.0], 2: [0.5, 0.86]}  # cosine ≈ 0.5 < 0.9
    monkeypatch.setattr(clustering, "_embed_schemas", lambda subs: _fake_vectors(vecs))
    subs = [_submission(1, "legal_only", "x"), _submission(2, "legal_only", "y")]
    clusters, _ = clustering.cluster_submissions(subs)
    assert all(len(c["member_submission_ids"]) == 1 for c in clusters)
    assert not any(c["is_candidate"] for c in clusters)


def test_schema_text_uses_extraction_not_prose():
    from app.amendments.clustering import schema_text

    s = _submission(1, "legal_only", "guard removed")
    s["formData"] = {"full_details_q1": "SECRET PROSE THAT MUST NOT LEAK"}
    text = schema_text(s)
    assert "guard removed" in text
    assert "SECRET PROSE" not in text


# ── Generation (C2): diff spans + unanchored rejection ───────────────────────


def test_compute_diff_spans():
    from app.amendments.generator import compute_diff_spans

    anchor = "Employees must report safety concerns."
    proposed = "Employees and contractors must report safety concerns promptly."
    spans = compute_diff_spans(anchor, proposed)
    assert spans, "expected non-empty diff"
    for s in spans:
        assert s["op"] in {"replace", "insert", "delete"}
        a0, a1 = s["anchor_span"]
        b0, b1 = s["proposed_span"]
        # Spans index into the right strings
        assert 0 <= a0 <= a1 <= len(anchor)
        assert 0 <= b0 <= b1 <= len(proposed)
    assert compute_diff_spans(anchor, anchor) == []


def _cluster(cluster_id="cc_0001", members=(1, 2)):
    return {
        "cluster_id": cluster_id,
        "member_submission_ids": list(members),
        "intra_sim": 0.9,
        "is_candidate": True,
    }


def _subs_by_id():
    return {
        1: _submission(1, "legal_only", "brake inspection records falsified"),
        2: _submission(2, "legal_only", "inspection logs backdated"),
    }


@patch("app.amendments.generator.get_retrieval_service")
def test_llm_outage_propagates_instead_of_fake_notice(mock_get_service):
    """A retrieval outage must produce NO record — never a misleading notice."""
    from app.amendments.generator import generate_proposal_for_cluster
    from app.rag.service import RetrievalUnavailable

    class _Down:
        def query(self, q):
            raise RetrievalUnavailable("quota")

    mock_get_service.return_value = _Down()
    with pytest.raises(RetrievalUnavailable):
        generate_proposal_for_cluster(_cluster(), _subs_by_id())


@patch("app.amendments.generator.get_retrieval_service")
def test_unanchored_cluster_emits_notice_without_text(mock_get_service):
    """Spec C2: reject if unanchored — silence is preferable to invention."""
    from app.amendments.generator import generate_proposal_for_cluster

    class _NoHit:
        def query(self, q):
            return None

    mock_get_service.return_value = _NoHit()
    record = generate_proposal_for_cluster(_cluster(), _subs_by_id())
    assert record["kind"] == "coverage_notice"
    assert record["proposed_text"] is None
    assert record["anchor_text"] is None
    assert record["diff_spans"] == []
    assert "No text is proposed" in record["notice"]


@patch("app.amendments.generator._generate_revision")
@patch("app.amendments.generator.get_retrieval_service")
def test_anchored_amendment_carries_provenance_and_server_diff(mock_get_service, mock_gen):
    from app.amendments.generator import generate_proposal_for_cluster
    from app.config import settings

    anchor = "Employees must report vehicle safety concerns to their supervisor."

    class _Svc:
        def __init__(self, corpus):
            self.corpus = corpus

        def query(self, q):
            return {
                "quote": anchor[:30],
                "section": "Safety — Page 9" if self.corpus == "policy" else "Article 6",
                "similarity": max(settings.RAG_TAU_POLICY, settings.RAG_TAU_LEGAL) + 0.1,
                "corpus": self.corpus,
                "document_id": f"{self.corpus}_doc",
                "source_text": anchor,
                "source_char_span": (100, 100 + len(anchor)),
            }

    mock_get_service.side_effect = _Svc
    mock_gen.return_value = {
        "proposed_text": anchor.replace("their supervisor", "their supervisor or the safety hotline"),
        "rationale": "Adds an alternative reporting channel per Article 6.",
    }

    record = generate_proposal_for_cluster(_cluster(), _subs_by_id())
    assert record["kind"] == "amendment"
    assert record["anchor_text"] == anchor
    assert record["anchor_ref"]["corpus"] == "policy"
    assert record["anchor_ref"]["char_span"] == (100, 100 + len(anchor))
    assert record["legal_ref"]["corpus"] == "legal"
    assert record["contributing_submission_ids"] == [1, 2]
    assert record["diff_spans"], "diff computed server-side"


@patch("app.amendments.generator._generate_revision")
@patch("app.amendments.generator.get_retrieval_service")
def test_unrelated_rewrite_downgraded_to_notice(mock_get_service, mock_gen):
    from app.amendments.generator import generate_proposal_for_cluster
    from app.config import settings

    anchor = "Employees must report vehicle safety concerns to their supervisor."

    class _Svc:
        def __init__(self, corpus):
            self.corpus = corpus

        def query(self, q):
            return {
                "quote": anchor[:20],
                "section": "S",
                "similarity": settings.RAG_TAU_POLICY + 0.1,
                "corpus": self.corpus,
                "document_id": "d",
                "source_text": anchor,
                "source_char_span": None,
            }

    mock_get_service.side_effect = _Svc
    mock_gen.return_value = {
        "proposed_text": "Zebras enjoy grazing on open savannah plains at dawn and dusk quietly.",
        "rationale": "nonsense",
    }
    record = generate_proposal_for_cluster(_cluster(), _subs_by_id())
    assert record["kind"] == "coverage_notice"
    assert record["proposed_text"] is None


# ── Stores ───────────────────────────────────────────────────────────────────


def test_cluster_ids_stable_across_runs():
    from app.amendments import store

    first = store.replace_clusters([
        {"member_submission_ids": [1, 2], "intra_sim": 0.9, "is_candidate": True},
    ])
    cid = first[0]["cluster_id"]
    second = store.replace_clusters([
        {"member_submission_ids": [2, 1], "intra_sim": 0.91, "is_candidate": True},
        {"member_submission_ids": [7], "intra_sim": 1.0, "is_candidate": False},
    ])
    assert second[0]["cluster_id"] == cid  # same member set → same id
    assert second[1]["cluster_id"] != cid


def test_proposal_round_trip_and_decisions():
    from app.amendments import store

    p = store.add_proposal({
        "kind": "amendment",
        "cluster_id": "cc_0001",
        "contributing_submission_ids": [1, 2],
        "anchor_ref": {"corpus": "policy"},
        "anchor_text": "a",
        "proposed_text": "b",
        "diff_spans": [],
        "legal_ref": None,
        "rationale": None,
        "notice": None,
    })
    assert p["proposal_id"] == "ap_0001"
    assert p["status"] == "pending"
    assert store.cluster_has_open_proposal("cc_0001")

    updated = store.record_decision("ap_0001", "reject", None, "too broad")
    assert updated["status"] == "rejected"
    assert updated["reviewer_decision"]["reason"] == "too broad"
    # Rejected proposals free the cluster for a new attempt
    assert not store.cluster_has_open_proposal("cc_0001")
    assert store.record_decision("ap_9999", "accept", None, None) is None


# ── Metrics (C3) ─────────────────────────────────────────────────────────────


def test_legal_only_rate():
    from app.amendments.metrics import coverage_metrics

    subs = [
        _submission(1, "covered", "a"),
        _submission(2, "legal_only", "b"),
        _submission(3, "legal_only", "c"),
        _submission(4, "uncovered", "d"),
        {"id": 5, "timestamp": _iso(1), "formData": {}},  # unclassified
    ]
    m = coverage_metrics(subs, window_days=90)
    assert m["total_classified"] == 4
    assert m["legal_only_rate"] == 0.5
    assert m["counts"]["unclassified"] == 1


# ── Reviewer-gate API ────────────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTIQ_SUBMISSIONS_PATH", str(tmp_path / "submissions.json"))
    from fastapi.testclient import TestClient
    from app.main import app

    return TestClient(app)


def _seed_proposal():
    from app.amendments import store

    return store.add_proposal({
        "kind": "amendment",
        "cluster_id": "cc_0001",
        "contributing_submission_ids": [1],
        "anchor_ref": {"corpus": "policy"},
        "anchor_text": "anchor",
        "proposed_text": "proposal",
        "diff_spans": [],
        "legal_ref": None,
        "rationale": None,
        "notice": None,
    })


def test_decision_endpoint_state_machine(client):
    p = _seed_proposal()
    pid = p["proposal_id"]

    # reject without reason → 422
    r = client.put(f"/api/admin/activity/proposals/{pid}/decision", json={"action": "reject"})
    assert r.status_code == 422
    # modify without text → 422
    r = client.put(f"/api/admin/activity/proposals/{pid}/decision", json={"action": "modify"})
    assert r.status_code == 422
    # accept works and is logged
    r = client.put(f"/api/admin/activity/proposals/{pid}/decision", json={"action": "accept"})
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"
    assert r.json()["reviewer_decision"]["decided_at"]
    # unknown id → 404
    r = client.put("/api/admin/activity/proposals/ap_9999/decision", json={"action": "accept"})
    assert r.status_code == 404


def test_proposals_listing_and_filter(client):
    _seed_proposal()
    r = client.get("/api/admin/activity/proposals")
    assert r.status_code == 200
    assert len(r.json()["proposals"]) == 1
    r = client.get("/api/admin/activity/proposals", params={"status": "rejected"})
    assert r.json()["proposals"] == []


def test_config_endpoints_validate(client, tmp_path, monkeypatch):
    import app.settings.store as settings_store

    monkeypatch.setattr(settings_store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(settings_store, "SETTINGS_FILE", tmp_path / "settings.json")

    r = client.get("/api/admin/activity/config")
    assert r.status_code == 200
    assert set(r.json()) == {"nMin", "simMin", "windowDays"}

    r = client.put("/api/admin/activity/config", json={"nMin": 3, "simMin": 0.8})
    assert r.status_code == 200
    assert r.json()["nMin"] == 3

    r = client.put("/api/admin/activity/config", json={"simMin": 5})
    assert r.status_code == 422


def test_metrics_endpoint(client):
    r = client.get("/api/admin/activity/metrics")
    assert r.status_code == 200
    body = r.json()
    assert "legal_only_rate" in body
    assert "proposals" in body
