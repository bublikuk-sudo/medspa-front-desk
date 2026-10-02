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
# Чистка календаря не фатальна: до появления воркфлоу test-fixtures (нужен credential MedSpa Google Calendar)
# или при его сбое Airtable-часть всё равно должна отработать. Отличие от брифа: вызов намеренно не фатален
# (бриф вызывает его под set -e). Итог чистки календаря виден в строке "calendar cleanup" ниже; после загрузки
# фикстур эта строка должна быть "ok".
if tests/run-case.sh test-fixtures '{"action":"delete_test_events"}' > /dev/null 2>&1; then
  echo "calendar cleanup: ok"
else
  echo "calendar cleanup: SKIPPED or FAILED (test-fixtures not pushed, or the call failed)"
fi
echo "cleanup done"
