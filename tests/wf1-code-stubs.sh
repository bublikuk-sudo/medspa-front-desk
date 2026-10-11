#!/usr/bin/env bash
# Stub test of the WF-1 Code nodes Normalize (with the Task 20 Test Inbound unwrapping) and Client Formula, the Create Client id expressions and the wiring of the
# Normalize side branch (Has Sender?, Dropped?, Notify Dropped), and of the cancel confirmation (two-step cancel): WF-2's request_cancel tool, Guardrail and
# Result, and WF-1's Client Data, Pending search, Gate, the YES-to-cancel path and the cancel question after the agent; end to end with send_message's
# Clear Ask? (every other message to the client closes the cancel question); and the escalation reset (escalate stamps Clients.escalated_at, WF-1 deletes the
# chat memory of a client whose escalation the owner resolved, then clears the marker).
# Runs ON THE VPS, in the n8n container's Node: no network, no workflow run, nothing is written.
#   scripts/remote.sh 'tests/wf1-code-stubs.sh'
# Optional arguments: other workflow files (defaults /opt/medspa/workflows/wf1-inbound.json, /opt/medspa/workflows/wf2-agent.json,
# /opt/medspa/workflows/shared/send_message.json, /opt/medspa/workflows/wf3-tools/escalate.json).
# The workflow JSON is piped in whole (no jq), so the same test also runs offline with any Node, from medspa-front-desk/:
#   { printf 'const WF = '; cat workflows/wf1-inbound.json; printf ';\nconst WF2 = '; cat workflows/wf2-agent.json; printf ';\nconst SM = '; cat workflows/shared/send_message.json; printf ';\nconst ESC = '; cat workflows/wf3-tools/escalate.json; printf ';\n'; cat tests/wf1-code-stubs.js; } | node -
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-/opt/medspa/workflows/wf1-inbound.json}"
wf2="${2:-/opt/medspa/workflows/wf2-agent.json}"
sm="${3:-/opt/medspa/workflows/shared/send_message.json}"
esc="${4:-/opt/medspa/workflows/wf3-tools/escalate.json}"
{
  printf 'const WF = '
  cat "$wf"
  printf ';\nconst WF2 = '
  cat "$wf2"
  printf ';\nconst SM = '
  cat "$sm"
  printf ';\nconst ESC = '
  cat "$esc"
  printf ';\n'
  cat "$here/wf1-code-stubs.js"
} | (cd /opt/medspa/deploy && docker compose exec -T n8n node -)
