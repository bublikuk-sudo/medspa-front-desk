#!/usr/bin/env bash
# Создаёт базу «MedSpa Front Desk» из airtable/schema.json через Airtable Meta API и доводит её до схемы.
# Скрипт возобновляемый: каждый проход сначала читает текущие таблицы и поля базы и создаёт только то, чего не хватает,
# поэтому повторный запуск на частично построенной базе её достраивает; на готовой базе ничего не меняет.
# id пишутся в airtable/ids.json по мере создания, AIRTABLE_BASE_ID — в deploy/secrets.env сразу после появления базы.
# Если Meta API не даёт создать базу (403) — владелец создаёт пустую базу вручную, затем: EXISTING_BASE=app… scripts/airtable-schema.sh
# Airtable API не умеет удалять базы — не создавайте «запасную», а возобновляйте существующую.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
[ -n "${AIRTABLE_PAT:-}" ] || { echo "AIRTABLE_PAT пуст в deploy/secrets.env" >&2; exit 1; }
H=(-H "Authorization: Bearer $AIRTABLE_PAT" -H "Content-Type: application/json")
meta=https://api.airtable.com/v0/meta/bases
ids=airtable/ids.json
[ -s "$ids" ] || echo '{"base":"","tables":{}}' > "$ids"

need_id() { case "$1" in ""|null) echo "Airtable не вернул id (получено «${1:-пусто}») — ничего не записываю" >&2; exit 1;; esac; }
set_secret() { # NAME VALUE: заменить строку на месте (допускается `export`), иначе дописать с новой строки
  local f=deploy/secrets.env esc
  need_id "$2"
  if grep -Eq "^[[:space:]]*(export[[:space:]]+)?$1=" "$f"; then
    esc=$(printf '%s' "$2" | sed -e 's/[\\&|]/\\&/g')   # |, & и \ в значении иначе ломают замену
    sed -i -E "s|^([[:space:]]*(export[[:space:]]+)?)$1=.*|\1$1=$esc|" "$f"
  else
    if [ -n "$(tail -c1 "$f")" ]; then echo >> "$f"; fi
    echo "$1=$2" >> "$f"
  fi
}
record_table() { # NAME ID: слить в ids.json
  need_id "$2"
  jq --arg n "$1" --arg id "$2" '.tables[$n] = $id' "$ids" > "$ids.tmp" && mv "$ids.tmp" "$ids"
}
live_tables() { curl -fsS "${H[@]}" "$meta/$base/tables"; }
# lastModifiedTime Airtable не создаёт вместе с таблицей (422) — такие поля добавляются отдельным проходом
strip_lm='.fields |= map(select(.type != "lastModifiedTime"))'

base=$(jq -r '.base // ""' "$ids")
if [ -n "$base" ] && [ -n "${EXISTING_BASE:-}" ] && [ "$base" != "$EXISTING_BASE" ]; then
  echo "airtable/ids.json уже указывает на $base, а не на $EXISTING_BASE. Запустите без EXISTING_BASE, чтобы достроить ту базу (Airtable API не умеет удалять базы — новую не создавайте)." >&2
  exit 1
fi
# порядок: EXISTING_BASE, ids.json, AIRTABLE_BASE_ID из secrets.env. Последнее — страховка: ids.json лежит только на VPS и не в git,
# а Airtable не умеет удалять базы, так что потерянный ids.json не должен приводить к созданию второй базы.
[ -n "$base" ] || base="${EXISTING_BASE:-}"
if [ -z "$base" ] && [ -n "${AIRTABLE_BASE_ID:-}" ]; then
  base="$AIRTABLE_BASE_ID"; echo "base $base взята из AIRTABLE_BASE_ID в secrets.env (в ids.json её не было); ids.json восстанавливается"
fi

if [ -z "$base" ]; then
  [ -n "${AIRTABLE_WORKSPACE_ID:-}" ] || { echo "AIRTABLE_WORKSPACE_ID пуст в deploy/secrets.env (или задайте EXISTING_BASE=app…)" >&2; exit 1; }
  payload=$(jq --arg ws "$AIRTABLE_WORKSPACE_ID" '{name, workspaceId: $ws, tables: (.tables | map(.fields |= map(select(.type != "lastModifiedTime"))))}' airtable/schema.json)
  resp=$(curl -fsS "${H[@]}" -X POST "$meta" -d "$payload")
  base=$(jq -r .id <<< "$resp"); need_id "$base"
  set_secret AIRTABLE_BASE_ID "$base"   # сразу, до всего остального: потеря этого id = дубликат базы при следующем запуске
  echo "created base $base"
  jq --arg b "$base" '.base = $b' "$ids" > "$ids.tmp" && mv "$ids.tmp" "$ids"
  jq -r '.tables[] | "\(.name) \(.id)"' <<< "$resp" | while read -r n id; do record_table "$n" "$id"; done
else
  jq --arg b "$base" '.base = $b' "$ids" > "$ids.tmp" && mv "$ids.tmp" "$ids"
fi
set_secret AIRTABLE_BASE_ID "$base"

# проход 1: недостающие таблицы
live=$(live_tables)
for name in $(jq -r '.tables[].name' airtable/schema.json); do
  have=$(jq -r --arg n "$name" '[.tables[] | select(.name == $n) | .id][0] // ""' <<< "$live")
  if [ -n "$have" ]; then
    record_table "$name" "$have"; echo "table $name: exists"
  else
    resp=$(curl -fsS "${H[@]}" -X POST "$meta/$base/tables" -d "$(jq -c --arg n "$name" ".tables[] | select(.name == \$n) | $strip_lm" airtable/schema.json)")
    record_table "$name" "$(jq -r .id <<< "$resp")"; echo "table $name: created"
  fi
done

# проход 2: недостающие поля (в т.ч. lastModifiedTime)
live=$(live_tables)
jq -c --argjson live "$live" '.tables[] | . as $t | ($live.tables[] | select(.name == $t.name)) as $lt
  | $t.fields[] | select(.name as $n | ($lt.fields | map(.name) | index($n)) | not) | {table: $t.name, field: .}' airtable/schema.json |
while read -r item; do
  tbl=$(jq -r --arg t "$(jq -r .table <<< "$item")" '.tables[$t]' "$ids")
  curl -fsS "${H[@]}" -X POST "$meta/$base/tables/$tbl/fields" -d "$(jq -c .field <<< "$item")" > /dev/null
  echo "field $(jq -r .table <<< "$item").$(jq -r .field.name <<< "$item"): added"
done

# проход 3: недостающие link-поля (нужны id целевых таблиц)
live=$(live_tables)
jq -c '.links[]' airtable/schema.json | while read -r link; do
  from=$(jq -r .table <<< "$link"); field=$(jq -r .field <<< "$link"); target=$(jq -r .to <<< "$link")
  if jq -e --arg t "$from" --arg f "$field" '.tables[] | select(.name == $t) | .fields[] | select(.name == $f)' <<< "$live" > /dev/null; then
    echo "link $from.$field: exists"; continue
  fi
  tbl=$(jq -r --arg t "$from" '.tables[$t]' "$ids"); to=$(jq -r --arg t "$target" '.tables[$t]' "$ids")
  curl -fsS "${H[@]}" -X POST "$meta/$base/tables/$tbl/fields" \
    -d "$(jq -n --arg n "$field" --arg to "$to" '{name: $n, type: "multipleRecordLinks", options: {linkedTableId: $to}}')" > /dev/null
  echo "linked $from.$field -> $target"
done

echo "base $base"; jq . "$ids"
