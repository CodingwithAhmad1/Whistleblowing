"""In-memory storage for chat sessions and reports."""

from typing import Dict, List, Optional
from datetime import datetime
from .models import ReportCreate
import json
import re
import logging

logger = logging.getLogger(__name__)


class ChatSession:
    """Represents a single chat session with conversation history and report state."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.created_at = datetime.utcnow()
        self.conversation_history: List[Dict[str, str]] = []
        self.report_data: Dict[str, str] = {}
        self._cached_system_prompt: Optional[str] = None
        self._prompt_cache_key: Optional[str] = None

    def add_message(self, role: str, content: str):
        """Add a message to conversation history."""
        self.conversation_history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def update_report(self, updates: Dict[str, str]):
        """Update report data with new fields."""
        self.report_data.update(updates)
        self._cached_system_prompt = None
        self._prompt_cache_key = None

    def get_report(self) -> ReportCreate:
        """Get current report state as Pydantic model."""
        return ReportCreate(**self.report_data)

    def extract_json_from_response(self, response: str) -> Optional[Dict]:
        """
        Extract JSON object from assistant response.
        Returns dict with 'data' (field updates) or None.

        Expected format from LLM:
        {"data": {"field_key": "value"}}

        Or legacy format (auto-converted):
        {"field_key": "value"}
        """
        json_pattern = r'\{(?:[^{}]|\{[^{}]*\})*\}'
        matches = re.findall(json_pattern, response)

        person_fields = {
            f"person_{n}_{s}"
            for n in range(1, 11)
            for s in ("first", "last", "title")
        }
        valid_fields = {
            "organization_tier", "country", "incident_location",
            "is_employee", "wish_anonymous", "reporter_first_name", "reporter_last_name",
            "reporter_phone_code", "reporter_phone", "reporter_email", "best_time_contact",
            *person_fields,
            "supervisor_involved", "supervisor_who", "management_aware",
            "general_nature", "where_occurred", "when_occurred", "duration",
            "how_aware", "how_aware_other", "full_details", "persons_concealing"
        }

        def filter_valid(raw: dict) -> dict:
            return {k: str(v) for k, v in raw.items() if k in valid_fields and v}

        for match in matches:
            try:
                data = json.loads(match)
                if not isinstance(data, dict):
                    logger.debug(f"Skipping non-dict JSON: {match}")
                    continue

                field_data = data.get("data", data) if "data" in data else data
                filtered_data = filter_valid(field_data)
                if filtered_data:
                    logger.info(f"Extracted JSON - data: {filtered_data}")
                    return {"data": filtered_data}

            except json.JSONDecodeError as e:
                logger.debug(f"Failed to parse JSON: {match[:100]}... Error: {e}")
                continue

        return None

    def get_cached_system_prompt(self, prompt_builder_func, report_data: Dict[str, str]) -> str:
        """
        Get cached system prompt or build new one if report state changed.
        Cache key is based on filled field keys to avoid rebuilding on every message.
        """
        cache_key = ",".join(sorted([k for k, v in report_data.items() if v and str(v).strip()]))

        if self._cached_system_prompt and self._prompt_cache_key == cache_key:
            logger.debug("Using cached system prompt")
            return self._cached_system_prompt

        logger.debug("Building new system prompt")
        self._cached_system_prompt = prompt_builder_func(report_data)
        self._prompt_cache_key = cache_key
        return self._cached_system_prompt


class SessionStore:
    """In-memory store for all chat sessions."""

    def __init__(self):
        self._sessions: Dict[str, ChatSession] = {}

    def create_session(self, session_id: str) -> ChatSession:
        """Create a new chat session."""
        session = ChatSession(session_id)
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get existing session or None."""
        return self._sessions.get(session_id)

    def get_or_create_session(self, session_id: str) -> ChatSession:
        """Get existing session or create new one."""
        session = self.get_session(session_id)
        if not session:
            session = self.create_session(session_id)
        return session

    def delete_session(self, session_id: str):
        """Delete a session."""
        self._sessions.pop(session_id, None)

    def reset_session(self, session_id: str) -> ChatSession:
        """Reset a session (clear history and report)."""
        self.delete_session(session_id)
        return self.create_session(session_id)


# Global instance
session_store = SessionStore()
