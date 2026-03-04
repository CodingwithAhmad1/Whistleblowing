"""Per-model, per-day usage tracking with JSON file persistence."""

import json
import logging
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from filelock import FileLock

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
USAGE_FILE = DATA_DIR / "usage.json"
_LOCK_FILE = USAGE_FILE.with_suffix(".json.lock")

# Free-tier daily limits per model.
DAILY_LIMITS: dict[str, dict[str, int]] = {
    "gemini-2.0-flash": {
        "requests": 1500,
        "tokens": 1_000_000,
    },
    "gemini-2.5-flash-lite": {
        "requests": 1500,
        "tokens": 1_000_000,
    },
    "gemini-1.5-flash": {
        "requests": 1500,
        "tokens": 1_000_000,
    },
}

_RETENTION_DAYS = 7


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _cutoff_str() -> str:
    cutoff = datetime.now(timezone.utc) - timedelta(days=_RETENTION_DAYS)
    return cutoff.strftime("%Y-%m-%d")


class UsageTracker:
    """Thread-safe per-model, per-day usage tracker backed by a JSON file."""

    def _ensure_dir(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def _read_raw(self) -> dict:
        self._ensure_dir()
        if not USAGE_FILE.exists():
            return {}
        try:
            with open(USAGE_FILE, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Could not read usage file: {e}")
            return {}

    def _write_atomic(self, data: dict) -> None:
        """Write data to USAGE_FILE atomically. Must be called inside the filelock."""
        self._ensure_dir()
        fd, tmp_path = tempfile.mkstemp(dir=str(DATA_DIR), suffix=".tmp", prefix="usage_")
        try:
            with open(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            Path(tmp_path).replace(USAGE_FILE)
        except BaseException:
            Path(tmp_path).unlink(missing_ok=True)
            raise

    def _cleanup_old_dates(self, data: dict) -> None:
        """Remove entries older than retention window. Mutates data in place."""
        cutoff = _cutoff_str()
        stale = [d for d in list(data.keys()) if d < cutoff]
        for d in stale:
            del data[d]

    def _default_entry(self) -> dict:
        return {"requests": 0, "input_tokens": 0, "output_tokens": 0, "exhausted": False}

    def record_usage(self, model: str, input_tokens: int, output_tokens: int) -> None:
        """Increment today's counters for the given model."""
        with FileLock(_LOCK_FILE):
            data = self._read_raw()
            today = _today_str()
            day = data.setdefault(today, {})
            entry = day.setdefault(model, self._default_entry())
            entry["requests"] += 1
            entry["input_tokens"] += input_tokens
            entry["output_tokens"] += output_tokens
            self._cleanup_old_dates(data)
            self._write_atomic(data)

    def mark_exhausted(self, model: str) -> None:
        """Mark a model as quota-exhausted for today."""
        with FileLock(_LOCK_FILE):
            data = self._read_raw()
            today = _today_str()
            day = data.setdefault(today, {})
            entry = day.setdefault(model, self._default_entry())
            entry["exhausted"] = True
            logger.warning(f"Model {model!r} marked quota-exhausted for {today}")
            self._cleanup_old_dates(data)
            self._write_atomic(data)

    def is_exhausted(self, model: str) -> bool:
        """Return True if the model is marked exhausted for today."""
        data = self._read_raw()
        return data.get(_today_str(), {}).get(model, {}).get("exhausted", False)

    def get_cumulative_summary(self) -> dict:
        """
        Return total requests and tokens summed across all stored dates (up to 7 days),
        broken down per model and as an overall total.
        """
        data = self._read_raw()
        per_model: dict[str, dict] = {}
        for model in DAILY_LIMITS:
            per_model[model] = {"requests": 0, "tokens": 0}

        for day_data in data.values():
            for model, entry in day_data.items():
                if model not in per_model:
                    per_model[model] = {"requests": 0, "tokens": 0}
                per_model[model]["requests"] += entry.get("requests", 0)
                per_model[model]["tokens"] += (
                    entry.get("input_tokens", 0) + entry.get("output_tokens", 0)
                )

        total_requests = sum(v["requests"] for v in per_model.values())
        total_tokens = sum(v["tokens"] for v in per_model.values())
        days_stored = len(data)

        return {
            "days_stored": days_stored,
            "per_model": per_model,
            "total_requests": total_requests,
            "total_tokens": total_tokens,
        }

    def get_today_summary(self) -> list[dict]:
        """
        Return usage stats for all known models for today.
        Models not yet seen today are included with zero counts.
        """
        data = self._read_raw()
        today_data = data.get(_today_str(), {})
        results = []
        for model, limits in DAILY_LIMITS.items():
            entry = today_data.get(model, {})
            requests_used = entry.get("requests", 0)
            tokens_used = entry.get("input_tokens", 0) + entry.get("output_tokens", 0)
            requests_limit = limits["requests"]
            tokens_limit = limits["tokens"]
            results.append({
                "model": model,
                "requests_used": requests_used,
                "requests_limit": requests_limit,
                "tokens_used": tokens_used,
                "tokens_limit": tokens_limit,
                "requests_pct": round(requests_used / requests_limit * 100, 1),
                "tokens_pct": round(tokens_used / tokens_limit * 100, 1),
                "exhausted": entry.get("exhausted", False),
            })
        return results


_tracker: Optional[UsageTracker] = None


def get_tracker() -> UsageTracker:
    """Return the module-level UsageTracker singleton."""
    global _tracker
    if _tracker is None:
        _tracker = UsageTracker()
    return _tracker
