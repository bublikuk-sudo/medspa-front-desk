#!/usr/bin/env bash
# Stub test of workflows/wf5-reminders.json: the Code nodes, the expressions and the wiring.
# Runs from the workstation, NOT through scripts/remote.sh (that syncs the whole repo): the workflow JSON and the test
# are piped into the n8n container's Node over ssh. No network call by the test, no workflow run, nothing is written.
#   tests/wf5-code-stubs.sh [path to another workflow file]
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-$here/../workflows/wf5-reminders.json}"
{
  printf 'const WF = '
  cat "$wf"
  # tests/lib/airtable.sh, for the check that the live scripts' wf5_guard uses WF-5's own formulas (base64: the shell
  # text has ${...} and quotes that no JS string literal takes as is)
  printf ';\nconst LIB = Buffer.from("'
  base64 -w0 "$here/lib/airtable.sh"
  printf '", "base64").toString();\n'
  cat "$here/wf5-code-stubs.js"
} | timeout 60 ssh -o BatchMode=yes -o ConnectTimeout=10 medspa 'cd /opt/medspa/deploy && timeout 50 docker compose exec -T n8n node -'
