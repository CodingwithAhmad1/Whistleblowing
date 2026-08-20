"""Retrieval calibration: run labelled vignettes, sweep τ, report the operating point.

Runs each vignette in app/testing/coverage_vignettes.py against BOTH corpora once
(recording the dense similarity of the top reranker-surviving candidate and the
retrieved section), then sweeps thresholds post-hoc over the recorded scores —
so the LLM/embedding cost is one pass regardless of grid size.

Reports:
  - classification accuracy + confusion matrix at each τ (τ_policy = τ_legal grid)
  - the best independent (τ_policy, τ_legal) pair
  - citation accuracy (does the retrieved section match the labelled section)
  - per-vignette score dump to backend/data/eval/ — the seed set for future
    conformal calibration (grow the vignette set before trusting guarantees).

Usage:
    cd backend && venv/bin/python scripts/eval_retrieval.py [--pace 8] [--limit N]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.testing.coverage_vignettes import COVERAGE_VIGNETTES  # noqa: E402

EVAL_DIR = Path(__file__).resolve().parent.parent / "data" / "eval"

GRID = [round(0.30 + 0.05 * i, 2) for i in range(11)]  # 0.30 … 0.80

CLASSES = ["covered", "legal_only", "policy_only", "uncovered"]


def classify(policy_score: float | None, legal_score: float | None, tp: float, tl: float) -> str:
    policy_hit = policy_score is not None and policy_score >= tp
    legal_hit = legal_score is not None and legal_score >= tl
    if policy_hit and legal_hit:
        return "covered"
    if policy_hit:
        return "policy_only"
    if legal_hit:
        return "legal_only"
    return "uncovered"


def run_retrieval(pace_seconds: float, limit: int | None) -> list[dict]:
    from app.rag.service import RetrievalUnavailable, get_retrieval_service

    vignettes = COVERAGE_VIGNETTES[:limit] if limit else COVERAGE_VIGNETTES
    records: list[dict] = []
    for i, v in enumerate(vignettes):
        rec: dict = {"id": v["id"], "expected_class": v["expected_class"]}
        for corpus in ("policy", "legal"):
            try:
                result = get_retrieval_service(corpus).query(v["query"])
            except RetrievalUnavailable as e:
                # Quota/outage — mark degraded rather than record a fake miss.
                rec["degraded"] = True
                rec[f"{corpus}_error"] = str(e)
                result = None
            rec[f"{corpus}_score"] = result.get("similarity") if result else None
            rec[f"{corpus}_relevance"] = result.get("relevance_score") if result else None
            rec[f"{corpus}_section"] = result.get("section") if result else None
        # Citation checks against labelled sections
        for corpus, key in (("policy", "policy_section_contains"), ("legal", "legal_section_contains")):
            want = v.get(key)
            if want:
                got = rec.get(f"{corpus}_section") or ""
                rec[f"{corpus}_citation_ok"] = want.lower() in got.lower()
        records.append(rec)
        print(
            f"  [{i + 1}/{len(vignettes)}] {v['id']:<24} "
            f"policy={_fmt(rec['policy_score'])} legal={_fmt(rec['legal_score'])} "
            f"(expected {v['expected_class']})"
        )
        if i + 1 < len(vignettes) and pace_seconds:
            time.sleep(pace_seconds)  # respect free-tier per-minute quotas
    return records


def _fmt(x: float | None) -> str:
    return f"{x:.3f}" if x is not None else "  —  "


def sweep(records: list[dict]) -> None:
    degraded = [r for r in records if r.get("degraded")]
    if degraded:
        print(
            f"\nWARNING: {len(degraded)} vignette(s) hit an LLM/quota outage and are "
            f"EXCLUDED from the sweep: {', '.join(r['id'] for r in degraded)}"
        )
        records = [r for r in records if not r.get("degraded")]
    if not records:
        print("No valid records — re-run when quota allows.")
        return

    print("\n── τ sweep (τ_policy = τ_legal) ─────────────────────────────")
    print(f"{'τ':>5} | {'acc':>5} | per-class correct/total")
    best_same = (0.0, -1.0)
    for tau in GRID:
        correct = 0
        per_class = {c: [0, 0] for c in CLASSES}
        for r in records:
            pred = classify(r["policy_score"], r["legal_score"], tau, tau)
            per_class[r["expected_class"]][1] += 1
            if pred == r["expected_class"]:
                correct += 1
                per_class[r["expected_class"]][0] += 1
        acc = correct / len(records)
        if acc > best_same[1]:
            best_same = (tau, acc)
        detail = "  ".join(f"{c}:{n}/{d}" for c, (n, d) in per_class.items() if d)
        print(f"{tau:>5.2f} | {acc:>5.0%} | {detail}")

    # Independent pair sweep
    best_pair = (0.0, 0.0, -1.0)
    for tp, tl in product(GRID, GRID):
        correct = sum(
            1 for r in records if classify(r["policy_score"], r["legal_score"], tp, tl) == r["expected_class"]
        )
        acc = correct / len(records)
        if acc > best_pair[2]:
            best_pair = (tp, tl, acc)

    print(f"\nBest single τ: {best_same[0]:.2f} (accuracy {best_same[1]:.0%})")
    print(f"Best (τ_policy, τ_legal): ({best_pair[0]:.2f}, {best_pair[1]:.2f}) (accuracy {best_pair[2]:.0%})")

    # Confusion matrix at the best pair
    tp, tl, _ = best_pair
    print(f"\n── Confusion at (τp={tp:.2f}, τl={tl:.2f}) — rows=expected, cols=predicted ──")
    header = "".join(f"{c[:9]:>11}" for c in CLASSES)
    print(f"{'':>12}{header}")
    for expected in CLASSES:
        row = {c: 0 for c in CLASSES}
        for r in records:
            if r["expected_class"] == expected:
                row[classify(r["policy_score"], r["legal_score"], tp, tl)] += 1
        if any(row.values()):
            cells = "".join(f"{row[c]:>11}" for c in CLASSES)
            print(f"{expected:>12}{cells}")
        for r in records:
            if r["expected_class"] == expected:
                pred = classify(r["policy_score"], r["legal_score"], tp, tl)
                if pred != expected:
                    print(f"{'':>12}  ✗ {r['id']}: predicted {pred} "
                          f"(policy={_fmt(r['policy_score'])}, legal={_fmt(r['legal_score'])})")

    # Citation accuracy
    checks = [(k, r) for r in records for k in ("policy_citation_ok", "legal_citation_ok") if k in r]
    if checks:
        ok = sum(1 for k, r in checks if r[k])
        print(f"\nCitation accuracy: {ok}/{len(checks)}")
        for k, r in checks:
            if not r[k]:
                corpus = k.split("_")[0]
                print(f"  ✗ {r['id']}: retrieved {corpus} section {r.get(f'{corpus}_section')!r}")

    print(
        "\nNext step: set RAG_TAU_POLICY / RAG_TAU_LEGAL in app/config.py to the chosen "
        "operating point. The per-vignette dump in data/eval/ is the seed for conformal "
        "calibration once the vignette set is larger (≥40 recommended)."
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pace", type=float, default=8.0, help="Seconds between vignettes (rate limits)")
    ap.add_argument("--limit", type=int, default=None, help="Evaluate only the first N vignettes")
    args = ap.parse_args()

    print(f"Evaluating {len(COVERAGE_VIGNETTES[:args.limit] if args.limit else COVERAGE_VIGNETTES)} vignettes…")
    records = run_retrieval(args.pace, args.limit)

    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dump = EVAL_DIR / f"retrieval_eval_{stamp}.json"
    dump.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"\nScore dump: {dump}")

    sweep(records)


if __name__ == "__main__":
    main()
