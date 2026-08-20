"""JSON file-based settings store for policy excerpt, API key, and intake gap configs."""

import copy
import json
import logging
import re
import tempfile
from pathlib import Path

from filelock import FileLock

from ..prompts.display_content import FULL_DETAILS_Q3_POLICY_EXCERPT
from ..prompts.intake_gaps import (
    CRITERIA_FIELD_COMPAT,
    DEFAULT_INTAKE_GAPS,
    LAYER1_FIELD_TYPES,
    VALID_CRITERIA_TYPES,
    VALID_LAYER1_FIELDS,
)
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
    valid: list[dict] = []
    for g in gaps_copy:
        try:
            _validate_gap(g)
            valid.append(g)
        except ValueError as e:
            logger.warning(
                "Skipping invalid intake gap from settings (id=%r): %s",
                g.get("id"),
                e,
            )
    return valid if valid else copy.deepcopy(DEFAULT_INTAKE_GAPS)


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
    if criteria["field"] not in VALID_LAYER1_FIELDS:
        raise ValueError(
            f"Gap criteria 'field' must be one of: {sorted(VALID_LAYER1_FIELDS)}"
        )
    # Validate criteria type is compatible with the field's logical type
    field_type = LAYER1_FIELD_TYPES.get(criteria["field"])
    allowed_field_types = CRITERIA_FIELD_COMPAT.get(criteria["type"], set())
    if field_type and allowed_field_types and field_type not in allowed_field_types:
        raise ValueError(
            f"Criteria type {criteria['type']!r} is not compatible with field "
            f"{criteria['field']!r} (type {field_type!r}). "
            f"Compatible field types: {sorted(allowed_field_types)}"
        )
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
    priorities_seen: set[int] = set()
    for gap in gaps:
        _validate_gap(gap)
        gid = gap["id"]
        if gid in ids_seen:
            raise ValueError(f"Duplicate gap id: {gid!r}")
        ids_seen.add(gid)
        pri = gap["priority"]
        if pri in priorities_seen:
            raise ValueError(f"Duplicate gap priority: {pri}")
        priorities_seen.add(pri)

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


# ── Amendment (Component C) clustering thresholds ─────────────────────────────
# Evidence accumulation is the gating mechanism, not model self-confidence —
# these are evaluation parameters, admin-tunable and reported with every run.

DEFAULT_AMENDMENT_CONFIG = {
    "nMin": 2,        # minimum distinct reports in a cluster (evidence volume)
    "simMin": 0.75,   # minimum intra-cluster similarity (same conduct)
    "windowDays": 90, # rolling window (currency)
}


def get_amendment_config() -> dict:
    raw = _read_raw().get("amendmentConfig")
    cfg = dict(DEFAULT_AMENDMENT_CONFIG)
    if isinstance(raw, dict):
        try:
            _validate_amendment_config(raw)
            cfg.update({k: raw[k] for k in DEFAULT_AMENDMENT_CONFIG if k in raw})
        except ValueError as e:
            logger.warning("Ignoring invalid amendmentConfig from settings: %s", e)
    return cfg


def _validate_amendment_config(cfg: dict) -> None:
    if "nMin" in cfg and (not isinstance(cfg["nMin"], int) or cfg["nMin"] < 1):
        raise ValueError("nMin must be a positive integer")
    if "simMin" in cfg and (
        not isinstance(cfg["simMin"], (int, float)) or not 0 < cfg["simMin"] <= 1
    ):
        raise ValueError("simMin must be in (0, 1]")
    if "windowDays" in cfg and (not isinstance(cfg["windowDays"], int) or cfg["windowDays"] < 1):
        raise ValueError("windowDays must be a positive integer")


def update_amendment_config(updates: dict) -> dict:
    """Merge, validate, and persist amendment clustering thresholds."""
    _validate_amendment_config(updates)
    lock_path = SETTINGS_FILE.with_suffix(SETTINGS_FILE.suffix + ".lock")
    with FileLock(lock_path):
        current = _read_raw()
        cfg = dict(DEFAULT_AMENDMENT_CONFIG)
        if isinstance(current.get("amendmentConfig"), dict):
            cfg.update(current["amendmentConfig"])
        cfg.update({k: updates[k] for k in DEFAULT_AMENDMENT_CONFIG if k in updates})
        current["amendmentConfig"] = cfg
        _ensure_dir()
        fd, tmp_path = tempfile.mkstemp(dir=str(DATA_DIR), suffix=".tmp", prefix="settings_")
        try:
            with open(fd, "w", encoding="utf-8") as f:
                json.dump(current, f, indent=2)
            Path(tmp_path).replace(SETTINGS_FILE)
        except BaseException:
            Path(tmp_path).unlink(missing_ok=True)
            raise
        return cfg


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
