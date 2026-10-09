#!/usr/bin/env bash
# Live proof of the "mark failed after a successful send" alert of WF-5 (Task 17 phase 2). Runs ON THE VPS (cwd /opt/medspa).
#   scripts/remote.sh 'tests/wf5-live-markfail.sh'
# Makes Mark Reminded fail for real: a TEMPORARY copy of the workflow (name wf5-reminders-test, own webhook path) writes the
# column reminder_sent_at_zz, which does not exist, so Airtable answers 422 after the REMINDER went out to the owner. The copy is
# run twice (alert text with the real appt_id, then no repeat alert), then deactivated and DELETED, and Settings is restored (trap).
# It sends two real REMINDER messages to the owner (the row stays booked, so the second run sends it again - that is the harm
# the alert warns about). Refuses to start when real rows would be touched or the hourly :05 run is near.
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
API="https://$N8N_HOST/api/v1"
V=wf5-reminders-test
min=$((10#$(date -u +%M)))
if [ "$min" -lt 10 ] || [ "$min" -gt 40 ]; then echo "refusing: the hourly :05 run is near (minute $min), start between :10 and :40" >&2; exit 1; fi
# Safety: WF-5's own send criteria at reminder_hours_before = 1 (tests/lib/airtable.sh wf5_guard; the variant runs the same
# searches), the reminder window widened by 1 h for the wait before the runs.
bad=$(wf5_guard 1 1) || { echo "refusing: cannot read Airtable for the safety check" >&2; exit 1; }
if [ -n "$bad" ]; then printf 'refusing: a WF-5 run would act on real rows:\n%s\n' "$bad" >&2; exit 1; fi
sid=$(at_list Settings 1 | jq -r '.records[0].id'); orig=$(at_list Settings 1 | jq -r '.records[0].fields.reminder_hours_before')
[ -n "$sid" ] && [ "$orig" -ge 1 ] 2>/dev/null || { echo "cannot read Settings" >&2; exit 1; }
echo "original reminder_hours_before=$orig"
vid=""
finish() {
  at_update Settings "$sid" "{\"reminder_hours_before\": $orig}" > /dev/null && echo "restored reminder_hours_before=$(at_list Settings 1 | jq -r '.records[0].fields.reminder_hours_before')"
  if [ -n "$vid" ]; then
    curl -fsS -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/workflows/$vid/deactivate" > /dev/null && echo "variant deactivated"
    curl -fsS -X DELETE -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/workflows/$vid" > /dev/null && echo "variant deleted"
    jq --arg n "$V" 'del(.[$n])' deploy/workflow-ids.json > deploy/.ids.tmp && mv deploy/.ids.tmp deploy/workflow-ids.json
  fi
}
trap finish EXIT

# the two failure rows of the first live run are not needed any more (and must not be hit again)
at_delete_where Appointments "OR({appt_id}='A-TEST-NOCONTACT',{appt_id}='A-TEST-NOLINK',{appt_id}='A-TEST-MARKFAIL',{appt_id}='A-TEST-ORPH',{appt_id}='A-TEST-PEND')"
at_delete_where Clients "{client_id}='C-test-nocontact'"

sed -e '2s/"name": "wf5-reminders"/"name": "wf5-reminders-test"/' -e 's/"path": "wf5-reminders"/"path": "wf5-reminders-test"/' \
    -e 's/5a0e0017-aaaa-4c00-8000-00000000f005/5a0e0017-bbbb-4c00-8000-00000000f006/' -e 's/reminder_sent_at/reminder_sent_at_zz/g' \
    workflows/wf5-reminders.json > /tmp/wf5-markfail.json
grep -q '"name": "wf5-reminders-test"' /tmp/wf5-markfail.json && grep -q 'reminder_sent_at_zz' /tmp/wf5-markfail.json || { echo "variant not built" >&2; exit 1; }
scripts/n8n-push.sh /tmp/wf5-markfail.json --activate || exit 1
vid=$(jq -r --arg n "$V" '.[$n]' deploy/workflow-ids.json)
echo "variant $vid active"

at_update Settings "$sid" '{"reminder_hours_before": 1}' > /dev/null || { echo "cannot set Settings" >&2; exit 1; }
oc=$(at_rec_id Clients "{client_id}='C-test-owner'") || { echo "C-test-owner client missing" >&2; exit 1; }
tz=$(at_timezone) || exit 1   # TOMORROW at clinic hours: WF-5 reminds the day before (local date in Settings.timezone)
s=$(at_tomorrow_utc "$tz" 11:00); e=$(at_tomorrow_utc "$tz" 11:30)
at_create Appointments "$(jq -nc --arg oc "$oc" --arg s "$s" --arg e "$e" '{appt_id:"A-TEST-MARKFAIL", client_id:"C-test-owner", client:[$oc], service_id:"botox", start_iso:$s, end_iso:$e, start_dt:$s, status:"booked", created_via:"test"}')" > /dev/null
echo "A-TEST-MARKFAIL created, starts $s"
due=$(wf5_due_formula 1 "$tz")   # WF-5's own Due Reminders formula at reminder_hours_before = 1
ok=0
for _ in $(seq 1 32); do
  n=$(at_list Appointments "$due" | jq '[.records[].fields.appt_id] | length')
  [ "$n" = 1 ] && { ok=1; break; }
  sleep 15
done
[ "$ok" = 1 ] || { echo "WF-5's formula never selected the row (n=$n)" >&2; exit 1; }

execs() { curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$(jq -r --arg n "$1" '.[$n]' deploy/workflow-ids.json)&limit=30&includeData=true" | jq -c --arg t "$2" '.data[] | select(.startedAt >= $t)'; }
report() {
  echo "-- send_message since $1 (template, appt, status):"
  execs send_message "$1" | jq -r '[(.data.resultData.runData.Trigger[0].data.main[0][0].json | .template_key, .appt_id), .status] | @tsv'
  echo "-- notify_owner since $1 (owner messages):"
  execs notify_owner "$1" | jq -r '.data.resultData.runData.Trigger[0].data.main[0][0].json.text'
  printf 'A-TEST-MARKFAIL: '; at_list Appointments "{appt_id}='A-TEST-MARKFAIL'" | jq -c '.records[0].fields | {status, reminder_sent_at}'
}
t0=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
echo "== RUN 1 (variant)"; scripts/n8n-run.sh "$V"; sleep 5; report "$t0"
t1=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
echo "== RUN 2 (variant; the reminder goes out again, the alert must NOT repeat)"; scripts/n8n-run.sh "$V"; sleep 5; report "$t1"
at_delete_where Appointments "{appt_id}='A-TEST-MARKFAIL'"
echo "== done"
