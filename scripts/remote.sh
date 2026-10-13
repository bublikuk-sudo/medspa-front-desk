#!/usr/bin/env bash
# usage: scripts/remote.sh [--force-dirty] '<команда на VPS, cwd=/opt/medspa>'
# Копирует рабочие папки проекта на VPS и выполняет команду там.
#
# Guard for scripts/push-all.sh: remote.sh copies the WHOLE working tree, so an unfinished workflow file
# in somebody's editor would replace the live workflow the moment anyone runs push-all. The VPS has no git
# checkout, so the check has to be here: when the command contains push-all.sh and `git status --porcelain`
# of workflows/ and scripts/ is not empty, abort and name the dirty files. --force-dirty is the deliberate
# escape hatch. On success remote.sh sets PUSH_ALL_CHECKED=1 for the remote command; push-all.sh refuses
# to run without it, so ssh-ing in and running push-all directly does not bypass the check.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
force=0
if [ "${1:-}" = "--force-dirty" ]; then force=1; shift; fi
pre=""
if [[ "$*" == *push-all.sh* ]]; then
  dirty=$(git -C "$here" status --porcelain -- workflows scripts 2>/dev/null || true)
  if [ -n "$dirty" ] && [ "$force" -eq 0 ]; then
    echo "remote.sh: refusing to run push-all.sh, uncommitted changes would go live:" >&2
    printf '%s\n' "$dirty" >&2
    echo "Commit or stash them, or pass --force-dirty to push them deliberately." >&2
    exit 1
  fi
  [ -z "$dirty" ] || echo "remote.sh: --force-dirty, pushing uncommitted changes:" >&2
  [ -z "$dirty" ] || printf '%s\n' "$dirty" >&2
  pre="export PUSH_ALL_CHECKED=1; "
fi
scp -rq "$here"/workflows "$here"/scripts "$here"/tests "$here"/airtable "$here"/templates "$here"/prompts medspa:/opt/medspa/
scp -q "$here"/deploy/docker-compose.yml "$here"/deploy/Caddyfile "$here"/deploy/postgres-init.sql medspa:/opt/medspa/deploy/
ssh medspa "cd /opt/medspa && chmod +x scripts/*.sh tests/*.sh 2>/dev/null; $pre$*"
