#!/usr/bin/env bash
# Загружает airtable/seed/*.json в таблицы. Идемпотентность: Settings — пропуск, если строка уже есть;
# Services/Knowledge — пропуск строк, чей primary уже существует.
# usage: scripts/airtable-seed.sh [--allow-demo-intake-url]
# Settings.intake_form_url goes to every first-time client right after the booking (BOOKED_INTAKE). The seed refuses to
# create Settings with the demo URL (https://example.com/intake-form-demo) or an empty one: real clients would be sent
# to example.com, or get "Something went wrong" after a successful booking. --allow-demo-intake-url is for a demo base.
set -euo pipefail
cd "$(dirname "$0")/.."
allow_demo_intake=0
if [ "${1:-}" = "--allow-demo-intake-url" ]; then allow_demo_intake=1; shift; fi
[ $# -eq 0 ] || { echo "usage: scripts/airtable-seed.sh [--allow-demo-intake-url]" >&2; exit 2; }
source deploy/secrets.env
for v in AIRTABLE_PAT AIRTABLE_BASE_ID GOOGLE_CALENDAR_ID OWNER_TELEGRAM_CHAT_ID; do
  [ -n "${!v:-}" ] || { echo "$v пуст или не задан в deploy/secrets.env (AIRTABLE_BASE_ID заполняет scripts/airtable-schema.sh)" >&2; exit 1; }
done
H=(-H "Authorization: Bearer $AIRTABLE_PAT" -H "Content-Type: application/json")
api="https://api.airtable.com/v0/$AIRTABLE_BASE_ID"
post() { curl -fsS "${H[@]}" -X POST "$api/$1" -d "$(jq -n --argjson r "$2" '{records: ($r | map({fields: .})), typecast: true}')" > /dev/null; }
existing() { curl -fsS -G "${H[@]}" "$api/$1" --data-urlencode "fields[]=$2" | jq -r --arg f "$2" '.records[].fields[$f]'; }
# Settings
if [ "$(curl -fsS "${H[@]}" "$api/Settings" | jq '.records|length')" = "0" ]; then
  intake=$(jq -r '.[0].intake_form_url // ""' airtable/seed/settings.json)
  if [ -z "$intake" ] || { [ "$intake" = "https://example.com/intake-form-demo" ] && [ "$allow_demo_intake" -eq 0 ]; }; then
    echo "refusing to seed Settings: intake_form_url in airtable/seed/settings.json is '${intake:-empty}'. Put the clinic's own" >&2
    echo "intake and consent form URL there (every first-time client gets it after booking), or pass --allow-demo-intake-url for a demo." >&2
    exit 1
  fi
  post Settings "$(jq --arg cal "$GOOGLE_CALENDAR_ID" --arg own "$OWNER_TELEGRAM_CHAT_ID" --arg wa "${WHATSAPP_FROM_DISPLAY:-}" \
    'map(.calendar_id=$cal | .owner_contact=$own | .whatsapp_number=$wa)' airtable/seed/settings.json)"; echo "Settings: 1 row"
else echo "Settings: exists"; fi
# Services и Knowledge — пачками по 10
for pair in "Services:service_id:services" "Knowledge:kb_id:knowledge"; do
  IFS=: read -r table key file <<< "$pair"
  have=$(existing "$table" "$key" | jq -R . | jq -s .)
  new=$(jq --argjson have "$have" --arg k "$key" '[.[] | select(.[$k] as $v | $have | index($v) | not)]' "airtable/seed/$file.json")
  n=$(jq length <<< "$new"); i=0
  while [ $i -lt "$n" ]; do post "$table" "$(jq ".[$i:$((i+10))]" <<< "$new")"; i=$((i+10)); done
  echo "$table: +$n rows"
done
