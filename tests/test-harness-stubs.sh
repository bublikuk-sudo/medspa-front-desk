#!/usr/bin/env bash
# Stub test of workflows/test-harness.json: the Unpack guard (allow-listed tool workflows only, test contacts only) and the
# wiring. It also checks that every workflow the test scripts call through the harness is allow-listed and that every
# contact_id in tests/tool-cases.tsv passes the guard.
# Runs from the workstation, NOT through scripts/remote.sh (that syncs the whole repo): the workflow JSON, the case table,
# the test scripts and push-all.sh are piped into the n8n container's Node over ssh. No network call by the test, no
# workflow run, nothing is written.
#   tests/test-harness-stubs.sh [path to another workflow file]
# Offline, with any Node, from the project root:
#   bash tests/test-harness-stubs.sh --print | node -
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
print=0
if [ "${1:-}" = "--print" ]; then print=1; shift; fi
wf="${1:-$here/../workflows/test-harness.json}"
b64() { printf 'Buffer.from("'; base64 -w0 "$@"; printf '", "base64").toString()'; }
src() {
  printf 'const WF = '
  cat "$wf"
  # base64: the shell and TSV text has ${...} and quotes that no JS string literal takes as is
  printf ';\nconst TSV = '; b64 "$here/tool-cases.tsv"
  printf ';\nconst CALLERS = '; cat "$here"/*.sh "$here"/lib/*.sh | b64
  printf ';\nconst PUSH_ALL = '; b64 "$here/../scripts/push-all.sh"
  printf ';\n'
  cat "$here/test-harness-stubs.js"
}
if [ "$print" -eq 1 ]; then src; exit 0; fi
src | timeout 60 ssh -o BatchMode=yes -o ConnectTimeout=10 medspa 'cd /opt/medspa/deploy && timeout 50 docker compose exec -T n8n node -'
