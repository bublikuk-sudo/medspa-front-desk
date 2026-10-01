#!/usr/bin/env bash
# usage: scripts/n8n-pull.sh <workflow name> > workflows/<path>.json
# Выгружает воркфлоу и возвращает id обратно в плейсхолдеры, чтобы JSON был переносимым.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
api="https://$N8N_HOST/api/v1"
id=$(curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$api/workflows?limit=250" | jq -r --arg n "$1" '.data[] | select(.name==$n) | .id' | head -1)
[ -n "$id" ] || { echo "no workflow named $1" >&2; exit 1; }
curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$api/workflows/$id" \
| jq --slurpfile ids deploy/workflow-ids.json --slurpfile at airtable/ids.json '
  ($ids[0] | to_entries | map({key: .value, value: ("WFID:" + .key)}) | from_entries) as $rev
  | ([{key: $at[0].base, value: "ATBASE"}] + ($at[0].tables | to_entries | map({key: .value, value: ("ATTBL:" + .key)})) | from_entries) as $atrev
  | {name, nodes, connections, settings: ((.settings // {}) | {executionOrder, saveManualExecutions, errorWorkflow} | with_entries(select(.value != null)))}
  | .settings.errorWorkflow |= (if . then ($rev[.] // .) else empty end)
  | walk(if type=="object" and (.credentials|type)=="object" then .credentials |= map_values(.id = "CRED") else . end)
  | walk(if type=="object" and .__rl==true and (.value|type)=="string"
         then (if $rev[.value] then .value = $rev[.value] | del(.cachedResultName, .cachedResultUrl)
               elif $atrev[.value] then .value = $atrev[.value] | del(.cachedResultName, .cachedResultUrl)
               else . end)
         else . end)'
