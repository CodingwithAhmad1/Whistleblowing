"""C3 — Standing coverage metrics (anti-gaming).

The reported figure is the gap between law and policy: the legal corpus is the
floor and is not firm-controlled, so narrowing the policy widens the measured
`legal_only` rate rather than hiding gaps. Published as a standing figure, not
just when amendments are proposed.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import store


def _parse_ts(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def coverage_metrics(submissions: list[dict], window_days: int = 90) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    counts = {"covered": 0, "legal_only": 0, "policy_only": 0, "uncovered": 0, "unclassified": 0}
    for s in submissions:
        ts = _parse_ts(s.get("timestamp") or "")
        if ts is None or ts < cutoff:
            continue
        cls = (s.get("coverage") or {}).get("classification")
        counts[cls if cls in counts else "unclassified"] += 1

    classified = sum(counts[c] for c in ("covered", "legal_only", "policy_only", "uncovered"))
    legal_only_rate = counts["legal_only"] / classified if classified else None

    proposals = store.read_proposals()
    n_amendments = sum(1 for p in proposals if p["kind"] == "amendment")
    n_notices = sum(1 for p in proposals if p["kind"] == "coverage_notice")
    decisions = {"pending": 0, "accepted": 0, "modified": 0, "rejected": 0}
    for p in proposals:
        decisions[p["status"]] = decisions.get(p["status"], 0) + 1

    return {
        "window_days": window_days,
        "counts": counts,
        "total_classified": classified,
        # The standing anti-gaming figure (spec C3).
        "legal_only_rate": round(legal_only_rate, 4) if legal_only_rate is not None else None,
        "proposals": {
            "amendments": n_amendments,
            # Whether the generation constraint binds (spec evaluation table).
            "coverage_notices": n_notices,
            "unanchored_rejection_rate": (
                round(n_notices / (n_amendments + n_notices), 4)
                if (n_amendments + n_notices)
                else None
            ),
            "decisions": decisions,
        },
    }
