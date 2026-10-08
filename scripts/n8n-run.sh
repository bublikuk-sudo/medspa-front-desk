#!/usr/bin/env bash
# usage: scripts/n8n-run.sh <workflow name>  (cwd or caller anywhere; runs on the VPS)
# Runs a workflow that has a Webhook trigger with path = its name (node "Run Now" in wf5-reminders and in
# wf4-knowledge-ingest, the manual re-index after a Knowledge edit), protected by the MedSpa Test Key Header Auth
# credential. The workflow must be ACTIVE (production webhook).
# Why not `n8n execute --id`: with N8N_RUNNERS_ENABLED=true `n8n execute` starts its own task broker on 127.0.0.1:5679,
# which the running main process already holds, so it cannot run beside the live instance.
# Reports the execution THIS call started: the newest webhook-mode execution id is noted before the call and the script
# waits for a newer one to finish. Exit 0 only when that execution finished with status success. The key is never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
name="${1:?usage: scripts/n8n-run.sh <workflow name>}"
id=$(jq -r --arg n "$name" '.[$n] // error("no workflow id for " + $n + " - push it first")' deploy/workflow-ids.json)
api="https://$N8N_HOST/api/v1"
# newest webhook-mode execution of the workflow as compact JSON ({} when there is none); the scheduled runs are ignored
latest() {
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$api/executions?workflowId=$id&limit=10" |
    jq -c '[.data[] | select(.mode == "webhook")] | (.[0] // {})'
}
before=$(latest | jq -r '.id // 0')
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 300 -X POST "https://$N8N_HOST/webhook/$name" \
  -H "X-Test-Key: $TEST_KEY" -H 'Content-Type: application/json' -d '{}')
echo "webhook $name -> HTTP $code"
[ "$code" = 200 ] || { echo "webhook did not answer 200 (workflow inactive, or wrong key?)" >&2; exit 1; }
# the execution record can lag a moment behind the answer: wait up to ~60 s for a NEWER execution that is no longer running
for _ in $(seq 1 30); do
  cur=$(latest)
  cid=$(printf '%s' "$cur" | jq -r '.id // 0')
  st=$(printf '%s' "$cur" | jq -r '.status // ""')
  if [ "$cid" != "0" ] && [ "$cid" != "$before" ] && [ "$st" != running ] && [ "$st" != new ] && [ "$st" != waiting ]; then
    printf '%s' "$cur" | jq -r '"execution \(.id): \(.status), finished=\(.finished), started \(.startedAt)"'
    [ "$st" = success ] || { echo "execution $cid did not succeed (status $st)" >&2; exit 1; }
    exit 0
  fi
  sleep 2
done
echo "no new finished execution of $name appeared after the webhook answered 200 (newest webhook execution is still $before)" >&2
exit 1
