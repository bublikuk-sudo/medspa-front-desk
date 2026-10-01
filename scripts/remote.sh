#!/usr/bin/env bash
# usage: medspa-front-desk/scripts/remote.sh '<команда на VPS, cwd=/opt/medspa>'
# Копирует рабочие папки проекта на VPS и выполняет команду там.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
scp -rq "$here"/workflows "$here"/scripts "$here"/tests "$here"/airtable "$here"/templates "$here"/prompts medspa:/opt/medspa/
scp -q "$here"/deploy/docker-compose.yml "$here"/deploy/Caddyfile "$here"/deploy/postgres-init.sql medspa:/opt/medspa/deploy/
ssh medspa "cd /opt/medspa && chmod +x scripts/*.sh tests/*.sh 2>/dev/null; $*"
