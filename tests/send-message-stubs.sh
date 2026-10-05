#!/usr/bin/env bash
# Stub test of send_message's Task 20 capture decision: the Format Code node's `test` field, the Test Contact? IF and the
# wiring Format -> Test Contact? -> Capture / Channel?. Runs ON THE VPS, in the n8n container's Node: no network, nothing written.
#   scripts/remote.sh 'tests/send-message-stubs.sh'
# Optional first argument: another workflow file (default /opt/medspa/workflows/shared/send_message.json).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-/opt/medspa/workflows/shared/send_message.json}"
{
  printf 'const CODE = '
  jq -c '
    def node($n): (first(.nodes[] | select(.name==$n)) // {});
    def out($n; $i): ([.connections[$n].main[$i][]?.node][0]) // "none";
    {
      format: (node("Format") | .parameters.jsCode),
      testExpr: (node("Test Contact?") | .parameters.conditions.conditions[0].leftValue),
      formatTarget: out("Format"; 0), trueTarget: out("Test Contact?"; 0), falseTarget: out("Test Contact?"; 1),
      captureTarget: out("Capture"; 0), captureQuery: (node("Capture") | .parameters.query)
    }' "$wf"
  printf ';\n'
  cat "$here/send-message-stubs.js"
} | (cd /opt/medspa/deploy && docker compose exec -T n8n node -)
