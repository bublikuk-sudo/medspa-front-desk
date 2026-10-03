#!/usr/bin/env bash
# usage: scripts/n8n-run.sh <workflow name>  (cwd or caller anywhere; runs on the VPS)
# Runs a workflow that has a Webhook trigger with path = its name (wf5-reminders: node "Run Now"), protected by the
# MedSpa Test Key Header Auth credential. The workflow must be ACTIVE (production webhook).
# Why not `n8n execute --id`: with N8N_RUNNERS_ENABLED=true `n8n execute` starts its own task broker on 127.0.0.1:5679,
# which the running main process already holds, so it cannot run beside the live instance.
# Prints the HTTP status and the newest execution of that workflow (id, status, finished). The key is never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
name="${1:?usage: scripts/n8n-run.sh <workflow name>}"
id=$(jq -r --arg n "$name" '.[$n] // error("no workflow id for " + $n + " - push it first")' deploy/workflow-ids.json)
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 300 -X POST "https://$N8N_HOST/webhook/$name" \
  -H "X-Test-Key: $TEST_KEY" -H 'Content-Type: application/json' -d '{}')
echo "webhook $name -> HTTP $code"
[ "$code" = 200 ] || { echo "webhook did not answer 200 (workflow inactive, or wrong key?)" >&2; exit 1; }
curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/executions?workflowId=$id&limit=1" |
  jq -r '.data[0] | "execution \(.id): \(.status), finished=\(.finished), started \(.startedAt)"'
