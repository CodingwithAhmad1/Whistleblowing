# ReportIQ – Whistleblowing Report Form

A structured whistleblowing report application. Users complete a guided multi-section form with AI-powered follow-up questions, then export a PDF. An admin panel lets compliance officers configure the gap analysis rules and monitor AI model usage.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, React Router |
| Backend | FastAPI, Pydantic |
| AI | Google Gemini (default) / Anthropic Claude / Ollama |

## How It Works

1. **Reporter fills the form** — organization context, preferences, incident details.
2. **Full Details Q1** — reporter writes a free-form narrative of what happened.
3. **AI intake analysis** — a 3-layer pipeline runs on the narrative:
   - **Layer 1 (LLM):** Gemini extracts structured JSON (dates, people, locations, evidence flags, etc.)
   - **Layer 2 (deterministic):** Active gap rules (configured in Admin) are evaluated against the extraction to identify the top 2 missing pieces of information.
   - **Layer 3 (template):** Question text is generated from the matched gap templates. For timeline gaps, a small LLM call fills in a contextual `{event}` placeholder.
4. **Q2 / Q3** — AI-generated follow-up questions are shown to the reporter one at a time.
5. **PDF export** — the completed report is exported as a PDF.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key (free tier works)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and set your GEMINI_API_KEY

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| Admin panel | http://localhost:5173/admin |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

## Project Structure

```
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Navbar/                    # Top nav (Home / Admin)
│       │   └── ReportPanel/
│       │       └── sections/
│       │           ├── FullDetailsQuestionnaire.tsx   # AI-driven Q1→Q2→Q3 flow
│       │           └── Incident.tsx                   # Incident details section
│       ├── hooks/
│       │   └── useIntakeAnalysis.ts       # Calls POST /api/questions/intake/analyze
│       ├── pages/
│       │   ├── HomePage.tsx               # Report form page
│       │   └── AdminPage.tsx              # Gap config + usage stats
│       └── context/ReportContext.tsx
│
├── backend/
│   └── app/
│       ├── llm/
│       │   ├── gemini_provider.py         # Primary LLM provider
│       │   ├── claude_provider.py         # Anthropic Claude provider
│       │   ├── model_fallback.py          # Fallback chain & quota handling
│       │   └── usage_tracker.py           # Per-model daily usage tracking
│       ├── question_processors/
│       │   └── intake_processor.py        # 3-layer intake pipeline
│       ├── prompts/
│       │   ├── intake_gaps.py             # Default gap definitions
│       │   └── display_content.py         # Default Q3 prompt templates
│       ├── routers/
│       │   ├── questions.py               # POST /api/questions/intake/analyze
│       │   ├── admin.py                   # GET/PUT /api/admin/*
│       │   └── chat.py                    # WebSocket chat (legacy)
│       └── settings/
│           └── store.py                   # JSON-based settings persistence
│
└── docs/
    ├── ARCHITECTURE.md
    └── SETUP.md
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your values.

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (if using Gemini) | Google AI Studio API key |
| `GEMINI_MODEL` | No | Default: `gemini-2.5-flash-lite` |
| `LLM_PROVIDER` | No | `gemini` (default) / `claude` / `ollama` / `local` |
| `ANTHROPIC_API_KEY` | Yes (if `LLM_PROVIDER=claude`) | Anthropic API key |
| `CORS_ORIGINS` | No | JSON array of allowed origins |

## Model Fallback

When using Gemini, the backend automatically falls back across a chain of models if one is quota-exhausted or unavailable:

```
gemini-2.0-flash → gemini-2.5-flash-lite → gemini-2.0-flash-lite
```

The active model and per-model usage stats are visible in the Admin panel.

## Admin Panel

Navigate to `/admin` to:

- **Configure gap rules** — enable/disable gaps, change priority order, edit question templates.
- **Monitor model usage** — see daily request and token counts per model, refreshed every 30 seconds.

Gap changes take effect immediately on the next intake analysis request — no restart needed.

## API Reference

Full interactive docs at `http://localhost:8000/docs` when the backend is running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Provider readiness check |
| `POST` | `/api/questions/intake/analyze` | Run 3-layer intake analysis on Q1 text |
| `GET` | `/api/admin/settings` | Get all settings + gap configs |
| `PUT` | `/api/admin/settings` | Update prompt templates |
| `GET` | `/api/admin/intake-gaps` | List gap configurations |
| `PUT` | `/api/admin/intake-gaps` | Replace full gap list |
| `GET` | `/api/admin/usage` | Model usage stats |

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** — Tech stack, data flow, component overview
- **[Setup](docs/SETUP.md)** — Detailed setup and configuration guide
