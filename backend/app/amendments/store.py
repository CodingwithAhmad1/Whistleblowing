"""Filelocked JSON stores for coverage clusters and amendment proposals.

Same pattern as app/settings/store.py: cross-process FileLock around every
read-modify-write, atomic tmp-file replace, monotonic sequence ids.
"""

from __future__ import annotations

import json
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from filelock import FileLock

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
CLUSTERS_FILE = DATA_DIR / "coverage_clusters.json"
PROPOSALS_FILE = DATA_DIR / "amendment_proposals.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read(path: Path, list_key: str) -> dict[str, Any]:
    if not path.is_file():
        return {"next_seq": 1, list_key: []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.error("read %s: %s", path.name, e)
        return {"next_seq": 1, list_key: []}
    if not isinstance(data, dict) or not isinstance(data.get(list_key), list):
        return {"next_seq": 1, list_key: []}
    if not isinstance(data.get("next_seq"), int) or data["next_seq"] < 1:
        data["next_seq"] = len(data[list_key]) + 1
    return data


def _write(path: Path, data: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=str(DATA_DIR), suffix=".tmp", prefix=path.stem + "_")
    try:
        with open(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        Path(tmp_path).replace(path)
    except BaseException:
        Path(tmp_path).unlink(missing_ok=True)
        raise


def _lock(path: Path) -> FileLock:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return FileLock(str(path) + ".lock", timeout=10)


# ── Clusters ──────────────────────────────────────────────────────────────────


def read_clusters() -> list[dict]:
    with _lock(CLUSTERS_FILE):
        return _read(CLUSTERS_FILE, "clusters")["clusters"]


def replace_clusters(clusters: list[dict]) -> list[dict]:
    """Replace the cluster set (clustering is recomputed from submissions each
    analyze run; ids are stable across runs via the member-set key)."""
    with _lock(CLUSTERS_FILE):
        data = _read(CLUSTERS_FILE, "clusters")
        existing_by_key = {_member_key(c["member_submission_ids"]): c for c in data["clusters"]}
        out: list[dict] = []
        for cluster in clusters:
            key = _member_key(cluster["member_submission_ids"])
            prior = existing_by_key.get(key)
            if prior:
                cluster["cluster_id"] = prior["cluster_id"]
                cluster["status"] = prior.get("status", "open")
            else:
                cluster["cluster_id"] = f"cc_{data['next_seq']:04d}"
                data["next_seq"] += 1
                cluster.setdefault("status", "open")
            cluster["updated_at"] = _now_iso()
            out.append(cluster)
        data["clusters"] = out
        _write(CLUSTERS_FILE, data)
        return out


def set_cluster_status(cluster_id: str, status: str) -> bool:
    with _lock(CLUSTERS_FILE):
        data = _read(CLUSTERS_FILE, "clusters")
        for c in data["clusters"]:
            if c["cluster_id"] == cluster_id:
                c["status"] = status
                c["updated_at"] = _now_iso()
                _write(CLUSTERS_FILE, data)
                return True
    return False


def _member_key(member_ids: list[int]) -> str:
    return ",".join(str(i) for i in sorted(member_ids))


# ── Embedding cache (schema embeddings, keyed by submission id + content hash) ─


def read_embedding_cache() -> dict[str, dict]:
    with _lock(CLUSTERS_FILE):
        return _read(CLUSTERS_FILE, "clusters").get("embedding_cache", {})


def write_embedding_cache(cache: dict[str, dict]) -> None:
    with _lock(CLUSTERS_FILE):
        data = _read(CLUSTERS_FILE, "clusters")
        data["embedding_cache"] = cache
        _write(CLUSTERS_FILE, data)


# ── Proposals ─────────────────────────────────────────────────────────────────


def read_proposals() -> list[dict]:
    with _lock(PROPOSALS_FILE):
        return _read(PROPOSALS_FILE, "proposals")["proposals"]


def add_proposal(proposal: dict) -> dict:
    with _lock(PROPOSALS_FILE):
        data = _read(PROPOSALS_FILE, "proposals")
        proposal["proposal_id"] = f"ap_{data['next_seq']:04d}"
        data["next_seq"] += 1
        proposal["status"] = "pending"
        proposal["reviewer_decision"] = None
        proposal["created_at"] = _now_iso()
        data["proposals"].append(proposal)
        _write(PROPOSALS_FILE, data)
        return proposal


def record_decision(
    proposal_id: str, action: str, modified_text: str | None, reason: str | None
) -> dict | None:
    """C4 human gate: log the reviewer decision. Returns the updated proposal."""
    status_by_action = {"accept": "accepted", "modify": "modified", "reject": "rejected"}
    with _lock(PROPOSALS_FILE):
        data = _read(PROPOSALS_FILE, "proposals")
        for p in data["proposals"]:
            if p["proposal_id"] == proposal_id:
                p["status"] = status_by_action[action]
                p["reviewer_decision"] = {
                    "action": action,
                    "modified_text": modified_text,
                    "reason": reason,
                    "decided_at": _now_iso(),
                }
                _write(PROPOSALS_FILE, data)
                return p
    return None


def cluster_has_open_proposal(cluster_id: str) -> bool:
    """A cluster with a pending/accepted/modified proposal is not re-proposed;
    rejected proposals allow a new attempt (rejection reasons feed tuning)."""
    return any(
        p["cluster_id"] == cluster_id and p["status"] != "rejected"
        for p in read_proposals()
    )
