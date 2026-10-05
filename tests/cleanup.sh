#!/usr/bin/env bash
# usage: tests/cleanup.sh [--no-calendar]
# Удаляет всё, что создали тесты, и ничего другого: тестовые клиенты имеют client_id с префиксом C-test,
# тестовые события календаря — [TEST] в названии. Task 20 dialog clients are found by their test contact
# (telegram_chat_id 9000000NNN / phone +1555000NNNN) and go with their Appointments, events, chat memory,
# test_outbox and wf1_rate_limit rows.
# --no-calendar skips ONLY the [TEST] sweep of the calendar: teardowns of cases that never touch the calendar
# (find_client_*, escalate_*, kb_*, propose_*) use it so they do not depend on Google being up. Calendar/fixtures
# and confirm_* cases use the full cleanup.
# Booking events are different: confirm_booking titles them "<service> — <client name>", which the [TEST] sweep
# deliberately never deletes. They are deleted BY ID, and only by the ids stored in calendar_event_id of Appointments
# rows whose client_id starts with C-test, so a real booking cannot be reached. That step runs even with
# --no-calendar whenever such ids exist (normally only after a confirm_* case), because deleting the rows first
# would lose the ids and leave the events in the owner's calendar for good.
set -euo pipefail
cd "$(dirname "$0")/.."
no_calendar=0
case "${1:-}" in
  "") ;;
  --no-calendar) no_calendar=1 ;;
  *) echo "usage: tests/cleanup.sh [--no-calendar]" >&2; exit 2 ;;
esac
source tests/lib/airtable.sh
# Every step after the first read runs even if an earlier one failed (one broken service must not leave the other's
# test data behind); any failure makes the script exit 1 at the end, and "cleanup done" is printed only when all
# steps worked.
rc=0
test_appts="REGEX_MATCH({client_id}, '^C-test')"
# Dialog clients (Task 20, tests/dialog.sh): WF-1 creates them itself with an ordinary client_id (C-<base36>), so they are
# found by contact instead - telegram_chat_id 9000000NNN or phone +1555000NNNN, the only contacts the test inbound accepts.
# Their Appointments join the C-test ones below (events by id, then rows).
dialog_clients='OR(REGEX_MATCH({telegram_chat_id}, "^9000000[0-9]{3}$"), REGEX_MATCH({phone}, "^[+]1555000[0-9]{4}$"))'
dialog_ids=$(at_list Clients "$dialog_clients" | jq -r --arg q "'" '[.records[].fields.client_id // empty | select(test("^C-[A-Za-z0-9-]+$")) | "{client_id}=" + $q + . + $q] | join(",")')
[ -z "$dialog_ids" ] || test_appts="OR($test_appts, $dialog_ids)"
events_ok=1
event_ids=$(at_list Appointments "AND($test_appts, {calendar_event_id} != '')" | jq -r '[.records[].fields.calendar_event_id | select(type == "string" and length > 0)] | unique | join(",")')
if [ -n "$event_ids" ]; then
  # "DELETED n of m" with n < m is a failure too: an event that is already gone or is not a booking event (test-fixtures
  # deletes only events whose description is an appt_id) means something else touched it; keep the rows and look.
  if out=$(tests/run-case.sh test-fixtures "$(jq -nc --arg ids "$event_ids" '{action: "delete_events_by_id", event_ids: $ids}')" 2>&1) && verdict=$(printf '%s' "$out" | jq -er '.verdict | select(type == "string" and (capture("^DELETED (?<n>[0-9]+) of (?<m>[0-9]+)$") | .n == .m))'); then
    echo "booking events: ok $verdict"
    at_delete_where Appointments "$test_appts"
  else
    # Keep the rows that carry an event id, so the next cleanup can still find those events.
    echo "booking events: FAILED, Appointments rows with a calendar_event_id kept for the next cleanup: $out" >&2
    rc=1; events_ok=0
    at_delete_where Appointments "AND($test_appts, {calendar_event_id} = '')"
  fi
else
  at_delete_where Appointments "$test_appts"
fi
at_delete_where Clients "REGEX_MATCH({client_id}, '^C-test')"
# A dialog client is the only link from its kept Appointments rows to the test ranges, so it stays while those rows do.
if [ "$events_ok" -eq 1 ]; then at_delete_where Clients "$dialog_clients"; fi
# Postgres, test contacts only: chat history (the escalate history cases' tg:9000000NN and the dialogs' sessions = their
# contact ids), the dialogs' captured outbound messages (test_outbox) and their rate-limit rows. Each table is skipped while
# it does not exist.
source tests/lib/pg.sh
if ! pg_sql 'DO $$ BEGIN
  IF to_regclass($q$public.n8n_chat_histories$q$) IS NOT NULL THEN DELETE FROM n8n_chat_histories WHERE session_id LIKE $q$tg:9000000%$q$ OR session_id LIKE $q$wa:+1555000%$q$; END IF;
  IF to_regclass($q$public.test_outbox$q$) IS NOT NULL THEN DELETE FROM test_outbox WHERE contact_id LIKE $q$tg:9000000%$q$ OR contact_id LIKE $q$wa:+1555000%$q$; END IF;
  IF to_regclass($q$public.wf1_rate_limit$q$) IS NOT NULL THEN DELETE FROM wf1_rate_limit WHERE contact_id LIKE $q$tg:9000000%$q$ OR contact_id LIKE $q$wa:+1555000%$q$; END IF;
END $$' > /dev/null; then
  echo "postgres cleanup (chat history, test_outbox, wf1_rate_limit): FAILED" >&2
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
