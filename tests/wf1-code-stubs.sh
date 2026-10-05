#!/usr/bin/env bash
# Stub test of the WF-1 Code nodes Normalize (with the Task 20 Test Inbound unwrapping) and Client Formula, the Create Client id expressions and the wiring of the
# Normalize side branch (Has Sender?, Dropped?, Notify Dropped).
# Runs ON THE VPS, in the n8n container's Node: no network, no workflow run, nothing is written.
#   scripts/remote.sh 'tests/wf1-code-stubs.sh'
# Optional first argument: another workflow file (default /opt/medspa/workflows/wf1-inbound.json).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
wf="${1:-/opt/medspa/workflows/wf1-inbound.json}"
{
  printf 'const CODE = '
  jq -c '
    def node($n): (first(.nodes[] | select(.name==$n)) // {});
    def target($n): ([.connections[$n].main[0][]?.node][0]) // "none";
    {
      normalize: (node("Normalize") | .parameters.jsCode),
      formula: (node("Client Formula") | .parameters.jsCode),
      phoneExpr: (node("Create Client") | .parameters.columns.value.phone),
      chatExpr: (node("Create Client") | .parameters.columns.value.telegram_chat_id),
      hasSenderExpr: (node("Has Sender?") | .parameters.conditions.conditions[0].leftValue),
      droppedExpr: (node("Dropped?") | .parameters.conditions.conditions[0].leftValue),
      notifyTextExpr: (node("Notify Dropped") | .parameters.workflowInputs.value.text),
      normalizeTargets: [.connections["Normalize"].main[0][]?.node],
      hasSenderTarget: target("Has Sender?"),
      droppedTarget: target("Dropped?"),
      afterNotify: (if (.connections["Notify Dropped"] // null) == null then "none" else "wired" end),
      testInbound: (node("Test Inbound") | {method: .parameters.httpMethod, path: .parameters.path, auth: .parameters.authentication, mode: .parameters.responseMode, cred: .credentials.httpHeaderAuth.name}),
      testTarget: target("Test Inbound")
    }' "$wf"
  printf ';\n'
  cat "$here/wf1-code-stubs.js"
} | (cd /opt/medspa/deploy && docker compose exec -T n8n node -)
