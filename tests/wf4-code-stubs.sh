#!/usr/bin/env bash
# Stub test of workflows/wf4-knowledge-ingest.json: triggers, the Plan Code node and the wiring.
# Same transport as tests/wf5-code-stubs.sh: the workflow JSON and the test are piped into the n8n container's Node over
# ssh. No network call by the test, no workflow run, nothing is written.
#   tests/wf4-code-stubs.sh [path to another workflow file]
# Offline, with any local Node instead:  { printf 'const WF = '; cat workflows/wf4-knowledge-ingest.json; printf ';\n'; cat tests/wf4-code-stubs.js; } | node -
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-$here/../workflows/wf4-knowledge-ingest.json}"
{
  printf 'const WF = '
  cat "$wf"
  printf ';\n'
  cat "$here/wf4-code-stubs.js"
} | timeout 60 ssh -o BatchMode=yes -o ConnectTimeout=10 medspa 'cd /opt/medspa/deploy && timeout 50 docker compose exec -T n8n node -'
