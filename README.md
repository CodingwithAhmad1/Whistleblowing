# ReportIQ – Whistleblowing Report Form

A structured whistleblowing report application. Users complete a multi-section form and export a PDF. An AI chat backend is available (WebSocket) but not currently shown in the UI.

## Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | FastAPI, Pydantic |
| AI | Gemini 1.5 Flash (default) / Ollama / local Phi |

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` with `GEMINI_API_KEY` (when using `LLM_PROVIDER=gemini`), then:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
npm run install:frontend
npm run dev
```

- **App**: http://localhost:5173  
- **API**: http://localhost:8000

## Project Structure

```
├── frontend/          # React + Vite app
│   └── src/
│       ├── components/ReportPanel/   # Form sections
│       ├── context/ReportContext.tsx
│       └── utils/generateReportPdf.ts
├── backend/           # FastAPI + LLM
│   └── app/
│       ├── llm/       # Gemini, Ollama, local Phi
│       ├── prompts/   # Two-layer workflow
│       └── routers/chat.py
└── docs/
    ├── ARCHITECTURE.md
    ├── SETUP.md
    └── api/
```

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** – Tech stack, data flow, components
- **[Setup](docs/SETUP.md)** – Detailed setup and configuration
- **[API](docs/api/README.md)** – WebSocket and endpoints

## Environment

For Gemini (default): set `GEMINI_API_KEY` in `backend/.env`. See `backend/.env.example`.
