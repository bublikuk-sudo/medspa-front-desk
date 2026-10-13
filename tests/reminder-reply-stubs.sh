#!/usr/bin/env bash
# Stub test of workflows/wf3-tools/reminder_reply.json: Decide (which visit, confirm or cancel, late or free), the cancel
# branch's expressions (Mark Cancelled status, Late?, Flag Client, Notify) and the wiring.
# Runs from the workstation, NOT through scripts/remote.sh (that syncs the whole repo): the workflow JSON and the test are
# piped into the n8n container's Node over ssh, which has the luxon that Decide uses. No network call by the test, no
# workflow run, nothing is written.
#   tests/reminder-reply-stubs.sh [path to another workflow file]
# Offline, with any Node that can require('luxon') (e.g. after `npm i luxon` in an empty folder), from the project root:
#   { printf 'const WF = '; cat workflows/wf3-tools/reminder_reply.json; printf ';\n'; cat tests/reminder-reply-stubs.js; } | node -
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-$here/../workflows/wf3-tools/reminder_reply.json}"
{
  printf 'const WF = '
  cat "$wf"
  printf ';\n'
  cat "$here/reminder-reply-stubs.js"
} | timeout 60 ssh -o BatchMode=yes -o ConnectTimeout=10 medspa 'cd /opt/medspa/deploy && timeout 50 docker compose exec -T n8n node -'
