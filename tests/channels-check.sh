#!/usr/bin/env bash
# usage: tests/channels-check.sh   (on the VPS, cwd /opt/medspa; scripts/remote.sh 'tests/channels-check.sh')
# Read-only check that the live channels still point at this instance, for after a wf1-inbound push:
#   - Telegram getWebhookInfo: url, pending_update_count, last_error_message
#   - Meta GET /<App ID>/subscriptions: object, active, callback_url, fields
# Exit 0 only when the Telegram webhook is /webhook/<Telegram Trigger webhookId>/webhook on N8N_HOST and the Meta app
# subscription is active with callback /webhook/<WhatsApp Trigger webhookId>/webhook and field messages.
# Tokens are only ever passed to curl; nothing secret is printed (the URLs printed carry no token).
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
tg_hook=$(jq -r '.nodes[] | select(.name == "Telegram Trigger") | .webhookId' workflows/wf1-inbound.json)
wa_hook=$(jq -r '.nodes[] | select(.name == "WhatsApp Trigger") | .webhookId' workflows/wf1-inbound.json)
tg_want="https://$N8N_HOST/webhook/$tg_hook/webhook"
wa_want="https://$N8N_HOST/webhook/$wa_hook/webhook"
rc=0
tg=$(curl -fsS --max-time 20 "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq -c '.result | {url, pending_update_count, last_error_message}')
echo "telegram: $tg"
[ "$(jq -r .url <<< "$tg")" = "$tg_want" ] || { echo "telegram: webhook is NOT this instance's Telegram Trigger" >&2; rc=1; }
wa=$(curl -fsS --max-time 20 -G "https://graph.facebook.com/v19.0/$META_APP_ID/subscriptions" --data-urlencode "access_token=$META_APP_ID|$META_APP_SECRET" |
  jq -c '[.data[] | {object, active, callback_url, fields: [.fields[]?.name]}]')
echo "whatsapp: $wa"
jq -e --arg u "$wa_want" 'any(.[]; .object == "whatsapp_business_account" and .active == true and .callback_url == $u and (.fields | index("messages")))' <<< "$wa" > /dev/null ||
  { echo "whatsapp: no active whatsapp_business_account subscription on this instance's WhatsApp Trigger" >&2; rc=1; }
[ "$rc" -eq 0 ] && echo "channels ok"
exit "$rc"
