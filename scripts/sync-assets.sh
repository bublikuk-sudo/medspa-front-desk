#!/usr/bin/env bash
# usage: scripts/sync-assets.sh   (cwd любой) — переносит templates/messages.en.json и prompts/agent-system-prompt.md в JSON воркфлоу
# Нужен jq (на Windows-машине разработчика его нет — запускать на VPS: remote.sh 'scripts/sync-assets.sh').
set -euo pipefail
cd "$(dirname "$0")/.."
t=$(jq -c . templates/messages.en.json)
f=workflows/shared/send_message.json
jq --arg t "$t" '(.nodes[] | select(.name=="Render") | .parameters.jsCode) |= sub("/\\*TEMPLATES\\*/.*/\\*END\\*/"; "/*TEMPLATES*/ const T = " + $t + "; /*END*/")' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
# sub() молча ничего не меняет, если маркеров нет — проверяем, что шаблоны действительно внутри.
jq -e --arg t "$t" '.nodes[] | select(.name=="Render") | .parameters.jsCode | contains("/*TEMPLATES*/ const T = " + $t + "; /*END*/")' "$f" > /dev/null \
  || { echo "ERROR: templates were not embedded into $f (markers missing?)" >&2; exit 1; }
echo "templates -> $f"
if [ -f workflows/wf2-agent.json ] && [ -f prompts/agent-system-prompt.md ]; then
  p=$(cat prompts/agent-system-prompt.md)
  f=workflows/wf2-agent.json
  jq --arg p "$p" '(.nodes[] | select(.name=="Agent") | .parameters.options.systemMessage) = ("=" + $p)' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  echo "prompt -> $f"
fi
