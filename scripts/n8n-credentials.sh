#!/usr/bin/env bash
# Создаёт credentials из deploy/secrets.env; повторный запуск пропускает уже созданные (по map-файлу).
# Credential, для которого в secrets.env пустые или отсутствующие значения, пропускается
# ("skipped (no value): <имя>") и создаётся при следующем запуске, когда значения появятся.
# Значения секретов нигде не печатаются.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
api="https://$N8N_HOST/api/v1"
auth=(-H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json")
[ -f deploy/credentials.map.json ] || echo '{}' > deploy/credentials.map.json
create() { # name type data_json required_var...
  local name="$1" type="$2" data="$3" v; shift 3
  if jq -e --arg n "$name" '.[$n]' deploy/credentials.map.json > /dev/null; then echo "exists: $name"; return; fi
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then echo "skipped (no value): $name"; return; fi
  done
  id=$(curl -fsS "${auth[@]}" -X POST "$api/credentials" \
        -d "$(jq -n --arg n "$name" --arg t "$type" --argjson d "$data" '{name: $n, type: $t, data: $d}')" | jq -r .id)
  jq --arg n "$name" --arg id "$id" '.[$n] = $id' deploy/credentials.map.json > deploy/.c.tmp && mv deploy/.c.tmp deploy/credentials.map.json
  echo "created: $name -> $id"
}
# ${VAR:-} нужен: set -u иначе упал бы на переменных, которых в secrets.env ещё нет.
create "MedSpa Anthropic" anthropicApi     "$(jq -n --arg k "${ANTHROPIC_API_KEY:-}" '{apiKey: $k}')" ANTHROPIC_API_KEY
create "MedSpa OpenAI"    openAiApi        "$(jq -n --arg k "${OPENAI_API_KEY:-}"    '{apiKey: $k}')" OPENAI_API_KEY
create "MedSpa Airtable"  airtableTokenApi "$(jq -n --arg k "${AIRTABLE_PAT:-}"      '{accessToken: $k}')" AIRTABLE_PAT
create "MedSpa Telegram"  telegramApi      "$(jq -n --arg k "${TELEGRAM_BOT_TOKEN:-}" '{accessToken: $k}')" TELEGRAM_BOT_TOKEN
create "MedSpa WhatsApp"  whatsAppApi      "$(jq -n --arg t "${WHATSAPP_ACCESS_TOKEN:-}" --arg b "${WHATSAPP_BUSINESS_ACCOUNT_ID:-}" '{accessToken: $t, businessAccountId: $b}')" WHATSAPP_ACCESS_TOKEN WHATSAPP_BUSINESS_ACCOUNT_ID
create "MedSpa WhatsApp Trigger" whatsAppTriggerApi "$(jq -n --arg i "${META_APP_ID:-}" --arg s "${META_APP_SECRET:-}" '{clientId: $i, clientSecret: $s}')" META_APP_ID META_APP_SECRET
create "MedSpa Postgres"  postgres         "$(jq -n --arg p "${POSTGRES_PASSWORD:-}" '{host: "postgres", port: 5432, database: "n8n", user: "n8n", password: $p, ssl: "disable"}')" POSTGRES_PASSWORD
create "MedSpa Test Key"  httpHeaderAuth   "$(jq -n --arg k "${TEST_KEY:-}" '{name: "X-Test-Key", value: $k}')" TEST_KEY
chmod 600 deploy/credentials.map.json
