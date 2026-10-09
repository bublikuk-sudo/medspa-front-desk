# 2026-10-09 free-Airtable phase 2: tests/wf5-live-consent.sh

Run on the VPS after the push of send_message, wf5-reminders and wf4-knowledge-ingest (commit 0092cf3), started 11:05 UTC, background PID 2333085. Raw output:

```text
rows created
== RUN 1: two consenting clients, one without consent
webhook wf5-reminders -> HTTP 200
execution 25431: success, finished=true, started 2026-10-09T11:06:08.598Z
   send_message           executions   2  airtable calls    8
   wf5-reminders          executions   1  airtable calls    8
   total airtable calls (approx.): 16
PASS A-TEST-REV-YES marked
PASS A-TEST-REV-WA marked
PASS A-TEST-REV-NO NOT marked (no consent)
PASS REVISIT to tg:9000000951
PASS REVISIT to wa:+15550000952
PASS REVISIT to wa:+15550000952 went the template path (medspa_revisit)
PASS nothing to tg:9000000953 (no consent)
PASS A-TEST-REV-NO-OLD NOT marked (no consent)
== RUN 2: nothing new (6 Airtable calls expected: Settings, 4 searches, Consenting Clients)
webhook wf5-reminders -> HTTP 200
execution 25434: success, finished=true, started 2026-10-09T11:06:36.007Z
   wf5-reminders          executions   1  airtable calls    6
   total airtable calls (approx.): 6
PASS still one REVISIT to tg:9000000951
PASS still one REVISIT to wa:+15550000952
PASS still nothing to tg:9000000953
PASS A-TEST-REV-NO still NOT marked
== RUN 3: the clinic ticked C-test-rev-no's consent
webhook wf5-reminders -> HTTP 200
execution 25435: success, finished=true, started 2026-10-09T11:06:56.756Z
   send_message           executions   1  airtable calls    4
   wf5-reminders          executions   1  airtable calls    8
   total airtable calls (approx.): 12
PASS A-TEST-REV-NO marked now
PASS A-TEST-REV-NO-OLD (the older due visit) marked with it, never sent on its own
PASS ONE REVISIT to tg:9000000953 for two due visits (I2: one per client, for the newest)
PASS that REVISIT is built from the NEWEST visit (its next_visit_in 60, not the older one's 30)
PASS still one REVISIT to tg:9000000951
cleanup done
failed checks: 0
```
