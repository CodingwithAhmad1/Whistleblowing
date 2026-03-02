# API Reference

## Base URL

- **Development**: `http://localhost:8000`
- **Prefix**: `/api`

---

## Health Check

### GET /api/health

Returns service and LLM provider status.

**Response:**
```json
{
  "status": "ok",
  "provider": "gemini",
  "ready": true
}
```

---

## WebSocket Chat

### WS /api/chat/{session_id}

Real-time streaming chat. Each `session_id` has its own conversation and report state.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/api/chat/my-session-id');
```

### Client → Server

```json
{
  "type": "message",
  "content": "I want to report financial misconduct..."
}
```

- `type`: Must be `"message"`.
- `content`: Non-empty string.

### Server → Client

**Streaming tokens:**
```json
{"type": "token", "content": "I"}
{"type": "token", "content": " understand"}
```

**Report field update (when AI extracts data):**
```json
{
  "type": "report_update",
  "data": {
    "general_nature": "Financial misconduct",
    "where_occurred": "Accounting department"
  }
}
```

**Stream complete:**
```json
{"type": "done"}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

## REST Endpoints

### GET /api/reports/{session_id}

Get current report state for a session.

**Response:**
```json
{
  "session_id": "abc123",
  "created_at": "2025-03-01T12:00:00",
  "report": { /* ReportData */ },
  "message_count": 5
}
```

**Status:** 200 OK | 404 Not Found

### POST /api/reports/{session_id}/reset

Reset session (clear history and report).

**Response:**
```json
{
  "session_id": "abc123",
  "status": "reset",
  "created_at": "2025-03-01T12:05:00"
}
```

### GET /api/sessions/{session_id}/history

Get conversation history.

**Response:**
```json
{
  "session_id": "abc123",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**Status:** 200 OK | 404 Not Found

---

## Report Data Model

See `frontend/src/types/report.ts` and `backend/app/models.py` for the full schema. Key fields include:

- **Organization**: organization_tier, country, incident_location
- **Reporter**: is_employee, wish_anonymous, reporter_first_name, reporter_last_name, reporter_phone_code, reporter_phone, reporter_email, best_time_contact
- **Persons**: person_1_first, person_1_last, person_1_title, … person_10_*
- **Incident**: general_nature, where_occurred, when_occurred, duration, how_aware, how_aware_other, persons_concealing, full_details
