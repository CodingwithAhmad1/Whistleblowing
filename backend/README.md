# Backend Setup

## Installation

### Using Virtual Environment (Recommended)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Manual Installation (if llama-cpp-python fails)

If you get compilation errors with llama-cpp-python, use the pre-built CPU-only wheel:

```bash
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
pip install fastapi uvicorn[standard] pydantic pydantic-settings websockets huggingface-hub
```

## Running the Server

```bash
cd backend
source venv/bin/activate  # If using venv
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The server will:
1. Auto-download the Phi-3.5-mini GGUF model on first run (~2.3 GB)
2. Load the model into memory
3. Start the WebSocket chat server on port 8000

## Configuration

Set environment variables (or create `.env` from `.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| LLM_PROVIDER | No | gemini | gemini \| ollama \| local |
| GEMINI_API_KEY | When gemini | - | Google AI API key |
| OLLAMA_BASE_URL | When ollama | http://localhost:11434 | Ollama API URL |
| OLLAMA_MODEL | When ollama | phi3.5 | Ollama model name |

- **gemini**: Uses Gemini 1.5 Flash. Set `GEMINI_API_KEY` in `.env`.
- **ollama**: Uses local Ollama. Run `ollama pull phi3.5` first.
- **local**: Uses llama-cpp Phi model (auto-downloads on first run).

## API Endpoints

- `GET /api/health` - Health check
- `WS /api/chat/{session_id}` - WebSocket chat endpoint
- `GET /api/reports/{session_id}` - Get report state
- `POST /api/reports/{session_id}/reset` - Reset session

## Model Download Location

Models are cached in `backend/models/` directory.
