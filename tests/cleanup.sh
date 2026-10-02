#!/usr/bin/env bash
# Удаляет всё, что создали тесты, и ничего другого: тестовые клиенты имеют client_id с префиксом C-test,
# тестовые события календаря — [TEST] в названии.
set -euo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
at_delete_where Appointments "REGEX_MATCH({client_id}, '^C-test')"
at_delete_where Clients "REGEX_MATCH({client_id}, '^C-test')"
# Chat-history rows seeded by the escalate history cases (session ids tg:9000000NN); skipped while the table does not exist.
source tests/lib/pg.sh
pg_sql 'DO $$ BEGIN IF to_regclass($q$public.n8n_chat_histories$q$) IS NOT NULL THEN DELETE FROM n8n_chat_histories WHERE session_id LIKE $q$tg:9000000%$q$; END IF; END $$' > /dev/null || echo "chat-history cleanup FAILED"
# The calendar goes last, after every Airtable deletion, so a failing calendar call cannot leave Airtable
# test rows behind. Unlike the brief it does not run under set -e, so that "cleanup done" is only printed when
# the calendar really was cleaned; a failure is reported and makes the script exit 1. "ok DELETED n" shows how
# many [TEST] events were removed (0 is the normal case).
if out=$(tests/run-case.sh test-fixtures '{"action":"delete_test_events"}' 2>&1) && [[ "$out" == *'"verdict":"DELETED '* ]]; then
  echo "calendar cleanup: ok $(printf '%s' "$out" | jq -r .verdict)"
else
  echo "calendar cleanup: FAILED (test-fixtures not pushed/active, or the call failed): $out" >&2
  exit 1
fi
echo "cleanup done"
