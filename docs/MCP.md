# ReportIQ Model Context Protocol (MCP)

The [`mcp`](../mcp) package is a stdio MCP server that wraps the FastAPI routes under `/api/*`. It lets MCP-capable clients (including Cursor) call **health**, **intake analysis**, **RAG construction**, and **policy quote** the same way the React app does.

**Feed storage:** Submissions are persisted by the **FastAPI** app at `GET/POST/DELETE /api/submissions` (file: `backend/data/submissions.json`, gitignored). The React app reads that list when the dev proxy can reach the API. The MCP can append rows with `reportiq_submission_create` so agents and your external browser see the same data. If the API is down, the app keeps a **local-only** copy in `localStorage` and can **Copy local reports to server** from `/feed` after the API comes back. `localhost` and `127.0.0.1` are different origins for any client-only data—pick one dev URL and stick to it.

### When a submission shows on the Feed (web app)

- **API up:** **Submit** on the home page `POST`s to the server; every browser and MCP `reportiq_submission_list` see the same rows. The optional intake `POST` on submit may still fail; **Summary** may show null extraction in that case.
- **API down:** the app falls back to `whistleblow_submissions` in `localStorage` for that profile only. Use **Copy local reports to server** on `/feed` after starting the API to upload those rows.
- **Submit is disabled** while the Full Details pipeline is running (`analyzing` / `constructing` / `policyLoading`) or if it is in a permanent **`error`** state. A quick mock *without* opening Full Details keeps the pipeline on **`idle`**. If you hit a pipeline error, use **Reset AI workflow** (below the error message) to return to `idle` and re-enable Submit.
- The Feed **refreshes** when you open `/feed`, on window focus, and after saves/deletes (custom event).

## Prerequisites

1. **Backend** running and reachable, usually `http://127.0.0.1:8000` (see `backend` README; set `GEMINI_API_KEY` or admin key for AI routes).
2. **Python 3.11+** in your environment.

### Enabling the server in Cursor

The agent only sees `reportiq_*` tools when the **reportiq** MCP server is enabled in Cursor. If tools are missing, the MCP is not connected—this repo does not ship Cursor’s internal tool descriptors under `.cursor/`.

1. Install the MCP package once: from the `mcp` directory, `pip install -e .` (or `uv pip install -e .`) into a venv; see [mcp/README.md](../mcp/README.md).
2. Generate a **project** or **user** MCP config fragment with an absolute `cwd` (Cursor does not resolve `${workspaceFolder}` in `mcp.json` for MCP cwd at the time of writing):

   ```bash
   ./scripts/print-reportiq-mcp-snippet.sh
   ```

   Optional: `REPORTIQ_API_BASE=https://…` and `REPORTIQ_MCP_PYTHON=/path/to/mcp/.venv/bin/python` if you run the server from the MCP venv.
3. Merge the JSON into **Cursor Settings → MCP** (or `.cursor/mcp.json` in the project) and restart MCP / reload the window. Start the FastAPI app before using tools that call the API.

## Install and run the server

From the `mcp` directory:

```bash
cd mcp
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
```

Run over stdio ( how Cursor and other clients invoke it ):

```bash
REPORTIQ_API_BASE=http://127.0.0.1:8000 python -m reportiq_server
```

If the API is on another host or port, set `REPORTIQ_API_BASE` accordingly (no trailing slash).

## Cursor configuration

Copy [mcp-cursor.json.example](mcp-cursor.json.example) into your Cursor **MCP** user configuration (or merge the `mcpServers.reportiq` object). Adjust `cwd` to your clone path, or set `command` to the `python` inside `mcp/.venv` when using a virtual environment.

Do not commit real secrets; the Gemini key stays in backend `.env` or admin `settings.json` on the server.

## Tools

| Tool | API |
|------|-----|
| `reportiq_health` | `GET /api/health` |
| `reportiq_intake_analyze` | `POST /api/questions/intake/analyze` (`q1_text`, optional `form_data`) — response includes `extraction` (merged) and `extraction_breakdown` (`from_answers` / `from_model`); include `full_details_q2` / `full_details_gap2` in `form_data` so AI follow-up answers are part of the combined narrative |
| `reportiq_intake_with_followup_answers` | Same as `reportiq_intake_analyze` but convenience parameters `full_details_q2` and `full_details_gap2` merged into `form_data` before the POST |
| `reportiq_rag_construct_sentence` | `POST /api/rag/construct-sentence` |
| `reportiq_rag_policy_quote` | `POST /api/rag/policy-quote` (optional `constructed_sentence`) |
| `reportiq_intake_gaps` | `GET /api/intake/gaps` |
| `reportiq_q2_generate` | `POST /api/questions/q2/generate` |
| `reportiq_q3_generate` | `POST /api/questions/q3/generate` |
| `reportiq_submission_list` | `GET /api/submissions` |
| `reportiq_submission_create` | `POST /api/submissions` (optional `extraction_breakdown` to mirror intake, passed as `extractionBreakdown` in the JSON body) |
| `reportiq_submission_delete` | `DELETE /api/submissions/{id}` |

## Resource

- **`reportiq://form-schema`** — JSON with report field keys and short conditional notes (aligns with `frontend/src/types/report.ts`).

## Verifying intake + Feed Summary (MCP or curl)

1. `reportiq_health` (or `GET /api/health`) — API up.
2. `reportiq_intake_analyze` with a non-empty `q1_text` and a flat string `form_data` map that includes e.g. `general_nature`, `when_occurred`, `where_occurred`, `management_aware` (`yes`/`no`), `sequence_of_events`, and optional `person_1_first` / `person_1_last`, `has_supporting_materials`, `evidence_description` to exercise merge rules.
3. **Compare** the JSON to expectations (see `intake_analyze_and_feed_summary` in the `reportiq://form-schema` resource, or [form_schema.json](../mcp/reportiq_server/form_schema.json)):
   - `extraction.summary` should not be empty when the form has `general_nature` / dates / locations, even if the narrative is short.
   - `extraction.people_mentioned` should include names from the form; dates/locations lists should include form fields.
   - `prior_reporting_mentioned` is often true when `management_aware` is `yes` (form merge), even if the narrative omits it.
4. `follow_up_questions` text must match **active** gap templates from `GET /api/intake/gaps`. In local dev, `backend/data/settings.json` overrides defaults; if templates do not match the repo, use **Admin → reset gaps** or `POST /api/admin/intake-gaps/reset` so API and app stay aligned.
5. **Feed** row: after browser **Submit** or `reportiq_submission_create`, open `/feed` → **Summary** — merged `extraction` when intake ran; optional `extractionBreakdown` splits **From your answers (rules)** vs **From your narrative (AI)** in the UI; plus policy fields when RAG completed.
6. **Automated (no browser):** from `backend/`, run the pytest targets listed in [backend/README.md](../backend/README.md) under **Testing** — they assert gap config parity with code defaults, `GET /api/intake/gaps`, extraction field contract, and (when a Gemini key is set) a live `POST` intake run.

## Example flow (chaining)

1. `reportiq_health` — confirm the API responds.
2. `reportiq_intake_analyze` with a long `q1_text` and a flat `form_data` object (string keys) — returns `extraction`, `gaps`, `follow_up_questions` when the model succeeds.
3. Append follow-up answers to `form_data` as the UI would, then:
4. `reportiq_rag_construct_sentence` with the updated `form_data`.
5. `reportiq_rag_policy_quote` with `form_data` and the `sentence` from step 4 as `constructed_sentence`.

HTTP errors (4xx/5xx) are returned in a JSON object with `error`, `status_code`, and `detail` so the model can read the failure without throwing.

## Feed row (browser or MCP)

**Option A — browser:** same as before: open the app origin (e.g. Vite `http://127.0.0.1:5173`), complete the form and pipeline as needed, **Submit**, then open **`/feed`** and expand the row.

**Option B — MCP:** run `reportiq_submission_create` with a flat `form_data` map; optionally chain `reportiq_intake_analyze` and pass `extraction`, `gaps`, and `follow_up_questions` into `reportiq_submission_create` to mirror a full client submit. Confirm with `reportiq_submission_list` or open `/feed` in the browser.

Use the browser MCP workflow from the product instructions: `browser_snapshot` before interactions, and take a fresh snapshot after navigation to `/feed`.
