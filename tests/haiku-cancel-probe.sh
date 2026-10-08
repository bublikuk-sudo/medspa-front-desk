#!/usr/bin/env bash
# Live probe of WF-1's LLM Affirmative prompt for the cancel question (see tests/haiku-cancel-probe.js). Six Haiku calls.
#   scripts/remote.sh 'tests/haiku-cancel-probe.sh'
# The key is passed to the container by NAME (docker exec -e K), so its value is neither printed nor on a command line.
set -uo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
export K="$ANTHROPIC_API_KEY"
{
  printf 'const WF = '
  cat workflows/wf1-inbound.json
  printf ';\n'
  cat tests/haiku-cancel-probe.js
} | (cd deploy && docker compose exec -T -e K n8n node -)
