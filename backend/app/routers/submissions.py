"""File-backed submission feed (shared across browsers and with MCP)."""

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

_lock = threading.Lock()
router = APIRouter()

# Overridable for tests: REPORTIQ_SUBMISSIONS_PATH=... or CWD-based default
def _data_file() -> Path:
    env = os.environ.get("REPORTIQ_SUBMISSIONS_PATH", "").strip()
    if env:
        return Path(env).resolve()
    # backend/data (same as app/settings/store.py DATA_DIR)
    base = Path(__file__).resolve().parent.parent.parent
    return base / "data" / "submissions.json"


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
    gaps: list[str] = Field(default_factory=list)
    followUpQuestions: list[FollowUpQ] = Field(default_factory=list)


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
            gaps=list(row.get("gaps") or []),
            followUpQuestions=[FollowUpQ(**f) for f in fups],
        )


def _read_all_unsafe(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as e:
        logger.error("read submissions: %s", e)
        raise HTTPException(status_code=500, detail="Failed to read submissions") from e
    if not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("submissions file corrupt: %s", e)
        raise HTTPException(status_code=500, detail="Submissions data file is invalid JSON") from e
    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="Submissions data must be a list")
    return data


def _write_all_unsafe(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)
    except OSError as e:
        logger.error("write submissions: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save submissions") from e


@router.get("/submissions", response_model=list[SubmissionOut])
def list_submissions():
    with _lock:
        return [_ensure_row(s) for s in _read_all_unsafe(_data_file())]


@router.post("/submissions", response_model=SubmissionOut, status_code=201)
def create_submission(body: SubmissionCreate):
    with _lock:
        path = _data_file()
        items = _read_all_unsafe(path)
        next_id = max((int(s.get("id", 0)) for s in items), default=0) + 1
        row = {
            "id": next_id,
            "timestamp": body.timestamp,
            "formData": body.formData,
            "extraction": body.extraction,
            "gaps": list(body.gaps),
            "followUpQuestions": [x.model_dump() for x in body.followUpQuestions],
        }
        items.append(row)
        _write_all_unsafe(path, items)
    return SubmissionOut.from_row(row)


@router.delete("/submissions/{submission_id}", response_model=Literal[True])
def delete_submission(submission_id: int):
    with _lock:
        path = _data_file()
        items = _read_all_unsafe(path)
        n = len(items)
        items = [s for s in items if int(s.get("id", 0)) != submission_id]
        if len(items) == n:
            raise HTTPException(status_code=404, detail="Submission not found")
        _write_all_unsafe(path, items)
    return True


def _ensure_row(s: dict[str, Any]) -> SubmissionOut:
    if "id" not in s or "timestamp" not in s:
        raise HTTPException(status_code=500, detail="Invalid submission record")
    return SubmissionOut.from_row(s)
