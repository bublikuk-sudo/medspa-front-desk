#!/usr/bin/env bash
# Stub test of send_message's Task 20 capture decision: the Format Code node's `test` field, the Test Contact? IF and the
# wiring Format -> Test Contact? -> Capture / Channel?; and of the Render Code node: the embedded templates equal
# templates/messages.en.json, the REQ map, the cancellation policy in PENDING_SUMMARY and the cancel templates; and of the
# client's language (dates, times and units rendered in it, the reply words checked against WF-1's Classify, the
# agent-reply English guard, the Translate prompt, and confirm_booking's SLOT_TAKEN alternatives).
# Runs ON THE VPS, in the n8n container's Node: no network, nothing written. The language checks expect the exact wording of
# that Node's ICU (78.3, n8n 2.41.5, node v26.7.0); another ICU version words some dates and units differently and fails them.
#   scripts/remote.sh 'tests/send-message-stubs.sh'
# Optional arguments: another workflow file (default /opt/medspa/workflows/shared/send_message.json), another templates
# file (default /opt/medspa/templates/messages.en.json), another confirm_booking file (default
# /opt/medspa/workflows/wf3-tools/confirm_booking.json) and another WF-1 file (default /opt/medspa/workflows/wf1-inbound.json).
# The JSON is piped in whole (no jq), so it also runs from the workstation, piped into the container's Node over ssh, from
# the project root:
#   { printf 'const WF = '; cat workflows/shared/send_message.json; printf ';\nconst TEMPLATES = '; cat templates/messages.en.json; printf ';\nconst CONFIRM = '; cat workflows/wf3-tools/confirm_booking.json; printf ';\nconst WF1 = '; cat workflows/wf1-inbound.json; printf ';\n'; cat tests/send-message-stubs.js; } | ssh medspa 'cd /opt/medspa/deploy && docker compose exec -T n8n node -'
# Offline, without the live container: end that command with `| node -` instead of the ssh part (a Node with ICU 78.3;
# another ICU fails only the language checks).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-/opt/medspa/workflows/shared/send_message.json}"
tf="${2:-/opt/medspa/templates/messages.en.json}"
cf="${3:-/opt/medspa/workflows/wf3-tools/confirm_booking.json}"
w1="${4:-/opt/medspa/workflows/wf1-inbound.json}"
{
  printf 'const WF = '
  cat "$wf"
  printf ';\nconst TEMPLATES = '
  cat "$tf"
  printf ';\nconst CONFIRM = '
  cat "$cf"
  printf ';\nconst WF1 = '
  cat "$w1"
  printf ';\n'
  cat "$here/send-message-stubs.js"
} | (cd /opt/medspa/deploy && docker compose exec -T n8n node -)
