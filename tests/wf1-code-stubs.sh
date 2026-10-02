#!/usr/bin/env bash
# Stub test of the WF-1 Code nodes Normalize and Client Formula plus the Create Client id expressions.
# Runs ON THE VPS, in the n8n container's Node: no network, no workflow run, nothing is written.
#   scripts/remote.sh 'tests/wf1-code-stubs.sh'
# Optional first argument: another workflow file (default /opt/medspa/workflows/wf1-inbound.json).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-/opt/medspa/workflows/wf1-inbound.json}"
{
  printf 'const CODE = '
  jq -c '{
    normalize: (.nodes[] | select(.name=="Normalize") | .parameters.jsCode),
    formula: (.nodes[] | select(.name=="Client Formula") | .parameters.jsCode),
    phoneExpr: (.nodes[] | select(.name=="Create Client") | .parameters.columns.value.phone),
    chatExpr: (.nodes[] | select(.name=="Create Client") | .parameters.columns.value.telegram_chat_id)
  }' "$wf"
  printf ';\n'
  cat "$here/wf1-code-stubs.js"
} | (cd /opt/medspa/deploy && docker compose exec -T n8n node -)
