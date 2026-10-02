#!/usr/bin/env bash
# usage: tests/cleanup.sh [--no-calendar]
# Удаляет всё, что создали тесты, и ничего другого: тестовые клиенты имеют client_id с префиксом C-test,
# тестовые события календаря — [TEST] в названии.
# --no-calendar skips ONLY the calendar step: teardowns of cases that never touch the calendar (find_client_*,
# escalate_*, kb_*) use it so they do not depend on Google being up. Calendar/fixtures cases use the full cleanup.
set -euo pipefail
cd "$(dirname "$0")/.."
no_calendar=0
case "${1:-}" in
  "") ;;
  --no-calendar) no_calendar=1 ;;
  *) echo "usage: tests/cleanup.sh [--no-calendar]" >&2; exit 2 ;;
esac
source tests/lib/airtable.sh
at_delete_where Appointments "REGEX_MATCH({client_id}, '^C-test')"
at_delete_where Clients "REGEX_MATCH({client_id}, '^C-test')"
# Every remaining step runs even if an earlier one failed (one broken service must not leave the other's test data
# behind); any failure makes the script exit 1 at the end, and "cleanup done" is printed only when all steps worked.
rc=0
# Chat-history rows seeded by the escalate history cases (session ids tg:9000000NN); skipped while the table does not exist.
source tests/lib/pg.sh
if ! pg_sql 'DO $$ BEGIN IF to_regclass($q$public.n8n_chat_histories$q$) IS NOT NULL THEN DELETE FROM n8n_chat_histories WHERE session_id LIKE $q$tg:9000000%$q$; END IF; END $$' > /dev/null; then
  echo "chat-history cleanup: FAILED" >&2
  rc=1
fi
# The calendar goes last. Unlike the brief it does not run under set -e. "ok DELETED n" shows how many [TEST]
# events were removed (0 is the normal case).
if [ "$no_calendar" -eq 0 ]; then
  if out=$(tests/run-case.sh test-fixtures '{"action":"delete_test_events"}' 2>&1) && verdict=$(printf '%s' "$out" | jq -er '.verdict | select(type == "string" and startswith("DELETED "))'); then
    echo "calendar cleanup: ok $verdict"
  else
    echo "calendar cleanup: FAILED (test-fixtures not pushed/active, or the call failed): $out" >&2
    rc=1
  fi
fi
[ "$rc" -eq 0 ] || exit 1
echo "cleanup done"
