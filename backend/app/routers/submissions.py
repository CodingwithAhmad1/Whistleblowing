"""File-backed submission feed (shared across browsers and with MCP).

Concurrency: the file is written by multiple processes (uvicorn workers, the MCP
server), so a cross-process FileLock guards every read-modify-write, mirroring
app/settings/store.py. Writes are atomic (tmp file + replace).

File format: {"next_id": int, "items": [...]}. A legacy bare list is read
transparently and migrated on the next write; IDs are monotonic and never
reused after deletion.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from filelock import FileLock
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

router = APIRouter()

_LOCK_TIMEOUT_SECONDS = 10


# Overridable for tests: REPORTIQ_SUBMISSIONS_PATH=... or CWD-based default
def _data_file() -> Path:
    env = os.environ.get("REPORTIQ_SUBMISSIONS_PATH", "").strip()
    if env:
        return Path(env).resolve()
    # backend/data (same as app/settings/store.py DATA_DIR)
    base = Path(__file__).resolve().parent.parent.parent
    return base / "data" / "submissions.json"


def _file_lock(path: Path) -> FileLock:
    path.parent.mkdir(parents=True, exist_ok=True)
    return FileLock(str(path) + ".lock", timeout=_LOCK_TIMEOUT_SECONDS)


class FollowUpQ(BaseModel):
    model_config = ConfigDict(extra="forbid")
    gap_id: str
    question_text: str


class SubmissionCreate(BaseModel):
    """Request body (matches frontend / MCP)."""

    model_config = ConfigDict(extra="forbid")
    timestamp: str
    formData: dict[str, Any] = Field(..., description="Full report form object")
    extraction: dict[str, Any] | None = None
    extractionBreakdown: dict[str, Any] | None = None
    gaps: list[str] = Field(default_factory=list)
    followUpQuestions: list[FollowUpQ] = Field(default_factory=list)
    # Dual-corpus coverage snapshot: {"classification", "policy_score",
    # "legal_score", "refs"} — computed at submit time, input to Component C.
    coverage: dict[str, Any] | None = None


class SubmissionOut(SubmissionCreate):
    id: int

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> SubmissionOut:
        fups = [
            {"gap_id": x["gap_id"], "question_text": x["question_text"]}
            for x in (row.get("followUpQuestions") or [])
        ]
        return cls(
            id=row["id"],
            timestamp=row["timestamp"],
            formData=row.get("formData") or row.get("form_data") or {},
            extraction=row.get("extraction"),
            extractionBreakdown=row.get("extractionBreakdown"),
            gaps=list(row.get("gaps") or []),
            followUpQuestions=[FollowUpQ(**f) for f in fups],
            coverage=row.get("coverage"),
        )


def _read_store_unsafe(path: Path) -> dict[str, Any]:
    """Read {"next_id", "items"}; tolerate the legacy bare-list format."""
    if not path.is_file():
        return {"next_id": 1, "items": []}
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as e:
        logger.error("read submissions: %s", e)
        raise HTTPException(status_code=500, detail="Failed to read submissions") from e
    if not raw.strip():
        return {"next_id": 1, "items": []}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("submissions file corrupt: %s", e)
        raise HTTPException(status_code=500, detail="Submissions data file is invalid JSON") from e
    if isinstance(data, list):
        # Legacy format: derive the counter once; migrated on next write.
        next_id = max((int(s.get("id", 0)) for s in data), default=0) + 1
        return {"next_id": next_id, "items": data}
    if isinstance(data, dict) and isinstance(data.get("items"), list):
        items = data["items"]
        next_id = data.get("next_id")
        if not isinstance(next_id, int) or next_id < 1:
            next_id = max((int(s.get("id", 0)) for s in items), default=0) + 1
        return {"next_id": next_id, "items": items}
    raise HTTPException(status_code=500, detail="Submissions data has unexpected shape")


def _write_store_unsafe(path: Path, store: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)
    except OSError as e:
        logger.error("write submissions: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save submissions") from e


def read_all_submissions() -> list[dict[str, Any]]:
    """Read-only access to submission rows (used by the amendments pipeline)."""
    path = _data_file()
    with _file_lock(path):
        return _read_store_unsafe(path)["items"]


def update_submission_fields(submission_id: int, fields: dict[str, Any]) -> bool:
    """Merge fields into one submission row. Returns False if the id is unknown."""
    path = _data_file()
    with _file_lock(path):
        store = _read_store_unsafe(path)
        for row in store["items"]:
            if int(row.get("id", 0)) == submission_id:
                row.update(fields)
                _write_store_unsafe(path, store)
                return True
    return False


@router.get("/submissions", response_model=list[SubmissionOut])
def list_submissions():
    path = _data_file()
    with _file_lock(path):
        return [_ensure_row(s) for s in _read_store_unsafe(path)["items"]]


@router.post("/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(body: SubmissionCreate):
    path = _data_file()
    with _file_lock(path):
        store = _read_store_unsafe(path)
        next_id = store["next_id"]
        row = {
            "id": next_id,
            "timestamp": body.timestamp,
            "formData": body.formData,
            "extraction": body.extraction,
            "extractionBreakdown": body.extractionBreakdown,
            "gaps": list(body.gaps),
            "followUpQuestions": [x.model_dump() for x in body.followUpQuestions],
            "coverage": body.coverage,
        }
        store["items"].append(row)
        store["next_id"] = next_id + 1
        _write_store_unsafe(path, store)
    return SubmissionOut.from_row(row)


@router.delete("/submissions/{submission_id}", response_model=Literal[True])
def delete_submission(submission_id: int):
    path = _data_file()
    with _file_lock(path):
        store = _read_store_unsafe(path)
        n = len(store["items"])
        store["items"] = [s for s in store["items"] if int(s.get("id", 0)) != submission_id]
        if len(store["items"]) == n:
            raise HTTPException(status_code=404, detail="Submission not found")
        _write_store_unsafe(path, store)
    return True


def _ensure_row(s: dict[str, Any]) -> SubmissionOut:
    if "id" not in s or "timestamp" not in s:
        raise HTTPException(status_code=500, detail="Invalid submission record")
    return SubmissionOut.from_row(s)
