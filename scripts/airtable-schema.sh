#!/usr/bin/env bash
# Создаёт базу и таблицы из airtable/schema.json через Airtable Meta API, затем link-поля.
# Записывает id в airtable/ids.json и AIRTABLE_BASE_ID в deploy/secrets.env. Повторный запуск при существующем ids.json — отказ.
# Если Meta API не даёт создать базу (403) — владелец создаёт пустую базу вручную, затем: EXISTING_BASE=app… scripts/airtable-schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
H=(-H "Authorization: Bearer $AIRTABLE_PAT" -H "Content-Type: application/json")
if [ -s airtable/ids.json ] && jq -e '.base != ""' airtable/ids.json > /dev/null; then echo "airtable/ids.json уже заполнен — база создана; для пересоздания удалите файл" >&2; exit 1; fi
if [ -n "${EXISTING_BASE:-}" ]; then
  base="$EXISTING_BASE"
  tables='{}'
  for i in $(seq 0 $(( $(jq '.tables|length' airtable/schema.json) - 1 ))); do
    resp=$(curl -fsS "${H[@]}" -X POST "https://api.airtable.com/v0/meta/bases/$base/tables" -d "$(jq -c ".tables[$i] | .fields |= map(select(.type != \"lastModifiedTime\"))" airtable/schema.json)")
    tables=$(jq --arg n "$(jq -r .name <<< "$resp")" --arg id "$(jq -r .id <<< "$resp")" '. + {($n): $id}' <<< "$tables")
  done
  jq -n --arg b "$base" --argjson t "$tables" '{base: $b, tables: $t}' > airtable/ids.json
else
  # Airtable не создаёт lastModifiedTime-поля вместе с таблицей (422) — они добавляются вторым проходом
  payload=$(jq --arg ws "$AIRTABLE_WORKSPACE_ID" '{name, workspaceId: $ws, tables: (.tables | map(.fields |= map(select(.type != "lastModifiedTime"))))}' airtable/schema.json)
  resp=$(curl -fsS "${H[@]}" -X POST https://api.airtable.com/v0/meta/bases -d "$payload")
  base=$(jq -r .id <<< "$resp")
  jq -n --arg b "$base" --argjson t "$(jq '[.tables[] | {key: .name, value: .id}] | from_entries' <<< "$resp")" '{base: $b, tables: $t}' > airtable/ids.json
fi
# lastModifiedTime-поля вторым проходом
jq -c '.tables[] | . as $t | .fields[] | select(.type == "lastModifiedTime") | {table: $t.name, field: .}' airtable/schema.json | while read -r lm; do
  tbl=$(jq -r --arg t "$(jq -r .table <<< "$lm")" '.tables[$t]' airtable/ids.json)
  curl -fsS "${H[@]}" -X POST "https://api.airtable.com/v0/meta/bases/$base/tables/$tbl/fields" -d "$(jq -c .field <<< "$lm")" > /dev/null
  echo "added $(jq -r .table <<< "$lm").$(jq -r .field.name <<< "$lm") (lastModifiedTime)"
done
# link-поля вторым проходом: им нужны id целевых таблиц
jq -c '.links[]' airtable/schema.json | while read -r link; do
  tbl=$(jq -r --arg t "$(jq -r .table <<< "$link")" '.tables[$t]' airtable/ids.json)
  to=$(jq -r --arg t "$(jq -r .to <<< "$link")" '.tables[$t]' airtable/ids.json)
  curl -fsS "${H[@]}" -X POST "https://api.airtable.com/v0/meta/bases/$base/tables/$tbl/fields" \
    -d "$(jq -n --arg n "$(jq -r .field <<< "$link")" --arg to "$to" '{name: $n, type: "multipleRecordLinks", options: {linkedTableId: $to}}')" > /dev/null
  echo "linked $(jq -r .table <<< "$link").$(jq -r .field <<< "$link") -> $(jq -r .to <<< "$link")"
done
grep -q '^AIRTABLE_BASE_ID=' deploy/secrets.env && sed -i "s/^AIRTABLE_BASE_ID=.*/AIRTABLE_BASE_ID=$base/" deploy/secrets.env || echo "AIRTABLE_BASE_ID=$base" >> deploy/secrets.env
echo "base $base"; jq . airtable/ids.json
