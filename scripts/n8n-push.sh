#!/usr/bin/env bash
# usage: scripts/n8n-push.sh workflows/<path>.json [--activate|--deactivate]
# Создаёт или обновляет воркфлоу по имени через Public API, подставляя
# id credentials (по имени), id воркфлоу (WFID:<name>) и id Airtable (ATBASE, ATTBL:<Table>).
# Любая ошибка фатальна; тело ответа API печатается в stderr.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
api="https://$N8N_HOST/api/v1"
auth=(-H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json")
# api_call <curl args...>: печатает тело ответа; при HTTP >= 400 печатает его в stderr и падает.
api_call() {
  local out
  if ! out=$(curl -sS --fail-with-body "${auth[@]}" "$@"); then
    echo "API error: $out" >&2
    return 1
  fi
  printf '%s' "$out"
}
[ -f deploy/workflow-ids.json ]     || echo '{}' > deploy/workflow-ids.json
[ -f deploy/credentials.map.json ]  || echo '{}' > deploy/credentials.map.json
[ -f airtable/ids.json ]            || echo '{"base":"","tables":{}}' > airtable/ids.json
f="$1"; name=$(jq -r .name "$f")
# settings.errorWorkflow = WFID:<x> with <x> not yet in workflow-ids.json (the first push-all pass, before WF-6 exists)
# would make every other WFID: resolution below fatal. Drop the setting instead, but LOUDLY: a workflow pushed
# without its error handler is silently unmonitored. scripts/push-all.sh's second pass re-pushes with the id known.
drop_ew=false
ew=$(jq -r '.settings.errorWorkflow // empty' "$f")
if [[ "$ew" == WFID:* ]] && ! jq -e --arg k "${ew#WFID:}" 'has($k)' deploy/workflow-ids.json > /dev/null; then
  drop_ew=true
  echo "WARNING: $name pushed WITHOUT settings.errorWorkflow ($ew is not deployed yet) - it has NO error handler until it is pushed again" >&2
fi
# WAPHONEID: a string value that is exactly WAPHONEID becomes WHATSAPP_PHONE_NUMBER_ID from secrets.env (an id, not a secret).
# Stopgap until the n8n container has $env.WHATSAPP_PHONE_NUMBER_ID (Task 15 Step 1), after which workflows use the $env expression.
body=$(jq --argjson dropew "$drop_ew" --arg waid "${WHATSAPP_PHONE_NUMBER_ID:-}" --slurpfile ids deploy/workflow-ids.json --slurpfile creds deploy/credentials.map.json --slurpfile at airtable/ids.json '
  def waphone(s): if s=="WAPHONEID" then (if ($waid|length)>0 then $waid else error("WHATSAPP_PHONE_NUMBER_ID is empty in secrets.env") end) else s end;
  def wf(s): if (s|type)=="string" and (s|startswith("WFID:")) then ($ids[0][s[5:]] // error("unknown workflow " + s)) else s end;
  def at(s): if s=="ATBASE" then (if ($at[0].base|type)=="string" and ($at[0].base|length)>0 then $at[0].base else error("unknown airtable base (airtable/ids.json not populated)") end)
             elif (s|type)=="string" and (s|startswith("ATTBL:")) then ($at[0].tables[s[6:]] // error("unknown table " + s))
             else s end;
  {name, nodes, connections, settings: (.settings // {})}
  | if $dropew then del(.settings.errorWorkflow) else . end
  | walk(if type=="object" and (.credentials|type)=="object"
         then .credentials |= with_entries(.value.id = ($creds[0][.value.name] // error("unknown credential " + .value.name)))
         else . end)
  | walk(if type=="object" and .__rl==true then .value |= (wf(.) | at(.)) else . end)
  | walk(if type=="string" then (wf(.) | waphone(.)) else . end)' "$f")
id=$(api_call "$api/workflows?limit=250" | jq -r --arg n "$name" '.data[] | select(.name==$n) | .id' | head -1)
if [ -z "$id" ]; then
  resp=$(api_call -X POST "$api/workflows" -d "$body")
  id=$(printf '%s' "$resp" | jq -r '.id // empty')
  [ -n "$id" ] || { echo "POST /workflows returned no id: $resp" >&2; exit 1; }
  echo "created $name -> $id"
else
  api_call -X PUT "$api/workflows/$id" -d "$body" > /dev/null; echo "updated $name -> $id"
fi
jq --arg n "$name" --arg id "$id" '.[$n] = $id' deploy/workflow-ids.json > deploy/.ids.tmp
mv deploy/.ids.tmp deploy/workflow-ids.json
case "${2:-}" in
  --activate)   api_call -X POST "$api/workflows/$id/activate"   > /dev/null; echo "activated $name" ;;
  --deactivate) api_call -X POST "$api/workflows/$id/deactivate" > /dev/null; echo "deactivated $name" ;;
esac
