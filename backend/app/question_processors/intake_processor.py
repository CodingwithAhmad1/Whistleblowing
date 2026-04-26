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
    _used_defaults: bool  # True if LLM parse failed and safe defaults were used


class FollowUpQuestion(TypedDict):
    gap_id: str
    question_text: str


class IntakeResult(TypedDict):
    extraction: Layer1Result
    gaps: list[str]
    follow_up_questions: list[FollowUpQuestion]
    extraction_breakdown: dict[str, Any]


# ── Layer 1 – Structured Extraction ───────────────────────────────────────────

_LAYER1_SCHEMA = """{
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

_LAYER1_PROMPT_TEMPLATE = """You are a structured data extractor. Extract information ONLY from the text below.
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
{schema}

Input text:
{q1_text}
{form_context}
JSON output:"""

_LAYER1_RETRY_HINT = (
    "\n\nYour previous reply was not valid JSON. Output ONLY one JSON object matching "
    "the schema above, with no markdown or other text.\nJSON output:"
)

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
        witnesses_mentioned=bool(data.get("witnesses_mentioned", False)),
        prior_reporting_mentioned=bool(data.get("prior_reporting_mentioned", False)),
        impact_described=bool(data.get("impact_described", False)),
        retaliation_mentioned=bool(data.get("retaliation_mentioned", False)),
        allegation_type=as_str_list(data.get("allegation_type")),
        length_character_count=len(q1_text),  # always use actual length, never trust LLM
        _used_defaults=False,
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
        witnesses_mentioned=False,
        prior_reporting_mentioned=False,
        impact_described=False,
        retaliation_mentioned=False,
        allegation_type=[],
        length_character_count=len(q1_text),
        _used_defaults=True,
    )


def _build_narrative_input(q1_text: str, form_data: dict | None) -> str:
    """Concatenate primary and follow-up narrative segments into one Layer-1 input.

    Order: primary ``q1_text`` (usually from ``full_details_q1`` or stitched basics),
    then answers to AI follow-up questions, then ``sequence_of_events`` and
    ``evidence_description``. Layer 1 and gap checks use this single combined text
    so reporters are not penalised for answering in separate fields.
    """
    parts: list[str] = []
    q1_text = (q1_text or "").strip()
    if q1_text:
        parts.append(q1_text)
    if form_data:
        for key, label in (
            ("full_details_q2", "Follow-up answer (AI question 1)"),
            ("full_details_gap2", "Follow-up answer (AI question 2)"),
            ("sequence_of_events", "Sequence of events"),
            ("evidence_description", "Evidence described"),
        ):
            val = form_data.get(key, "")
            if val and isinstance(val, str) and val.strip():
                parts.append(f"{label}: {val.strip()}")
    return "\n\n".join(parts)


class IntakeLayer1:
    """Layer 1: LLM extracts structured JSON from the combined narrative."""

    async def extract(self, q1_text: str, form_data: dict | None = None) -> Layer1Result:
        """Run Layer 1 extraction. Returns normalized Layer1Result.

        The narrative input is the concatenation of full_details_q1,
        sequence_of_events, and evidence_description (when present) so gap
        detection sees everything the reporter wrote. Additional form fields
        are passed as context to help disambiguate.
        """
        narrative = _build_narrative_input(q1_text, form_data)
        if not narrative:
            raise ValueError("Narrative is empty; cannot run intake analysis")

        prompt = _build_layer1_prompt(narrative, form_data)
        provider = get_provider()
        raw = await collect_stream(
            provider,
            prompt,
            max_tokens=512,
            temperature=settings.INTAKE_TEMPERATURE,
        )
        result = _parse_layer1_json(raw, narrative)
        if result.get("_used_defaults"):
            raw_retry = await collect_stream(
                provider,
                prompt + _LAYER1_RETRY_HINT,
                max_tokens=512,
                temperature=settings.INTAKE_TEMPERATURE,
            )
            result = _parse_layer1_json(raw_retry, narrative)
        return result


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


# Maps form_data keys to gap IDs they make redundant.
# If the form field has a non-empty value, the corresponding gap is suppressed
# because the user already provided that information outside the narrative.
# Most gaps are evaluated on the combined narrative; this table covers cases where
# a structured field alone clearly signals the same theme (see also
# _conditional_gap_suppression).
_FORM_FIELD_GAP_SUPPRESSION: dict[str, str] = {}


def _conditional_gap_suppression(form_data: dict) -> set[str]:
    """Suppress gaps when structured answers plausibly cover the same information."""
    s: set[str] = set()
    if (form_data.get("management_aware") or "").strip().lower() == "yes":
        s.add("no_prior_reporting")
    seq = (form_data.get("sequence_of_events") or "").strip()
    if len(seq) >= 60:
        # A substantive sequence in the standardised "sequence of events" field
        # supplies concrete order/detail even if the extraction flag is still off.
        s.add("no_specific_example")
    return s


def _suppressed_gaps(form_data: dict | None) -> set[str]:
    """Return set of gap IDs that should be suppressed based on form field values."""
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
        """
        Evaluate active gaps against Layer 1 JSON.
        Returns list of up to 2 gap ids (highest-priority matches).

        If form_data is provided, gaps already answered by form fields are suppressed
        to avoid asking the user for information they already provided.

        If Layer 1 used safe defaults (LLM parse failure), returns empty list
        instead of evaluating meaningless default values.
        """
        if gaps is None:
            gaps = get_intake_gaps()

        if layer1.get("_used_defaults", False):
            logger.warning("Layer 1 used safe defaults (LLM parse failure); skipping gap evaluation")
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

        for gap_id in identified_gaps[:2]:
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
        )
