#!/usr/bin/env bash
# usage: tests/airtable-calls.sh <since ISO> <until ISO>     (runs ON THE VPS, cwd anywhere; reads the n8n API only)
# Approximate Airtable API calls made by every deployed workflow whose executions STARTED in [since, until), counted from
# the n8n execution data: one call per input item of each Airtable node run (a Get / Update / Create makes one request per
# item; a search with executeOnce or one input item makes one). Not counted: extra pages of a search over 100 records, the
# retries of retryOnFail, the Airtable calls of the test scripts themselves (tests/lib/airtable.sh). The Airtable node names
# come from the workflow files in workflows/, so they must match what is deployed. n8n prunes executions after 7 days
# (EXECUTIONS_DATA_MAX_AGE=168).
# Example (one booking dialog of a Task 20 run): tests/airtable-calls.sh 2026-10-05T19:50:48Z 2026-10-05T20:10:46Z
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
since="${1:?usage: tests/airtable-calls.sh <since ISO> <until ISO>}"; until="${2:?usage: tests/airtable-calls.sh <since ISO> <until ISO>}"
# n8n's startedAt is "YYYY-MM-DDTHH:MM:SS.mmmZ"; the bounds are compared as strings, so bring them to exactly that form
# ("…:48Z" would sort after "…:48.123Z" and drop executions of that very second)
since=$(date -u -d "$since" +%Y-%m-%dT%H:%M:%S.%3NZ) && until=$(date -u -d "$until" +%Y-%m-%dT%H:%M:%S.%3NZ) || { echo "unreadable time bound" >&2; exit 2; }
api="https://$N8N_HOST/api/v1"
names=$(jq -s 'map({(.name): [.nodes[] | select(.type == "n8n-nodes-base.airtable") | .name]}) | add' workflows/*.json workflows/*/*.json)
# per execution: sum over the Airtable node runs of the number of distinct input items its output items are paired to (at least 1)
count='def pi: if type == "array" then (.[0].item // 0) elif type == "object" then (.item // 0) else 0 end;
  [.data[] | select(.startedAt >= $s and .startedAt < $u)
   | [(.data.resultData.runData // {}) | to_entries[] | select(.key as $k | $names | index($k)) | .value[]
      | ([(.data.main // [])[] | (. // [])[] | (.pairedItem | pi)] | unique | length) | if . < 1 then 1 else . end] | add // 0]
  | {executions: length, calls: (add // 0)}'
total=0
for wf in $(jq -r 'keys[]' deploy/workflow-ids.json); do
  nodes=$(jq -c --arg n "$wf" '.[$n] // []' <<< "$names")
  [ "$nodes" != "[]" ] || continue
  id=$(jq -r --arg n "$wf" '.[$n]' deploy/workflow-ids.json)
  ex=0; calls=0; cursor=""
  while :; do
    page=$(curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$api/executions?workflowId=$id&includeData=true&limit=50${cursor:+&cursor=$cursor}")
    r=$(jq -c --arg s "$since" --arg u "$until" --argjson names "$nodes" "$count" <<< "$page")
    ex=$((ex + $(jq .executions <<< "$r"))); calls=$((calls + $(jq .calls <<< "$r")))
    cursor=$(jq -r '.nextCursor // ""' <<< "$page"); oldest=$(jq -r '.data[-1].startedAt // ""' <<< "$page")
    if [ -z "$cursor" ] || [[ "$oldest" < "$since" ]]; then break; fi
  done
  [ "$ex" -eq 0 ] || printf '%-22s executions %3d  airtable calls %4d\n' "$wf" "$ex" "$calls"
  total=$((total + calls))
done
echo "total airtable calls (approx.): $total"
