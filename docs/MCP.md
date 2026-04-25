# ReportIQ Model Context Protocol (MCP)

The [`mcp`](../mcp) package is a stdio MCP server that wraps the FastAPI routes under `/api/*`. It lets MCP-capable clients (including Cursor) call **health**, **intake analysis**, **RAG construction**, and **policy quote** the same way the React app does.

**Important:** The submission **Feed** at `/feed` is stored in **browser `localStorage`**. This MCP only talks to the backend. To verify a new table row on the Feed, use a browser (manual test or the Cursor **browser** MCP). See the [browser checklist](#feed-row-browser-only) below.

## Prerequisites

1. **Backend** running and reachable, usually `http://127.0.0.1:8000` (see `backend` README; set `GEMINI_API_KEY` or admin key for AI routes).
2. **Python 3.11+** in your environment.

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
| `reportiq_intake_analyze` | `POST /api/questions/intake/analyze` (`q1_text`, optional `form_data`) |
| `reportiq_rag_construct_sentence` | `POST /api/rag/construct-sentence` |
| `reportiq_rag_policy_quote` | `POST /api/rag/policy-quote` (optional `constructed_sentence`) |
| `reportiq_intake_gaps` | `GET /api/intake/gaps` |
| `reportiq_q2_generate` | `POST /api/questions/q2/generate` |
| `reportiq_q3_generate` | `POST /api/questions/q3/generate` |

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
5. **Feed** row: after browser Submit, open `/feed` → **Summary** — same `extraction` shape as in step 2, plus policy fields from the report when RAG completed.
6. **Automated (no browser):** from `backend/`, run the pytest targets listed in [backend/README.md](../backend/README.md) under **Testing** — they assert gap config parity with code defaults, `GET /api/intake/gaps`, extraction field contract, and (when a Gemini key is set) a live `POST` intake run.

## Example flow (chaining)

1. `reportiq_health` — confirm the API responds.
2. `reportiq_intake_analyze` with a long `q1_text` and a flat `form_data` object (string keys) — returns `extraction`, `gaps`, `follow_up_questions` when the model succeeds.
3. Append follow-up answers to `form_data` as the UI would, then:
4. `reportiq_rag_construct_sentence` with the updated `form_data`.
5. `reportiq_rag_policy_quote` with `form_data` and the `sentence` from step 4 as `constructed_sentence`.

HTTP errors (4xx/5xx) are returned in a JSON object with `error`, `status_code`, and `detail` so the model can read the failure without throwing.

## Feed row (browser only)

1. Open the app origin (e.g. Vite `http://localhost:5173` or the static URL served with the API).
2. Fill the home form, including any conditional fields (e.g. contact when not anonymous, supervisor when “yes”, evidence when “yes” to supporting materials, “if other, how” when `how_aware` is other).
3. In **AI follow-up**, click **Generate AI follow-up**; wait for analysis; complete **Next** on follow-up questions; let **RAG** steps finish; on the policy step click **Done**; adjust review text if shown.
4. Click **Submit**.
5. Go to **`/feed`**, expand the new row, and use **Report** and **Summary** to confirm `extraction` and follow-up questions when the intake run succeeded.

Use the browser MCP workflow from the product instructions: `browser_snapshot` before interactions, and take a fresh snapshot after navigation to `/feed`.
