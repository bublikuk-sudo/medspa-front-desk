#!/usr/bin/env bash
# usage: tests/state.sh <contact_id> [--json]   (on the VPS, cwd /opt/medspa)
# Snapshot of one client's state: the Clients row, its Appointments and the calendar events of those appointments.
#   default  CLIENT / APPT / EVENT lines (what the dialog run logs show)
#   --json   {client: {...fields}, appts: [{...fields}], events: [{id, summary, description, start, end}]} for tests/dialog.sh
# Adapted from the plan's Task 20 Step 1: the events are not "every event of the next 60 days" but only the booking events
# of this client's appointments (confirm_booking writes the appt_id into the event description), searched in the next
# 60 days AND in January-February 2030, where the dialogs book. So a log never shows another (real) client's event.
set -euo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
cid="${1:-}"; mode="${2:-}"
[[ "$cid" =~ ^(tg:[0-9]{1,20}|wa:\+[0-9]{7,15})$ ]] || { echo "usage: tests/state.sh <tg:digits|wa:+digits> [--json]" >&2; exit 2; }
field=$([[ "$cid" == tg:* ]] && echo telegram_chat_id || echo phone); val="${cid#*:}"
client=$(at_list Clients "{$field}='$val'" | jq -c '.records[0].fields // {}')
clid=$(jq -r '.client_id // empty' <<< "$client")
appts='[]'
if [[ "$clid" =~ ^[A-Za-z0-9_-]+$ ]]; then
  appts=$(at_list Appointments "{client_id}='$clid'" | jq -c '[.records[].fields] | sort_by(.start_iso // "")')
fi
ids=$(jq -c '[.[].appt_id // empty]' <<< "$appts")
events='[]'
if [ "$ids" != '[]' ]; then
  ev() { tests/run-case.sh test-fixtures "$(jq -nc --arg s "$1" --arg e "$2" '{action:"list_events", start_iso:$s, end_iso:$e}')" | jq -ce '.events'; }
  near=$(ev "$(date -u +%Y-%m-%dT00:00:00Z)" "$(date -u -d '+60 days' +%Y-%m-%dT00:00:00Z)")
  y2030=$(ev 2030-01-01T00:00:00Z 2030-03-01T00:00:00Z)
  events=$(jq -cn --argjson a "$near" --argjson b "$y2030" --argjson ids "$ids" '[$a[], $b[]] | unique_by(.id) | map(select(.description as $d | $ids | index($d)))')
fi
if [ "$mode" = --json ]; then
  jq -cn --argjson client "$client" --argjson appts "$appts" --argjson events "$events" '{client: $client, appts: $appts, events: $events}'
  exit 0
fi
echo "CLIENT: $(jq -c '{client_id, name, language, status, intake_completed}' <<< "$client")"
jq -r '.[] | "APPT: \(.appt_id) \(.service_id) \(.start_iso) \(.status) event=\(.calendar_event_id // "-") reminder_sent_at=\(.reminder_sent_at // "-")"' <<< "$appts"
jq -r '.[] | "EVENT: \(.summary) \(.start) \(.description)"' <<< "$events"
