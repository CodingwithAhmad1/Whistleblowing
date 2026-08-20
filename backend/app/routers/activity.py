"""Activity endpoints — Component C surface for the Admin ▸ Activity tab.

Component C proposes; it never amends (C4). Everything here routes through the
human gate: analysis is on-demand, proposals carry full provenance, and every
reviewer decision is logged. Rejection reasons are retained to feed threshold
tuning.

Known limitation (matches the rest of /api/admin): no authentication exists in
this app; the Activity tab is gated client-side by manager mode only.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from ..amendments import store
from ..amendments.clustering import cluster_submissions
from ..amendments.generator import generate_proposal_for_cluster
from ..amendments.metrics import coverage_metrics
from ..routers.submissions import read_all_submissions
from ..settings import get_amendment_config, update_amendment_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/activity", tags=["activity"])


class DecisionRequest(BaseModel):
    action: Literal["accept", "modify", "reject"]
    modified_text: str | None = None
    reason: str | None = None


@router.post("/analyze")
def run_analysis():
    """Run gap accumulation + anchored proposal generation on demand.

    Idempotent-ish: a cluster whose member set already has a non-rejected
    proposal is skipped. Coverage itself is computed per-submission at submit
    time, so this call only clusters and generates.
    """
    submissions = read_all_submissions()
    clusters, cfg = cluster_submissions(submissions)
    saved_clusters = store.replace_clusters(clusters)

    submissions_by_id = {int(s["id"]): s for s in submissions}
    proposals_created = 0
    notices_created = 0
    skipped_existing = 0
    generation_failures = 0

    for cluster in saved_clusters:
        if not cluster.get("is_candidate"):
            continue
        if store.cluster_has_open_proposal(cluster["cluster_id"]):
            skipped_existing += 1
            continue
        try:
            record = generate_proposal_for_cluster(cluster, submissions_by_id)
        except Exception:
            # Includes RetrievalUnavailable: an LLM/index outage must produce
            # NO record at all — never a misleading coverage notice.
            logger.exception("Proposal generation failed for %s", cluster["cluster_id"])
            generation_failures += 1
            continue
        store.add_proposal(record)
        store.set_cluster_status(cluster["cluster_id"], "proposed")
        if record["kind"] == "amendment":
            proposals_created += 1
        else:
            notices_created += 1

    return {
        "generation_failures": generation_failures,
        "clusters": [
            {k: v for k, v in c.items() if k != "centroid"} for c in saved_clusters
        ],
        "config": cfg,
        "proposals_created": proposals_created,
        "notices_created": notices_created,
        "skipped_existing": skipped_existing,
        "inputs_considered": sum(
            1
            for s in submissions
            if (s.get("coverage") or {}).get("classification") in ("legal_only", "uncovered")
        ),
    }


@router.get("/proposals")
def list_proposals(status: str | None = None):
    """Amendment proposals + coverage notices, newest first."""
    proposals = store.read_proposals()
    if status:
        proposals = [p for p in proposals if p["status"] == status]
    proposals.sort(key=lambda p: p.get("created_at") or "", reverse=True)
    return {"proposals": proposals}


@router.put("/proposals/{proposal_id}/decision")
def decide_proposal(proposal_id: str, body: DecisionRequest):
    """C4 human gate: accept / modify / reject, logged with timestamp.

    - modify requires modified_text
    - reject requires a reason (rejection reasons feed threshold tuning)
    """
    if body.action == "modify" and not (body.modified_text or "").strip():
        raise HTTPException(status_code=422, detail="modify requires modified_text")
    if body.action == "reject" and not (body.reason or "").strip():
        raise HTTPException(status_code=422, detail="reject requires a reason")

    updated = store.record_decision(
        proposal_id,
        body.action,
        (body.modified_text or "").strip() or None,
        (body.reason or "").strip() or None,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    logger.info("Proposal %s: reviewer decision %s", proposal_id, body.action)
    return updated


@router.get("/metrics")
def get_metrics(window_days: int = 90):
    """Standing coverage figures — legal_only rate is the anti-gaming metric (C3)."""
    if not 1 <= window_days <= 3650:
        raise HTTPException(status_code=422, detail="window_days out of range")
    return coverage_metrics(read_all_submissions(), window_days)


@router.get("/config")
def get_config():
    """Clustering thresholds (evidence gates, spec C1) — reported as evaluation parameters."""
    return get_amendment_config()


@router.put("/config")
def put_config(body: dict[str, Any] = Body(default_factory=dict)):
    """Update clustering thresholds (nMin, simMin, windowDays)."""
    try:
        return update_amendment_config(body)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
