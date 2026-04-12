# Backend

FastAPI backend for ReportIQ. Serves the WebSocket chat API, question generation endpoints, admin settings, and model usage stats.

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Running

Use the project root scripts (recommended):

```bash
# From project root — starts both backend and frontend
npm run start

# Backend only
npm run start:backend
```

Or run directly from the backend directory (must use the venv interpreter):

```bash
cd backend
venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

> **Important:** Always run via `venv/bin/python` (or the activated venv). The system `python3` does not have the project dependencies installed.

## Configuration

Create `backend/.env` from `.env.example`:

```env
GEMINI_API_KEY=your_google_ai_api_key_here
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | No* | — | Google AI API key. Admin-stored key takes precedence. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-lite` | Preferred Gemini model. Falls back through the model chain on quota exhaustion. |
| `GEMINI_EMBEDDING_MODEL` | No | `models/text-embedding-004` | Embedding model for future policy document search. |
| `TEMPERATURE` | No | `0.7` | LLM sampling temperature. |
| `TOP_P` | No | `0.9` | LLM nucleus sampling probability. |
| `MAX_TOKENS` | No | `512` | Default max output tokens per request. |
| `HOST` | No | `0.0.0.0` | Bind address. |
| `PORT` | No | `8000` | Bind port. |
| `CORS_ORIGINS` | No | `["http://localhost:5173","http://localhost:3000"]` | Allowed CORS origins. |

\* API key is required (from Admin settings OR `.env`) to enable chat, Q2/Q3 generation, and embeddings.

## Model Fallback Chain

When a model returns a 429 quota error, the backend automatically retries with the next available model. The full chain is:

```
gemini-2.0-flash → gemini-2.5-flash-lite → gemini-2.5-flash
```

The backend starts from whichever model is set in `GEMINI_MODEL` (default: `gemini-2.5-flash-lite`) and cycles through the rest in chain order. Models that return HTTP 429 are skipped for the rest of the UTC day **in that server process** (in-memory; no `usage.json`).

## API Endpoints

### Chat & Session

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `WS` | `/api/chat/{session_id}` | Streaming chat (two-layer classify → execute) |
| `GET` | `/api/reports/{session_id}` | Report state for a session |
| `POST` | `/api/reports/{session_id}/reset` | Reset session |
| `GET` | `/api/sessions/{session_id}/history` | Conversation history |

### Question Generation (Full Details)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/questions/intake/analyze` | 3-layer deterministic intake analysis on Q1 narrative → 0–2 follow-up questions |
| `POST` | `/api/questions/q2/generate` | AI-generated ~10-word follow-up question (legacy, used by chat workflow) |
| `POST` | `/api/questions/q3/generate` | AI-generated policy excerpt + question (legacy) |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/settings` | Get admin settings |
| `PUT` | `/api/admin/settings` | Update admin settings |
| `GET` | `/api/intake/gaps` | Read-only intake gap list (same data as admin GET, for Analysis page) |
| `GET` | `/api/admin/intake-gaps` | Get all intake gap configurations |
| `PUT` | `/api/admin/intake-gaps` | Replace full ordered gap list |
| `POST` | `/api/admin/intake-gaps` | Add a new gap (auto-generates id from label) |
| `PUT` | `/api/admin/intake-gaps/{gap_id}` | Update fields on a single gap |
| `DELETE` | `/api/admin/intake-gaps/{gap_id}` | Delete a gap by id |

## Data Files

| File | Description |
|------|-------------|
| `backend/data/settings.json` | Persisted admin settings (API key, Q2/Q3 templates, intake gap configs). Created on first save. |
