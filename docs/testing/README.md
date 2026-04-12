# Testing Guide

## Quick Start

### 1. Start Both Servers (recommended)

```bash
# From project root
npm run start
```

### Or start individually

```bash
# Backend (from backend/)
venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev
```

### 2. Open Browser

Navigate to: http://localhost:5173

---

## Form Testing

### Form Flow

1. **Organization & Context**: Fill country, location (searchable dropdowns).
2. **Reporter Preferences**: Select employee/anonymous; if not anonymous, fill contact details.
3. **Identifying Persons**: Add one or more persons (first, last, title); answer supervisor/management questions.
4. **Incident Details**: Fill general nature, where, when, duration, how aware, persons concealing.
5. **Full Details wizard**:
   - **Q1**: Type a free-text narrative, click Next.
   - **Analyzing**: "Analyzing your report…" spinner appears while the backend runs the 3-layer intake pipeline.
   - **Follow-up questions** (0–2): Answer each question that appears (Backend identified gaps in Q1).
   - **Review**: All answered questions are shown in an editable review panel.
6. **Submit**: Click Submit; PDF should download.

### Manual Checklist

- [ ] Backend starts without errors (`INFO: Application startup complete`)
- [ ] Frontend starts without errors
- [ ] All form sections render
- [ ] Country/location searchable selects work (filter, select, blur)
- [ ] Conditional reporter fields show when "No" to anonymous
- [ ] Phone number with country code works
- [ ] Add/remove person rows works
- [ ] Full Details Q1 → Next triggers "Analyzing your report…" loading state
- [ ] Backend returns 0–2 follow-up questions based on Q1 content
- [ ] Each follow-up question step renders with the question text and a textarea for the answer
- [ ] If analysis fails (e.g. no API key), error message appears with Back and Skip buttons (no auto-advance)
- [ ] Review step shows all Q&A items with editable textareas
- [ ] PDF export downloads and includes Q1, Q2, Q3 question texts and answers (only populated fields)
- [ ] Missing/empty fields show "Not provided" in the PDF (not blank or crashed)
- [ ] Browser refresh clears report data
- [ ] No console errors during interaction

---

## API Testing

### Health Check

```bash
curl http://localhost:8000/api/health
# Expected: {"status":"ok","provider":"gemini","ready":true}
```

### Admin Settings

```bash
# Get settings
curl http://localhost:8000/api/admin/settings

# Update Q2/Q3 prompt templates
curl -X PUT http://localhost:8000/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"q2PromptTemplate":"","q3PromptTemplate":""}'

# Verify invalid placeholder returns 422 (not 500)
curl -X PUT http://localhost:8000/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"q2PromptTemplate":"Ask about {invalid_key} and {context}"}'
curl -X POST http://localhost:8000/api/questions/q2/generate \
  -H "Content-Type: application/json" \
  -d '{"report":{"full_details_q1":"Test"}}'
# Expected: HTTP 422 with detail describing the invalid placeholder
# Restore: PUT settings with empty q2PromptTemplate to reset to default
```

### Public intake gaps (read-only)

```bash
curl http://localhost:8000/api/intake/gaps
```

### Intake Analysis (Full Details)

```bash
# Run 3-layer intake analysis on Q1 text — returns 0–2 follow-up questions
curl -X POST http://localhost:8000/api/questions/intake/analyze \
  -H "Content-Type: application/json" \
  -d '{"q1_text":"Something bad happened at work last month."}'

# Expected response shape:
# {
#   "extraction": { "summary": "...", "witnesses_mentioned": false, "impact_described": false, ... },
#   "gaps": ["no_specific_example"],
#   "follow_up_questions": [
#     { "gap_id": "no_specific_example", "question_text": "For documentation purposes, could you provide a specific example..." }
#   ]
# }

# Verify empty q1_text returns 422
curl -X POST http://localhost:8000/api/questions/intake/analyze \
  -H "Content-Type: application/json" \
  -d '{"q1_text":""}'
```

### Intake Gap Configuration (Admin)

```bash
# Get current gaps (ordered by priority)
curl http://localhost:8000/api/admin/intake-gaps

# Add a new custom gap
curl -X POST http://localhost:8000/api/admin/intake-gaps \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Missing Department",
    "priority": 8,
    "active": true,
    "criteria": {"type": "empty_array", "field": "locations_mentioned", "threshold": null},
    "template": "Which department or team was involved in the incident?"
  }'

# Deactivate a gap (patch a single field)
curl -X PUT http://localhost:8000/api/admin/intake-gaps/no_retaliation_context \
  -H "Content-Type: application/json" \
  -d '{"active": false}'

# Delete a gap
curl -X DELETE http://localhost:8000/api/admin/intake-gaps/missing_department

# Replace the full gap list (re-order, bulk edit)
curl -X PUT http://localhost:8000/api/admin/intake-gaps \
  -H "Content-Type: application/json" \
  -d '{"gaps": [ ...full array... ]}'
```

### Question Generation (Full Details — Legacy)

```bash
# Q2 — short follow-up question (~10 words) — used by chat workflow
curl -X POST http://localhost:8000/api/questions/q2/generate \
  -H "Content-Type: application/json" \
  -d '{"report":{"full_details_q1":"I observed my manager altering invoices.","general_nature":"Financial fraud","where_occurred":"Finance dept","when_occurred":"Last quarter"}}'

# Q3 — policy excerpt + question
curl -X POST http://localhost:8000/api/questions/q3/generate \
  -H "Content-Type: application/json" \
  -d '{"report":{"full_details_q1":"I observed my manager altering invoices.","general_nature":"Financial fraud","where_occurred":"Finance dept"}}'
```

### Backend Unit Tests

A test script covers the intake pipeline, settings store, and Layer 2/3 logic without requiring a live API key (LLM-dependent tests are skipped automatically if `GEMINI_API_KEY` is not set):

```bash
cd backend
venv/bin/python test_intake.py
# Expected: 32 passed, 0 failed, 2 skipped (LLM tests skipped without API key)

# Run with API key to include full LLM pipeline tests
GEMINI_API_KEY=your-key venv/bin/python test_intake.py
```

### WebSocket Chat (when chat UI is enabled)

1. Connect: `ws://localhost:8000/api/chat/test-session-1`
2. Send: `{"type":"message","content":"I want to report misconduct"}`
3. Expect: `{"type":"token","content":"..."}` (streaming), then `{"type":"done"}`

### Session REST Endpoints

```bash
# Get report state
curl http://localhost:8000/api/reports/test-session-1

# Reset session
curl -X POST http://localhost:8000/api/reports/test-session-1/reset

# Conversation history
curl http://localhost:8000/api/sessions/test-session-1/history
```

---

## Model Fallback Testing

429 exhaustion is tracked **in memory** for the running server process (cleared at UTC midnight). To verify fallback behaviour, trigger real quota limits from the API or temporarily misconfigure the primary model so it returns 429; logs should show exhaustion and a switch to the next model in `MODEL_CHAIN`. Restarting the backend clears in-process exhaustion flags.

---

## Backend Logs

### Normal startup
```
INFO - Starting application...
INFO - Using LLM provider: gemini
INFO - Initializing Gemini Provider...
INFO - Gemini provider ready (model: gemini-2.5-flash-lite)
INFO - Application startup complete.
```

### Model fallback triggered
```
WARNING - Quota 429 for model 'gemini-2.0-flash', marking exhausted and retrying
WARNING - Model 'gemini-2.0-flash' marked quota-exhausted for 2026-03-03
INFO    - Model 'gemini-2.0-flash' exhausted, falling back to 'gemini-2.5-flash-lite'
```

### Chat session
```
INFO - WebSocket connection established for session ...
INFO - WebSocket disconnected for session ...
```

---

## Common Issues

### Backend Fails to Start — ImportError `cannot import 'genai'`

The server is using the system Python instead of the venv. Always run via `venv/bin/python` or `npm run start:backend` (which uses `venv/bin/python` automatically).

### 429 Quota Errors

The free-tier daily quota for the current model may be exhausted. The backend auto-falls back to the next model in the chain. If every model in the chain returns 429 for this process, wait until UTC midnight (in-process flags reset) or add billing to your Google AI account.

### Intake Analysis Returns 500 / Full Details Stuck on "Analyzing"

- Check backend logs — `intake_processor.py` logs Layer 1 JSON parse failures and LLM errors.
- Ensure a valid API key is configured (Admin settings or `GEMINI_API_KEY` in `.env`).
- If Layer 1 JSON parsing fails, the pipeline uses safe defaults (all fields empty/false) and continues to Layer 2 rather than aborting — the frontend will still receive a valid response, possibly with 0 follow-up questions.
- If the LLM call itself fails (e.g. 429 quota), the model fallback chain activates automatically.

### Q2/Q3 Returns 502

The LLM returned an empty or unusable response. Check backend logs for the full error. Neither Q2 nor Q3 have silent fallbacks — the error surfaces so the frontend can retry.

### PDF Does Not Download

- Check browser console for jsPDF errors.
- Verify all required form fields are populated.

### WebSocket Fails (Chat)

- Ensure backend is running on port 8000.
- Check `CORS_ORIGINS` in `backend/app/config.py` includes the frontend URL.

### Searchable Select Does Not Filter

- Verify options are loaded (e.g., countries from `frontend/src/data/countries.ts`).
- Check for JavaScript errors in console.
