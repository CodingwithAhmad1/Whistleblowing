"""Test history persistence — JSON file with filelock."""

import json
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
TEST_HISTORY_FILE = DATA_DIR / "test_history.json"
MAX_HISTORY_ENTRIES = 50


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_test_history() -> list[dict]:
    """Read test history from JSON file. Returns empty list if file missing."""
    if not TEST_HISTORY_FILE.exists():
        return []
    try:
        from filelock import FileLock
        lock = FileLock(str(TEST_HISTORY_FILE) + ".lock", timeout=5)
        with lock:
            return json.loads(TEST_HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"Failed to read test history: {e}")
        return []


def append_test_result(result: dict) -> None:
    """Append a test result to history. FIFO capped at MAX_HISTORY_ENTRIES."""
    _ensure_data_dir()
    try:
        from filelock import FileLock
        lock = FileLock(str(TEST_HISTORY_FILE) + ".lock", timeout=5)
        with lock:
            history = []
            if TEST_HISTORY_FILE.exists():
                try:
                    history = json.loads(TEST_HISTORY_FILE.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, IOError):
                    history = []
            history.append(result)
            # FIFO trim
            if len(history) > MAX_HISTORY_ENTRIES:
                history = history[-MAX_HISTORY_ENTRIES:]
            # Atomic write
            tmp = tempfile.NamedTemporaryFile(
                mode="w", dir=str(DATA_DIR), suffix=".tmp", delete=False, encoding="utf-8"
            )
            try:
                json.dump(history, tmp, indent=2)
                tmp.close()
                Path(tmp.name).replace(TEST_HISTORY_FILE)
            except Exception:
                Path(tmp.name).unlink(missing_ok=True)
                raise
    except Exception as e:
        logger.warning(f"Failed to append test result: {e}")


def clear_test_history() -> None:
    """Clear all test history."""
    _ensure_data_dir()
    try:
        from filelock import FileLock
        lock = FileLock(str(TEST_HISTORY_FILE) + ".lock", timeout=5)
        with lock:
            TEST_HISTORY_FILE.write_text("[]", encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed to clear test history: {e}")
