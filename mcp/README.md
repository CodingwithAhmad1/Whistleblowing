# reportiq-mcp

Stdio MCP server for the ReportIQ backend. See [docs/MCP.md](../docs/MCP.md) for full setup and Cursor configuration.

**Run locally (after `cd mcp` and `uv sync`):**

```bash
REPORTIQ_API_BASE=http://127.0.0.1:8000 uv run reportiq-mcp
```

or:

```bash
uv run python -m reportiq_server
```
