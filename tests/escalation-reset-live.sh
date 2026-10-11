#!/usr/bin/env bash
# usage: tests/escalation-reset-live.sh   (on the VPS, cwd /opt/medspa, via scripts/remote.sh)
# Live proof of the escalation reset (2026-10-11): a test contact talks, is escalated, gets the hold reply, the owner's
# status change to active is simulated, and the next message must reset the agent's chat memory exactly once.
# Test contact only (tg:9000000101 -> client C-test-*); costs about 3 agent answers and ~60 Airtable calls.
# Prints facts per step; the verdict lines start with PASS/FAIL. Cleans up its own rows at the start and the end.
set -uo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
source tests/lib/airtable.sh
source tests/lib/pg.sh
CID="tg:9000000101"; API="https://$N8N_HOST/api/v1"; AH="X-N8N-API-KEY: $N8N_API_KEY"
WF1=$(jq -r '.["wf1-inbound"]' deploy/workflow-ids.json)
FAILS=0
ok()  { echo "PASS: $*"; }
bad() { echo "FAIL: $*"; FAILS=$((FAILS + 1)); }
hist() { pg_sql "SELECT count(*) FROM n8n_chat_histories WHERE session_id = '$CID'"; }
client() { at_list Clients "{telegram_chat_id}='${CID#tg:}'" | jq -c '.records[0] | {id, client_id: .fields.client_id, status: .fields.status, escalated_at: (.fields.escalated_at // null)}'; }
newest() { curl -fsS -H "$AH" "$API/executions?workflowId=$WF1&limit=1" | jq -r '.data[0].id // 0'; }
send() {  # <text> -> EXEC (execution json path)
  local before nonce body id end
  before=$(newest); nonce=$(( $(date +%s%N) / 1000 % 1000000000000 ))
  body=$(jq -nc --arg t "$1" --argjson u "$nonce" --argjson id "${CID#tg:}" --argjson d "$(date +%s)" \
    '{update_id: $u, message: {message_id: ($u % 1000000), from: {id: $id, is_bot: false, first_name: "Reset", language_code: "ru"}, chat: {id: $id, first_name: "Reset", type: "private"}, date: $d, text: $t}}')
  curl -sS -o /dev/null --max-time 30 -X POST "https://$N8N_HOST/webhook/wf1-test" -H "X-Test-Key: $TEST_KEY" -H 'Content-Type: application/json' -d "$body"
  end=$((SECONDS + 120)); EXEC=""
  while [ $SECONDS -lt $end ]; do
    sleep 4
    id=$(curl -fsS -H "$AH" "$API/executions?workflowId=$WF1&limit=10" | jq -r --argjson b "$before" '[.data[] | select((.id|tonumber) > $b and ((.status // "") | IN("running","new","waiting") | not))] | last | .id // empty')
    [ -n "$id" ] || continue
    curl -fsS -H "$AH" "$API/executions/$id?includeData=true" > /tmp/erl-exec.json; EXEC=/tmp/erl-exec.json; break
  done
  [ -n "$EXEC" ] || { bad "no finished wf1-inbound execution for '$1'"; return 1; }
  echo "  exec $id $(jq -r .status $EXEC); nodes: $(jq -r '.data.resultData.runData | keys | map(select(IN("Escalated?","Send Hold","Escalation Resolved?","Reset Memory","Clear Marker","Marker Cleared?","Notify Reset Failure","Agent"))) | join(", ")' $EXEC)"
}
ran() { jq -e --arg n "$1" '.data.resultData.runData[$n] != null' "$EXEC" > /dev/null; }
outbox() { pg_sql "SELECT coalesce(string_agg(left(regexp_replace(text, '\s+', ' ', 'g'), 160), ' || ' ORDER BY id), '') FROM test_outbox WHERE contact_id = '$CID' AND id > $1"; }
maxout() { pg_sql "SELECT coalesce(max(id), 0) FROM test_outbox"; }

echo "== cleanup"; tests/cleanup.sh --no-calendar > /dev/null && echo "  clean"

echo "== 1. first message"; o=$(maxout); send "Привет"
echo "  reply: $(outbox "$o")"; h1=$(hist); echo "  history rows: $h1"; [ "$h1" -ge 2 ] && ok "agent memory written" || bad "history $h1 < 2"
echo "  client: $(client)"

echo "== 2. escalate (deterministic, escalate tool)"
echo "  verdict: $(tests/run-case.sh escalate "{\"contact_id\":\"$CID\",\"reason\":\"[TEST] escalation reset proof\"}" | jq -c .)"
c=$(client); echo "  client: $c"
[ "$(jq -r .status <<< "$c")" = escalated ] && [ "$(jq -r .escalated_at <<< "$c")" != null ] && ok "status escalated + escalated_at set" || bad "marker not set"

echo "== 3. message while escalated"; h3a=$(hist); o=$(maxout); send "Привет"
echo "  reply: $(outbox "$o")"; h3b=$(hist); echo "  history rows: $h3a -> $h3b"
ran "Send Hold" && ! ran "Agent" && ! ran "Reset Memory" && ok "hold, no agent, no reset" || bad "unexpected path while escalated"
[ "$h3a" = "$h3b" ] && ok "hold reply not written to agent memory" || bad "history changed during hold"

echo "== 4. owner resolves: status -> active"
rec=$(jq -r .id <<< "$c"); at_update Clients "$rec" '{"status":"active"}' > /dev/null; N=$(hist); echo "  client: $(client); history rows N=$N"

echo "== 5. first message after resolution"; o=$(maxout); send "Хочу записаться"
echo "  Escalation Resolved? -> $(jq -c '.data.resultData.runData["Escalation Resolved?"][0].data.main | map(length)' $EXEC)"
echo "  Reset Memory out: $(jq -c '.data.resultData.runData["Reset Memory"][0].data.main | map(map(.json))' $EXEC)"
echo "  Marker Cleared? -> $(jq -c '.data.resultData.runData["Marker Cleared?"][0].data.main | map(length)' $EXEC)"
echo "  tools: $(jq -c '.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // []' $EXEC)"
echo "  reply: $(outbox "$o")"
c5=$(client); h5=$(hist); echo "  client: $c5; history rows: $h5"
ran "Reset Memory" && ran "Clear Marker" && ran "Agent" && ! ran "Notify Reset Failure" && ok "reset path ran, no failure alert" || bad "reset path incomplete or alerted"
[ "$(jq -r .escalated_at <<< "$c5")" = null ] && ok "escalated_at cleared (typecast null reached Airtable)" || bad "escalated_at still set: $(jq -r .escalated_at <<< "$c5")"
# One agent turn writes 2 rows without a tool call and 4 with one (human, tool call, tool result, reply), so the check is
# on the delete itself: exactly the N rows that existed before this message, and no more rows now than one turn makes.
d5=$(jq -r '.data.resultData.runData["Reset Memory"][0].data.main[0][0].json.deleted // -1' $EXEC)
[ "$d5" = "$N" ] && [ "$h5" -le 4 ] && ok "deleted exactly the $N old rows; history holds only this turn ($h5 rows)" || bad "deleted $d5 of $N, history $h5 rows after reset"
jq -e '.data.resultData.runData.Agent[0].data.main[0][0].json.tools_used // [] | index("escalate") | not' $EXEC > /dev/null && ok "agent did not escalate" || bad "agent escalated again"

echo "== 6. next message: no second reset"; o=$(maxout); send "Консультация"
echo "  reply: $(outbox "$o")"
! ran "Reset Memory" && ran "Agent" && ok "no reset, agent answered" || bad "reset ran again or no agent"
h6=$(hist); [ "$h6" -gt "$h5" ] && ok "memory kept growing ($h5 -> $h6)" || bad "history $h5 -> $h6"

echo "== cleanup"; tests/cleanup.sh --no-calendar > /dev/null && echo "  clean: client rows $(at_list Clients "{telegram_chat_id}='${CID#tg:}'" | jq '.records|length'), history $(hist)"
rm -f /tmp/erl-exec.json
echo "RESULT: $([ $FAILS -eq 0 ] && echo PASS || echo "FAIL ($FAILS)")"
exit "$FAILS"
