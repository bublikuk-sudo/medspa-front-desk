#!/usr/bin/env bash
# usage: tests/escalation-reset-live.sh   (on the VPS, cwd /opt/medspa, via scripts/remote.sh)
# Live proof of the escalation reset (2026-10-11): a test contact talks, is escalated, gets the hold reply, the owner's
# status change to active is simulated, and the next message must reset the agent's chat memory exactly once.
# Test contact only (tg:9000000101 -> client C-test-*); costs about 3 agent answers and ~60 Airtable calls.
# Prints facts per step; the verdict lines start with PASS/FAIL. Cleans up its own rows at the start and the end; a failed
# cleanup at the start aborts, at the end it is a FAIL, and the end asserts 0 client rows and 0 history rows.
# Revised after the first run (review of phase 2): see tests/dialog-runs/2026-10-11-escalation-reset-live.md.
set -uo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
source tests/lib/airtable.sh
source tests/lib/pg.sh
CID="tg:9000000101"; API="https://$N8N_HOST/api/v1"; AH="X-N8N-API-KEY: $N8N_API_KEY"
WF1=$(jq -r '.["wf1-inbound"]' deploy/workflow-ids.json)
TMP=$(mktemp -d) || { echo "FAIL: mktemp"; exit 1; }
trap 'rm -rf "$TMP"' EXIT
FAILS=0
ok()  { echo "PASS: $*"; }
bad() { echo "FAIL: $*"; FAILS=$((FAILS + 1)); }
num() { [[ "${1:-}" =~ ^[0-9]+$ ]]; }
hist() { pg_sql "SELECT count(*) FROM n8n_chat_histories WHERE session_id = '$CID'"; }
client() { at_list Clients "{telegram_chat_id}='${CID#tg:}'" | jq -c '.records[0] | {id, client_id: .fields.client_id, status: .fields.status, escalated_at: (.fields.escalated_at // null)}'; }
newest() { curl -fsS -H "$AH" "$API/executions?workflowId=$WF1&limit=1" | jq -r '.data[0].id // 0'; }
# send <text> -> EXEC (path of the execution json). The execution under test must be the one started by THIS message:
# Test Inbound's body carries our update_id (a nonce) and Normalize's contact_id is $CID. Every other finished execution
# newer than `before` (a real client's message, say) is fetched once, skipped, and the polling goes on.
send() {
  local before nonce body id end f seen=" "
  before=$(newest); nonce=$(( $(date +%s%N) / 1000 % 1000000000000 ))
  num "$before" || { bad "could not read the newest wf1-inbound execution id ('$before')"; return 1; }
  body=$(jq -nc --arg t "$1" --argjson u "$nonce" --argjson id "${CID#tg:}" --argjson d "$(date +%s)" \
    '{update_id: $u, message: {message_id: ($u % 1000000), from: {id: $id, is_bot: false, first_name: "Reset", language_code: "ru"}, chat: {id: $id, first_name: "Reset", type: "private"}, date: $d, text: $t}}')
  curl -sS -o /dev/null --max-time 30 -X POST "https://$N8N_HOST/webhook/wf1-test" -H "X-Test-Key: $TEST_KEY" -H 'Content-Type: application/json' -d "$body"
  end=$((SECONDS + 120)); EXEC=""
  while [ $SECONDS -lt $end ] && [ -z "$EXEC" ]; do
    sleep 4
    for id in $(curl -fsS -H "$AH" "$API/executions?workflowId=$WF1&limit=20" | jq -r --argjson b "$before" '[.data[] | select((.id|tonumber) > $b and ((.status // "") | IN("running","new","waiting") | not)) | .id] | sort_by(tonumber) | .[]'); do
      case "$seen" in *" $id "*) continue;; esac
      seen="$seen$id "
      f="$TMP/exec-$id.json"
      curl -fsS -H "$AH" "$API/executions/$id?includeData=true" > "$f" || { rm -f "$f"; seen="${seen/ $id / }"; continue; }   # fetch failed: try again next poll
      if jq -e --arg c "$CID" --arg n "$nonce" '
          ((.data.resultData.runData["Test Inbound"][0].data.main[0][0].json.body // {}) | (if type == "array" then .[0] else . end) | (.update_id // "") | tostring) == $n
          and (.data.resultData.runData.Normalize[0].data.main[0][0].json.contact_id // "") == $c' "$f" > /dev/null; then
        EXEC="$f"; break
      fi
      echo "  (skipped execution $id: not this message of $CID)"
    done
  done
  [ -n "$EXEC" ] || { bad "no finished wf1-inbound execution of $CID for '$1' within 120 s"; EXEC="$TMP/none.json"; echo '{}' > "$EXEC"; return 1; }
  echo "  exec $id $(jq -r .status "$EXEC"); nodes: $(jq -r '.data.resultData.runData | keys | map(select(IN("Escalated?","Send Hold","Escalation Resolved?","Reset Memory","Clear Marker","Marker Cleared?","Notify Reset Failure","Agent"))) | join(", ")' "$EXEC")"
}
ran() { jq -e --arg n "$1" '.data.resultData.runData[$n] != null' "$EXEC" > /dev/null; }
took_true() { jq -e --arg n "$1" '(.data.resultData.runData[$n][0].data.main // []) as $m | ($m[0] // [] | length) == 1 and ($m[1] // [] | length) == 0' "$EXEC" > /dev/null; }   # IF node: output 0 (true) only
outbox() { pg_sql "SELECT coalesce(string_agg(left(regexp_replace(text, '\s+', ' ', 'g'), 160), ' || ' ORDER BY id), '') FROM test_outbox WHERE contact_id = '$CID' AND id > $1"; }
maxout() { pg_sql "SELECT coalesce(max(id), 0) FROM test_outbox"; }

echo "== cleanup"
if tests/cleanup.sh --no-calendar > /dev/null; then echo "  clean"; else bad "cleanup failed at the start - aborting"; echo "RESULT: FAIL ($FAILS)"; exit "$FAILS"; fi

echo "== 1. first message"; o=$(maxout); send "Привет"
echo "  reply: $(outbox "$o")"; h1=$(hist); echo "  history rows: $h1"; num "$h1" && [ "$h1" -ge 2 ] && ok "agent memory written" || bad "history '$h1' < 2"
echo "  client: $(client)"

echo "== 2. escalate (deterministic, escalate tool)"
echo "  verdict: $(tests/run-case.sh escalate "{\"contact_id\":\"$CID\",\"reason\":\"[TEST] escalation reset proof\"}" | jq -c .)"
c=$(client); echo "  client: $c"
[ "$(jq -r .status <<< "$c")" = escalated ] && [ "$(jq -r .escalated_at <<< "$c")" != null ] && ok "status escalated + escalated_at set" || bad "marker not set"

echo "== 3. message while escalated"; h3a=$(hist); o=$(maxout); send "Привет"
echo "  reply: $(outbox "$o")"; h3b=$(hist); echo "  history rows: $h3a -> $h3b"
ran "Send Hold" && ! ran "Agent" && ! ran "Reset Memory" && ok "hold, no agent, no reset" || bad "unexpected path while escalated"
num "$h3a" && num "$h3b" && [ "$h3a" = "$h3b" ] && ok "hold reply not written to agent memory" || bad "history '$h3a' -> '$h3b' during hold"
c3=$(client); echo "  client: $c3"
[ "$(jq -r .escalated_at <<< "$c3")" = "$(jq -r .escalated_at <<< "$c")" ] && [ "$(jq -r .status <<< "$c3")" = escalated ] && ok "marker and status unchanged by the hold" || bad "marker/status changed during hold: $c3"

echo "== 4. owner resolves: status -> active"
rec=$(jq -r .id <<< "$c3"); clid=$(jq -r .client_id <<< "$c3")
if [[ "$clid" == C-test-* ]] && [[ "$rec" == rec* ]]; then
  at_update Clients "$rec" '{"status":"active"}' > /dev/null || bad "status update failed"
else
  bad "row is not a test client (client_id '$clid', rec '$rec') - not touching it"; echo "RESULT: FAIL ($FAILS)"; exit "$FAILS"
fi
N=$(hist); M=$(pg_sql "SELECT coalesce(max(id), 0) FROM n8n_chat_histories WHERE session_id = '$CID'")
echo "  client: $(client); history rows N=$N, newest row id M=$M"
num "$N" && num "$M" || bad "history count/max id unreadable: N='$N' M='$M'"

echo "== 5. first message after resolution"; o=$(maxout); send "Хочу записаться"
echo "  Escalation Resolved? -> $(jq -c '.data.resultData.runData["Escalation Resolved?"][0].data.main | map(length)' "$EXEC")"
echo "  Reset Memory out: $(jq -c '.data.resultData.runData["Reset Memory"][0].data.main | map(map(.json))' "$EXEC")"
echo "  Marker Cleared? -> $(jq -c '.data.resultData.runData["Marker Cleared?"][0].data.main | map(length)' "$EXEC")"
echo "  tools: $(jq -c '.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // []' "$EXEC")"
echo "  reply: $(outbox "$o")"
c5=$(client); h5=$(hist); echo "  client: $c5; history rows: $h5"
took_true "Escalation Resolved?" && ok "Escalation Resolved? true" || bad "Escalation Resolved? did not take the true output"
ran "Reset Memory" && ran "Clear Marker" && ran "Agent" && ! ran "Notify Reset Failure" && ok "reset path ran, no failure alert" || bad "reset path incomplete or alerted"
took_true "Marker Cleared?" && ok "Marker Cleared? true" || bad "Marker Cleared? did not take the true output"
[ "$(jq -r .escalated_at <<< "$c5")" = null ] && ok "escalated_at cleared (typecast null reached Airtable)" || bad "escalated_at still set: $(jq -r .escalated_at <<< "$c5")"
[ "$(jq -r .status <<< "$c5")" = active ] && ok "status still active" || bad "status after step 5: $(jq -r .status <<< "$c5")"
# The delete itself: exactly the N rows that existed before this message, and none of the old rows (id <= M) survive.
# How many rows the new turn writes depends on its tool calls (2 without, 4 with one), so that count is not bounded.
d5=$(jq -r '.data.resultData.runData["Reset Memory"][0].data.main[0][0].json.deleted // -1' "$EXEC")
old5=$(pg_sql "SELECT count(*) FROM n8n_chat_histories WHERE session_id = '$CID' AND id <= ${M:-0}")
[ "$d5" = "$N" ] && ok "deleted exactly the $N old rows" || bad "deleted $d5, expected N=$N"
num "$M" && [ "$old5" = 0 ] && ok "no row of the old conversation left (id <= $M); $h5 rows are this turn's" || bad "$old5 old rows (id <= $M) still there"
jq -e '.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // [] | index("escalate") | not' "$EXEC" > /dev/null && ok "agent did not escalate" || bad "agent escalated again"

echo "== 6. next message: no second reset"; o=$(maxout); send "Консультация"
echo "  reply: $(outbox "$o")"
! ran "Reset Memory" && ran "Agent" && ok "no reset, agent answered" || bad "reset ran again or no agent"
h6=$(hist); num "$h5" && num "$h6" && [ "$h6" -gt "$h5" ] && ok "memory kept growing ($h5 -> $h6)" || bad "history '$h5' -> '$h6'"

echo "== cleanup"
tests/cleanup.sh --no-calendar > /dev/null || bad "cleanup failed at the end"
rows=$(at_list Clients "{telegram_chat_id}='${CID#tg:}'" | jq '.records | length'); hend=$(hist)
echo "  client rows $rows, history $hend"
[ "$rows" = 0 ] && [ "$hend" = 0 ] && ok "test contact fully removed" || bad "left behind: client rows '$rows', history '$hend'"
echo "RESULT: $([ $FAILS -eq 0 ] && echo PASS || echo "FAIL ($FAILS)")"
exit "$FAILS"
