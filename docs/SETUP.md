# Development Setup

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **npm** 9+

## Quick Start

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` from `backend/.env.example`:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_google_ai_api_key_here
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
# From project root
npm run install:frontend
npm run dev
```

Or from `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend health**: http://localhost:8000/api/health

---

## Backend Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| LLM_PROVIDER | No | gemini | gemini \| ollama \| local |
| GEMINI_API_KEY | When gemini | - | Google AI API key |
| OLLAMA_BASE_URL | When ollama | http://localhost:11434 | Ollama API URL |
| OLLAMA_MODEL | When ollama | phi3.5 | Ollama model name |

- **gemini**: Uses Gemini 1.5 Flash. Set `GEMINI_API_KEY`.
- **ollama**: Uses local Ollama. Run `ollama pull phi3.5` first.
- **local**: Uses llama-cpp Phi model; downloads on first run (~2.3 GB to `backend/models/`).

---

## Verification

```bash
# Health check
curl http://localhost:8000/api/health

# Expected response
{"status":"ok","provider":"gemini","ready":true}
```

---

## Production Build

```bash
cd frontend && npm run build
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The built SPA is served from `frontend/dist` when it exists.
