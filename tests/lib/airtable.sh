# source tests/lib/airtable.sh  (cwd = /opt/medspa)
source deploy/secrets.env
_AT="https://api.airtable.com/v0/$AIRTABLE_BASE_ID"
_H=(-H "Authorization: Bearer $AIRTABLE_PAT" -H "Content-Type: application/json")
at_list()   { curl -fsS -G "${_H[@]}" "$_AT/$1" --data-urlencode "filterByFormula=${2:-1}"; }                       # table formula → records json
at_create() { curl -fsS "${_H[@]}" -X POST "$_AT/$1" -d "$(jq -n --argjson f "$2" '{records: [{fields: $f}], typecast: true}')"; }  # table fields → created
at_update() { curl -fsS "${_H[@]}" -X PATCH "$_AT/$1/$2" -d "$(jq -n --argjson f "$3" '{fields: $f, typecast: true}')"; }         # table rec fields
at_delete() { curl -fsS "${_H[@]}" -X DELETE "$_AT/$1/$2" > /dev/null; }                                             # table rec
at_delete_where() { at_list "$1" "$2" | jq -r '.records[].id' | while read -r r; do at_delete "$1" "$r"; done; }     # table formula
# at_test_client_with_offer <n> <slot iso> [service_id]: (re)creates client C-test-<n> (Telegram chat 90000000<n>, name "Test C-test-<n>")
# whose last offer, made just now, is exactly that one slot for that service (default botox), so propose_booking will accept it.
# The offer has check_availability's format: {"service_id":"<id>","slots":["<iso>",...]}.
at_test_client_with_offer() {
  at_delete_where Clients "{client_id}='C-test-$1'"
  at_create Clients "$(jq -n --arg c "C-test-$1" --arg t "90000000$1" --arg o "$(jq -nc --arg s "${3:-botox}" --arg slot "$2" '{service_id:$s, slots:[$slot]}')" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{client_id:$c, name:("Test "+$c), telegram_chat_id:$t, language:"en", status:"new", last_offer_json:$o, last_offer_at:$at}')"
}
# at_offer <n> <slot iso> [service_id]: gives the EXISTING test client C-test-<n> a new offer made just now (same format), keeping
# the row (its status and its earlier bookings), for a second proposal in the same case (a reschedule).
at_offer() {
  at_update Clients "$(at_rec_id Clients "{client_id}='C-test-$1'")" "$(jq -n --arg o "$(jq -nc --arg s "${3:-botox}" --arg slot "$2" '{service_id:$s, slots:[$slot]}')" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{last_offer_json:$o, last_offer_at:$at}')"
}
at_rec_id() { at_list "$1" "$2" | jq -er '.records[0].id'; }                                                     # table formula → id of the first match
# at_all <table> <formula>: every page of a search (at_list returns the first 100 records only) as ONE JSON array of records
at_all() {
  local off="" out="[]" page
  while :; do
    page=$(curl -fsS -G "${_H[@]}" "$_AT/$1" --data-urlencode "filterByFormula=$2" ${off:+--data-urlencode "offset=$off"}) || return 1
    out=$(jq -c --argjson a "$out" '$a + .records' <<< "$page") || return 1
    off=$(jq -r '.offset // ""' <<< "$page")
    [ -n "$off" ] || break
  done
  printf '%s' "$out"
}
# wf5_guard <hours> [margin hours]: the REAL rows (appt_id not A-TEST-*, client_id not C-test*) that a WF-5 run made while
# Settings.reminder_hours_before = <hours> would act on, one line each: the row and why. Empty = the run touches test rows
# only. The criteria are WF-5's own searches (workflows/wf5-reminders.json), so keep the two in step:
#   - Due Reminders: booked, start in (now, now + hours + 24 h], booked at least <hours> ahead (+ 24 = the Daily interval);
#     [margin] widens the window for the time a script waits between this check and its run;
#   - Expired Pending / Orphan Pending: an expired real offer (the run cancels it, or alerts the owner when it has an event);
#   - Due Revisits + Consenting Clients: a due revisit counts only when its client has marketing_consent; a real client
#     without consent is never invited, so it never blocks.
# Exit 1 when Airtable cannot be read (callers refuse then too).
wf5_guard() {
  local h=$1 m=${2:-0} yes R='def real: select(((.fields.appt_id // "") | startswith("A-TEST-") | not) and ((.fields.client_id // "") | startswith("C-test") | not));'
  at_all Appointments "AND({status}='booked',IS_AFTER({start_dt},NOW()),IS_BEFORE({start_dt},DATEADD(NOW(),$((h + 24 + m)),'hours')),DATETIME_DIFF({start_dt},CREATED_TIME(),'hours')>=$h)" |
    jq -r "$R"' .[] | real | "\(.fields.appt_id // .id): real booked visit at \(.fields.start_iso // "?") - the run would send its reminder now"' || return 1
  at_all Appointments "AND({status}='pending',IS_BEFORE({pending_expires_at},NOW()))" |
    jq -r "$R"' .[] | real | "\(.fields.appt_id // .id): real expired pending offer (pending_expires_at \(.fields.pending_expires_at // "?")) - the run would " + (if (.fields.calendar_event_id // "") == "" then "cancel it" else "report it to the owner (it has a calendar event)" end)' || return 1
  yes=$(at_all Clients "{marketing_consent}=1" | jq -c '[.[].id]') || return 1
  at_all Appointments "AND({status}='done',{next_visit_in}>0,{revisit_invited_at}=BLANK(),IS_BEFORE(DATEADD({start_dt},{next_visit_in},'days'),NOW()))" |
    jq -r --argjson yes "$yes" "$R"' .[] | real | select((.fields.client // [])[0] as $c | $c != null and ($yes | index($c)) != null) | "\(.fields.appt_id // .id): real done visit of a client with marketing consent - the run would send the revisit invitation"' || return 1
}
