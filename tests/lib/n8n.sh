# source tests/lib/n8n.sh  (cwd = /opt/medspa; sourced by tests/tool-cases.sh)
# Reads what a tool did from the n8n execution list, for cases that must assert on more than the verdict.

# last_compose <workflow name>: the owner message the NEWEST execution of that workflow composed
last_compose() {
  local id
  id=$(jq -r --arg n "$1" '.[$n] // error("no workflow " + $n)' deploy/workflow-ids.json) || return 1
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "https://$N8N_HOST/api/v1/executions?workflowId=$id&limit=1&includeData=true" |
    jq -r '.data[0].data.resultData.runData.Compose[0].data.main[0][0].json.text'
}
