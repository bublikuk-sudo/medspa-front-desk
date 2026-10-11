#!/usr/bin/env bash
# Stub test of send_message's Task 20 capture decision: the Format Code node's `test` field, the Test Contact? IF and the
# wiring Format -> Test Contact? -> Capture / Channel?; and of the Render Code node: the embedded templates equal
# templates/messages.en.json, the REQ map, the cancellation policy in PENDING_SUMMARY and the cancel templates; and of the
# client's language (dates, times and units rendered in it, the agent-reply English guard, the Translate prompt, and
# confirm_booking's SLOT_TAKEN alternatives).
# Runs ON THE VPS, in the n8n container's Node (its full ICU is what the language checks expect): no network, nothing written.
#   scripts/remote.sh 'tests/send-message-stubs.sh'
# Optional arguments: another workflow file (default /opt/medspa/workflows/shared/send_message.json), another templates
# file (default /opt/medspa/templates/messages.en.json) and another confirm_booking file (default
# /opt/medspa/workflows/wf3-tools/confirm_booking.json). The JSON is piped in whole (no jq), so it also runs offline with any
# Node that has full ICU, from medspa-front-desk/:
#   { printf 'const WF = '; cat workflows/shared/send_message.json; printf ';\nconst TEMPLATES = '; cat templates/messages.en.json; printf ';\nconst CONFIRM = '; cat workflows/wf3-tools/confirm_booking.json; printf ';\n'; cat tests/send-message-stubs.js; } | node -
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-/opt/medspa/workflows/shared/send_message.json}"
tf="${2:-/opt/medspa/templates/messages.en.json}"
cf="${3:-/opt/medspa/workflows/wf3-tools/confirm_booking.json}"
{
  printf 'const WF = '
  cat "$wf"
  printf ';\nconst TEMPLATES = '
  cat "$tf"
  printf ';\nconst CONFIRM = '
  cat "$cf"
  printf ';\n'
  cat "$here/send-message-stubs.js"
} | (cd /opt/medspa/deploy && docker compose exec -T n8n node -)
