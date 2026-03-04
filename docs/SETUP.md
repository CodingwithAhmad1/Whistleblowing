# Development Setup

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+ (3.13 recommended)
- **npm** 9+

## Quick Start

### Option A — Single command (recommended)

From the project root:

```bash
npm install          # install concurrently
npm run start        # starts backend + frontend together
```

- **Frontend**: http://localhost:5173
- **Backend health**: http://localhost:8000/api/health
- **Admin**: http://localhost:5173/admin

### Option B — Manual

#### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Start the server using the **venv interpreter** (important — system Python lacks the required packages):

```bash
venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend

```bash
# From project root
npm run install:frontend
npm run start:frontend
```

Or from `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

---

## Backend Configuration

Create `backend/.env` (optional if using Admin-stored API key):

```env
GEMINI_API_KEY=your_google_ai_api_key_here
```

See `.env.example` for all available variables.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | No* | — | Google AI API key. Fallback if not set in Admin. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-lite` | Preferred Gemini model. The backend automatically falls back to other models on quota exhaustion. |
| `GEMINI_EMBEDDING_MODEL` | No | `models/text-embedding-004` | Embedding model for future policy document search. |
| `TEMPERATURE` | No | `0.7` | LLM sampling temperature. |
| `TOP_P` | No | `0.9` | Nucleus sampling probability. |
| `MAX_TOKENS` | No | `512` | Max output tokens per request. |

\* API key is required from **Admin settings** (`/admin`) OR `GEMINI_API_KEY` in `.env`. Admin-stored key takes precedence. At least one must be set to enable chat, Full Details Q2/Q3, and embeddings.

### Model Fallback Chain

If a Gemini model returns a `429 Too Many Requests` (quota exhausted), the backend automatically retries with the next available model. The full chain is:

```
gemini-2.0-flash → gemini-2.5-flash-lite → gemini-1.5-flash
```

The backend starts from the model set in `GEMINI_MODEL` (default: `gemini-2.5-flash-lite`) and cycles through the remaining models in chain order. Exhaustion state resets at UTC midnight. Current usage is visible at `GET /api/admin/usage` and on the Admin page.

---

## Frontend Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `''` (empty) | Backend API base URL. In dev, Vite proxies to `http://localhost:8000`. |

For production or when frontend and backend are on different hosts, set at build time:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

---

## Verification

```bash
# Health check
curl http://localhost:8000/api/health
# Expected: {"status":"ok","provider":"gemini","ready":true}

# Admin settings
curl http://localhost:8000/api/admin/settings

# Model usage
curl http://localhost:8000/api/admin/usage
```

---

## Production Build

```bash
cd frontend && npm run build
cd ../backend && venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The built SPA (`frontend/dist`) is served at `/` by the backend. Runtime data files (`backend/data/settings.json`, `backend/data/usage.json`) are created automatically on first use.
