# Testing Guide

## Quick Start

### 1. Start Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 2. Start Frontend

```bash
cd frontend
npm run dev
```

### 3. Open Browser

Navigate to: http://localhost:5173

---

## Form Testing

### Form Flow

1. **Organization & Context**: Fill country, location (searchable dropdowns).
2. **Reporter Preferences**: Select employee/anonymous; if not anonymous, fill contact details.
3. **Identifying Persons**: Add one or more persons (first, last, title); answer supervisor/management questions.
4. **Incident Details**: Fill general nature, where, when, duration, how aware, persons concealing, full details.
5. **Submit**: Click Submit; PDF should download.

### Manual Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] All form sections render
- [ ] Country/location searchable selects work (filter, select, blur)
- [ ] Conditional reporter fields show when "No" to anonymous
- [ ] Phone number with country code works
- [ ] Add/remove person rows works
- [ ] PDF export downloads with correct content
- [ ] Browser refresh clears report data
- [ ] No console errors during interaction

---

## API Testing

### Health Check

```bash
curl http://localhost:8000/api/health
```

Expected: `{"status":"ok","provider":"gemini","ready":true}`

### WebSocket Chat (When Chat UI Is Enabled)

1. Connect: `ws://localhost:8000/api/chat/test-session-1`
2. Send: `{"type":"message","content":"I want to report misconduct"}`
3. Expect: `{"type":"token","content":"..."}` (streaming), then `{"type":"done"}`

### REST Endpoints

```bash
# Get report state
curl http://localhost:8000/api/reports/test-session-1

# Reset session
curl -X POST http://localhost:8000/api/reports/test-session-1/reset
```

---

## Backend Logs

Check for:

```
INFO - WebSocket connection established for session ...
INFO - WebSocket disconnected for session ...
```

---

## Common Issues

### PDF Does Not Download

- Check browser console for jsPDF errors.
- Verify all form fields are populated if required.

### WebSocket Fails (Chat)

- Ensure backend is running on port 8000.
- Check CORS_ORIGINS in config includes frontend URL.

### Searchable Select Does Not Filter

- Verify options are loaded (e.g. countries).
- Check for JavaScript errors in console.
