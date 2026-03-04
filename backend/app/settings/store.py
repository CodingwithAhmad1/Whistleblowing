"""JSON file-based settings store for policy excerpt, API key, and intake gap configs."""

import copy
import json
import logging
import re
import tempfile
from pathlib import Path

from filelock import FileLock

from ..prompts.display_content import FULL_DETAILS_Q3_POLICY_EXCERPT
from ..prompts.intake_gaps import DEFAULT_INTAKE_GAPS, VALID_CRITERIA_TYPES
from ..question_processors.report_utils import has_value

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"

_DEFAULT_SETTINGS = {
    "policyExcerpt": FULL_DETAILS_Q3_POLICY_EXCERPT,
    "apiKey": "",
    "q2PromptTemplate": "",
    "q3PromptTemplate": "",
    "intakeGaps": DEFAULT_INTAKE_GAPS,
}


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_raw() -> dict:
    _ensure_dir()
    if not SETTINGS_FILE.exists():
        return copy.deepcopy(_DEFAULT_SETTINGS)
    try:
        with open(SETTINGS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return copy.deepcopy(_DEFAULT_SETTINGS)
        return data
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"Could not read settings file: {e}")
        return copy.deepcopy(_DEFAULT_SETTINGS)


def get_settings() -> dict:
    """Return current settings. Missing keys use defaults."""
    raw = _read_raw()
    return {
        "policyExcerpt": raw.get("policyExcerpt") or _DEFAULT_SETTINGS["policyExcerpt"],
        "apiKey": raw.get("apiKey") or "",
        "q2PromptTemplate": raw.get("q2PromptTemplate", ""),
        "q3PromptTemplate": raw.get("q3PromptTemplate", ""),
        "intakeGaps": raw.get("intakeGaps") or list(DEFAULT_INTAKE_GAPS),
    }


def get_intake_gaps() -> list[dict]:
    """Return current intake gap configs sorted by priority, falling back to defaults.

    Always returns independent deep copies — callers may mutate freely.
    """
    raw = _read_raw()
    gaps = raw.get("intakeGaps")
    if not gaps or not isinstance(gaps, list):
        return copy.deepcopy(DEFAULT_INTAKE_GAPS)
    # Sort by priority for consistent ordering (backend runtime also sorts, this
    # makes the API response order predictable for the frontend display too).
    gaps_copy = copy.deepcopy(gaps)
    gaps_copy.sort(key=lambda g: g.get("priority", 999))
    return gaps_copy


def _validate_gap(gap: dict) -> None:
    """Raise ValueError if gap dict has invalid structure."""
    if not isinstance(gap.get("id"), str) or not gap["id"].strip():
        raise ValueError("Gap 'id' must be a non-empty string")
    if not isinstance(gap.get("label"), str) or not gap["label"].strip():
        raise ValueError("Gap 'label' must be a non-empty string")
    if not isinstance(gap.get("priority"), int) or gap["priority"] < 1:
        raise ValueError("Gap 'priority' must be a positive integer")
    if not isinstance(gap.get("active"), bool):
        raise ValueError("Gap 'active' must be a boolean")
    criteria = gap.get("criteria")
    if not isinstance(criteria, dict):
        raise ValueError("Gap 'criteria' must be an object")
    if criteria.get("type") not in VALID_CRITERIA_TYPES:
        raise ValueError(f"Gap criteria 'type' must be one of: {VALID_CRITERIA_TYPES}")
    if not isinstance(criteria.get("field"), str) or not criteria["field"].strip():
        raise ValueError("Gap criteria 'field' must be a non-empty string")
    if criteria["type"] == "length_threshold":
        threshold = criteria.get("threshold")
        if not isinstance(threshold, (int, float)) or threshold < 0:
            raise ValueError("Gap criteria 'threshold' must be a non-negative number for length_threshold type")
    if not isinstance(gap.get("template"), str) or not gap["template"].strip():
        raise ValueError("Gap 'template' must be a non-empty string")


def update_intake_gaps(gaps: list[dict]) -> list[dict]:
    """Validate and persist the full gap list. Returns saved list."""
    if not isinstance(gaps, list):
        raise ValueError("gaps must be a list")
    ids_seen: set[str] = set()
    for gap in gaps:
        _validate_gap(gap)
        gid = gap["id"]
        if gid in ids_seen:
            raise ValueError(f"Duplicate gap id: {gid!r}")
        ids_seen.add(gid)

    lock_path = SETTINGS_FILE.with_suffix(SETTINGS_FILE.suffix + ".lock")
    lock = FileLock(lock_path)
    with lock:
        current = _read_raw()
        current["intakeGaps"] = gaps
        _ensure_dir()
        try:
            fd, tmp_path = tempfile.mkstemp(
                dir=str(DATA_DIR), suffix=".tmp", prefix="settings_"
            )
            try:
                with open(fd, "w", encoding="utf-8") as f:
                    json.dump(current, f, indent=2)
                Path(tmp_path).replace(SETTINGS_FILE)
            except BaseException:
                Path(tmp_path).unlink(missing_ok=True)
                raise
        except OSError as e:
            logger.error(f"Failed to write intake gaps: {e}")
            raise
    return gaps


def _slugify(label: str) -> str:
    """Convert label to a URL/id-safe slug."""
    slug = label.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    return slug or "gap"


def update_settings(updates: dict) -> dict:
    """Update settings and persist to file. Returns merged settings."""
    lock_path = SETTINGS_FILE.with_suffix(SETTINGS_FILE.suffix + ".lock")
    lock = FileLock(lock_path)
    with lock:
        current = _read_raw()
        if "policyExcerpt" in updates:
            val = updates.get("policyExcerpt")
            current["policyExcerpt"] = str(val).strip() if has_value(val) else _DEFAULT_SETTINGS["policyExcerpt"]
        if "apiKey" in updates:
            val = updates.get("apiKey")
            current["apiKey"] = str(val) if val is not None else ""
        if "q2PromptTemplate" in updates:
            val = updates.get("q2PromptTemplate")
            current["q2PromptTemplate"] = str(val) if val is not None else ""
        if "q3PromptTemplate" in updates:
            val = updates.get("q3PromptTemplate")
            current["q3PromptTemplate"] = str(val) if val is not None else ""
        _ensure_dir()
        try:
            fd, tmp_path = tempfile.mkstemp(
                dir=str(DATA_DIR), suffix=".tmp", prefix="settings_"
            )
            try:
                with open(fd, "w", encoding="utf-8") as f:
                    json.dump(current, f, indent=2)
                Path(tmp_path).replace(SETTINGS_FILE)
            except BaseException:
                Path(tmp_path).unlink(missing_ok=True)
                raise
        except OSError as e:
            logger.error(f"Failed to write settings: {e}")
            raise
        return {
            "policyExcerpt": current.get("policyExcerpt") or _DEFAULT_SETTINGS["policyExcerpt"],
            "apiKey": current.get("apiKey") or "",
            "q2PromptTemplate": current.get("q2PromptTemplate", ""),
            "q3PromptTemplate": current.get("q3PromptTemplate", ""),
        }
