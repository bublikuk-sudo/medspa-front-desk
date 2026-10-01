#!/usr/bin/env bash
# usage: tests/run-case.sh <workflow name> '<json input>'  → JSON выхода последнего узла
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
id=$(jq -r --arg n "$1" '.[$n] // error("no workflow id for " + $n + " — push it first")' deploy/workflow-ids.json)
curl -fsS -X POST "https://$N8N_HOST/webhook/test-tool" -H "X-Test-Key: $TEST_KEY" -H 'Content-Type: application/json' \
  -d "$(jq -n --arg id "$id" --argjson input "$2" '{workflow_id: $id, input: $input}')"
