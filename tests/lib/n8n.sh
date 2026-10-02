# source tests/lib/n8n.sh  (cwd = /opt/medspa; sourced by tests/tool-cases.sh)
# Reads what a tool did from the n8n execution list, for cases that must assert on more than the verdict.

# last_compose <workflow name>: the owner message the NEWEST execution of that workflow composed
last_compose() {
  local id
  id=$(jq -r --arg n "$1" '.[$n] // error("no workflow " + $n)' deploy/workflow-ids.json) || return 1
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/executions?workflowId=$id&limit=1&includeData=true" |
    jq -r '.data[0].data.resultData.runData.Compose[0].data.main[0][0].json.text'
}

# Booking helpers (Task 9). They call the tools through the harness, like a case does, and fail unless the tool
# gave the expected verdict, so a setup built from them stops at the first step that did not work.
# cal_on <YYYY-MM-DD>: test-fixtures list_events for that whole day as JSON ({verdict: "EVENTS n", events: [...]}).
# The offset is +01:00, so it is only right for winter dates (the cases use January 2030).
cal_on() {
  tests/run-case.sh test-fixtures "$(jq -nc --arg s "$1T00:00:00+01:00" --arg e "$(date -d "$1 + 1 day" +%F)T00:00:00+01:00" '{action:"list_events", start_iso:$s, end_iso:$e}')"
}
# bk_propose <n> <slot iso> [replaces_appt_id]: propose_booking botox at that slot for test client n (tg:90000000n); must answer PENDING
bk_propose() {
  tests/run-case.sh propose_booking "$(jq -nc --arg c "tg:90000000$1" --arg s "$2" --arg r "${3:-}" '{contact_id:$c, service_id:"botox", start_iso:$s, channel:"test", replaces_appt_id:$r}')" |
    jq -e '.verdict | startswith("PENDING A-")' > /dev/null
}
# bk_appt_id <n>: appt_id of test client n's booked row (exactly one must exist)
bk_appt_id() {
  at_list Appointments "AND({client_id}='C-test-$1',{status}='booked')" | jq -er 'if (.records | length) == 1 then .records[0].fields.appt_id else error("expected one booked row") end'
}
# last_node_json <workflow name> <node name>: the first item a node output in the NEWEST execution of that workflow, as JSON.
# last_node_json notify_owner Trigger | jq -r .text is the last owner message.
last_node_json() {
  local id
  id=$(jq -r --arg n "$1" '.[$n] // error("no workflow " + $n)' deploy/workflow-ids.json) || return 1
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/executions?workflowId=$id&limit=1&includeData=true" |
    jq -ec --arg node "$2" '.data[0].data.resultData.runData[$node][0].data.main[0][0].json'
}
# bk_confirm <n>: confirm_booking for test client n; must answer BOOKED (this sends the owner a real Telegram message)
bk_confirm() {
  tests/run-case.sh confirm_booking "$(jq -nc --arg c "tg:90000000$1" '{contact_id:$c}')" | jq -e '.verdict | startswith("BOOKED A-")' > /dev/null
}
# appt_event_id <appt_id>: the Google event id confirm_booking gives the booking ("appt" + hex of the appt_id bytes)
appt_event_id() { printf 'appt%s' "$(printf '%s' "$1" | od -An -tx1 | tr -d ' \n')"; }
# execs_since <workflow name> <UTC ISO with ms>: how many executions of that workflow started at or after that instant
# (newest 50 only). Used to count owner notifications (notify_owner runs) in a time window.
execs_since() {
  local id
  id=$(jq -r --arg n "$1" '.[$n] // error("no workflow " + $n)' deploy/workflow-ids.json) || return 1
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/executions?workflowId=$id&limit=50" |
    jq --arg t "$2" '[.data[] | select(.startedAt >= $t)] | length'
}
# cal_sweep_day <YYYY-MM-DD>: safety net for cases that can leave a booking event without an Appointments row pointing
# at it when they FAIL (confirm_concurrent, confirm_repair*): the event was created but calendar_event_id never written.
# Run it BEFORE tests/cleanup.sh (it needs the rows). It deletes only events of that day whose id is appt_event_id of a
# C-test Appointments row with an EMPTY calendar_event_id, so it can never reach a real booking (whose appt_id is not a
# C-test row's) nor an event the cleanup deletes by id anyway. delete_events_by_id also checks the description is an
# appt_id. Fails unless all of them were deleted.
cal_sweep_day() {
  local want ids
  want=$(at_list Appointments "AND(REGEX_MATCH({client_id}, '^C-test'), {calendar_event_id} = '')" |
    jq -r '.records[].fields.appt_id // empty | select(test("^A-[0-9A-Z-]+$"))' | while read -r a; do appt_event_id "$a"; echo; done) || return 1
  [ -n "$want" ] || return 0
  ids=$(cal_on "$1" | jq -er --arg want "$want" '($want | split("\n") | map(select(length > 0))) as $w | [.events[] | select(.id | IN($w[])) | .id] | join(",")') || return 1
  [ -n "$ids" ] || return 0
  tests/run-case.sh test-fixtures "$(jq -nc --arg ids "$ids" '{action:"delete_events_by_id", event_ids:$ids}')" |
    jq -e '.verdict | capture("^DELETED (?<n>[0-9]+) of (?<m>[0-9]+)$") | .n == .m' > /dev/null
}
