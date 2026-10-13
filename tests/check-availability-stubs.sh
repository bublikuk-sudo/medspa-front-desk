#!/usr/bin/env bash
# Stub test of check_availability's slots_local (written in the client's language in its Result node) and of the agent's
# instructions about it (wf2-agent's system prompt and check_availability tool description).
# Runs from the workstation, NOT through scripts/remote.sh (that syncs the whole repo): the workflow JSON, the prompt and the
# test are piped into the n8n container's Node over ssh. Its ICU (78.3) is the wording the checks expect. No network call by
# the test, no workflow run, nothing is written.
#   tests/check-availability-stubs.sh [check_availability file] [wf2-agent file] [prompt file]
# Offline, without the live container, with a Node whose ICU is 78.3 (another ICU fails only the slots_local wording), from
# the project root:
#   { printf 'const WF = '; cat workflows/wf3-tools/check_availability.json; printf ';\nconst WF2 = '; cat workflows/wf2-agent.json; printf ';\nconst PROMPT = Buffer.from("'; base64 -w0 prompts/agent-system-prompt.md; printf '", "base64").toString();\n'; cat tests/check-availability-stubs.js; } | node -
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ca="${1:-$here/../workflows/wf3-tools/check_availability.json}"
w2="${2:-$here/../workflows/wf2-agent.json}"
pr="${3:-$here/../prompts/agent-system-prompt.md}"
{
  printf 'const WF = '
  cat "$ca"
  printf ';\nconst WF2 = '
  cat "$w2"
  # the prompt as a string (base64: it has quotes and ${...} that no JS string literal takes as is)
  printf ';\nconst PROMPT = Buffer.from("'
  base64 -w0 "$pr"
  printf '", "base64").toString();\n'
  cat "$here/check-availability-stubs.js"
} | timeout 60 ssh -o BatchMode=yes -o ConnectTimeout=10 medspa 'cd /opt/medspa/deploy && timeout 50 docker compose exec -T n8n node -'
