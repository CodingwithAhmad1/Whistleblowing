"""C1 — Gap accumulation: cluster unmatched accounts by conduct similarity.

Clusters are computed over embeddings of the EXTRACTED SCHEMA (Layer-1 fields
serialized to a deterministic template), never over raw prose. A cluster becomes
a candidate gap only when it passes all three thresholds (nMin, simMin,
windowDays) — evidence accumulation is the gating mechanism, not model
self-confidence.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import numpy as np

from ..settings import get_amendment_config
from . import store

logger = logging.getLogger(__name__)

INPUT_CLASSES = {"legal_only", "uncovered"}


def schema_text(submission: dict) -> str:
    """Deterministic serialization of the extracted schema for embedding.

    Uses the assessment surface (extraction fields), not the reporter's prose.
    """
    ex = submission.get("extraction") or {}
    parts = [
        f"Allegation types: {', '.join(ex.get('allegation_type') or []) or 'unspecified'}.",
        f"Summary: {ex.get('summary') or 'none'}.",
        f"Evidence described: {'yes' if ex.get('evidence_described') else 'no'}.",
        f"Retaliation mentioned: {'yes' if ex.get('retaliation_mentioned') else 'no'}.",
        f"Impact described: {'yes' if ex.get('impact_described') else 'no'}.",
    ]
    coverage = submission.get("coverage") or {}
    if coverage.get("classification"):
        parts.append(f"Coverage: {coverage['classification']}.")
    return " ".join(parts)


def _parse_ts(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def gather_inputs(submissions: list[dict], window_days: int) -> list[dict]:
    """Submissions whose coverage feeds Component C, within the rolling window."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    out = []
    for s in submissions:
        coverage = s.get("coverage") or {}
        if coverage.get("classification") not in INPUT_CLASSES:
            continue
        ts = _parse_ts(s.get("timestamp") or "")
        if ts is None or ts < cutoff:
            continue
        out.append(s)
    return out


def _embed_schemas(submissions: list[dict]) -> dict[int, np.ndarray]:
    """Embed each submission's schema text, using the persisted cache keyed by
    submission id + content hash (re-embeds only when the schema changed)."""
    from ..embeddings.service import get_embedding_service

    cache = store.read_embedding_cache()
    vectors: dict[int, np.ndarray] = {}
    to_embed: list[tuple[int, str, str]] = []

    for s in submissions:
        sid = int(s["id"])
        text = schema_text(s)
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        entry = cache.get(str(sid))
        if entry and entry.get("hash") == digest:
            vectors[sid] = np.asarray(entry["vector"], dtype=np.float64)
        else:
            to_embed.append((sid, text, digest))

    if to_embed:
        service = get_embedding_service()
        embedded = service.embed_documents([t for _, t, _ in to_embed], task_type="CLUSTERING")
        for (sid, _, digest), vec in zip(to_embed, embedded):
            vectors[sid] = np.asarray(vec, dtype=np.float64)
            cache[str(sid)] = {"hash": digest, "vector": list(vec)}
        store.write_embedding_cache(cache)

    return vectors


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    return float(a @ b / denom) if denom else 0.0


def _average_linkage(members_a: list[int], members_b: list[int], vecs: dict[int, np.ndarray]) -> float:
    sims = [_cosine(vecs[i], vecs[j]) for i in members_a for j in members_b]
    return float(np.mean(sims)) if sims else 0.0


def _intra_sim(members: list[int], vecs: dict[int, np.ndarray]) -> float:
    if len(members) < 2:
        return 1.0
    sims = [
        _cosine(vecs[a], vecs[b])
        for idx, a in enumerate(members)
        for b in members[idx + 1 :]
    ]
    return float(np.mean(sims))


def cluster_submissions(submissions: list[dict]) -> tuple[list[dict], dict]:
    """Greedy average-linkage agglomerative clustering over schema embeddings.

    Returns (candidate_clusters, config_used). Clusters below nMin members are
    not candidates but are still returned with status implied by size — only
    candidates (passing all thresholds) get proposals.
    """
    cfg = get_amendment_config()
    inputs = gather_inputs(submissions, cfg["windowDays"])
    if not inputs:
        return [], cfg

    vecs = _embed_schemas(inputs)
    by_id = {int(s["id"]): s for s in inputs}

    # Start singleton clusters, merge the closest pair while ≥ simMin.
    clusters: list[list[int]] = [[int(s["id"])] for s in inputs]
    while len(clusters) > 1:
        best: tuple[float, int, int] | None = None
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                sim = _average_linkage(clusters[i], clusters[j], vecs)
                if best is None or sim > best[0]:
                    best = (sim, i, j)
        if best is None or best[0] < cfg["simMin"]:
            break
        _, i, j = best
        clusters[i] = clusters[i] + clusters[j]
        del clusters[j]

    out: list[dict] = []
    for members in clusters:
        members_sorted = sorted(members)
        timestamps = [
            _parse_ts(by_id[m].get("timestamp") or "") for m in members_sorted
        ]
        timestamps = [t for t in timestamps if t]
        intra = _intra_sim(members_sorted, vecs)
        is_candidate = len(members_sorted) >= cfg["nMin"] and intra >= cfg["simMin"]
        coverage_counts: dict[str, int] = {}
        for m in members_sorted:
            cls = (by_id[m].get("coverage") or {}).get("classification", "unknown")
            coverage_counts[cls] = coverage_counts.get(cls, 0) + 1
        centroid = np.mean([vecs[m] for m in members_sorted], axis=0)
        out.append({
            "member_submission_ids": members_sorted,
            "centroid": [round(float(x), 6) for x in centroid],
            "intra_sim": round(intra, 4),
            "coverage_classes": coverage_counts,
            "first_seen": min(timestamps).isoformat() if timestamps else None,
            "last_seen": max(timestamps).isoformat() if timestamps else None,
            "is_candidate": is_candidate,
        })

    logger.info(
        "Clustering: %d inputs → %d clusters (%d candidates) [nMin=%s simMin=%s window=%sd]",
        len(inputs), len(out), sum(c["is_candidate"] for c in out),
        cfg["nMin"], cfg["simMin"], cfg["windowDays"],
    )
    return out, cfg
