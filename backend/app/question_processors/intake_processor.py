"""
Deterministic AI intake workflow – 3-layer pipeline for Full Details Q1 analysis.

Layer 1: LLM extracts structured JSON from Q1 narrative.
Layer 2: Deterministic gap analysis using Layer 1 JSON and gap configs (no LLM).
Layer 3: Template-based question generation.
"""

import json
import logging
import re
from typing import Any, TypedDict

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
    allegation_type: list[str]
    length_character_count: int


class FollowUpQuestion(TypedDict):
    gap_id: str
    question_text: str


class IntakeResult(TypedDict):
    extraction: Layer1Result
    gaps: list[str]
    follow_up_questions: list[FollowUpQuestion]


# ── Layer 1 – Structured Extraction ───────────────────────────────────────────

_LAYER1_SCHEMA = """{
  "summary": "Neutral 2-4 sentence summary of the narrative",
  "dates_mentioned": ["only explicit dates written in the text"],
  "people_mentioned": ["only explicitly named individuals"],
  "locations_mentioned": ["only explicitly stated locations"],
  "specific_examples_present": false,
  "evidence_described": false,
  "timeline_clear": false,
  "allegation_type": ["categorize only if explicitly stated"],
  "length_character_count": 0
}"""

_LAYER1_PROMPT_TEMPLATE = """You are a structured data extractor. Extract information ONLY from the text below.
Do NOT infer, assume, or add anything not explicitly written.

Rules:
- dates_mentioned: only explicit dates written in the text
- people_mentioned: only explicitly named individuals (not pronouns or roles)
- locations_mentioned: only explicitly stated place names
- specific_examples_present: true ONLY if a concrete event instance is described
- evidence_described: true ONLY if documents, screenshots, emails, etc. are explicitly referenced
- timeline_clear: true ONLY if sequence of events can be reconstructed from the text
- allegation_type: categorize only if explicitly stated in the text
- length_character_count: exact character count of the input text

Output ONLY valid JSON matching this exact schema. No other text:
{schema}

Input text:
{q1_text}
{form_context}
JSON output:"""

# Fields from the form that provide useful context for extraction
_CONTEXT_FIELDS: list[tuple[str, str]] = [
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


def _build_form_context(form_data: dict | None) -> str:
    """Build additional context from form fields for Layer 1 prompt."""
    if not form_data:
        return ""
    lines: list[str] = []
    for key, label in _CONTEXT_FIELDS:
        val = form_data.get(key, "")
        if val and isinstance(val, str) and val.strip():
            lines.append(f"- {label}: {val.strip()}")
    if not lines:
        return ""
    return "\nAdditional context from form fields (use only to disambiguate, not as primary source):\n" + "\n".join(lines) + "\n"


def _build_layer1_prompt(q1_text: str, form_data: dict | None = None) -> str:
    form_context = _build_form_context(form_data)
    return _LAYER1_PROMPT_TEMPLATE.format(
        schema=_LAYER1_SCHEMA, q1_text=q1_text, form_context=form_context
    )


def _parse_layer1_json(raw: str, q1_text: str) -> Layer1Result:
    """Extract Layer 1 JSON from LLM response, with safe defaults on parse failure."""
    # Try to find first {...} block
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, dict):
                return _normalize_layer1(data, q1_text)
        except json.JSONDecodeError:
            logger.warning("Layer 1 JSON parse failed; using safe defaults")

    logger.warning("Layer 1: no valid JSON found in response, using safe defaults")
    return _safe_layer1_defaults(q1_text)


def _normalize_layer1(data: dict, q1_text: str) -> Layer1Result:
    """Normalize and validate Layer 1 JSON, filling missing keys with safe defaults."""
    def as_str_list(v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [str(x) for x in v if x]

    return Layer1Result(
        summary=str(data.get("summary", "")).strip(),
        dates_mentioned=as_str_list(data.get("dates_mentioned")),
        people_mentioned=as_str_list(data.get("people_mentioned")),
        locations_mentioned=as_str_list(data.get("locations_mentioned")),
        specific_examples_present=bool(data.get("specific_examples_present", False)),
        evidence_described=bool(data.get("evidence_described", False)),
        timeline_clear=bool(data.get("timeline_clear", False)),
        allegation_type=as_str_list(data.get("allegation_type")),
        length_character_count=len(q1_text),  # always use actual length, never trust LLM
    )


def _safe_layer1_defaults(q1_text: str) -> Layer1Result:
    return Layer1Result(
        summary="",
        dates_mentioned=[],
        people_mentioned=[],
        locations_mentioned=[],
        specific_examples_present=False,
        evidence_described=False,
        timeline_clear=False,
        allegation_type=[],
        length_character_count=len(q1_text),
    )


class IntakeLayer1:
    """Layer 1: LLM extracts structured JSON from Q1 narrative."""

    async def extract(self, q1_text: str, form_data: dict | None = None) -> Layer1Result:
        """Run Layer 1 extraction. Returns normalized Layer1Result.

        If form_data is provided, additional form fields are included as context
        to help disambiguate the extraction (but Q1 text remains the primary source).
        """
        q1_text = q1_text.strip()
        if not q1_text:
            raise ValueError("Q1 text is empty; cannot run intake analysis")

        prompt = _build_layer1_prompt(q1_text, form_data)
        provider = get_provider()
        raw = await collect_stream(provider, prompt, max_tokens=512)
        return _parse_layer1_json(raw, q1_text)


# ── Layer 2 – Deterministic Gap Analysis ─────────────────────────────────────

def _evaluate_gap(gap: dict, layer1: Layer1Result) -> bool:
    """Evaluate a single gap criteria against Layer 1 JSON. Returns True if gap is present."""
    criteria = gap.get("criteria", {})
    ctype = criteria.get("type")
    field = criteria.get("field")

    if ctype == "boolean_false":
        # Gap present when the boolean field is False
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


class IntakeLayer2:
    """Layer 2: Deterministic gap analysis. No LLM involved."""

    def analyze(self, layer1: Layer1Result, gaps: list[dict] | None = None) -> list[str]:
        """
        Evaluate active gaps against Layer 1 JSON.
        Returns list of up to 2 gap ids (in priority order).
        """
        if gaps is None:
            gaps = get_intake_gaps()

        active_gaps = [g for g in gaps if g.get("active", True)]
        active_gaps.sort(key=lambda g: g.get("priority", 999))

        identified: list[str] = []
        for gap in active_gaps:
            if len(identified) >= 1:
                break
            if _evaluate_gap(gap, layer1):
                identified.append(gap["id"])

        return identified


# ── Layer 3 – Template-based Question Generation ──────────────────────────────

class IntakeLayer3:
    """Layer 3: Template-based question generation."""

    def generate(
        self,
        identified_gaps: list[str],
        gaps: list[dict] | None = None,
    ) -> list[FollowUpQuestion]:
        """
        Generate follow-up question from the top gap template.
        Returns list of FollowUpQuestion dicts.
        """
        if gaps is None:
            gaps = get_intake_gaps()

        gap_map = {g["id"]: g for g in gaps}
        questions: list[FollowUpQuestion] = []

        for gap_id in identified_gaps[:1]:
            gap = gap_map.get(gap_id)
            if not gap:
                logger.warning(f"Gap id {gap_id!r} not found in config; skipping")
                continue

            question_text = gap.get("template", "")[:MAX_QUESTION_CHARS]
            questions.append(FollowUpQuestion(gap_id=gap_id, question_text=question_text))

        return questions


# ── Orchestrator ──────────────────────────────────────────────────────────────

class IntakeProcessor:
    """Orchestrates the full 3-layer intake pipeline."""

    def __init__(self) -> None:
        self._layer1 = IntakeLayer1()
        self._layer2 = IntakeLayer2()
        self._layer3 = IntakeLayer3()

    async def process(self, q1_text: str, form_data: dict | None = None) -> IntakeResult:
        """Run full 3-layer pipeline on Q1 text. Returns combined IntakeResult.

        If form_data is provided, additional form fields are passed to Layer 1
        to enrich the extraction context.
        """
        gaps = get_intake_gaps()

        layer1_result = await self._layer1.extract(q1_text, form_data)
        identified_gaps = self._layer2.analyze(layer1_result, gaps)
        follow_up_questions = self._layer3.generate(identified_gaps, gaps)

        return IntakeResult(
            extraction=layer1_result,
            gaps=identified_gaps,
            follow_up_questions=follow_up_questions,
        )
