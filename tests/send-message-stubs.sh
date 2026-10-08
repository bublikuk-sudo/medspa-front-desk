#!/usr/bin/env bash
# Stub test of send_message's Task 20 capture decision: the Format Code node's `test` field, the Test Contact? IF and the
# wiring Format -> Test Contact? -> Capture / Channel?; and of the Render Code node: the embedded templates equal
# templates/messages.en.json, the REQ map, the cancellation policy in PENDING_SUMMARY and the cancel templates.
# Runs ON THE VPS, in the n8n container's Node: no network, nothing written.
#   scripts/remote.sh 'tests/send-message-stubs.sh'
# Optional arguments: another workflow file (default /opt/medspa/workflows/shared/send_message.json) and another templates
# file (default /opt/medspa/templates/messages.en.json). The JSON is piped in whole (no jq), so it also runs offline with any
# Node, from medspa-front-desk/:
#   { printf 'const WF = '; cat workflows/shared/send_message.json; printf ';\nconst TEMPLATES = '; cat templates/messages.en.json; printf ';\n'; cat tests/send-message-stubs.js; } | node -
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-/opt/medspa/workflows/shared/send_message.json}"
tf="${2:-/opt/medspa/templates/messages.en.json}"
{
  printf 'const WF = '
  cat "$wf"
  printf ';\nconst TEMPLATES = '
  cat "$tf"
  printf ';\n'
  cat "$here/send-message-stubs.js"
} | (cd /opt/medspa/deploy && docker compose exec -T n8n node -)
