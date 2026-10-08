#!/usr/bin/env bash
# Live test of the REVISIT marketing consent (mini-task "Airtable Free plan budget + REVISIT marketing consent", phase 2).
# Runs ON THE VPS (cwd /opt/medspa):   scripts/remote.sh 'tests/wf5-live-consent.sh'
# Three done visits, next_visit_in 60, start 90 days ago, so WF-5's Due Revisits selects all three:
#   A-TEST-REV-YES  client C-test-rev-yes  tg:9000000951     marketing_consent ticked          -> REVISIT, revisit_invited_at set
#   A-TEST-REV-WA   client C-test-rev-wa   wa:+15550000952   ticked, created_via wa            -> REVISIT on the template path
#   A-TEST-REV-NO   client C-test-rev-no   tg:9000000953     NOT ticked                        -> nothing, revisit_invited_at empty
# Run 1 checks that. Run 2 must send nothing new and leave A-TEST-REV-NO unmarked. Then the clinic ticks C-test-rev-no and
# run 3 must invite A-TEST-REV-NO (consent given later still lets the invitation go out).
# No real message: the contacts are in send_message's test ranges (tg:9000000NNN, wa:+1555000NNNN) with C-test rows, so every
# REVISIT becomes a Postgres test_outbox row. Everything created is C-test / A-TEST; tests/cleanup.sh --no-calendar removes it
# (and those test_outbox rows) in the EXIT trap, also after a failure. Exit status 0 only when every check passed and the
# cleanup worked.
# Refuses to start near the daily WF-5 run (06:55-07:20 UTC) or when a Run Now would touch something real: a booked visit due
# for its reminder, or a due revisit of a real client who consented. A real expired pending row would be cancelled exactly as
# the daily run would cancel it (it is listed first). One writer at a time on Airtable: not beside tests/tool-cases.sh or
# tests/dialogs.sh (same C-test prefix, same cleanup).
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
source tests/lib/pg.sh

failed=0
ok() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (got '$2', expected '$3')"; failed=$((failed + 1)); fi; }
finish() {
  local r=$failed
  if tests/cleanup.sh --no-calendar > /dev/null; then echo "cleanup done"; else echo "cleanup FAILED" >&2; r=1; fi
  echo "failed checks: $failed"
  exit $((r > 0 ? 1 : 0))
}
# every page of a search (at_list returns the first 100 records only): table formula -> JSON array of records
at_all() {
  local off="" out="[]" page
  while :; do
    page=$(curl -fsS -G "${_H[@]}" "$_AT/$1" --data-urlencode "filterByFormula=$2" ${off:+--data-urlencode "offset=$off"}) || return 1
    out=$(jq -c --argjson a "$out" '$a + .records' <<< "$page")
    off=$(jq -r '.offset // ""' <<< "$page")
    [ -n "$off" ] || break
  done
  printf '%s' "$out"
}

hm=$((10#$(date -u +%H%M)))
if [ "$hm" -ge 655 ] && [ "$hm" -le 720 ]; then echo "refusing: the daily WF-5 run (07:05 UTC) is near, now $(date -u +%H:%M) UTC" >&2; exit 1; fi

# ---- safety: nothing real may be acted on by a Run Now
h=$(at_list Settings 1 | jq -r '.records[0].fields.reminder_hours_before')
[[ "$h" =~ ^[0-9]+$ ]] || { echo "cannot read Settings.reminder_hours_before" >&2; exit 1; }
rem=$(at_all Appointments "AND({status}='booked',IS_AFTER({start_dt},NOW()),IS_BEFORE({start_dt},DATEADD(NOW(),$h,'hours')),DATETIME_DIFF({start_dt},CREATED_TIME(),'hours')>=$h)" |
  jq -r '.[] | (.fields.appt_id // "?") | select(startswith("A-TEST-") | not)') || exit 1
[ -z "$rem" ] || { echo "refusing: a Run Now would send these real reminders now: $rem" >&2; exit 1; }
rev_formula="AND({status}='done',{next_visit_in}>0,{revisit_invited_at}=BLANK(),IS_BEFORE(DATEADD({start_dt},{next_visit_in},'days'),NOW()))"
yes_ids=$(at_all Clients "{marketing_consent}=1" | jq -c '[.[].id]') || exit 1
rev=$(at_all Appointments "$rev_formula" | jq -r --argjson yes "$yes_ids" \
  '.[] | select(((.fields.appt_id // "") | startswith("A-TEST-")) | not) | select((.fields.client // [])[0] as $c | $yes | index($c)) | .fields.appt_id // "?"') || exit 1
[ -z "$rev" ] || { echo "refusing: a Run Now would send real revisit invitations: $rev" >&2; exit 1; }
exp=$(at_all Appointments "AND({status}='pending',IS_BEFORE({pending_expires_at},NOW()))" | jq -r '.[] | (.fields.appt_id // "?") | select(startswith("A-TEST-") | not)')
[ -z "$exp" ] || echo "note: these real expired pending rows will be cancelled (or reported, with an event) as the daily run would: $exp"

trap finish EXIT
tests/cleanup.sh --no-calendar > /dev/null || { echo "pre-clean failed" >&2; failed=1; exit 1; }

# ---- rows
mkc() { at_create Clients "$1" > /dev/null || { echo "cannot create client" >&2; failed=1; exit 1; }; }
mkc '{"client_id":"C-test-rev-yes","name":"Rev Yes","telegram_chat_id":"9000000951","language":"en","status":"active","marketing_consent":true}'
mkc '{"client_id":"C-test-rev-wa","name":"Rev Wa","phone":"+15550000952","language":"en","status":"active","marketing_consent":true}'
mkc '{"client_id":"C-test-rev-no","name":"Rev No","telegram_chat_id":"9000000953","language":"en","status":"active"}'
d=$(date -u -d "-90 days" +%Y-%m-%dT10:00:00.000Z)
mka() { # appt_id client_id via
  local rec; rec=$(at_rec_id Clients "{client_id}='$2'") || { echo "client $2 missing" >&2; failed=1; exit 1; }
  at_create Appointments "$(jq -nc --arg a "$1" --arg c "$2" --arg r "$rec" --arg d "$d" --arg v "$3" \
    '{appt_id:$a, client_id:$c, client:[$r], service_id:"hydrafacial", start_iso:$d, end_iso:$d, start_dt:$d, status:"done", next_visit_in:60, created_via:$v}')" > /dev/null ||
    { echo "cannot create $1" >&2; failed=1; exit 1; }
}
mka A-TEST-REV-YES C-test-rev-yes test
mka A-TEST-REV-WA C-test-rev-wa wa
mka A-TEST-REV-NO C-test-rev-no test
echo "rows created"

invited() { at_list Appointments "{appt_id}='$1'" | jq -r 'if (.records[0].fields.revisit_invited_at // "") != "" then "marked" else "empty" end'; }
sent() { pg_sql "SELECT count(*) FROM test_outbox WHERE contact_id = '$1' AND template_key = 'REVISIT'"; }
run() { # label
  local t0 t1; t0=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  echo "== $1"; scripts/n8n-run.sh wf5-reminders || { echo "WF-5 run failed" >&2; failed=$((failed + 1)); }
  sleep 8; t1=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  tests/airtable-calls.sh "$t0" "$t1" | sed 's/^/   /' || true
}

run "RUN 1: two consenting clients, one without consent"
ok "A-TEST-REV-YES marked" "$(invited A-TEST-REV-YES)" marked
ok "A-TEST-REV-WA marked" "$(invited A-TEST-REV-WA)" marked
ok "A-TEST-REV-NO NOT marked (no consent)" "$(invited A-TEST-REV-NO)" empty
ok "REVISIT to tg:9000000951" "$(sent tg:9000000951)" 1
ok "REVISIT to wa:+15550000952" "$(sent wa:+15550000952)" 1
ok "REVISIT to wa:+15550000952 went the template path (medspa_revisit)" "$(pg_sql "SELECT count(*) FROM test_outbox WHERE contact_id = 'wa:+15550000952' AND template_key = 'REVISIT' AND wa_template LIKE 'medspa_revisit%'")" 1
ok "nothing to tg:9000000953 (no consent)" "$(sent tg:9000000953)" 0

run "RUN 2: nothing new (6 Airtable calls expected: Settings, 4 searches, Consenting Clients)"
ok "still one REVISIT to tg:9000000951" "$(sent tg:9000000951)" 1
ok "still one REVISIT to wa:+15550000952" "$(sent wa:+15550000952)" 1
ok "still nothing to tg:9000000953" "$(sent tg:9000000953)" 0
ok "A-TEST-REV-NO still NOT marked" "$(invited A-TEST-REV-NO)" empty

at_update Clients "$(at_rec_id Clients "{client_id}='C-test-rev-no'")" '{"marketing_consent": true}' > /dev/null || { echo "cannot tick consent" >&2; failed=$((failed + 1)); }
run "RUN 3: the clinic ticked C-test-rev-no's consent"
ok "A-TEST-REV-NO marked now" "$(invited A-TEST-REV-NO)" marked
ok "one REVISIT to tg:9000000953" "$(sent tg:9000000953)" 1
ok "still one REVISIT to tg:9000000951" "$(sent tg:9000000951)" 1
