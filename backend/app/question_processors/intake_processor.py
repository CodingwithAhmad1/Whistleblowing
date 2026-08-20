"""
Deterministic AI intake workflow – 3-layer pipeline for Full Details Q1 analysis.

Layer 1: LLM extracts structured JSON from labeled form sections (two passes:
        strict literal-evidence fields + inference narrative-judgement booleans).
Layer 2: Deterministic gap analysis using Layer 1 JSON and gap configs (no LLM).
Layer 3: Template-based question generation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Callable, TypedDict

from ..config import settings
from ..llm import get_provider, collect_stream
from ..settings import get_intake_gaps

logger = logging.getLogger(__name__)

# ── Types ─────────────────────────────────────────────────────────────────────

MAX_QUESTION_CHARS = 300


class Layer1Result(TypedDict):
    summary: str
    dates_mentioned: list[str]
    people_mentioned: list[str]
    locations_mentioned: list[str]
    specific_examples_present: bool
    evidence_described: bool
    timeline_clear: bool
    witnesses_mentioned: bool
    prior_reporting_mentioned: bool
    impact_described: bool
    retaliation_mentioned: bool
    allegation_type: list[str]
    length_character_count: int
    _used_defaults: bool  # True only if BOTH Layer-1 passes failed to parse


class FollowUpQuestion(TypedDict):
    gap_id: str
    question_text: str


class IntakeResult(TypedDict):
    extraction: Layer1Result
    gaps: list[str]
    follow_up_questions: list[FollowUpQuestion]
    extraction_breakdown: dict[str, Any]
    # False when both Layer-1 passes failed: gaps=[] then means "analysis
    # unavailable", never "the account is complete".
    analysis_available: bool


# Ordered section headers emitted by _build_layer1_sections (prompts + tests rely on this).
LAYER1_SECTION_ORDER = (
    "NARRATIVE",
    "CHRONOLOGY",
    "SEQUENCE",
    "EVIDENCE_DESCRIPTION",
    "FOLLOW_UP_1",
    "FOLLOW_UP_2",
    "CONCEALMENT",
    "HOW_AWARE",
    "STRUCTURED",
)


# ── Layer 1 – Labeled sections input ──────────────────────────────────────────


def _strip_val(val: Any) -> str:
    if val is None:
        return ""
    if not isinstance(val, str):
        return str(val).strip()
    return val.strip()


def _build_layer1_sections(q1_text: str, form_data: dict | None) -> str:
    """Build labeled per-field blocks for Layer 1 (strict + inference passes).

    Empty sections are omitted. Order matches LAYER1_SECTION_ORDER.
    """
    blocks: list[str] = []
    narrative = _strip_val(q1_text)
    if narrative:
        blocks.append("[NARRATIVE]\n" + narrative)

    fd = form_data or {}

    chron = _strip_val(fd.get("general_nature"))
    if chron:
        blocks.append("[CHRONOLOGY]\n" + chron)

    seq = _strip_val(fd.get("sequence_of_events"))
    if seq:
        blocks.append("[SEQUENCE]\n" + seq)

    ev = _strip_val(fd.get("evidence_description"))
    if ev:
        blocks.append("[EVIDENCE_DESCRIPTION]\n" + ev)

    fq1 = _strip_val(fd.get("full_details_q2"))
    if fq1:
        blocks.append("[FOLLOW_UP_1]\n" + fq1)

    fq2 = _strip_val(fd.get("full_details_gap2"))
    if fq2:
        blocks.append("[FOLLOW_UP_2]\n" + fq2)

    conceal = _strip_val(fd.get("persons_concealing"))
    if conceal:
        blocks.append("[CONCEALMENT]\n" + conceal)

    how = _strip_val(fd.get("how_aware"))
    how_other = _strip_val(fd.get("how_aware_other"))
    how_parts = [p for p in (how, how_other) if p]
    if how_parts:
        blocks.append("[HOW_AWARE]\n" + "\n".join(how_parts))

    struct_lines: list[str] = []
    structured_pairs: list[tuple[str, str]] = [
        ("when_occurred", "When"),
        ("where_occurred", "Where"),
        ("duration", "Duration"),
        ("country", "Country"),
        ("incident_location", "Incident location"),
        ("organization_tier", "Organization tier"),
        ("supervisor_involved", "Supervisor involved"),
        ("supervisor_who", "Supervisor who"),
        ("management_aware", "Management aware"),
        ("has_supporting_materials", "Supporting materials"),
        ("wish_anonymous", "Wish anonymous"),
    ]
    for key, label in structured_pairs:
        v = _strip_val(fd.get(key))
        if v:
            struct_lines.append(f"- {label}: {v}")

    for i in range(1, 11):
        first = _strip_val(fd.get(f"person_{i}_first"))
        last = _strip_val(fd.get(f"person_{i}_last"))
        title = _strip_val(fd.get(f"person_{i}_title"))
        if not first and not last and not title:
            continue
        name = f"{first} {last}".strip()
        line = f"- Person {i}: {name}" if name else f"- Person {i}:"
        if title:
            line += f", {title}" if name else f" {title}"
        struct_lines.append(line)

    if struct_lines:
        blocks.append("[STRUCTURED]\n" + "\n".join(struct_lines))

    return "\n\n".join(blocks)


# ── Layer 1 – Two-pass prompts (no .format() on user text — brace-safe) ───────

_LAYER1_STRICT_SCHEMA = """{
  "summary": "Neutral 2-4 sentence summary using only NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_1, FOLLOW_UP_2",
  "dates_mentioned": ["explicit calendar references only — scan NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*, STRUCTURED When"],
  "people_mentioned": ["explicitly named individuals — scan NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*, CONCEALMENT, STRUCTURED Supervisor who / Person rows"],
  "locations_mentioned": ["explicit place names — scan NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*, STRUCTURED Where / Incident location / Country"],
  "evidence_described": false,
  "allegation_type": ["category labels only when clearly stated — scan NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*"]
}"""

_LAYER1_STRICT_PROMPT_HEAD = """You are a structured extractor (PASS 1 — STRICT).

Use ONLY the labeled sections below. Each section starts with [SECTION_NAME].

Rules:
- summary: Neutral 2-4 sentences from NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_1, FOLLOW_UP_2 only.
- dates_mentioned: Literal dates/time phrases written in text (include STRUCTURED When if it adds a date). Do not invent dates.
- people_mentioned: Only individuals explicitly named (not pronouns alone). Include STRUCTURED person rows and Supervisor who when names appear there.
- locations_mentioned: Explicit places only. Include STRUCTURED Where, Incident location, Country when present.
- evidence_described: true if the reporter clearly references concrete evidence — documents, files, emails, screenshots, photos, recordings, logs, spreadsheets, links, or similar — in EVIDENCE_DESCRIPTION, NARRATIVE, FOLLOW_UP_*, or STRUCTURED Supporting materials=yes with supporting detail in text. Obvious phrasing counts (e.g. "the spreadsheet I downloaded"); vague "I have proof" without any artifact type stays false.
- allegation_type: Short labels only when the text clearly states the nature (e.g. fraud, harassment). Do not invent.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
""" + _LAYER1_STRICT_SCHEMA + """

Labeled input:
"""

_LAYER1_STRICT_PROMPT_TAIL = """

JSON output:"""

_STRICT_RETRY_HINT = (
    "\n\nYour previous reply was not valid JSON. Output ONLY one JSON object matching "
    "the schema above, with no markdown or other text.\nJSON output:"
)

_LAYER1_INFERENCE_SCHEMA = """{
  "specific_examples_present": false,
  "witnesses_mentioned": false,
  "impact_described": false,
  "retaliation_mentioned": false,
  "prior_reporting_mentioned": false,
  "timeline_clear": false
}"""

_LAYER1_INFERENCE_PROMPT_HEAD = """You are a structured extractor (PASS 2 — REASONABLE INFERENCE).

Use ONLY the labeled sections below. Each section starts with [SECTION_NAME].

Set each boolean true when reasonably supported by the text (clear implication counts). When unsure, false.

Rules (each lists which sections matter):
- specific_examples_present: true if at least one concrete situation is described (who/what/when/where style detail). Sections: NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*, STRUCTURED When/Where.
  Example true: "On Tuesday in Lab 2 they altered the results." Example false: only vague unease with no instance.
- witnesses_mentioned: true if anyone besides the reporter and the main wrongdoer could observe, corroborate, or was told — colleagues, bystanders, another department, "someone else saw", HOW_AWARE=told_by_coworker, etc. Sections: NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*, CONCEALMENT, HOW_AWARE.
  Not enough: only the reporter and one accused party with no third party.
- impact_described: true if harm or consequences are stated or clearly implied — financial loss, safety risk, stress/time off, morale, customers/public affected, etc. Sections: NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*.
  Example true: "people lost savings." False: wrongdoing stated with no hint of effect on anyone.
- retaliation_mentioned: true for retaliation, threats, intimidation, punishment for speaking up, fear of reprisal, chilling effect. Sections: NARRATIVE, FOLLOW_UP_*, STRUCTURED Wish anonymous combined with fear/reprisal language (anonymity alone is NOT enough).
- prior_reporting_mentioned: true if they say they already raised this (manager, HR, hotline, compliance, lawyer, etc.). Sections: NARRATIVE, CHRONOLOGY, SEQUENCE, FOLLOW_UP_*, HOW_AWARE, STRUCTURED Management aware (yes implies awareness — treat as prior organizational exposure only if the narrative supports raising/reporting, not merely that management knows abstractly).
- timeline_clear: true if event order or timing can be reconstructed (sequence words, dates, or STRUCTURED When + Duration). Sections: NARRATIVE, CHRONOLOGY, SEQUENCE, STRUCTURED When, Duration.

Output ONLY valid JSON matching this schema (no markdown, no commentary):
""" + _LAYER1_INFERENCE_SCHEMA + """

Labeled input:
"""

_LAYER1_INFERENCE_PROMPT_TAIL = """

JSON output:"""

_INFERENCE_RETRY_HINT = (
    "\n\nYour previous reply was not valid JSON. Output ONLY one JSON object matching "
    "the schema above, with no markdown or other text.\nJSON output:"
)


def _extract_json_dict(raw: str) -> dict[str, Any] | None:
    """Extract the first complete JSON object from LLM output.

    Uses a balanced decode (raw_decode) rather than a greedy regex so trailing
    prose — including prose containing braces — cannot break parsing.
    """
    decoder = json.JSONDecoder()
    idx = raw.find("{")
    while idx != -1:
        try:
            data, _ = decoder.raw_decode(raw, idx)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
        idx = raw.find("{", idx + 1)
    return None


def _as_str_list(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    return [str(x) for x in v if x]


def _default_strict_partial() -> dict[str, Any]:
    return {
        "summary": "",
        "dates_mentioned": [],
        "people_mentioned": [],
        "locations_mentioned": [],
        "evidence_described": False,
        "allegation_type": [],
    }


def _default_inference_partial() -> dict[str, Any]:
    return {
        "specific_examples_present": False,
        "witnesses_mentioned": False,
        "impact_described": False,
        "retaliation_mentioned": False,
        "prior_reporting_mentioned": False,
        "timeline_clear": False,
    }


def _normalize_strict_partial(data: dict[str, Any]) -> dict[str, Any]:
    d = _default_strict_partial()
    d["summary"] = str(data.get("summary", "")).strip()
    d["dates_mentioned"] = _as_str_list(data.get("dates_mentioned"))
    d["people_mentioned"] = _as_str_list(data.get("people_mentioned"))
    d["locations_mentioned"] = _as_str_list(data.get("locations_mentioned"))
    d["evidence_described"] = bool(data.get("evidence_described", False))
    d["allegation_type"] = _as_str_list(data.get("allegation_type"))
    return d


def _normalize_inference_partial(data: dict[str, Any]) -> dict[str, Any]:
    d = _default_inference_partial()
    d["specific_examples_present"] = bool(data.get("specific_examples_present", False))
    d["witnesses_mentioned"] = bool(data.get("witnesses_mentioned", False))
    d["impact_described"] = bool(data.get("impact_described", False))
    d["retaliation_mentioned"] = bool(data.get("retaliation_mentioned", False))
    d["prior_reporting_mentioned"] = bool(data.get("prior_reporting_mentioned", False))
    d["timeline_clear"] = bool(data.get("timeline_clear", False))
    return d


def _try_strict_pass(raw: str) -> tuple[bool, dict[str, Any]]:
    data = _extract_json_dict(raw)
    if data is None:
        logger.warning("Layer 1 strict pass: invalid JSON")
        return False, _default_strict_partial()
    return True, _normalize_strict_partial(data)


def _try_inference_pass(raw: str) -> tuple[bool, dict[str, Any]]:
    data = _extract_json_dict(raw)
    if data is None:
        logger.warning("Layer 1 inference pass: invalid JSON")
        return False, _default_inference_partial()
    return True, _normalize_inference_partial(data)


def _merge_layer1_passes(
    strict_ok: bool,
    inference_ok: bool,
    strict_part: dict[str, Any],
    inference_part: dict[str, Any],
    measure_len: int,
) -> Layer1Result:
    """Combine strict + inference partials. _used_defaults only when both passes failed."""
    return Layer1Result(
        summary=strict_part["summary"],
        dates_mentioned=list(strict_part["dates_mentioned"]),
        people_mentioned=list(strict_part["people_mentioned"]),
        locations_mentioned=list(strict_part["locations_mentioned"]),
        specific_examples_present=inference_part["specific_examples_present"],
        evidence_described=strict_part["evidence_described"],
        timeline_clear=inference_part["timeline_clear"],
        witnesses_mentioned=inference_part["witnesses_mentioned"],
        prior_reporting_mentioned=inference_part["prior_reporting_mentioned"],
        impact_described=inference_part["impact_described"],
        retaliation_mentioned=inference_part["retaliation_mentioned"],
        allegation_type=list(strict_part["allegation_type"]),
        length_character_count=measure_len,
        _used_defaults=(not strict_ok) and (not inference_ok),
    )


# Legacy single-shot schema / helpers (manual test script + older JSON fixtures)


_LAYER1_FULL_SCHEMA = """{
  "summary": "Neutral 2-4 sentence summary of the narrative",
  "dates_mentioned": ["only explicit dates written in the text"],
  "people_mentioned": ["only explicitly named individuals"],
  "locations_mentioned": ["only explicitly stated locations"],
  "specific_examples_present": false,
  "evidence_described": false,
  "timeline_clear": false,
  "witnesses_mentioned": false,
  "prior_reporting_mentioned": false,
  "impact_described": false,
  "retaliation_mentioned": false,
  "allegation_type": ["categorize only if explicitly stated"],
  "length_character_count": 0
}"""

_LAYER1_LEGACY_PROMPT_TEMPLATE = """You are a structured data extractor. Extract information ONLY from the text below.
Do NOT infer, assume, or add anything not explicitly written.

Rules (each boolean flips to true ONLY when the text EXPLICITLY addresses the topic; never infer):
- dates_mentioned: only explicit dates written in the text
- people_mentioned: only explicitly named individuals (not pronouns or roles)
- locations_mentioned: only explicitly stated place names
- specific_examples_present: true ONLY if a concrete event instance is described
- evidence_described: true ONLY if documents, screenshots, emails, etc. are explicitly referenced
- timeline_clear: true ONLY if sequence of events can be reconstructed from the text
- witnesses_mentioned: true ONLY if the text explicitly references third parties who saw, heard, or can corroborate the incident (not the participants themselves, not the reporter). Do NOT infer.
- prior_reporting_mentioned: true ONLY if the text explicitly states the matter has been raised/reported to someone before (e.g., a manager, HR, hotline, compliance, lawyer). Do NOT infer from general awareness statements.
- impact_described: true ONLY if the text explicitly describes harm caused — people affected, financial loss, safety risk, reputational damage, or similar concrete consequences. Do NOT infer from the mere existence of wrongdoing.
- retaliation_mentioned: true ONLY if the text explicitly mentions retaliation, fear of retaliation, reprisal, punishment for raising concerns, or a chilling effect. Do NOT infer from general fear or anonymity preferences.
- allegation_type: categorize only if explicitly stated in the text
- length_character_count: exact character count of the input text

Output ONLY valid JSON matching this exact schema. No other text:
""" + _LAYER1_FULL_SCHEMA + """

Input text:
{q1_text}
{form_context}
JSON output:"""

_LAYER1_LEGACY_RETRY_HINT = (
    "\n\nYour previous reply was not valid JSON. Output ONLY one JSON object matching "
    "the schema above, with no markdown or other text.\nJSON output:"
)

_CONTEXT_FIELDS_FOR_LEGACY: list[tuple[str, str]] = [
    ("general_nature", "General nature of the issue"),
    ("where_occurred", "Where the incident occurred"),
    ("when_occurred", "When the incident occurred"),
    ("duration", "Duration"),
    ("how_aware", "How the reporter became aware"),
    ("organization_tier", "Organization tier"),
    ("country", "Country"),
    ("incident_location", "Incident location"),
    ("supervisor_involved", "Supervisor involvement"),
    ("management_aware", "Management awareness"),
]


def _build_legacy_form_context(form_data: dict | None) -> str:
    if not form_data:
        return ""
    lines: list[str] = []
    for key, label in _CONTEXT_FIELDS_FOR_LEGACY:
        val = form_data.get(key, "")
        if val and isinstance(val, str) and val.strip():
            lines.append(f"- {label}: {val.strip()}")
    if not lines:
        return ""
    return (
        "\nAdditional context from form fields (use only to disambiguate, "
        "not as primary source):\n" + "\n".join(lines) + "\n"
    )


def _build_layer1_prompt_legacy(q1_text: str, form_data: dict | None = None) -> str:
    """Legacy single-pass prompt (manual tests only; production uses two-pass + sections)."""
    form_context = _build_legacy_form_context(form_data)
    return _LAYER1_LEGACY_PROMPT_TEMPLATE.format(q1_text=q1_text, form_context=form_context)


def _normalize_layer1(data: dict, measure_text: str) -> Layer1Result:
    """Normalize full legacy Layer 1 JSON (used by test_intake.py).

    Reads strict-slot keys via _normalize_strict_partial and judgement booleans
    via _normalize_inference_partial so single-shot responses remain complete.
    """
    strict_like = _normalize_strict_partial(data)
    inf_like = _normalize_inference_partial(data)
    return _merge_layer1_passes(True, True, strict_like, inf_like, len(measure_text))


def _safe_layer1_defaults(measure_text: str) -> Layer1Result:
    return _merge_layer1_passes(
        False,
        False,
        _default_strict_partial(),
        _default_inference_partial(),
        len(measure_text),
    )


def _parse_layer1_json(raw: str, measure_text: str) -> Layer1Result:
    """Parse legacy combined JSON (manual tests)."""
    data = _extract_json_dict(raw)
    if data is None:
        logger.warning("Layer 1: no valid JSON found in response, using safe defaults")
        return _safe_layer1_defaults(measure_text)
    return _normalize_layer1(data, measure_text)


async def _run_layer1_pass_with_retry(
    provider: Any,
    prompt: str,
    retry_hint: str,
    try_pass: Callable[[str], tuple[bool, dict[str, Any]]],
) -> tuple[bool, dict[str, Any]]:
    raw = await collect_stream(
        provider,
        prompt,
        max_tokens=512,
        temperature=settings.INTAKE_TEMPERATURE,
    )
    ok, part = try_pass(raw)
    if ok:
        return ok, part
    raw_retry = await collect_stream(
        provider,
        prompt + retry_hint,
        max_tokens=512,
        temperature=settings.INTAKE_TEMPERATURE,
    )
    ok2, part2 = try_pass(raw_retry)
    return ok2, part2


def _narrative_length(q1_text: str, form_data: dict | None) -> int:
    """Character count of the reporter's own narrative text: Q1 plus follow-up
    answers. This is what length-based gap criteria are meant to measure — not
    the assembled prompt blocks, which grow with unrelated structured fields."""
    fd = form_data or {}
    parts = [
        _strip_val(q1_text),
        _strip_val(fd.get("full_details_q2")),
        _strip_val(fd.get("full_details_gap2")),
    ]
    return sum(len(p) for p in parts if p)


class IntakeLayer1:
    """Layer 1: two concurrent LLM passes over labeled sections."""

    async def extract(self, q1_text: str, form_data: dict | None = None) -> Layer1Result:
        """Run strict + inference extraction. Returns normalized Layer1Result."""
        sections = _build_layer1_sections(q1_text, form_data)
        if not sections.strip():
            raise ValueError("Narrative is empty; cannot run intake analysis")

        measure_len = _narrative_length(q1_text, form_data)
        strict_prompt = _LAYER1_STRICT_PROMPT_HEAD + sections + _LAYER1_STRICT_PROMPT_TAIL
        inference_prompt = (
            _LAYER1_INFERENCE_PROMPT_HEAD + sections + _LAYER1_INFERENCE_PROMPT_TAIL
        )

        provider = get_provider()
        strict_task = _run_layer1_pass_with_retry(
            provider, strict_prompt, _STRICT_RETRY_HINT, _try_strict_pass
        )
        inference_task = _run_layer1_pass_with_retry(
            provider, inference_prompt, _INFERENCE_RETRY_HINT, _try_inference_pass
        )

        (strict_ok, strict_part), (inference_ok, inference_part) = await asyncio.gather(
            strict_task,
            inference_task,
        )

        if not strict_ok:
            logger.warning("Layer 1 strict pass failed after retry; using strict defaults")
        if not inference_ok:
            logger.warning("Layer 1 inference pass failed after retry; using inference defaults")

        result = _merge_layer1_passes(
            strict_ok, inference_ok, strict_part, inference_part, measure_len
        )
        if result["_used_defaults"]:
            logger.warning(
                "Layer 1 both passes failed JSON parse; merged result uses full defaults"
            )
        return result


# ── Layer 2 – Deterministic Gap Analysis ─────────────────────────────────────


def _evaluate_gap(gap: dict, layer1: Layer1Result) -> bool:
    """Evaluate a single gap criteria against Layer 1 JSON. Returns True if gap is present."""
    criteria = gap.get("criteria", {})
    ctype = criteria.get("type")
    field = criteria.get("field")

    if ctype == "boolean_false":
        return not bool(layer1.get(field, False))

    if ctype == "empty_array":
        val = layer1.get(field, [])
        return not isinstance(val, list) or len(val) == 0

    if ctype == "length_threshold":
        threshold = criteria.get("threshold")
        if not isinstance(threshold, (int, float)):
            return False
        count = layer1.get(field, 0)
        return int(count) < int(threshold)

    logger.warning(f"Unknown criteria type: {ctype!r} for gap {gap.get('id')!r}")
    return False


_FORM_FIELD_GAP_SUPPRESSION: dict[str, str] = {}


def _conditional_gap_suppression(form_data: dict) -> set[str]:
    s: set[str] = set()
    if (form_data.get("management_aware") or "").strip().lower() == "yes":
        s.add("no_prior_reporting")
    seq = (form_data.get("sequence_of_events") or "").strip()
    if len(seq) >= 60:
        s.add("no_specific_example")
    return s


def _suppressed_gaps(form_data: dict | None) -> set[str]:
    if not form_data:
        return set()
    suppressed: set[str] = set()
    for field_key, gap_id in _FORM_FIELD_GAP_SUPPRESSION.items():
        val = form_data.get(field_key, "")
        if val and isinstance(val, str) and val.strip():
            suppressed.add(gap_id)
    suppressed |= _conditional_gap_suppression(form_data)
    return suppressed


class IntakeLayer2:
    """Layer 2: Deterministic gap analysis. No LLM involved."""

    def analyze(
        self,
        layer1: Layer1Result,
        gaps: list[dict] | None = None,
        form_data: dict | None = None,
    ) -> list[str]:
        if gaps is None:
            gaps = get_intake_gaps()

        if layer1.get("_used_defaults", False):
            logger.warning(
                "Layer 1 used safe defaults (both passes failed); skipping gap evaluation"
            )
            return []

        suppressed = _suppressed_gaps(form_data)
        active_gaps = [g for g in gaps if g.get("active", True)]
        active_gaps.sort(key=lambda g: g.get("priority", 999))

        identified: list[str] = []
        for gap in active_gaps:
            if len(identified) >= 2:
                break
            if gap["id"] in suppressed:
                continue
            if _evaluate_gap(gap, layer1):
                identified.append(gap["id"])

        return identified


class IntakeLayer3:
    """Layer 3: Template-based question generation."""

    def generate(
        self,
        identified_gaps: list[str],
        gaps: list[dict] | None = None,
    ) -> list[FollowUpQuestion]:
        if gaps is None:
            gaps = get_intake_gaps()

        gap_map = {g["id"]: g for g in gaps}
        questions: list[FollowUpQuestion] = []

        for gap_id in identified_gaps[:2]:
            gap = gap_map.get(gap_id)
            if not gap:
                logger.warning(f"Gap id {gap_id!r} not found in config; skipping")
                continue

            question_text = gap.get("template", "")[:MAX_QUESTION_CHARS]
            questions.append(FollowUpQuestion(gap_id=gap_id, question_text=question_text))

        return questions


class IntakeProcessor:
    """Orchestrates the full 3-layer intake pipeline."""

    def __init__(self) -> None:
        self._layer1 = IntakeLayer1()
        self._layer2 = IntakeLayer2()
        self._layer3 = IntakeLayer3()

    async def process(self, q1_text: str, form_data: dict | None = None) -> IntakeResult:
        gaps = get_intake_gaps()

        layer1_raw = await self._layer1.extract(q1_text, form_data)
        from .extraction_augmentation import augment_extraction_with_form, build_extraction_breakdown

        extraction_breakdown = build_extraction_breakdown(layer1_raw, form_data)
        layer1_merged = augment_extraction_with_form(layer1_raw, form_data)
        identified_gaps = self._layer2.analyze(layer1_merged, gaps, form_data)
        follow_up_questions = self._layer3.generate(identified_gaps, gaps)

        return IntakeResult(
            extraction=layer1_merged,
            gaps=identified_gaps,
            follow_up_questions=follow_up_questions,
            extraction_breakdown=extraction_breakdown,
            analysis_available=not layer1_merged.get("_used_defaults", False),
        )


# Backwards-compatible names for scripts/tests
_build_layer1_prompt = _build_layer1_prompt_legacy
_LAYER1_RETRY_HINT = _LAYER1_LEGACY_RETRY_HINT
