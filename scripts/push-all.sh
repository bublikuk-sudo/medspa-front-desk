#!/usr/bin/env bash
# usage (on the VPS): scripts/push-all.sh
# Pushes every workflow in dependency order (WFID: needs the called workflow to exist already).
#
# The list below is the FULL project order. Workflows that are not built yet (wf1-inbound, wf2-agent,
# wf5-reminders, the rest of the wf3 tools) are SKIPPED when the file is absent from disk:
#   missing (not built yet): <path>
# A file whose credentials do not exist on the instance yet (test-fixtures needs a Google Calendar
# credential) is skipped the same way, loudly, instead of aborting the whole run.
#
# Two passes: on the first, wf6-error-handler does not exist yet, so n8n-push.sh drops
# settings.errorWorkflow with a WARNING; the second pass re-pushes everything with the id known.
# The script then verifies through the API that every pushed workflow really carries WF-6's id,
# and exits non-zero if one does not.
set -euo pipefail
cd "$(dirname "$0")/.."
source deploy/secrets.env
order=(
  workflows/shared/notify_owner.json
  workflows/wf6-error-handler.json
  workflows/shared/send_message.json
  workflows/wf3-tools/find_client.json
  workflows/wf3-tools/check_availability.json
  workflows/wf3-tools/cancel_booking.json
  workflows/wf3-tools/propose_booking.json
  workflows/wf3-tools/confirm_booking.json
  workflows/wf3-tools/reminder_reply.json
  workflows/wf3-tools/escalate.json
  workflows/wf4-tools/search_knowledge.json
  workflows/wf2-agent.json
  workflows/wf1-inbound.json
  workflows/wf4-knowledge-ingest.json
  workflows/wf5-reminders.json
  workflows/test-fixtures.json
  workflows/test-harness.json
)
# Not activated here: sub-workflows (called by id), WF-6 (an error handler needs no activation),
# test-fixtures (needs a Google Calendar credential).
activate=(wf1-inbound wf4-knowledge-ingest wf5-reminders test-harness)
# No errorWorkflow expected on these: WF-6 itself (it would handle its own failure) and the test tooling.
no_error_handler=(wf6-error-handler test-fixtures test-harness)

# n8n 2.41.5 refuses settings.errorWorkflow that points at a workflow with no published version
# ("The selected error workflow has no published version."), so WF-6 must be ACTIVATED, not just pushed,
# before any other workflow can reference it. Hence --activate on every push of WF-6.
wf6_flag() { case "$1" in */wf6-error-handler.json) echo --activate ;; esac; }

pushable=()
for f in "${order[@]}"; do
  if [ ! -f "$f" ]; then echo "missing (not built yet): $f"; continue; fi
  missing_cred=$(jq -r --slurpfile m deploy/credentials.map.json '[.. | objects | select(has("credentials")) | .credentials[]?.name | select(. != null) | select($m[0][.] == null)] | unique | join(", ")' "$f")
  if [ -n "$missing_cred" ]; then echo "skipped (credential not created: $missing_cred): $f"; continue; fi
  pushable+=("$f")
done

# Re-run safety: if WF-6 exists but is inactive (for example after a manual deactivate), every push that
# carries errorWorkflow would fail with the 400 above. Activating is idempotent.
wf6_known=$(jq -r '.["wf6-error-handler"] // empty' deploy/workflow-ids.json)
if [ -n "$wf6_known" ]; then
  curl -sS --fail-with-body -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/workflows/$wf6_known/activate" > /dev/null
  echo "wf6-error-handler active ($wf6_known)"
fi
echo "--- pass 1"
for f in "${pushable[@]}"; do scripts/n8n-push.sh "$f" $(wf6_flag "$f"); done
echo "--- pass 2 (all ids known: errorWorkflow and cross-references resolve)"
for f in "${pushable[@]}"; do scripts/n8n-push.sh "$f" $(wf6_flag "$f"); done

for w in "${activate[@]}"; do
  [ -f "workflows/$w.json" ] || { echo "missing (not built yet): workflows/$w.json (not activated)"; continue; }
  scripts/n8n-push.sh "workflows/$w.json" --activate | tail -1
done

echo "--- verify settings.errorWorkflow through the API"
wf6=$(jq -r '.["wf6-error-handler"] // empty' deploy/workflow-ids.json)
[ -n "$wf6" ] || { echo "FAIL: wf6-error-handler has no id in deploy/workflow-ids.json" >&2; exit 1; }
echo "wf6-error-handler id: $wf6"
bad=0
for f in "${pushable[@]}"; do
  name=$(jq -r .name "$f")
  skip=0; for x in "${no_error_handler[@]}"; do [ "$x" = "$name" ] && skip=1; done
  [ "$skip" -eq 1 ] && { echo "exempt  $name (no error handler expected)"; continue; }
  id=$(jq -r --arg n "$name" '.[$n]' deploy/workflow-ids.json)
  got=$(curl -sS --fail-with-body -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/workflows/$id" | jq -r '.settings.errorWorkflow // ""')
  if [ "$got" = "$wf6" ]; then echo "OK      $name ($id) errorWorkflow=$got"
  else echo "MISSING $name ($id) errorWorkflow='$got' expected $wf6" >&2; bad=1; fi
done
[ "$bad" -eq 0 ] || { echo "FAIL: some workflows have no error handler" >&2; exit 1; }
echo "push-all done"
