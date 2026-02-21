# ReportIQ - Whistleblowing Reporting Webapp

A two-panel web application for whistleblowing reports: chat-assisted input (left) and live report preview (right). Uses Phi-3.5-mini running locally in the browser via WebLLM.

## Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + TypeScript
- **AI**: WebLLM + Phi-3.5-mini (browser-based, WebGPU)

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

From project root:

```bash
npm run install:frontend   # first time only
npm run dev
```

Or from the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` with API proxy to `http://localhost:8000`.

### AI Model (Phi-3.5-mini)

The app runs Phi-3.5-mini locally in the browser. No data is sent to external servers.

- **Activate**: Click "Activate AI" in the chat panel to load the model. The LLM is inactive until you click.
- **First visit**: Downloads ~2.3 GB; progress shown during download.
- **Subsequent visits**: Loads from IndexedDB cache in seconds; no re-download.
- **WebGPU required**: Chrome 113+, Edge 113+, Safari 18 (macOS 15), or Firefox with WebGPU enabled.
- **RAM**: Recommend 8 GB+ system RAM. Chrome may use 5–10 GB during inference.

### Production

```bash
cd frontend && npm run build
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The built SPA is served from `frontend/dist` when it exists.

## Architecture

- **State**: In-memory only (lost on refresh). Architecture prepared for future DB.
- **Report schema**: Pydantic models in `backend/app/models.py`; TypeScript types in `frontend/src/types/report.ts`.
- **AI**: WebLLM loads Phi-3.5-mini on user-triggered "Activate". Model cached in IndexedDB. Chat extracts report fields via streaming JSON; checklist auto-ticks as fields are filled.
# Whistleblowing
