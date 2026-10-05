#!/usr/bin/env bash
# usage: tests/dialog.sh <tests/dialogs/NN-name.md> <tg|wa> [NNN]   (on the VPS, cwd /opt/medspa; see tests/dialogs.sh)
# Plays one Task 20 dialog end to end in one channel format and checks it. Exit 0 = PASS, 1 = FAIL, 2 = usage error or
# not a clean start (a Clients row or test_outbox rows of the contact exist), 4 = Settings.reminder_hours_before could not
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
#   profile: <First Last>          the name in the Telegram profile / WhatsApp profile (default "Dialog Tester")
#   setup: <bash>                  run before the first step (helpers below and tests/lib/*.sh are available)
#   send: <text>                   the client writes <text>
#   run: <bash>                    a non-message step, e.g. reminder_leg; its new test_outbox rows are checked like a send's
#   expect <check>: <value>        checks the step just played; "tg.<check>" / "wa.<check>" applies to that channel only
#       templates: A, B            exact sequence of the step's outbound rows, by template_key; "reply" = free-form agent text;
#                                  "none" = no message at all
#       lang: en|es|ru             language of the step's free-form/translated texts (WhatsApp template rows excluded)
#       regex: <re>                Oniguruma regex, case-insensitive, must match the step's texts joined by newlines
#       tool: <name>               the Agent's tools_used in this wf1-inbound execution contains <name>
#       node: <name> / no-node: <name>   that wf1-inbound node ran / did not run in this execution
#       owner: <re>                an owner notification (notify_owner run) about this contact since the step began matches
#       wa_template: <name>|none   every row of the step took the WhatsApp template path <name> / none did
#       state: <jq>                jq boolean over tests/state.sh --json (+ outbox, owner) right now
#   state: <jq>                    after the last step: jq boolean over {client, appts, events} (tests/state.sh --json)
#                                  plus outbox (all rows of this dialog) and owner (owner notification texts about this contact)
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
if [ "$ch" = tg ]; then CID="tg:9000000$num"; else CID="wa:+15550000$num"; fi
WF1=$(jq -er '."wf1-inbound"' deploy/workflow-ids.json) || { echo "wf1-inbound not deployed" >&2; exit 2; }
TMP=$(mktemp -d)
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
state_json() { tests/state.sh "$CID" --json; }
client_rec() { local f v; f=$([[ "$CID" == tg:* ]] && echo telegram_chat_id || echo phone); v="${CID#*:}"; at_rec_id Clients "{$f}='$v'"; }
# client_set <field> <value>: sets one text/select field of this contact's Clients row (e.g. client_set status active)
client_set() { local r; r=$(client_rec) || { echo "no Clients row for $CID" >&2; return 1; }; at_update Clients "$r" "$(jq -nc --arg k "$1" --arg v "$2" '{($k): $v}')" > /dev/null; }
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
profile="Dialog Tester"
newest_exec() { curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$WF1&limit=1" | jq -r '.data[0].id // 0'; }
make_body() {  # text nonce
  if [ "$ch" = tg ]; then
    local fn="${profile%% *}" ln=""; [[ "$profile" == *" "* ]] && ln="${profile#* }"
    jq -nc --arg t "$1" --argjson u "$2" --argjson id "${CID#tg:}" --arg fn "$fn" --arg ln "$ln" --argjson d "$(date +%s)" \
      '{update_id: $u, message: {message_id: ($u % 1000000), from: {id: $id, is_bot: false, first_name: $fn, last_name: $ln, language_code: "en"}, chat: {id: $id, first_name: $fn, last_name: $ln, type: "private"}, date: $d, text: $t}}
       | if $ln == "" then del(.message.from.last_name, .message.chat.last_name) else . end'
  else
    jq -nc --arg t "$1" --arg n "$2" --arg from "${CID#wa:+}" --arg name "$profile" --arg d "$(date +%s)" \
      '{messaging_product: "whatsapp", metadata: {display_phone_number: "15550000000", phone_number_id: "TEST"}, contacts: [{profile: {name: $name}, wa_id: $from}], messages: [{from: $from, id: ("wamid.T20." + $n), timestamp: $d, type: "text", text: {body: $t}}], field: "messages"}'
  fi
}
# wait_exec <nonce> <id before the POST>: the finished wf1-inbound execution whose Test Inbound body carries the nonce
wait_exec() {
  local n="$1" before="$2" seen=" " id ids end=$((SECONDS + EXEC_WAIT))
  while [ "$SECONDS" -lt "$end" ]; do
    ids=$(curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$WF1&limit=25" |
      jq -r --argjson b "$before" '.data[] | select((.id | tonumber) > $b and ((.status // "") | IN("running", "new", "waiting") | not)) | .id') || ids=""
    for id in $ids; do
      case "$seen" in *" $id "*) continue ;; esac
      curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions/$id?includeData=true" > "$TMP/exec.json" || continue
      seen="$seen$id "
      if jq -e --arg n "$n" '(.data.resultData.runData["Test Inbound"][0].data.main[0][0].json.body // null) | tostring | contains($n)' "$TMP/exec.json" > /dev/null 2>&1; then
        EXEC_ID=$id; EXEC_STATUS=$(jq -r '.status' "$TMP/exec.json"); return 0
      fi
    done
    sleep 3
  done
  return 1
}
out_rows() { pg_sql "SELECT coalesce(json_agg(json_build_object('id', id, 'template_key', template_key, 'wa_template', wa_template, 'text', text) ORDER BY id), '[]') FROM test_outbox WHERE contact_id = '$CID' AND id > $1"; }
read_outbox() {
  out_rows "$LAST_OUT" > "$TMP/rows.json" || { fail "cannot read test_outbox"; echo '[]' > "$TMP/rows.json"; return; }
  LAST_OUT=$(jq -r --argjson l "$LAST_OUT" '(map(.id) | max) // $l' "$TMP/rows.json")
  jq -r '.[] | "  <- " + (if .template_key == "" then "reply" else .template_key end) + (if .wa_template != "" then " [wa template " + .wa_template + "]" else "" end) + ": " + (.text | gsub("\\s+"; " ") | .[0:240])' "$TMP/rows.json"
}
# owner_texts <since ISO>: texts of the owner notifications about THIS contact since then, as a JSON array
owner_texts() {
  local id; id=$(jq -r '.notify_owner' deploy/workflow-ids.json)
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$API/executions?workflowId=$id&limit=50&includeData=true" |
    jq -c --arg t "$1" --arg c "$CID" '[.data[] | select(.startedAt >= $t) | .data.resultData.runData.Trigger[0].data.main[0][0].json.text // empty | select(contains($c))] | reverse'
}
# build_ctx -> $TMP/ctx.json: tests/state.sh --json plus outbox (this dialog's rows so far) and owner (notifications about
# this contact since the dialog started). Both `expect state:` and the final `state:` lines are evaluated against it.
build_ctx() {
  state_json > "$TMP/state.json" && out_rows "$START_OUT" > "$TMP/all.json" && owner_texts "$T0" > "$TMP/ownerall.json" &&
    jq -c --slurpfile o "$TMP/all.json" --slurpfile w "$TMP/ownerall.json" '. + {outbox: $o[0], owner: $w[0]}' "$TMP/state.json" > "$TMP/ctx.json"
}
STEP=0; STEP_KIND=""; STEP_T=""
do_send() {
  local nonce body code before
  STEP=$((STEP + 1)); STEP_KIND=send; STEP_T=$(now_iso)
  log "STEP $STEP send: $1"
  before=$(newest_exec) || { fail "cannot list executions"; return; }
  nonce=$(( $(date +%s%N) / 1000 % 1000000000000 ))
  body=$(make_body "$1" "$nonce")
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 -X POST "https://$N8N_HOST/webhook/wf1-test" -H "X-Test-Key: $TEST_KEY" -H 'Content-Type: application/json' -d "$body")
  [ "$code" = 200 ] || { fail "test inbound answered HTTP $code"; return; }
  if ! wait_exec "$nonce" "$before"; then fail "no finished wf1-inbound execution with nonce $nonce within ${EXEC_WAIT}s"; echo '{}' > "$TMP/exec.json"; read_outbox; return; fi
  log "  exec $EXEC_ID $EXEC_STATUS; route $(jq -r '.data.resultData.runData.Route[0].data.main | to_entries | map(select((.value | length) > 0) | .key) | map(["confirm","llm","reminder","agent"][.]) | join(",") // "-"' "$TMP/exec.json" 2>/dev/null || echo -); tools $(jq -c '.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // []' "$TMP/exec.json" 2>/dev/null)"
  [ "$EXEC_STATUS" = success ] || fail "wf1-inbound execution $EXEC_ID ended $EXEC_STATUS"
  read_outbox
}
do_run() {
  STEP=$((STEP + 1)); STEP_KIND=run; STEP_T=$(now_iso)
  log "STEP $STEP run: $1"
  echo '{}' > "$TMP/exec.json"
  eval "$1" || fail "run step failed: $1"
  read_outbox
}
# check <kind> <value>: one expectation against the step just played
check() {
  local kind="$1" v="$2" ok=1 got
  case "$kind" in
    tg.*|wa.*) [ "${kind%%.*}" = "$ch" ] || return 0; kind="${kind#*.}" ;;
  esac
  case "$kind" in
    templates)
      local want; want=$(printf '%s' "$v" | tr -d ' '); [ "$want" = none ] && want=""
      got=$(jq -r 'map(if .template_key == "" then "reply" else .template_key end) | join(",")' "$TMP/rows.json")
      [ "$got" = "$want" ] || { ok=0; v="$v (got: ${got:-none})"; } ;;
    lang)
      jq -e --arg l "$v" '[.[] | select(.wa_template == "") | .text] as $x | ($x | join("\n")) as $t | ($x | length) > 0 and (
          if $l == "ru" then ($t | test("\\p{Cyrillic}"))
          elif $l == "es" then ($t | test("\\p{Cyrillic}") | not) and ($t | test("[ñ¿¡áéíóú]|\\b(el|la|los|las|de|que|para|su|usted|tu|una|cita|gracias|hola)\\b"; "i")) and ($t | test("\\b(the|you|your|and|with|please)\\b"; "i") | not)
          elif $l == "en" then ($t | test("\\p{Cyrillic}") | not) and ($t | test("\\b(the|you|your|and|to|is|we|for|of|it|this|can|our|with)\\b"; "i")) and ($t | test("[ñ¿¡]|\\b(usted|gracias|hola|para|cita|está|tiene)\\b"; "i") | not)
          else false end)' "$TMP/rows.json" > /dev/null || ok=0 ;;
    regex) jq -e --arg r "$v" '[.[].text] | join("\n") | test($r; "i")' "$TMP/rows.json" > /dev/null 2>&1 || ok=0 ;;
    tool) jq -e --arg t "$v" '(.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // []) | index($t) != null' "$TMP/exec.json" > /dev/null 2>&1 || ok=0 ;;
    node) jq -e --arg n "$v" '.data.resultData.runData | has($n)' "$TMP/exec.json" > /dev/null 2>&1 || ok=0 ;;
    no-node) jq -e --arg n "$v" '.data.resultData.runData | has($n) | not' "$TMP/exec.json" > /dev/null 2>&1 || ok=0 ;;
    owner) owner_texts "$STEP_T" > "$TMP/owner.json" && jq -e --arg r "$v" 'any(.[]; test($r; "i"))' "$TMP/owner.json" > /dev/null 2>&1 || ok=0 ;;
    wa_template)
      if [ "$v" = none ]; then jq -e 'all(.[]; .wa_template == "")' "$TMP/rows.json" > /dev/null || ok=0
      else jq -e --arg w "$v" 'length > 0 and all(.[]; .wa_template == $w or (.wa_template | startswith($w + "|")))' "$TMP/rows.json" > /dev/null || ok=0; fi ;;
    state) build_ctx && jq -e "$v" "$TMP/ctx.json" > /dev/null 2>&1 || ok=0 ;;
    *) ok=0; v="$v (unknown check '$kind')" ;;
  esac
  if [ "$ok" -eq 1 ]; then log "  ok   $1: $2"; else fail "$1: $v"; fi
}

# ---- play the file ----------------------------------------------------------------------------------------------------
block=$(sed -n '/^```dialog[[:space:]]*$/,/^```[[:space:]]*$/p' "$file" | sed '1d;$d' | sed 's/\r$//')
[ -n "$block" ] || { echo "no \`\`\`dialog block in $file" >&2; exit 2; }
T0=$(now_iso)
START_OUT=$(pg_sql "SELECT coalesce(max(id), 0) FROM test_outbox") || { echo "test_outbox is not readable" >&2; exit 2; }
LAST_OUT=$START_OUT
# Clean start (before any setup: line): no Clients row and no test_outbox rows for this contact - otherwise the run would
# assert on leftovers of an earlier one. tests/cleanup.sh (tests/dialogs.sh runs it before each dialog) provides it.
pre_client=$(state_json | jq -c '.client') || { echo "cannot read the state of $CID" >&2; exit 2; }
pre_out=$(pg_sql "SELECT count(*) FROM test_outbox WHERE contact_id = '$CID'") || { echo "test_outbox is not readable" >&2; exit 2; }
if [ "$pre_client" != "{}" ] || [ "$pre_out" != 0 ]; then
  echo "not a clean start for $CID (Clients row: $([ "$pre_client" = "{}" ] && echo none || echo present), test_outbox rows: $pre_out) - run tests/cleanup.sh first" >&2
  exit 2
fi
log "DIALOG $(basename "$file") channel=$ch contact=$CID started $T0 (clean start checked)"
STATES=()
while IFS= read -r line <&3; do
  [[ -z "${line// }" || "$line" == \#* ]] && continue
  key="${line%%:*}"; val="${line#*:}"; val="${val# }"
  if [ "$ABORT" -eq 1 ] && [[ "$key" == send || "$key" == run ]]; then log "  (aborted: remaining steps skipped)"; break; fi
  case "$key" in
    profile) profile="$val" ;;
    setup) log "SETUP: $val"; eval "$val" > /dev/null || fail "setup failed: $val" ;;
    send) do_send "$val" ;;
    run) do_run "$val" ;;
    expect\ *) check "${key#expect }" "$val" ;;
    state) STATES+=("$val") ;;
    *) fail "unknown directive: $line" ;;
  esac
done 3<<< "$block"

# ---- final state ------------------------------------------------------------------------------------------------------
log "STATE"
tests/state.sh "$CID" | sed 's/^/  /'
if build_ctx; then
  jq -r '.owner[] | "  OWNER: " + (gsub("\\s+"; " ") | .[0:300])' "$TMP/ctx.json"
  if [ "$ABORT" -eq 0 ]; then
    for s in "${STATES[@]}"; do
      if jq -e "$s" "$TMP/ctx.json" > /dev/null 2>&1; then log "  ok   state: $s"; else fail "state: $s"; fi
    done
  fi
  log "SUMMARY: $(jq -r '"client=\(.client.status // "-")/\(.client.language // "-") appts=\([.appts[].status] | join(",") | if . == "" then "-" else . end) events=\(.events | length) sent=\([.outbox[] | if .template_key == "" then "reply" else .template_key end] | join(","))"' "$TMP/ctx.json")"
else
  fail "could not read the final state"
fi
restore_settings || true
if [ "$RESTORE_FAILED" -eq 1 ]; then log "RESULT FAIL $(basename "$file") $ch (Settings.reminder_hours_before NOT restored - exit 4)"; exit 4; fi
if [ "$FAILS" -eq 0 ]; then log "RESULT PASS $(basename "$file") $ch"; exit 0; fi
log "RESULT FAIL $(basename "$file") $ch ($FAILS failed)"; exit 1
