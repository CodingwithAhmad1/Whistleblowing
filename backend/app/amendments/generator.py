"""C2 — Anchored amendment generation, constrained.

Every proposal is an adaptation of an anchor retrieved from the policy corpus
(with the applicable legal provision as motivation). The output is a DIFF —
anchor verbatim, proposed revision, changed spans — computed server-side with
difflib, never taken from the model. If no anchor retrieves above threshold,
a coverage-gap notice is emitted with NO proposed text: silence is preferable
to invention here (spec C2).
"""

from __future__ import annotations

import difflib
import json
import logging

from ..config import settings
from ..llm.generate import generate_with_fallback
from ..prompts.amendments import AMENDMENT_PROMPT_TEMPLATE
from ..question_processors.intake_processor import _extract_json_dict
from ..rag.service import get_retrieval_service

logger = logging.getLogger(__name__)

# A proposal that rewrites the anchor beyond recognition is not an "adaptation";
# below this similarity ratio it is downgraded to a coverage notice.
MIN_DIFF_RATIO = 0.3


def _ref(result: dict, corpus: str) -> dict:
    return {
        "corpus": result.get("corpus") or corpus,
        "document_id": result.get("document_id"),
        "section": result.get("section"),
        "char_span": result.get("source_char_span"),
    }


def compute_diff_spans(anchor: str, proposed: str) -> list[dict]:
    """Changed spans between anchor and proposal (server-computed, not LLM-claimed)."""
    matcher = difflib.SequenceMatcher(a=anchor, b=proposed, autojunk=False)
    spans = []
    for op, a0, a1, b0, b1 in matcher.get_opcodes():
        if op != "equal":
            spans.append({"op": op, "anchor_span": [a0, a1], "proposed_span": [b0, b1]})
    return spans


def _cluster_conduct_summaries(cluster: dict, submissions_by_id: dict[int, dict]) -> str:
    lines = []
    for sid in cluster["member_submission_ids"]:
        ex = (submissions_by_id.get(sid) or {}).get("extraction") or {}
        summary = ex.get("summary") or "no summary extracted"
        kinds = ", ".join(ex.get("allegation_type") or []) or "unclassified"
        lines.append(f"- [{kinds}] {summary}")
    return "\n".join(lines)


def _generate_revision(conduct_summaries: str, n_reports: int, anchor_text: str, legal_text: str) -> dict | None:
    """One constrained Gemini call → {"proposed_text", "rationale"} or None."""
    prompt = AMENDMENT_PROMPT_TEMPLATE.format(
        n_reports=n_reports,
        conduct_summaries=conduct_summaries,
        anchor_text=anchor_text,
        legal_text=legal_text or "(no provision retrieved)",
    )
    try:
        text = generate_with_fallback(
            prompt,
            temperature=settings.INTAKE_TEMPERATURE,
            max_output_tokens=1024,
        )
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = _extract_json_dict(text)
        if not data:
            return None
        proposed = data.get("proposed_text")
        if not isinstance(proposed, str) or not proposed.strip():
            return None
        rationale = data.get("rationale")
        return {
            "proposed_text": proposed.strip(),
            "rationale": rationale.strip() if isinstance(rationale, str) else None,
        }
    except Exception as e:
        logger.warning("Amendment generation failed: %s", e)
        return None


def generate_proposal_for_cluster(cluster: dict, submissions_by_id: dict[int, dict]) -> dict:
    """Build a proposal record (kind=amendment) or coverage notice (kind=coverage_notice).

    The record is NOT persisted here — the caller adds it via store.add_proposal.
    """
    summaries = _cluster_conduct_summaries(cluster, submissions_by_id)
    query = summaries.replace("- ", " ")

    base = {
        "cluster_id": cluster["cluster_id"],
        "contributing_submission_ids": list(cluster["member_submission_ids"]),
    }

    # Anchor: nearest existing policy clause. Legal provision motivates the change.
    policy_result = get_retrieval_service("policy").query(query)
    legal_result = get_retrieval_service("legal").query(query)

    policy_anchored = (
        policy_result is not None
        and policy_result.get("similarity", 0.0) >= settings.RAG_TAU_POLICY
        and policy_result.get("source_text")
    )

    legal_ref = _ref(legal_result, "legal") if legal_result else None
    legal_text = legal_result.get("source_text") or legal_result.get("quote") if legal_result else ""

    if not policy_anchored:
        # Reject if unanchored: coverage-gap notice with no proposed text.
        logger.info(
            "Cluster %s: no policy anchor above τ=%.2f → coverage notice",
            cluster["cluster_id"], settings.RAG_TAU_POLICY,
        )
        return {
            **base,
            "kind": "coverage_notice",
            "anchor_ref": None,
            "anchor_text": None,
            "proposed_text": None,
            "diff_spans": [],
            "legal_ref": legal_ref,
            "rationale": None,
            "notice": (
                "No sufficiently similar clause was retrieved from the policy corpus "
                "to anchor an amendment. No text is proposed: this cluster indicates "
                "a coverage gap that needs human drafting."
            ),
        }

    anchor_text = policy_result["source_text"].strip()
    revision = _generate_revision(summaries, len(cluster["member_submission_ids"]), anchor_text, legal_text or "")

    if revision:
        proposed = revision["proposed_text"]
        ratio = difflib.SequenceMatcher(a=anchor_text, b=proposed, autojunk=False).ratio()
        if proposed == anchor_text:
            logger.info("Cluster %s: proposal identical to anchor → notice", cluster["cluster_id"])
            revision = None
        elif ratio < MIN_DIFF_RATIO:
            logger.info(
                "Cluster %s: proposal unrelated to anchor (ratio %.2f) → notice",
                cluster["cluster_id"], ratio,
            )
            revision = None

    if not revision:
        return {
            **base,
            "kind": "coverage_notice",
            "anchor_ref": _ref(policy_result, "policy"),
            "anchor_text": anchor_text,
            "proposed_text": None,
            "diff_spans": [],
            "legal_ref": legal_ref,
            "rationale": None,
            "notice": (
                "An anchor clause was retrieved but no usable adaptation was generated. "
                "No text is proposed."
            ),
        }

    return {
        **base,
        "kind": "amendment",
        "anchor_ref": _ref(policy_result, "policy"),
        "anchor_text": anchor_text,
        "proposed_text": revision["proposed_text"],
        "diff_spans": compute_diff_spans(anchor_text, revision["proposed_text"]),
        "legal_ref": legal_ref,
        "rationale": revision["rationale"],  # model-authored; rendered separately
        "notice": None,
    }
