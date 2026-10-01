#!/usr/bin/env bash
# Удаляет всё, что создали тесты, и ничего другого: тестовые клиенты имеют client_id с префиксом C-test,
# тестовые события календаря — [TEST] в названии.
set -euo pipefail
cd "$(dirname "$0")/.."
source tests/lib/airtable.sh
at_delete_where Appointments "REGEX_MATCH({client_id}, '^C-test')"
at_delete_where Clients "REGEX_MATCH({client_id}, '^C-test')"
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
