# 2026-10-09 free-Airtable phase 2: tests/wf5-live.sh run (live reminder check)

First live check of the Due Reminders formula (SET_TIMEZONE / DATETIME_FORMAT, local date in Settings.timezone): booked visits seeded for TOMORROW 11:00 Berlin (2026-10-10T09:00Z) at reminder_hours_before = 1, restored to 24 by the trap. Started 11:10 UTC, background PID 2335525; rows removed afterwards with `tests/wf5-live.sh clean`. Raw output:

```text
original reminder_hours_before=24
rows created; A-TEST-REM starts 2026-10-10T09:00:00.000Z
rows due at 11:10:12
== RUN 1
webhook wf5-reminders -> HTTP 200
execution 25437: success, finished=true, started 2026-10-09T11:10:13.293Z
A-TEST-REM: {"status":"reminded","reminder_sent_at":"2026-10-09T11:10:27.008Z","revisit_invited_at":null,"calendar_event_id":null}
A-TEST-PEND: {"status":"cancelled","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
A-TEST-ORPH: {"status":"pending","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":"appttestorphan"}
A-TEST-DONE90: {"status":"done","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
A-TEST-NOCONTACT: {"status":"booked","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
A-TEST-NOLINK: {"status":"booked","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
-- send_message since 2026-10-09T11:10:12.000Z (template, appt, ok?):
REMINDER	A-TEST-REM	success
REMINDER	A-TEST-NOCONTACT	error
-- notify_owner since 2026-10-09T11:10:12.000Z (the owner messages):
⚠️ 1 expired pending booking(s) still have a calendar event, so WF-5 did not cancel them: A-TEST-ORPH. Check the calendar and fix the rows by hand.
❌ WF-5 skipped the reminder of A-TEST-NOLINK: its client record (no link) could not be read (The resource you are requesting could not be found)
❌ Reminder failed for A-TEST-NOCONTACT: send_message: template REMINDER needs "service" but it is empty (contact_id=, appt_id=A-TEST-NOCONTACT) [line 29]
⚠️ send_message failed at Render: send_message: template REMINDER needs "service" but it is empty (contact_id=, appt_id=A-TEST-NOCONTACT) [line 29]
execution: https://<n8n-host>/workflow/kbDqztgeR3GX6WDI/executions/25438
== RUN 2 (must send nothing and alert nothing: delivered rows are marked, the failures are deduplicated)
webhook wf5-reminders -> HTTP 200
execution 25445: success, finished=true, started 2026-10-09T11:10:41.673Z
A-TEST-REM: {"status":"reminded","reminder_sent_at":"2026-10-09T11:10:27.008Z","revisit_invited_at":null,"calendar_event_id":null}
A-TEST-PEND: {"status":"cancelled","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
A-TEST-ORPH: {"status":"pending","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":"appttestorphan"}
A-TEST-DONE90: {"status":"done","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
A-TEST-NOCONTACT: {"status":"booked","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
A-TEST-NOLINK: {"status":"booked","reminder_sent_at":null,"revisit_invited_at":null,"calendar_event_id":null}
-- send_message since 2026-10-09T11:10:41.000Z (template, appt, ok?):
REMINDER	A-TEST-NOCONTACT	error
-- notify_owner since 2026-10-09T11:10:41.000Z (the owner messages):
== done (Settings restored by the trap)
restored reminder_hours_before=24
```
