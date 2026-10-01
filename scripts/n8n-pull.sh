#!/usr/bin/env bash
# usage: scripts/n8n-pull.sh <workflow name> [<outfile>]      (без outfile пишет в stdout)
# Выгружает воркфлоу и возвращает id обратно в плейсхолдеры, чтобы JSON был переносимым.
# Пишет только после полного успеха. ВНИМАНИЕ: shell-редирект `> file` обнуляет файл ещё
# до запуска скрипта, поэтому для отслеживаемых файлов используйте второй аргумент:
#   scripts/n8n-pull.sh <name> workflows/<path>.json   (временный файл + mv, файл цел при ошибке)
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
api="https://$N8N_HOST/api/v1"
# api_call <path>: печатает тело ответа; при HTTP >= 400 печатает его в stderr и падает.
api_call() {
  local out
  if ! out=$(curl -sS --fail-with-body -H "X-N8N-API-KEY: $N8N_API_KEY" "$api$1"); then
    echo "API error: $out" >&2
    return 1
  fi
  printf '%s' "$out"
}
[ -f deploy/workflow-ids.json ] || echo '{}' > deploy/workflow-ids.json
[ -f airtable/ids.json ]        || echo '{"base":"","tables":{}}' > airtable/ids.json
list=$(api_call "/workflows?limit=250")
id=$(printf '%s' "$list" | jq -r --arg n "$1" '.data[] | select(.name==$n) | .id' | head -1)
[ -n "$id" ] || { echo "no workflow named $1" >&2; exit 1; }
wf=$(api_call "/workflows/$id")
out=$(printf '%s' "$wf" | jq --slurpfile ids deploy/workflow-ids.json --slurpfile at airtable/ids.json '
  ($ids[0] | to_entries | map({key: .value, value: ("WFID:" + .key)}) | from_entries) as $rev
  | (($at[0].base // "") as $b | (if ($b|type)=="string" and ($b|length)>0 then [{key: $b, value: "ATBASE"}] else [] end)
     + (($at[0].tables // {}) | to_entries | map({key: .value, value: ("ATTBL:" + .key)})) | from_entries) as $atrev
  | {name, nodes, connections, settings: ((.settings // {}) | {executionOrder, saveManualExecutions, errorWorkflow} | with_entries(select(.value != null)))}
  | .settings.errorWorkflow |= (if . then ($rev[.] // .) else empty end)
  | walk(if type=="object" and (.credentials|type)=="object" then .credentials |= map_values(.id = "CRED") else . end)
  | walk(if type=="object" and .__rl==true and (.value|type)=="string"
         then (if $rev[.value] then .value = $rev[.value] | del(.cachedResultName, .cachedResultUrl)
               elif $atrev[.value] then .value = $atrev[.value] | del(.cachedResultName, .cachedResultUrl)
               else . end)
         else . end)')
if [ -n "${2:-}" ]; then
  printf '%s\n' "$out" > "$2.tmp" && mv "$2.tmp" "$2"
else
  printf '%s\n' "$out"
fi
