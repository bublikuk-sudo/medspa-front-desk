#!/usr/bin/env bash
# Live test of WF-5 (Task 17 phase 2). Runs ON THE VPS (cwd /opt/medspa), Telegram only.
#   scripts/remote.sh 'tests/wf5-live.sh run'      create the rows (booked visits TOMORROW 11:00 local), run WF-5 twice, print
#   scripts/remote.sh 'tests/wf5-live.sh clean'    delete every A-TEST-* row and the C-test-* clients (A-TEST-REM goes too)
# It sets Settings.reminder_hours_before to 1 (so a visit booked a moment ago for tomorrow is due) and ALWAYS restores the
# original value (trap). It refuses to start when WF-5 would act on a real row (tests/lib/airtable.sh wf5_guard) or near the
# daily 07:05 UTC run (its minute guard is older and stricter). It sends real Telegram messages to the owner.
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
source tests/lib/n8n.sh
API="https://$N8N_HOST/api/v1"

appt() { at_list Appointments "{appt_id}='$1'" | jq -c '.records[0].fields | {status, reminder_sent_at, revisit_invited_at, calendar_event_id}'; }
# execs <workflow name> <since ISO>: executions started at or after that instant, with data, as compact JSON lines
execs() {
  local id; id=$(jq -r --arg n "$1" '.[$n]' deploy/workflow-ids.json)
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$id&limit=30&includeData=true" |
    jq -c --arg t "$2" '.data[] | select(.startedAt >= $t)'
}
report_sends() {
  echo "-- send_message since $1 (template, appt, ok?):"
  execs send_message "$1" | jq -r '[(.data.resultData.runData.Trigger[0].data.main[0][0].json | .template_key, .appt_id), .status] | @tsv'
  echo "-- notify_owner since $1 (the owner messages):"
  execs notify_owner "$1" | jq -r '.data.resultData.runData.Trigger[0].data.main[0][0].json.text'
}

if [ "${1:-}" = clean ]; then
  at_delete_where Appointments "REGEX_MATCH({appt_id}, '^A-TEST-')"
  at_delete_where Clients "REGEX_MATCH({client_id}, '^C-test')"
  echo "clean: A-TEST-* appointments and C-test* clients deleted"
  exit 0
fi
[ "${1:-}" = run ] || { echo "usage: tests/wf5-live.sh run|clean" >&2; exit 2; }

min=$((10#$(date -u +%M)))
if [ "$min" -lt 10 ] || [ "$min" -gt 45 ]; then echo "refusing: the hourly :05 run is near (minute $min), start between :10 and :45" >&2; exit 1; fi

# ---- safety: nothing real may be acted on by the runs below. WF-5's own send criteria at reminder_hours_before = 1
# (tests/lib/airtable.sh wf5_guard), the reminder window widened by 1 h for the wait before the runs.
bad=$(wf5_guard 1 1) || { echo "refusing: cannot read Airtable for the safety check" >&2; exit 1; }
if [ -n "$bad" ]; then printf 'refusing: a WF-5 run would act on real rows:\n%s\n' "$bad" >&2; exit 1; fi

sid=$(at_list Settings 1 | jq -r '.records[0].id'); orig=$(at_list Settings 1 | jq -r '.records[0].fields.reminder_hours_before')
[ -n "$sid" ] && [ "$orig" -ge 1 ] 2>/dev/null || { echo "cannot read Settings" >&2; exit 1; }
echo "original reminder_hours_before=$orig"
restore() { at_update Settings "$sid" "{\"reminder_hours_before\": $orig}" > /dev/null && echo "restored reminder_hours_before=$(at_list Settings 1 | jq -r '.records[0].fields.reminder_hours_before')"; }
trap restore EXIT
at_update Settings "$sid" '{"reminder_hours_before": 1}' > /dev/null || { echo "cannot set Settings" >&2; exit 1; }

# ---- rows (leftovers of an earlier run are removed first)
at_delete_where Appointments "REGEX_MATCH({appt_id}, '^A-TEST-')"
at_delete_where Clients "REGEX_MATCH({client_id}, '^C-test')"
owner_chat=$(source deploy/secrets.env; printf '%s' "$OWNER_TELEGRAM_CHAT_ID")
[ -n "$owner_chat" ] || { echo "OWNER_TELEGRAM_CHAT_ID is empty" >&2; exit 1; }
at_create Clients "$(jq -nc --arg t "$owner_chat" '{client_id:"C-test-owner", name:"Owner Test", telegram_chat_id:$t, language:"en", status:"active"}')" > /dev/null
at_create Clients '{"client_id":"C-test-nocontact","name":"No Contact","language":"en","status":"active"}' > /dev/null
oc=$(at_rec_id Clients "{client_id}='C-test-owner'"); nc=$(at_rec_id Clients "{client_id}='C-test-nocontact'")
iso() { date -u -d "$1" +%Y-%m-%dT%H:%M:00.000Z; }
tz=$(at_timezone) || exit 1   # the visits go to TOMORROW at clinic hours: WF-5 reminds the day before (local date in Settings.timezone)
s=$(at_tomorrow_utc "$tz" 11:00); e=$(at_tomorrow_utc "$tz" 11:30); d=$(iso "-90 days")
mk() { at_create Appointments "$(jq -nc "$1")" > /dev/null; }
mk "{appt_id:\"A-TEST-REM\", client_id:\"C-test-owner\", client:[\"$oc\"], service_id:\"botox\", start_iso:\"$s\", end_iso:\"$e\", start_dt:\"$s\", status:\"booked\", created_via:\"test\"}"
mk "{appt_id:\"A-TEST-NOCONTACT\", client_id:\"C-test-nocontact\", client:[\"$nc\"], service_id:\"botox\", start_iso:\"$s\", end_iso:\"$e\", start_dt:\"$s\", status:\"booked\", created_via:\"test\"}"
mk "{appt_id:\"A-TEST-NOLINK\", client_id:\"C-test-nolink\", service_id:\"botox\", start_iso:\"$s\", end_iso:\"$e\", start_dt:\"$s\", status:\"booked\", created_via:\"test\"}"
mk '{appt_id:"A-TEST-PEND", client_id:"C-test-owner", service_id:"botox", start_iso:"2030-01-07T11:00:00.000Z", end_iso:"2030-01-07T11:30:00.000Z", start_dt:"2030-01-07T11:00:00.000Z", status:"pending", pending_expires_at:"2020-01-01T00:00:00.000Z", created_via:"test"}'
mk '{appt_id:"A-TEST-ORPH", client_id:"C-test-orph", service_id:"botox", start_iso:"2030-01-07T13:00:00.000Z", end_iso:"2030-01-07T13:30:00.000Z", start_dt:"2030-01-07T13:00:00.000Z", status:"pending", pending_expires_at:"2020-01-01T00:00:00.000Z", calendar_event_id:"appttestorphan", created_via:"test"}'
mk "{appt_id:\"A-TEST-DONE90\", client_id:\"C-test-owner\", client:[\"$oc\"], service_id:\"hydrafacial\", start_iso:\"$d\", end_iso:\"$d\", start_dt:\"$d\", status:\"done\", next_visit_in:60, created_via:\"test\"}"
echo "rows created; A-TEST-REM starts $s"

# ---- wait (bounded, 8 min) until WF-5's own Due Reminders formula (at reminder_hours_before = 1) selects the three booked rows
due=$(wf5_due_formula 1 "$tz")
ok=0
for _ in $(seq 1 32); do
  n=$(at_list Appointments "$due" | jq '[.records[].fields.appt_id | select(startswith("A-TEST-"))] | length')
  [ "$n" = 3 ] && { ok=1; break; }
  sleep 15
done
[ "$ok" = 1 ] || { echo "WF-5's formula never selected the three rows (n=$n)" >&2; exit 1; }
echo "rows due at $(date -u +%H:%M:%S)"

t0=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
echo "== RUN 1"; scripts/n8n-run.sh wf5-reminders
sleep 5
for a in A-TEST-REM A-TEST-PEND A-TEST-ORPH A-TEST-DONE90 A-TEST-NOCONTACT A-TEST-NOLINK; do printf '%s: ' "$a"; appt "$a"; done
report_sends "$t0"
t1=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
echo "== RUN 2 (must send nothing and alert nothing: delivered rows are marked, the failures are deduplicated)"; scripts/n8n-run.sh wf5-reminders
sleep 5
for a in A-TEST-REM A-TEST-PEND A-TEST-ORPH A-TEST-DONE90 A-TEST-NOCONTACT A-TEST-NOLINK; do printf '%s: ' "$a"; appt "$a"; done
report_sends "$t1"
echo "== done (Settings restored by the trap)"
