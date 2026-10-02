#!/usr/bin/env bash
# usage: medspa-front-desk/scripts/remote.sh 'scripts/push-all.sh'   (it runs on the VPS; remote.sh guards the working tree)
# Pushes every workflow in dependency order (WFID: needs the called workflow to exist already).
#
# The list below is the FULL project order. Workflows that are not built yet (wf1-inbound, wf2-agent,
# wf5-reminders, the rest of the wf3 tools) are SKIPPED when the file is absent from disk:
#   missing (not built yet): <path>
# A file whose credentials do not exist on the instance yet (for example a workflow that needs the
# Google Calendar or WhatsApp credential before it has been created) is skipped the same way, loudly,
# instead of aborting the whole run.
#
# Two passes: on the first, wf6-error-handler does not exist yet, so n8n-push.sh drops
# settings.errorWorkflow with a WARNING; the second pass re-pushes everything with the id known.
# The script then verifies through the API that every pushed workflow really carries WF-6's id,
# and exits non-zero if one does not.
set -euo pipefail
cd "$(dirname "$0")/.."
# Run it through medspa-front-desk/scripts/remote.sh, which refuses when workflows/ or scripts/ have
# uncommitted changes (--force-dirty to override) and sets PUSH_ALL_CHECKED. Without that check whatever
# half-finished file sits in somebody's working tree would replace the live workflow.
[ "${PUSH_ALL_CHECKED:-}" = "1" ] || { echo "push-all.sh: run it via medspa-front-desk/scripts/remote.sh (it checks the working tree is committed first)" >&2; exit 1; }
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
# Not activated here: the tool sub-workflows (called by id) - but test-fixtures IS activated, because the harness
# refuses to run an inactive sub-workflow from a webhook ("Workflow is not active and cannot be executed.").
# WF-6 is activated separately (wf6_flag below) because other workflows cannot reference it until it is.
activate=(wf1-inbound wf4-knowledge-ingest wf5-reminders test-fixtures test-harness)
# No errorWorkflow expected on these:
#  - wf6-error-handler: it would handle its own failure;
#  - notify_owner: it IS the alert channel. With errorWorkflow set, a failing notify_owner fires WF-6, whose
#    Notify node calls notify_owner, which fails again -> an alert loop for as long as the fault lasts
#    (a blank owner_contact loops immediately). The channel cannot be its own alarm;
#  - the test tooling.
no_error_handler=(wf6-error-handler notify_owner test-fixtures test-harness)
# Skipping these for a missing credential is expected (test workflows); skipping any other workflow is a failure.
test_workflows=(test-fixtures test-harness)
skipped_nontest=0

# n8n 2.41.5 refuses settings.errorWorkflow that points at a workflow with no published version
# ("The selected error workflow has no published version."), so WF-6 must be ACTIVATED, not just pushed,
# before any other workflow can reference it. Hence --activate on every push of WF-6.
wf6_flag() { case "$1" in */wf6-error-handler.json) echo --activate ;; esac; }

pushable=()
for f in "${order[@]}"; do
  if [ ! -f "$f" ]; then echo "missing (not built yet): $f"; continue; fi
  missing_cred=$(jq -r --slurpfile m deploy/credentials.map.json '[.. | objects | select(has("credentials")) | .credentials[]?.name | select(. != null) | select($m[0][.] == null)] | unique | join(", ")' "$f")
  if [ -n "$missing_cred" ]; then
    echo "skipped (credential not created: $missing_cred): $f"
    wn=$(jq -r .name "$f"); is_test=0; for x in "${test_workflows[@]}"; do [ "$x" = "$wn" ] && is_test=1; done
    [ "$is_test" -eq 1 ] || skipped_nontest=1
    continue
  fi
  pushable+=("$f")
done
# Names of what was actually pushed: the activate loop below must not touch anything else (a file skipped for a
# missing credential would make n8n-push.sh abort with "unknown credential" before the verification step).
pushable_files=" ${pushable[*]} "

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
  [[ "$pushable_files" == *" workflows/$w.json "* ]] || { echo "skipped (not pushed, see 'skipped' above): workflows/$w.json (not activated)"; continue; }
  scripts/n8n-push.sh "workflows/$w.json" --activate | tail -1
done

echo "--- verify settings.errorWorkflow through the API"
wf6=$(jq -r '.["wf6-error-handler"] // empty' deploy/workflow-ids.json)
[ -n "$wf6" ] || { echo "FAIL: wf6-error-handler has no id in deploy/workflow-ids.json" >&2; exit 1; }
echo "wf6-error-handler id: $wf6"
bad=0
api_get() { curl -sS --fail-with-body -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/workflows/$1"; }
# WF-6 must be ACTIVE: n8n starts an inactive error workflow silently never, so every failure goes unreported.
wf6_active=$(api_get "$wf6" | jq -r '.active')
if [ "$wf6_active" = "true" ]; then echo "OK      wf6-error-handler is ACTIVE"
else echo "INACTIVE wf6-error-handler ($wf6) active=$wf6_active - failures are NOT being reported" >&2; bad=1; fi
for f in "${pushable[@]}"; do
  name=$(jq -r .name "$f")
  id=$(jq -r --arg n "$name" '.[$n]' deploy/workflow-ids.json)
  got=$(api_get "$id" | jq -r '.settings.errorWorkflow // ""')
  if [ "$name" = "notify_owner" ]; then
    # the opposite assertion: notify_owner must NOT have an error workflow (alert loop, see no_error_handler above)
    if [ -z "$got" ]; then echo "OK      notify_owner has no errorWorkflow (alert channel, must not alarm itself)"
    else echo "LOOP RISK notify_owner ($id) carries errorWorkflow=$got" >&2; bad=1; fi
    continue
  fi
  skip=0; for x in "${no_error_handler[@]}"; do [ "$x" = "$name" ] && skip=1; done
  [ "$skip" -eq 1 ] && { echo "exempt  $name (no error handler expected)"; continue; }
  if [ "$got" = "$wf6" ]; then echo "OK      $name ($id) errorWorkflow=$got"
  else echo "MISSING $name ($id) errorWorkflow='$got' expected $wf6" >&2; bad=1; fi
done
[ "$skipped_nontest" -eq 0 ] || { echo "FAIL: a non-test workflow was skipped for a missing credential (see 'skipped' above)" >&2; bad=1; }
[ "$bad" -eq 0 ] || { echo "FAIL: push-all verification failed" >&2; exit 1; }
echo "push-all done"
