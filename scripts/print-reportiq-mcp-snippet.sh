#!/usr/bin/env bash
# Emit a Cursor-ready MCP snippet for the reportiq server. Cursor's project MCP
# config does not resolve ${workspaceFolder} in cwd (see docs/MCP.md), so this
# script substitutes the repo root at generation time.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${REPORTIQ_API_BASE:-http://127.0.0.1:8000}"
PYTHON="${REPORTIQ_MCP_PYTHON:-python3}"
cat <<EOF
{
  "mcpServers": {
    "reportiq": {
      "command": "${PYTHON}",
      "args": ["-m", "reportiq_server"],
      "cwd": "${ROOT}/mcp",
      "env": {
        "REPORTIQ_API_BASE": "${API_BASE}"
      }
    }
  }
}
EOF
