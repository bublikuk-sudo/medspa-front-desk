#!/usr/bin/env bash
# usage: tests/dialog.sh <tests/dialogs/NN-name.md> <tg|wa> [NNN]   (on the VPS, cwd /opt/medspa; see tests/dialogs.sh)
# Plays one Task 20 dialog end to end in one channel format and checks it. Exit 0 = PASS, 1 = FAIL, 2 = usage error or
# not a clean start (a Clients row or test_outbox rows of a contact exist), 4 = Settings.reminder_hours_before could not
# be restored (tests/dialogs.sh stops the whole run on 4).
#
# The client is a test contact: tg:9000000NNN or wa:+1555000 0NNN, NNN = 1<dialog number> unless given (dialog 07 -> 107).
# Each `send:` builds the channel-native payload (a Telegram update as Telegram Trigger emits it, or a WhatsApp Trigger
# item {...change.value, field: 'messages'}) and POSTs it to wf1-inbound's Test Inbound webhook (/webhook/wf1-test, MedSpa
# Test Key). The webhook answers on receipt, so the runner finds the execution it started by a nonce in the payload
# (Telegram update_id, WhatsApp message id), waits until that execution has finished (bounded), and reads the new
# test_outbox rows of the contact: send_message records every outbound message to a test contact there instead of
# sending it. The expectations of the step are then checked against those rows and that execution.
#
# Dialog file: human-readable markdown plus ONE fenced block opened by ```dialog, one directive per line:
#   channels: tg wa                read by tests/dialogs.sh only (default both)
#   profile: <First Last>          the name in the Telegram profile / WhatsApp profile (default "Dialog Tester")
#   second: <tg|wa|same> <NNN>     a second test contact B (dialogs 05, 10); clean start checked like A's
#   profile2: <First Last>         B's profile name
#   setup: <bash>                  run before the first step (helpers below and tests/lib/*.sh are available)
#   send: <text>                   client A writes <text>;  send2: <text>  client B writes it
#   burst: <n> <seconds> <text>    client A writes <text> n times, one every <seconds>, without waiting in between; the
#                                  step's rows are all rows produced by the n runs, and node checks apply to every run
#   run: <bash>                    a non-message step, e.g. reminder_leg; its new test_outbox rows are checked like a send's
#   expect <check>: <value>        checks the step just played; "tg.<check>" / "wa.<check>" applies to that channel only
#       templates: A, B            exact sequence of the step's outbound rows by template_key; "reply" = free-form agent text;
#                                  "none" = no message at all; "X*20" = 20 times X
#       count: <n>                 the step produced exactly n outbound rows
#       templates-in: A|B|C        every outbound row of the step is one of these (order free; use with count)
#       lang: en|es|ru             language of the step's free-form/translated texts (WhatsApp template rows excluded)
#       regex: <re> / no-regex: <re>   Oniguruma regex, case-insensitive, must / must not match the step's texts
#       tool: <name>               the Agent's tools_used in the step's wf1-inbound execution(s) contains <name>
#       node: <name> / no-node: <name>   that wf1-inbound node ran / did not run in the step's execution(s)
#       owner: <re>                an owner notification (notify_owner run) about the speaking contact since the step began
#       wa_template: <name>|none   every row of the step took the WhatsApp template path <name> / none did
#       state: <jq>                jq boolean over the context (below) right now
#       sh: <bash>                 the command exits 0
#   state: <jq>                    after the last step, jq boolean over the context:
#                                  {client, appts, events} (tests/state.sh --json of A), outbox (A's rows of this dialog),
#                                  owner (owner notification texts about A since the start), and when B exists
#                                  second: {client, appts, events, outbox, owner} of B
# Model wording is never compared; regexes only assert facts that must appear.
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
source tests/lib/pg.sh
source tests/lib/n8n.sh
API="https://$N8N_HOST/api/v1"
EXEC_WAIT=${EXEC_WAIT:-300}
usage() { echo "usage: tests/dialog.sh <tests/dialogs/NN-name.md> <tg|wa> [NNN]" >&2; exit 2; }
file="${1:-}"; ch="${2:-}"
[ -f "$file" ] && [[ "$ch" =~ ^(tg|wa)$ ]] || usage
nn=$(basename "$file" | grep -oE '^[0-9]{2}') || usage
num="${3:-1$nn}"
[[ "$num" =~ ^[1-9][0-9]{2}$ ]] || usage
contact_of() { if [ "$1" = tg ]; then echo "tg:9000000$2"; else echo "wa:+15550000$2"; fi; }   # <tg|wa> <NNN>
CID=$(contact_of "$ch" "$num")
CID2=""; CH2=""
WF1=$(jq -er '."wf1-inbound"' deploy/workflow-ids.json) || { echo "wf1-inbound not deployed" >&2; exit 2; }
TMP=$(mktemp -d); EXECS="$TMP/execs"; mkdir -p "$EXECS"
# Settings.reminder_hours_before is changed only by reminder_leg. restore_settings writes the original back and READS IT
# BACK, up to 5 attempts; only a read-back equal to the original counts. A failed restore is RESTORE_FAILED=1: the dialog
# FAILs and the script exits 4 (also from the EXIT trap), which makes tests/dialogs.sh stop the whole run.
SETTINGS_REC=""; SETTINGS_ORIG=""; RESTORE_FAILED=0
restore_settings() {
  [ -n "$SETTINGS_ORIG" ] || return 0
  local i got=""
  for i in 1 2 3 4 5; do
    at_update Settings "$SETTINGS_REC" "{\"reminder_hours_before\": $SETTINGS_ORIG}" > /dev/null 2>&1
    got=$(at_list Settings 1 2> /dev/null | jq -r '.records[0].fields.reminder_hours_before' 2> /dev/null)
    if [ "$got" = "$SETTINGS_ORIG" ]; then
      echo "  settings: reminder_hours_before restored to $got (read back, attempt $i)"; SETTINGS_ORIG=""; return 0
    fi
    sleep $((i * 3))
  done
  RESTORE_FAILED=1
  echo "  RESTORE FAILED: Settings.reminder_hours_before reads '${got:-unreadable}', must be $SETTINGS_ORIG - set it back by hand" | tee /dev/stderr
  return 1
}
on_exit() { local rc=$?; restore_settings; [ "$RESTORE_FAILED" -eq 0 ] || rc=4; rm -rf "$TMP"; exit "$rc"; }
trap on_exit EXIT
trap 'exit 130' INT TERM

log() { printf '%s\n' "$*"; }
FAILS=0; ABORT=0
fail() { FAILS=$((FAILS + 1)); ABORT=1; log "  FAIL: $*"; }
now_iso() { date -u +%Y-%m-%dT%H:%M:%S.000Z; }

# ---- helpers available to setup:/run: lines -------------------------------------------------------------------------
contact_field() { [[ "$1" == tg:* ]] && echo telegram_chat_id || echo phone; }
state_of() { tests/state.sh "$1" --json; }
state_json() { state_of "$CID"; }
client_rec_of() { at_rec_id Clients "{$(contact_field "$1")}='${1#*:}'"; }
client_rec() { client_rec_of "$CID"; }
# client_set <field> <value>: sets one text/select field of A's Clients row (e.g. client_set status active)
client_set() { local r; r=$(client_rec) || { echo "no Clients row for $CID" >&2; return 1; }; at_update Clients "$r" "$(jq -nc --arg k "$1" --arg v "$2" '{($k): $v}')" > /dev/null; }
# seed_client <contact> <name> [status] [language]: creates that test contact's Clients row, client_id C-test-D<digits>
seed_client() {
  local c="$1" id; id="C-test-D$(printf '%s' "$c" | tr -dc '0-9')"
  at_create Clients "$(jq -nc --arg id "$id" --arg f "$(contact_field "$c")" --arg v "${c#*:}" --arg n "$2" --arg s "${3:-active}" --arg l "${4:-en}" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{client_id: $id, ($f): $v, name: $n, language: $l, status: $s, first_seen: $t}')" > /dev/null
}
# seed_appt <contact> '<fields json>': creates an Appointments row of that contact's client (client_id and client link added)
seed_appt() {
  local rec clid; rec=$(client_rec_of "$1") || return 1
  clid=$(at_list Clients "{$(contact_field "$1")}='${1#*:}'" | jq -er '.records[0].fields.client_id') || return 1
  at_create Appointments "$(jq -c --arg c "$clid" --arg r "$rec" '. + {client_id: $c, client: [$r]}' <<< "$2")" > /dev/null
}
# seed_booking <contact> <service_id> <start iso with offset>: a real booking through the tools, as the bot would make it:
# the slot becomes the client's last offer, propose_booking (PENDING), confirm_booking (BOOKED: calendar event "<service> —
# <name>", owner notified). The client row must exist.
seed_booking() {
  local c="$1" rec
  rec=$(client_rec_of "$c") || { echo "seed_booking: no client row for $c" >&2; return 1; }
  at_update Clients "$rec" "$(jq -nc --arg o "$(jq -nc --arg s "$2" --arg t "$3" '{service_id: $s, slots: [$t]}')" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{last_offer_json: $o, last_offer_at: $at}')" > /dev/null || return 1
  tests/run-case.sh propose_booking "$(jq -nc --arg c "$c" --arg s "$2" --arg t "$3" '{contact_id: $c, service_id: $s, start_iso: $t, channel: "test", replaces_appt_id: ""}')" |
    jq -e '.verdict | startswith("PENDING A-")' > /dev/null || { echo "seed_booking: propose_booking did not answer PENDING" >&2; return 1; }
  tests/run-case.sh confirm_booking "$(jq -nc --arg c "$c" '{contact_id: $c}')" |
    jq -e '.verdict | startswith("BOOKED A-")' > /dev/null || { echo "seed_booking: confirm_booking did not answer BOOKED" >&2; return 1; }
}
# appt_set <contact> <field> <value>: sets a field on that contact's one live (pending/booked/reminded/confirmed) appointment
appt_set() {
  local clid rows
  clid=$(at_list Clients "{$(contact_field "$1")}='${1#*:}'" | jq -er '.records[0].fields.client_id') || return 1
  rows=$(at_list Appointments "AND({client_id}='$clid',OR({status}='pending',{status}='booked',{status}='reminded',{status}='confirmed'))")
  [ "$(jq '.records | length' <<< "$rows")" = 1 ] || { echo "appt_set: expected one live appointment of $clid" >&2; return 1; }
  at_update Appointments "$(jq -r '.records[0].id' <<< "$rows")" "$(jq -nc --arg k "$2" --arg v "$3" '{($k): $v}')" > /dev/null
}
# berlin_in <minutes>: the time that many minutes from now, rounded up to the next half hour, as ISO with the Berlin offset
berlin_in() { local t=$(( $(date +%s) + $1 * 60 )); t=$(( (t + 1799) / 1800 * 1800 )); TZ=Europe/Berlin date -d "@$t" +%Y-%m-%dT%H:%M:00%:z; }
# rate_limit_reset: forgets A's wf1_rate_limit row - stands in for the 10-minute wait of dialog 09 (said so in the log)
rate_limit_reset() { log "  rate_limit_reset: wf1_rate_limit row of $CID deleted instead of waiting 10 minutes"; pg_sql "DELETE FROM wf1_rate_limit WHERE contact_id = '$CID'" > /dev/null; }
# test_client_ids: client_ids of every test client, one per line (C-test*, which includes the dialog clients: WF-1 gives
# a client created through Test Inbound the prefix C-test-)
test_client_ids() {
  at_list Clients "REGEX_MATCH({client_id}, '^C-test')" | jq -r '.records[].fields.client_id // empty'
}
# reminder_leg: the Task 17 trick, for the client's one booked visit. Waits until the hourly WF-5 run (:05) is far away,
# refuses when a non-test row would be touched by WF-5, sets Settings.reminder_hours_before = 1 (always restored: right
# after the run and by the EXIT trap), moves the visit to about an hour ahead in Airtable (the calendar event stays
# where it was booked), waits until WF-5's due-reminder formula selects it, then runs WF-5 (scripts/n8n-run.sh).
reminder_leg() {
  local m waited=0 clid rows rec appt dur created s e sid orig bad tids due n
  while m=$((10#$(date -u +%M))); [ "$m" -lt 10 ] || [ "$m" -gt 44 ]; do
    [ "$waited" -ge 2700 ] && { echo "reminder_leg: still near the hourly WF-5 run after 45 min" >&2; return 1; }
    [ "$waited" -eq 0 ] && log "  reminder_leg: waiting for minute 10-44 (the hourly WF-5 run is at :05), now :$(date -u +%M)"
    sleep 30; waited=$((waited + 30))
  done
  clid=$(state_json | jq -r '.client.client_id // empty')
  [[ "$clid" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "reminder_leg: no client row" >&2; return 1; }
  rows=$(at_list Appointments "AND({client_id}='$clid',{status}='booked')")
  [ "$(jq '.records | length' <<< "$rows")" = 1 ] || { echo "reminder_leg: expected exactly one booked visit of $clid" >&2; return 1; }
  rec=$(jq -r '.records[0].id' <<< "$rows"); appt=$(jq -r '.records[0].fields.appt_id' <<< "$rows")
  dur=$(( $(date -d "$(jq -r '.records[0].fields.end_iso' <<< "$rows")" +%s) - $(date -d "$(jq -r '.records[0].fields.start_iso' <<< "$rows")" +%s) ))
  created=$(date -d "$(jq -r '.records[0].createdTime' <<< "$rows")" +%s)
  # Safety (as tests/wf5-live.sh, window widened to 2 h): this extra WF-5 run may touch test rows only.
  tids=$(test_client_ids | jq -Rsc 'split("\n") | map(select(length > 0))')
  bad=$(for f in "AND({status}='pending',IS_BEFORE({pending_expires_at},NOW()))" \
      "AND({status}='done',{next_visit_in}>0,{revisit_invited_at}=BLANK(),IS_BEFORE(DATEADD({start_dt},{next_visit_in},'days'),NOW()))" \
      "AND({status}='booked',IS_AFTER({start_dt},NOW()),IS_BEFORE({start_dt},DATEADD(NOW(),2,'hours')))"; do
      at_list Appointments "$f" | jq -r --argjson t "$tids" '.records[].fields | select((.client_id // "") as $c | ($t | index($c)) == null) | (.appt_id // "?")'; done)
  [ -z "$bad" ] || { echo "reminder_leg: refusing, real rows would be touched by WF-5: $bad" >&2; return 1; }
  sid=$(at_list Settings 1 | jq -r '.records[0].id'); orig=$(at_list Settings 1 | jq -r '.records[0].fields.reminder_hours_before')
  [[ -n "$sid" && "$orig" =~ ^[0-9]+$ ]] || { echo "reminder_leg: cannot read Settings" >&2; return 1; }
  # An original below 2 is most likely a 1 left behind by an earlier leg: never treat it as the value to restore.
  [ "$orig" -ge 2 ] || { echo "reminder_leg: refusing, reminder_hours_before is $orig (< 2: an earlier leg did not restore it?)" >&2; return 1; }
  if [ -n "${DIALOGS_PINNED_HOURS:-}" ] && [ "$orig" != "$DIALOGS_PINNED_HOURS" ]; then
    echo "reminder_leg: refusing, reminder_hours_before is $orig but tests/dialogs.sh pinned $DIALOGS_PINNED_HOURS at its start" >&2; return 1
  fi
  SETTINGS_REC=$sid; SETTINGS_ORIG=$orig
  at_update Settings "$sid" '{"reminder_hours_before": 1}' > /dev/null || { echo "reminder_leg: cannot set Settings" >&2; return 1; }
  log "  reminder_leg: reminder_hours_before $orig -> 1"
  # start at least 57 min ahead (inside the 1 h window soon) and at least 62 min after the row was created (the formula
  # skips visits booked inside the window)
  s=$(( $(date +%s) + 57 * 60 )); [ "$s" -ge $((created + 62 * 60)) ] || s=$((created + 62 * 60))
  e=$((s + dur))
  at_update Appointments "$rec" "$(jq -nc --arg s "$(date -u -d "@$s" +%Y-%m-%dT%H:%M:00.000Z)" --arg e "$(date -u -d "@$e" +%Y-%m-%dT%H:%M:00.000Z)" '{start_iso: $s, end_iso: $e, start_dt: $s}')" > /dev/null || { restore_settings; return 1; }
  log "  reminder_leg: $appt moved to $(date -u -d "@$s" +%H:%M)Z today"
  due="AND({appt_id}='$appt',{status}='booked',IS_AFTER({start_dt},NOW()),IS_BEFORE({start_dt},DATEADD(NOW(),1,'hours')),DATETIME_DIFF({start_dt},CREATED_TIME(),'hours')>=1)"
  for _ in $(seq 1 40); do
    n=$(at_list Appointments "$due" | jq '.records | length'); [ "$n" = 1 ] && break; sleep 15
  done
  [ "$n" = 1 ] || { echo "reminder_leg: $appt never became due" >&2; restore_settings; return 1; }
  scripts/n8n-run.sh wf5-reminders | sed 's/^/  /'
  local rc=${PIPESTATUS[0]}
  restore_settings || return 1
  return "$rc"
}

# ---- one step ---------------------------------------------------------------------------------------------------------
profile="Dialog Tester"; profile2="Second Tester"
newest_exec() { curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$WF1&limit=1" | jq -r '.data[0].id // 0'; }
make_body() {  # <text> <nonce> <contact> <profile>
  local c="$3" p="$4"
  if [[ "$c" == tg:* ]]; then
    local fn="${p%% *}" ln=""; [[ "$p" == *" "* ]] && ln="${p#* }"
    jq -nc --arg t "$1" --argjson u "$2" --argjson id "${c#tg:}" --arg fn "$fn" --arg ln "$ln" --argjson d "$(date +%s)" \
      '{update_id: $u, message: {message_id: ($u % 1000000), from: {id: $id, is_bot: false, first_name: $fn, last_name: $ln, language_code: "en"}, chat: {id: $id, first_name: $fn, last_name: $ln, type: "private"}, date: $d, text: $t}}
       | if $ln == "" then del(.message.from.last_name, .message.chat.last_name) else . end'
  else
    jq -nc --arg t "$1" --arg n "$2" --arg from "${c#wa:+}" --arg name "$p" --arg d "$(date +%s)" \
      '{messaging_product: "whatsapp", metadata: {display_phone_number: "15550000000", phone_number_id: "TEST"}, contacts: [{profile: {name: $name}, wa_id: $from}], messages: [{from: $from, id: ("wamid.T20." + $n), timestamp: $d, type: "text", text: {body: $t}}], field: "messages"}'
  fi
}
# Every finished wf1-inbound execution newer than the step's start is fetched once (with data) into $EXECS/<id>.json and
# its payload key (Telegram update_id / WhatsApp message id) into $EXECS/<id>.key; a nonce is then looked up by key.
scan_execs() {  # <id before>
  local id ids
  ids=$(curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$WF1&limit=100" |
    jq -r --argjson b "$1" '.data[] | select((.id | tonumber) > $b and ((.status // "") | IN("running", "new", "waiting") | not)) | .id') || return 0
  for id in $ids; do
    [ -f "$EXECS/$id.key" ] && continue
    curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions/$id?includeData=true" > "$EXECS/$id.tmp" || continue
    mv "$EXECS/$id.tmp" "$EXECS/$id.json"
    jq -r '(.data.resultData.runData["Test Inbound"][0].data.main[0][0].json.body // {}) | (if type == "array" then .[0] else . end) | ((.update_id // .messages[0].id // "") | tostring)' "$EXECS/$id.json" > "$EXECS/$id.key" 2> /dev/null || echo "" > "$EXECS/$id.key"
  done
}
find_exec() { local k; for k in "$EXECS"/*.key; do [ -f "$k" ] && [ "$(cat "$k")" = "$1" ] && { basename "$k" .key; return 0; }; done; return 1; }
# wait_execs <id before> <key>...: waits (bounded) until every key has a finished execution; STEP_EXECS = their ids
wait_execs() {
  local before="$1" end=$((SECONDS + EXEC_WAIT)) k id missing; shift
  STEP_EXECS=()
  while :; do
    scan_execs "$before"; missing=0
    for k in "$@"; do find_exec "$k" > /dev/null || missing=$((missing + 1)); done
    [ "$missing" -eq 0 ] && break
    [ "$SECONDS" -lt "$end" ] || { fail "$missing of $# wf1-inbound executions not finished within ${EXEC_WAIT}s"; break; }
    sleep 3
  done
  for k in "$@"; do id=$(find_exec "$k") && STEP_EXECS+=("$id"); done
}
global_max_out() { pg_sql "SELECT coalesce(max(id), 0) FROM test_outbox"; }
out_rows() { pg_sql "SELECT coalesce(json_agg(json_build_object('id', id, 'template_key', template_key, 'wa_template', wa_template, 'text', text) ORDER BY id), '[]') FROM test_outbox WHERE contact_id = '$1' AND id > $2"; }   # <contact> <after id>
read_outbox() {  # the speaker's rows since the previous step
  out_rows "$SP_CID" "$LAST_OUT" > "$TMP/rows.json" || { fail "cannot read test_outbox"; echo '[]' > "$TMP/rows.json"; return; }
  LAST_OUT=$(global_max_out) || LAST_OUT=$(jq -r --argjson l "$LAST_OUT" '(map(.id) | max) // $l' "$TMP/rows.json")
  jq -r '.[] | "  <- " + (if .template_key == "" then "reply" else .template_key end) + (if .wa_template != "" then " [wa template " + .wa_template + "]" else "" end) + ": " + (.text | gsub("\\s+"; " ") | .[0:240])' "$TMP/rows.json"
}
# owner_texts <since ISO> <contact>: texts of the owner notifications about that contact since then, as a JSON array
owner_texts() {
  local id; id=$(jq -r '.notify_owner' deploy/workflow-ids.json)
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$id&limit=50&includeData=true" |
    jq -c --arg t "$1" --arg c "$2" '[.data[] | select(.startedAt >= $t) | .data.resultData.runData.Trigger[0].data.main[0][0].json.text // empty | select(contains($c))] | reverse'
}
# build_ctx -> $TMP/ctx.json: A's tests/state.sh --json plus outbox (A's rows of this dialog so far) and owner (notifications
# about A since the dialog started); with B, the same for B under .second. Both `expect state:` and `state:` use it.
contact_ctx() {  # <contact> <out file>
  state_of "$1" > "$TMP/s.json" && out_rows "$1" "$START_OUT" > "$TMP/o.json" && owner_texts "$T0" "$1" > "$TMP/w.json" &&
    jq -c --slurpfile o "$TMP/o.json" --slurpfile w "$TMP/w.json" '. + {outbox: $o[0], owner: $w[0]}' "$TMP/s.json" > "$2"
}
build_ctx() {
  contact_ctx "$CID" "$TMP/ctx.json" || return 1
  if [ -n "$CID2" ]; then
    contact_ctx "$CID2" "$TMP/ctx2.json" || return 1
    jq -c --slurpfile b "$TMP/ctx2.json" '. + {second: $b[0]}' "$TMP/ctx.json" > "$TMP/ctx.tmp" && mv "$TMP/ctx.tmp" "$TMP/ctx.json"
  fi
}
log_execs() {
  local id f
  for id in "${STEP_EXECS[@]}"; do
    f="$EXECS/$id.json"
    log "  exec $id $(jq -r .status "$f"); route $(jq -r '.data.resultData.runData.Route[0].data.main | to_entries | map(select((.value | length) > 0) | .key) | map(["confirm","llm","reminder","agent","cancel"][.]) | join(",") // "-"' "$f" 2>/dev/null || echo -); tools $(jq -c '.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // []' "$f" 2>/dev/null)"
    [ "$(jq -r .status "$f")" = success ] || fail "wf1-inbound execution $id ended $(jq -r .status "$f")"
  done
}
STEP=0; STEP_KIND=""; STEP_T=""; STEP_EXECS=(); SP_CID="$CID"
post() {  # <text> <contact> <profile> -> prints the nonce key
  local nonce code
  nonce=$(( $(date +%s%N) / 1000 % 1000000000000 ))
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 -X POST "https://$N8N_HOST/webhook/wf1-test" -H "X-Test-Key: $TEST_KEY" -H 'Content-Type: application/json' -d "$(make_body "$1" "$nonce" "$2" "$3")")
  [ "$code" = 200 ] || { echo "HTTP $code"; return 1; }
  if [[ "$2" == tg:* ]]; then echo "$nonce"; else echo "wamid.T20.$nonce"; fi
}
do_send() {  # <text> <contact> <profile> [label]
  local before key
  STEP=$((STEP + 1)); STEP_KIND=send; STEP_T=$(now_iso); SP_CID="$2"
  log "STEP $STEP ${4:-send}: $1"
  before=$(newest_exec) || { fail "cannot list executions"; return; }
  key=$(post "$1" "$2" "$3") || { fail "test inbound answered $key"; return; }
  wait_execs "$before" "$key"
  log_execs
  read_outbox
}
do_burst() {  # <n> <seconds> <text>
  local n="$1" gap="$2" text="$3" before keys=() i key
  STEP=$((STEP + 1)); STEP_KIND=burst; STEP_T=$(now_iso); SP_CID="$CID"
  log "STEP $STEP burst: $n x '$text', one every ${gap}s"
  before=$(newest_exec) || { fail "cannot list executions"; return; }
  for i in $(seq 1 "$n"); do
    key=$(post "$text" "$CID" "$profile") || { fail "test inbound answered $key (message $i)"; return; }
    keys+=("$key"); [ "$i" -lt "$n" ] && sleep "$gap"
  done
  log "  $n messages posted from $(date -u -d "$STEP_T" +%H:%M:%S) to $(date -u +%H:%M:%S)Z"
  wait_execs "$before" "${keys[@]}"
  log_execs
  read_outbox
}
do_run() {
  STEP=$((STEP + 1)); STEP_KIND=run; STEP_T=$(now_iso); STEP_EXECS=(); SP_CID="$CID"
  log "STEP $STEP run: $1"
  eval "$1" || fail "run step failed: $1"
  read_outbox
}
# all_execs <jq boolean>: true when the step has executions and every one satisfies the expression
all_execs() {
  local id
  [ "${#STEP_EXECS[@]}" -gt 0 ] || return 1
  for id in "${STEP_EXECS[@]}"; do jq -e --arg v "$2" "$1" "$EXECS/$id.json" > /dev/null 2>&1 || return 1; done
}
# check <kind> <value>: one expectation against the step just played
check() {
  local kind="$1" v="$2" ok=1 got
  case "$kind" in
    tg.*|wa.*) [ "${kind%%.*}" = "$ch" ] || return 0; kind="${kind#*.}" ;;
  esac
  case "$kind" in
    templates)
      local want="" t toks=()
      IFS=',' read -ra toks <<< "$(printf '%s' "$v" | tr -d ' ')"
      for t in "${toks[@]}"; do
        [ "$t" = none ] && continue
        if [[ "$t" == *\** ]]; then for _ in $(seq 1 "${t#*\*}"); do want="$want,${t%\**}"; done; else want="$want,$t"; fi
      done
      want="${want#,}"
      got=$(jq -r 'map(if .template_key == "" then "reply" else .template_key end) | join(",")' "$TMP/rows.json")
      [ "$got" = "$want" ] || { ok=0; v="$v (got: ${got:-none})"; } ;;
    count) got=$(jq 'length' "$TMP/rows.json"); [ "$got" = "$v" ] || { ok=0; v="$v (got: $got)"; } ;;
    templates-in)
      jq -e --arg s "$v" '($s | gsub(" "; "") | split("|")) as $set | all(.[]; (if .template_key == "" then "reply" else .template_key end) as $k | $set | index($k) != null)' "$TMP/rows.json" > /dev/null || {
        ok=0; v="$v (got: $(jq -r 'map(if .template_key == "" then "reply" else .template_key end) | join(",")' "$TMP/rows.json"))"; } ;;
    lang)
      jq -e --arg l "$v" '[.[] | select(.wa_template == "") | .text] as $x | ($x | join("\n")) as $t | ($x | length) > 0 and (
          if $l == "ru" then ($t | test("\\p{Cyrillic}"))
          elif $l == "es" then ($t | test("\\p{Cyrillic}") | not) and ($t | test("[ñ¿¡áéíóú]|\\b(el|la|los|las|de|que|para|su|usted|tu|una|cita|gracias|hola)\\b"; "i")) and ($t | test("\\b(the|you|your|and|with|please)\\b"; "i") | not)
          elif $l == "en" then ($t | test("\\p{Cyrillic}") | not) and ($t | test("\\b(the|you|your|and|to|is|we|for|of|it|this|can|our|with)\\b"; "i")) and ($t | test("[ñ¿¡]|\\b(usted|gracias|hola|para|cita|está|tiene)\\b"; "i") | not)
          else false end)' "$TMP/rows.json" > /dev/null || ok=0 ;;
    regex) jq -e --arg r "$v" '[.[].text] | join("\n") | test($r; "i")' "$TMP/rows.json" > /dev/null 2>&1 || ok=0 ;;
    no-regex) jq -e --arg r "$v" '[.[].text] | join("\n") | test($r; "i") | not' "$TMP/rows.json" > /dev/null 2>&1 || ok=0 ;;
    tool) all_execs '(.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // []) | index($v) != null' "$v" || ok=0 ;;
    node) all_execs '.data.resultData.runData | has($v)' "$v" || ok=0 ;;
    no-node) all_execs '.data.resultData.runData | has($v) | not' "$v" || ok=0 ;;
    owner) owner_texts "$STEP_T" "$SP_CID" > "$TMP/owner.json" && jq -e --arg r "$v" 'any(.[]; test($r; "i"))' "$TMP/owner.json" > /dev/null 2>&1 || ok=0 ;;
    wa_template)
      if [ "$v" = none ]; then jq -e 'all(.[]; .wa_template == "")' "$TMP/rows.json" > /dev/null || ok=0
      else jq -e --arg w "$v" 'length > 0 and all(.[]; .wa_template == $w or (.wa_template | startswith($w + "|")))' "$TMP/rows.json" > /dev/null || ok=0; fi ;;
    state) build_ctx && jq -e "$v" "$TMP/ctx.json" > /dev/null 2>&1 || ok=0 ;;
    sh) ( eval "$v" ) > /dev/null 2>&1 || ok=0 ;;
    *) ok=0; v="$v (unknown check '$kind')" ;;
  esac
  if [ "$ok" -eq 1 ]; then log "  ok   $1: $2"; else fail "$1: $v"; fi
}
# assert_clean <contact>: no Clients row and no test_outbox rows - otherwise the run would assert on leftovers of an
# earlier one. tests/cleanup.sh (tests/dialogs.sh runs it before each dialog) provides it. Checked before any setup: line.
assert_clean() {
  local c o
  c=$(state_of "$1" | jq -c '.client') || { echo "cannot read the state of $1" >&2; exit 2; }
  o=$(pg_sql "SELECT count(*) FROM test_outbox WHERE contact_id = '$1'") || { echo "test_outbox is not readable" >&2; exit 2; }
  if [ "$c" != "{}" ] || [ "$o" != 0 ]; then
    echo "not a clean start for $1 (Clients row: $([ "$c" = "{}" ] && echo none || echo present), test_outbox rows: $o) - run tests/cleanup.sh first" >&2
    exit 2
  fi
}

# ---- play the file ----------------------------------------------------------------------------------------------------
block=$(sed -n '/^```dialog[[:space:]]*$/,/^```[[:space:]]*$/p' "$file" | sed '1d;$d' | sed 's/\r$//')
[ -n "$block" ] || { echo "no \`\`\`dialog block in $file" >&2; exit 2; }
T0=$(now_iso)
START_OUT=$(global_max_out) || { echo "test_outbox is not readable" >&2; exit 2; }
LAST_OUT=$START_OUT
assert_clean "$CID"
log "DIALOG $(basename "$file") channel=$ch contact=$CID started $T0 (clean start checked)"
STATES=()
while IFS= read -r line <&3; do
  [[ -z "${line// }" || "$line" == \#* ]] && continue
  key="${line%%:*}"; val="${line#*:}"; val="${val# }"
  if [ "$ABORT" -eq 1 ] && [[ "$key" == send || "$key" == send2 || "$key" == burst || "$key" == run ]]; then log "  (aborted: remaining steps skipped)"; break; fi
  case "$key" in
    channels) ;;
    profile) profile="$val" ;;
    profile2) profile2="$val" ;;
    second)
      read -r c2 n2 <<< "$val"; [ "$c2" = same ] && c2="$ch"
      [[ "$c2" =~ ^(tg|wa)$ && "$n2" =~ ^[1-9][0-9]{2}$ ]] || { echo "bad second: $val" >&2; exit 2; }
      CH2="$c2"; CID2=$(contact_of "$c2" "$n2"); [ "$CID2" != "$CID" ] || { echo "second contact equals the first" >&2; exit 2; }
      assert_clean "$CID2"; log "SECOND contact=$CID2 (clean start checked)" ;;
    setup) log "SETUP: $val"; eval "$val" > /dev/null || fail "setup failed: $val" ;;
    send) do_send "$val" "$CID" "$profile" ;;
    send2) [ -n "$CID2" ] || { fail "send2 without second:"; continue; }; do_send "$val" "$CID2" "$profile2" "send2 ($CID2)" ;;
    burst) read -r bn bg bt <<< "$val"; do_burst "$bn" "$bg" "$bt" ;;
    run) do_run "$val" ;;
    expect\ *) check "${key#expect }" "$val" ;;
    state) STATES+=("$val") ;;
    *) fail "unknown directive: $line" ;;
  esac
done 3<<< "$block"

# ---- final state ------------------------------------------------------------------------------------------------------
log "STATE"
tests/state.sh "$CID" | sed 's/^/  /'
[ -z "$CID2" ] || { log "STATE second $CID2"; tests/state.sh "$CID2" | sed 's/^/  /'; }
if build_ctx; then
  jq -r '(.owner[] | "  OWNER: " + (gsub("\\s+"; " ") | .[0:300])), ((.second.owner // [])[] | "  OWNER (second): " + (gsub("\\s+"; " ") | .[0:300]))' "$TMP/ctx.json"
  if [ "$ABORT" -eq 0 ]; then
    for s in "${STATES[@]}"; do
      if jq -e "$s" "$TMP/ctx.json" > /dev/null 2>&1; then log "  ok   state: $s"; else fail "state: $s"; fi
    done
  fi
  log "SUMMARY: $(jq -r 'def one: "client=\(.client.status // "-")/\(.client.language // "-") appts=\([.appts[].status] | join(",") | if . == "" then "-" else . end) events=\(.events | length) sent=\([.outbox[] | if .template_key == "" then "reply" else .template_key end] | join(","))"; one + (if .second then " | second: " + (.second | one) else "" end)' "$TMP/ctx.json")"
else
  fail "could not read the final state"
fi
restore_settings || true
if [ "$RESTORE_FAILED" -eq 1 ]; then log "RESULT FAIL $(basename "$file") $ch (Settings.reminder_hours_before NOT restored - exit 4)"; exit 4; fi
if [ "$FAILS" -eq 0 ]; then log "RESULT PASS $(basename "$file") $ch"; exit 0; fi
log "RESULT FAIL $(basename "$file") $ch ($FAILS failed)"; exit 1
