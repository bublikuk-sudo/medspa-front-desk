# Task 20 level 2, run 2 (repeat after the credit top-up and spend-limit raise): 12 dialogs

| | |
|---|---|
| Started | 2026-10-10T15:45:37Z |
| Finished | 2026-10-10T16:38:27Z |
| Dialogs | 01 02 03 04 05 06 07 08 12 11 10 09 |
| Result | passed 22, failed 0 |
| Final cleanup | ok: cleanup done |

- Final configuration at commit 20205e8, unchanged since run 1 (2026-10-09). Dialog 05 amended by the 2026-10-10 ruling (step 2 may be reply or ESCALATED_REPLY). Started 2026-10-10 outside 06:30-07:25 UTC.
- Dialog 09: the 10-minute recovery is checked by clearing that test contact rows in wf1_rate_limit in teardown.

| dialog | channel | result | state | notes |
|---|---|---|---|---|
| 01-new-client-books | tg | PASS | client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED |  |
| 01-new-client-books | wa | PASS | client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED |  |
| 02-returning-same-as-last-time | tg | PASS | client=active/en appts=done,pending events=0 sent=reply,PENDING_SUMMARY |  |
| 02-returning-same-as-last-time | wa | PASS | client=active/en appts=done,pending events=0 sent=reply,PENDING_SUMMARY |  |
| 03-reschedule | tg | PASS | client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,BOOKED |  |
| 03-reschedule | wa | PASS | client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,BOOKED |  |
| 04-late-cancel | tg | PASS | client=flagged/en appts=late_cancel events=0 sent=LATE_CANCEL_PENDING,LATE_CANCEL,reply |  |
| 04-late-cancel | wa | PASS | client=flagged/en appts=late_cancel events=0 sent=LATE_CANCEL_PENDING,LATE_CANCEL,reply |  |
| 05-cancel-not-yours | tg | PASS | client=escalated/en appts=- events=0 sent=reply,ESCALATED_REPLY | second: client=active/en appts=booked events=0 sent= |  |
| 05-cancel-not-yours | wa | PASS | client=active/en appts=- events=0 sent=reply,reply | second: client=active/en appts=booked events=0 sent= |  |
| 06-knowledge-in-base | tg | PASS | client=new/en appts=- events=0 sent=reply,reply |  |
| 06-knowledge-in-base | wa | PASS | client=new/en appts=- events=0 sent=reply,reply |  |
| 07-medical-out-of-base | tg | PASS | client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply |  |
| 07-medical-out-of-base | wa | PASS | client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply |  |
| 08-talk-to-human | tg | PASS | client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply |  |
| 08-talk-to-human | wa | PASS | client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply |  |
| 12-russian-client | tg | PASS | client=active/ru appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE |  |
| 12-russian-client | wa | PASS | client=active/ru appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE |  |
| 11-spanish-client | tg | PASS | client=active/es appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE |  |
| 11-spanish-client | wa | PASS | client=active/es appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE |  |
| 10-two-clients-one-slot | tg | PASS | client=active/en appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE | second: client=new/en appts=cancelled events=0 sent=reply,reply,reply,PENDING_SUMMARY,SLOT_TAKEN |  |
| 09-spam | tg | PASS | client=escalated/en appts=- events=0 sent=reply,reply,reply,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,RATE_LIMIT,ESCALATED_HOLD |  |

## Raw output

### 01-new-client-books, tg

```text
DIALOG 01-new-client-books.md channel=tg contact=tg:9000000101 started 2026-10-10T15:45:41.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 27413 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox appointment started?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 27417 success; route agent; tools []
  <- reply: Thanks, Dana! What day would you like to come in, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 27420 success; route agent; tools ["check_availability"]
  <- reply: That date is open. I can offer Mon, Jan 7, 2030 at 10:00 AM, 10:30 AM, 11:00 AM or 11:30 AM — which works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 27424 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   regex: free cancellation up to 24 hours before\. reply yes to confirm
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 27432 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 hours before your visit.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   regex: we.ll send you a reminder the day before\. to change or cancel, just message me here — cancellation is free up to 24 hours before your visit
  ok   no-regex: remind you \d+ hours before
  ok   node: Confirm
  ok   no-node: Agent
  ok   state: [.appts[].status] == ["booked"] and (.events | length) == 1
STEP 6 run: reminder_leg
  reminder_leg: waiting for minute 10-44 (the hourly WF-5 run is at :05), now :47
  reminder_leg: reminder_hours_before 24 -> 1
  reminder_leg: A-MV2KH92RHMS moved to 2026-10-11 11:00 Europe/Berlin (tomorrow)
  webhook wf5-reminders -> HTTP 200
  execution 27445: success, finished=true, started 2026-10-10T16:10:12.572Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER: Reminder: Botox — Sun, Oct 11, 11:00 AM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   tg.wa_template: none
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 27451 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Sun, Oct 11, 11:00 AM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2KG7QH","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MV2KH92RHMS botox 2026-10-11T09:00:00.000Z confirmed event=appt412d4d56324b48393252484d53 reminder_sent_at=2026-10-10T16:10:16.503Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MV2KH92RHMS
  OWNER: ✅ New booking: Dana Testova (tg:9000000101) — Botox — Mon, Jan 7, 10:00 AM — A-MV2KH92RHMS
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: .client.language == "en"
  ok   state: (.client.name // "") | test("Dana"; "i")
  ok   state: [.appts[].status] == ["confirmed"]
  ok   state: (.appts[0].reminder_sent_at // "") != ""
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
  ok   state: [.outbox[].template_key] | index("BOOKED_INTAKE") != null and index("REMINDER") != null
SUMMARY: client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED
RESULT PASS 01-new-client-books.md tg
```

### 01-new-client-books, wa

```text
DIALOG 01-new-client-books.md channel=wa contact=wa:+15550000101 started 2026-10-10T16:10:47.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 27466 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 27470 success; route agent; tools []
  <- reply: Thanks, Dana! Which day would you like to come in for your Botox?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 27473 success; route agent; tools ["check_availability"]
  <- reply: Here's what's open that morning: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which time works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 27477 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   regex: free cancellation up to 24 hours before\. reply yes to confirm
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 27485 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 hours before your visit.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   regex: we.ll send you a reminder the day before\. to change or cancel, just message me here — cancellation is free up to 24 hours before your visit
  ok   no-regex: remind you \d+ hours before
  ok   node: Confirm
  ok   no-node: Agent
  ok   state: [.appts[].status] == ["booked"] and (.events | length) == 1
STEP 6 run: reminder_leg
  reminder_leg: reminder_hours_before 24 -> 1
  reminder_leg: A-MV2LDIURESK moved to 2026-10-11 11:00 Europe/Berlin (tomorrow)
  webhook wf5-reminders -> HTTP 200
  execution 27498: success, finished=true, started 2026-10-10T16:12:14.389Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER [wa template medspa_reminder|en]: Reminder: Botox — Sun, Oct 11, 11:00 AM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   wa.wa_template: medspa_reminder
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 27504 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Sun, Oct 11, 11:00 AM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2LCHT9","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MV2LDIURESK botox 2026-10-11T09:00:00.000Z confirmed event=appt412d4d56324c4449555245534b reminder_sent_at=2026-10-10T16:12:18.332Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MV2LDIURESK
  OWNER: ✅ New booking: Dana Testova (wa:+15550000101) — Botox — Mon, Jan 7, 10:00 AM — A-MV2LDIURESK
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: .client.language == "en"
  ok   state: (.client.name // "") | test("Dana"; "i")
  ok   state: [.appts[].status] == ["confirmed"]
  ok   state: (.appts[0].reminder_sent_at // "") != ""
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
  ok   state: [.outbox[].template_key] | index("BOOKED_INTAKE") != null and index("REMINDER") != null
SUMMARY: client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED
RESULT PASS 01-new-client-books.md wa
```

### 02-returning-same-as-last-time, tg

```text
DIALOG 02-returning-same-as-last-time.md channel=tg contact=tg:9000000102 started 2026-10-10T16:12:47.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
SETUP: NW_TZ=$(at_list Settings 1 | jq -er '.records[0].fields.timezone') && NW_TODAY=$(TZ="$NW_TZ" date +%F) && NW_TUE=$(date -d "$NW_TODAY + $((9 - $(date -d "$NW_TODAY" +%u))) days" +%F) && printf '  weekday check: Tuesday of next week = %s (today %s in %s)\n' "$NW_TUE" "$NW_TODAY" "$NW_TZ" >&2
  weekday check: Tuesday of next week = 2026-10-13 (today 2026-10-10 in Europe/Berlin)
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 27519 success; route agent; tools ["find_client","check_availability"]
  <- reply: Welcome back, Rita! For a HydraFacial next Tuesday morning I have: Tue, Oct 13, 2026 at 10:00 AM Tue, Oct 13, 2026 at 10:30 AM Tue, Oct 13, 2026 at 11:00 AM Which one works for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: find_client
  ok   tool: check_availability
  ok   regex: hydra ?facial
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   sh: [ -n "$NW_TUE" ] && jq -e --arg r "\\b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\\.?,? ($(date -d "$NW_TUE" +%b)|$(date -d "$NW_TUE" +%B))\\.? $(date -d "$NW_TUE" +%-d)\\b" '[.[].text] | join("\n") | test($r; "i") | not' "$TMP/rows.json"
  ok   no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
STEP 2 send: The first one, please.
  exec 27524 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: HydraFacial (60 min) — Tue, Oct 13, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: HydraFacial
  ok   tool: propose_booking
STATE
  CLIENT: {"client_id":"C-test-D9000000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  APPT: A-MV2LFROINXU hydrafacial 2026-10-13T10:00:00+02:00 pending event=- reminder_sent_at=-
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[] | select(.status == "pending") | .service_id] == ["hydrafacial"]
  ok   state: [.appts[] | select(.status == "done") | .appt_id] == ["A-TEST-D02DONE"]
  ok   state: (.appts | length) == 2
  ok   state: .client.name == "Rita Returntest"
  ok   state: (.owner | length) == 0
SUMMARY: client=active/en appts=done,pending events=0 sent=reply,PENDING_SUMMARY
RESULT PASS 02-returning-same-as-last-time.md tg
```

### 02-returning-same-as-last-time, wa

```text
DIALOG 02-returning-same-as-last-time.md channel=wa contact=wa:+15550000102 started 2026-10-10T16:13:43.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
SETUP: NW_TZ=$(at_list Settings 1 | jq -er '.records[0].fields.timezone') && NW_TODAY=$(TZ="$NW_TZ" date +%F) && NW_TUE=$(date -d "$NW_TODAY + $((9 - $(date -d "$NW_TODAY" +%u))) days" +%F) && printf '  weekday check: Tuesday of next week = %s (today %s in %s)\n' "$NW_TUE" "$NW_TODAY" "$NW_TZ" >&2
  weekday check: Tuesday of next week = 2026-10-13 (today 2026-10-10 in Europe/Berlin)
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 27539 success; route agent; tools ["find_client","check_availability"]
  <- reply: Welcome back, Rita! For a HydraFacial on Tue, Oct 13 I have: Tue, Oct 13 at 10:00 AM Tue, Oct 13 at 10:30 AM Tue, Oct 13 at 11:00 AM Which one works for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: find_client
  ok   tool: check_availability
  ok   regex: hydra ?facial
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   sh: [ -n "$NW_TUE" ] && jq -e --arg r "\\b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\\.?,? ($(date -d "$NW_TUE" +%b)|$(date -d "$NW_TUE" +%B))\\.? $(date -d "$NW_TUE" +%-d)\\b" '[.[].text] | join("\n") | test($r; "i") | not' "$TMP/rows.json"
  ok   no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
STEP 2 send: The first one, please.
  exec 27544 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: HydraFacial (60 min) — Tue, Oct 13, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: HydraFacial
  ok   tool: propose_booking
STATE
  CLIENT: {"client_id":"C-test-D15550000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  APPT: A-MV2LGV2EIUZ hydrafacial 2026-10-13T10:00:00+02:00 pending event=- reminder_sent_at=-
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[] | select(.status == "pending") | .service_id] == ["hydrafacial"]
  ok   state: [.appts[] | select(.status == "done") | .appt_id] == ["A-TEST-D02DONE"]
  ok   state: (.appts | length) == 2
  ok   state: .client.name == "Rita Returntest"
  ok   state: (.owner | length) == 0
SUMMARY: client=active/en appts=done,pending events=0 sent=reply,PENDING_SUMMARY
RESULT PASS 02-returning-same-as-last-time.md wa
```

### 03-reschedule, tg

```text
DIALOG 03-reschedule.md channel=tg contact=tg:9000000103 started 2026-10-10T16:14:32.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 27564 success; route agent; tools ["find_client","check_availability"]
  <- reply: Hi Paul! Here are afternoon openings for your Botox on Mon, Jan 7, 2030: 1:00 PM 1:30 PM 2:00 PM 3:00 PM Which one would you like?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 2 send: The first one, please.
  exec 27569 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 1:00 PM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] | sort == ["booked", "pending"]
  ok   state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
STEP 3 send: YES
  exec 27582 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 1:00 PM. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 hours before your visit.
  ok   templates: BOOKED
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D9000000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV2LHDDYRP0 botox 2030-01-07T12:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MV2LI7AI4YN botox 2030-01-07T13:00:00+01:00 booked event=appt412d4d56324c4937414934594e reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T13:00:00+01:00 A-MV2LI7AI4YN
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 12:00 PM — A-MV2LHDDYRP0
  OWNER: 🔁 Rescheduled, old visit cancelled: Paul Movetest (tg:9000000103) — botox — Mon, Jan 7, 12:00 PM — A-MV2LHDDYRP0
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 1:00 PM — A-MV2LI7AI4YN — replaces A-MV2LHDDYRP0
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] | sort == ["booked", "cancelled"]
  ok   state: [.appts[] | select(.status == "cancelled") | .start_iso] == ["2030-01-07T12:00:00+01:00"]
  ok   state: [.appts[] | select(.status == "booked") | .start_iso] | length == 1 and (.[0] | startswith("2030-01-07T") and (.[11:13] | tonumber) >= 12 and . != "2030-01-07T12:00:00+01:00")
  ok   state: (.events | length) == 1 and .events[0].description == ([.appts[] | select(.status == "booked") | .appt_id] | .[0])
  ok   state: .events[0].summary == "Botox — Paul Movetest"
  ok   state: .client.status == "active"
SUMMARY: client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,BOOKED
RESULT PASS 03-reschedule.md tg
```

### 03-reschedule, wa

```text
DIALOG 03-reschedule.md channel=wa contact=wa:+15550000103 started 2026-10-10T16:16:00.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 27605 success; route agent; tools ["find_client","check_availability"]
  <- reply: Here are afternoon openings for your Botox on Mon, Jan 7, 2030: 12:30 PM 1:00 PM 2:00 PM 3:00 PM Which one works for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 2 send: The first one, please.
  exec 27610 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 12:30 PM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] | sort == ["booked", "pending"]
  ok   state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
STEP 3 send: YES
  exec 27623 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 12:30 PM. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 hours before your visit.
  ok   templates: BOOKED
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D15550000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV2LJ9BFT90 botox 2030-01-07T12:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MV2LK6J8DP3 botox 2030-01-07T12:30:00+01:00 booked event=appt412d4d56324c4b364a38445033 reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T12:30:00+01:00 A-MV2LK6J8DP3
  OWNER: ✅ New booking: Paul Movetest (wa:+15550000103) — Botox — Mon, Jan 7, 12:00 PM — A-MV2LJ9BFT90
  OWNER: 🔁 Rescheduled, old visit cancelled: Paul Movetest (wa:+15550000103) — botox — Mon, Jan 7, 12:00 PM — A-MV2LJ9BFT90
  OWNER: ✅ New booking: Paul Movetest (wa:+15550000103) — Botox — Mon, Jan 7, 12:30 PM — A-MV2LK6J8DP3 — replaces A-MV2LJ9BFT90
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] | sort == ["booked", "cancelled"]
  ok   state: [.appts[] | select(.status == "cancelled") | .start_iso] == ["2030-01-07T12:00:00+01:00"]
  ok   state: [.appts[] | select(.status == "booked") | .start_iso] | length == 1 and (.[0] | startswith("2030-01-07T") and (.[11:13] | tonumber) >= 12 and . != "2030-01-07T12:00:00+01:00")
  ok   state: (.events | length) == 1 and .events[0].description == ([.appts[] | select(.status == "booked") | .appt_id] | .[0])
  ok   state: .events[0].summary == "Botox — Paul Movetest"
  ok   state: .client.status == "active"
SUMMARY: client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,BOOKED
RESULT PASS 03-reschedule.md wa
```

### 04-late-cancel, tg

```text
DIALOG 04-late-cancel.md channel=tg contact=tg:9000000104 started 2026-10-10T16:17:32.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 27646 success; route agent; tools ["find_client","request_cancel"]
  <- LATE_CANCEL_PENDING: Cancel your Botox on Sat, Oct 10, 9:30 PM? This is less than 24 hours before your visit, so it will be recorded as a late cancellation. Reply YES to cancel.
  ok   templates: LATE_CANCEL_PENDING
  ok   lang: en
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: less than 24 hours
  ok   regex: late cancellation
  ok   regex: reply yes to cancel
  ok   state: [.appts[].status] == ["confirmed"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
  ok   state: [.owner[] | select(test("cancel"; "i"))] | length == 0
STEP 2 send: Yes, please cancel it.
  exec 27667 success; route llm; tools []
  <- LATE_CANCEL: Your Botox on Sat, Oct 10, 9:30 PM has been cancelled. It was less than 24 hours before the visit, so it is recorded as a late cancellation. Message me any time to book again.
  ok   templates: LATE_CANCEL
  ok   lang: en
  ok   node: LLM Affirmative
  ok   node: Cancel Visit
  ok   no-node: Agent
  ok   regex: has been cancelled
  ok   regex: \b24 hours\b
  ok   state: [.appts[].status] == ["late_cancel"]
  ok   state: .client.status == "flagged"
  ok   state: (.events | length) == 0
  ok   state: (.client.cancel_ask_appt_id // "") == ""
  ok   owner: LATE cancellation
STEP 3 send: What is your cancellation policy?
  exec 27687 success; route agent; tools ["search_knowledge","find_client"]
  <- reply: You can reschedule or cancel free of charge up to 24 hours before your appointment. Cancellations less than 24 hours ahead, and no-shows, are recorded and may require a deposit for future bookings. Since your appointment is today, this one 
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \b24\b
STATE
  CLIENT: {"client_id":"C-test-D9000000104","name":"Carl Latetest","language":"en","status":"flagged","intake_completed":null}
  APPT: A-MV2LL7YR2LQ botox 2026-10-10T21:30:00+02:00 late_cancel event=- reminder_sent_at=-
  OWNER: ✅ New booking: Carl Latetest (tg:9000000104) — Botox — Sat, Oct 10, 9:30 PM — A-MV2LL7YR2LQ
  OWNER: ⚠️ LATE cancellation: Carl Latetest (tg:9000000104) — botox — Sat, Oct 10, 9:30 PM — A-MV2LL7YR2LQ — client flagged
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] == ["late_cancel"]
  ok   state: .client.status == "flagged"
  ok   state: (.events | length) == 0
  ok   state: [.owner[] | select(test("LATE cancellation"))] | length == 1
  ok   state: [.outbox[] | .template_key] | index("LATE_CANCEL_PENDING") != null and index("LATE_CANCEL") != null
  ok   state: (.client.cancel_ask_appt_id // "") == ""
SUMMARY: client=flagged/en appts=late_cancel events=0 sent=LATE_CANCEL_PENDING,LATE_CANCEL,reply
RESULT PASS 04-late-cancel.md tg
```

### 04-late-cancel, wa

```text
DIALOG 04-late-cancel.md channel=wa contact=wa:+15550000104 started 2026-10-10T16:19:09.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 27707 success; route agent; tools ["find_client","request_cancel"]
  <- LATE_CANCEL_PENDING: Cancel your Botox on Sat, Oct 10, 9:30 PM? This is less than 24 hours before your visit, so it will be recorded as a late cancellation. Reply YES to cancel.
  ok   templates: LATE_CANCEL_PENDING
  ok   lang: en
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: less than 24 hours
  ok   regex: late cancellation
  ok   regex: reply yes to cancel
  ok   state: [.appts[].status] == ["confirmed"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
  ok   state: [.owner[] | select(test("cancel"; "i"))] | length == 0
STEP 2 send: Yes, please cancel it.
  exec 27728 success; route llm; tools []
  <- LATE_CANCEL: Your Botox on Sat, Oct 10, 9:30 PM has been cancelled. It was less than 24 hours before the visit, so it is recorded as a late cancellation. Message me any time to book again.
  ok   templates: LATE_CANCEL
  ok   lang: en
  ok   node: LLM Affirmative
  ok   node: Cancel Visit
  ok   no-node: Agent
  ok   regex: has been cancelled
  ok   regex: \b24 hours\b
  ok   state: [.appts[].status] == ["late_cancel"]
  ok   state: .client.status == "flagged"
  ok   state: (.events | length) == 0
  ok   state: (.client.cancel_ask_appt_id // "") == ""
  ok   owner: LATE cancellation
STEP 3 send: What is your cancellation policy?
  exec 27748 success; route agent; tools ["search_knowledge"]
  <- reply: You can cancel or reschedule free of charge up to 24 hours before your appointment. Cancellations less than 24 hours ahead, and no-shows, are recorded and may require a deposit for future bookings. Since your appointment is today, it would 
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \b24\b
STATE
  CLIENT: {"client_id":"C-test-D15550000104","name":"Carl Latetest","language":"en","status":"flagged","intake_completed":null}
  APPT: A-MV2LNB92YQF botox 2026-10-10T21:30:00+02:00 late_cancel event=- reminder_sent_at=-
  OWNER: ✅ New booking: Carl Latetest (wa:+15550000104) — Botox — Sat, Oct 10, 9:30 PM — A-MV2LNB92YQF
  OWNER: ⚠️ LATE cancellation: Carl Latetest (wa:+15550000104) — botox — Sat, Oct 10, 9:30 PM — A-MV2LNB92YQF — client flagged
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] == ["late_cancel"]
  ok   state: .client.status == "flagged"
  ok   state: (.events | length) == 0
  ok   state: [.owner[] | select(test("LATE cancellation"))] | length == 1
  ok   state: [.outbox[] | .template_key] | index("LATE_CANCEL_PENDING") != null and index("LATE_CANCEL") != null
  ok   state: (.client.cancel_ask_appt_id // "") == ""
SUMMARY: client=flagged/en appts=late_cancel events=0 sent=LATE_CANCEL_PENDING,LATE_CANCEL,reply
RESULT PASS 04-late-cancel.md wa
```

### 05-cancel-not-yours, tg

```text
DIALOG 05-cancel-not-yours.md channel=tg contact=tg:9000000105 started 2026-10-10T16:20:47.000Z (clean start checked)
SECOND contact=tg:9000000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 27762 success; route agent; tools ["find_client"]
  <- reply: Hi Nina! I don't see any upcoming appointments under your contact, so I can't find that one to cancel. If you booked it under a different phone number or email, a team member can help track it down — just let me know.
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  ok   regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   no-node: Send Cancel Ask
  ok   state: [.second.appts[].status] == ["booked"]
  ok   state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
STEP 2 send: It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest.
  exec 27774 success; route agent; tools ["escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates-in: reply|ESCALATED_REPLY
  ok   count: 1
  ok   lang: en
  ok   sh: jq -e --arg r '\b(can.?t|cannot|couldn.?t|unable to|not able to|only)\b[^.]{0,80}\b(cancel|change|find|access)\b' '(.[0].template_key != "") or ([.[].text] | join("\n") | test($r; "i"))' "$TMP/rows.json"
  ok   no-node: Send Cancel Ask
STATE
  CLIENT: {"client_id":"C-test-D9000000105","name":"Nina Mytest","language":"en","status":"escalated","intake_completed":null}
STATE second tg:9000000205
  CLIENT: {"client_id":"C-test-D9000000205","name":"Maria Othertest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D05OTHER botox 2030-01-08T11:00:00+01:00 booked event=- reminder_sent_at=-
  OWNER: 🚨 Escalation — tg:9000000105 Name: Nina Mytest Reason: Client asks to cancel an appointment booked under another person's name (Maria Othertest), which the assistant cannot access or cancel. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi, plea
  ok   state: (.appts | length) == 0
  ok   state: (.client.status == "active" and (.owner | length) == 0) or (.client.status == "escalated" and (.owner | length) == 1)
  ok   state: (.client.cancel_ask_appt_id // "") == ""
  ok   state: [.second.appts[] | {appt_id, status}] == [{"appt_id": "A-TEST-D05OTHER", "status": "booked"}]
  ok   state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
  ok   state: .second.client.status == "active"
  ok   state: (.second.owner | length) == 0 and (.owner | length) <= 1 and all(.owner[]; test("escalation"; "i"))
  ok   state: (.second.outbox | length) == 0
SUMMARY: client=escalated/en appts=- events=0 sent=reply,ESCALATED_REPLY | second: client=active/en appts=booked events=0 sent=
RESULT PASS 05-cancel-not-yours.md tg
```

### 05-cancel-not-yours, wa

```text
DIALOG 05-cancel-not-yours.md channel=wa contact=wa:+15550000105 started 2026-10-10T16:21:42.000Z (clean start checked)
SECOND contact=wa:+15550000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 27789 success; route agent; tools ["find_client"]
  <- reply: I don't see any upcoming appointments under your contact, so I can't find that one to cancel. If you booked it under a different phone number or email, let me know and I'll have a team member check. Happy to help you book something as well.
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  ok   regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   no-node: Send Cancel Ask
  ok   state: [.second.appts[].status] == ["booked"]
  ok   state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
STEP 2 send: It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest.
  exec 27801 success; route agent; tools []
  <- reply: That appointment isn't under your contact, so I'm not able to look it up or cancel it for privacy reasons. The person who booked it can cancel it from their own phone number, or I can pass this to a team member to handle. Would you like me 
  ok   templates-in: reply|ESCALATED_REPLY
  ok   count: 1
  ok   lang: en
  ok   sh: jq -e --arg r '\b(can.?t|cannot|couldn.?t|unable to|not able to|only)\b[^.]{0,80}\b(cancel|change|find|access)\b' '(.[0].template_key != "") or ([.[].text] | join("\n") | test($r; "i"))' "$TMP/rows.json"
  ok   no-node: Send Cancel Ask
STATE
  CLIENT: {"client_id":"C-test-D15550000105","name":"Nina Mytest","language":"en","status":"active","intake_completed":null}
STATE second wa:+15550000205
  CLIENT: {"client_id":"C-test-D15550000205","name":"Maria Othertest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D05OTHER botox 2030-01-08T11:00:00+01:00 booked event=- reminder_sent_at=-
  ok   state: (.appts | length) == 0
  ok   state: (.client.status == "active" and (.owner | length) == 0) or (.client.status == "escalated" and (.owner | length) == 1)
  ok   state: (.client.cancel_ask_appt_id // "") == ""
  ok   state: [.second.appts[] | {appt_id, status}] == [{"appt_id": "A-TEST-D05OTHER", "status": "booked"}]
  ok   state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
  ok   state: .second.client.status == "active"
  ok   state: (.second.owner | length) == 0 and (.owner | length) <= 1 and all(.owner[]; test("escalation"; "i"))
  ok   state: (.second.outbox | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,reply | second: client=active/en appts=booked events=0 sent=
RESULT PASS 05-cancel-not-yours.md wa
```

### 06-knowledge-in-base, tg

```text
DIALOG 06-knowledge-in-base.md channel=tg contact=tg:9000000106 started 2026-10-10T16:22:34.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 27814 success; route agent; tools ["find_client","search_knowledge"]
  <- reply: Hi, and welcome — I'm Glow Aesthetics' AI assistant, and a team member can take over any time you'd like. Yes, we have free client parking in the courtyard at 12 Rosenstrasse, with the entrance from Rosenstrasse (we're on the second floor).
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: courtyard|free (client )?parking
STEP 2 send: How much is filler and is there a deposit?
  exec 27819 success; route agent; tools ["search_knowledge"]
  <- reply: Dermal filler is $550 per syringe and takes about 45 minutes. A $100 deposit is required when booking, and the rest is paid at the clinic after the treatment. Would you like me to look for a time?
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \$\s?550\b
  ok   regex: \$\s?100\b[^.]*deposit|deposit[^.]*\$\s?100\b
STATE
  CLIENT: {"client_id":"C-test-MV2LRNK1","name":null,"language":"en","status":"new","intake_completed":null}
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "new"
  ok   state: (.owner | length) == 0
SUMMARY: client=new/en appts=- events=0 sent=reply,reply
RESULT PASS 06-knowledge-in-base.md tg
```

### 06-knowledge-in-base, wa

```text
DIALOG 06-knowledge-in-base.md channel=wa contact=wa:+15550000106 started 2026-10-10T16:23:13.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 27825 success; route agent; tools ["find_client","search_knowledge"]
  <- reply: Hello, and welcome to Glow Aesthetics Med-Spa — I'm the clinic's AI assistant, and a team member can take over any time you'd like. Yes, we have free client parking in the courtyard, with the entrance from Rosenstrasse (we're at 12 Rosenstr
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: courtyard|free (client )?parking
STEP 2 send: How much is filler and is there a deposit?
  exec 27830 success; route agent; tools ["search_knowledge"]
  <- reply: Dermal filler is $550 per syringe and takes about 45 minutes. Yes, a $100 deposit is required at booking. Would you like me to look for an appointment time?
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \$\s?550\b
  ok   regex: \$\s?100\b[^.]*deposit|deposit[^.]*\$\s?100\b
STATE
  CLIENT: {"client_id":"C-test-MV2LSKZL","name":null,"language":"en","status":"new","intake_completed":null}
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "new"
  ok   state: (.owner | length) == 0
SUMMARY: client=new/en appts=- events=0 sent=reply,reply
RESULT PASS 06-knowledge-in-base.md wa
```

### 07-medical-out-of-base, tg

```text
DIALOG 07-medical-out-of-base.md channel=tg contact=tg:9000000107 started 2026-10-10T16:23:52.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 27836 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Botox is 30 minutes at $350 — would you like me to look for an appointment, or do you have questions first?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Can I do Botox while on warfarin and 20 mg of prednisone?
  exec 27840 success; route agent; tools ["search_knowledge","escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   owner: Escalation —
  ok   owner: Client: .*thinking about getting Botox
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Are you there?
  exec 27846 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, what are your opening hours on Saturday?
  exec 27848 success; route agent; tools ["search_knowledge"]
  <- reply: On Saturdays we're open 10:00 to 16:00. Our team will still be in touch with you about your earlier question.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2LTBUC","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — tg:9000000107 Name: unnamed client Reason: Client asked whether Botox is safe alongside their current medications; not covered by the knowledge base. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi, I'm thinking about getting Bot
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 07-medical-out-of-base.md tg
```

### 07-medical-out-of-base, wa

```text
DIALOG 07-medical-out-of-base.md channel=wa contact=wa:+15550000107 started 2026-10-10T16:24:54.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 27854 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Botox is $350 for a 30-minute appointment — would you like me to look for a day that suits you?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Can I do Botox while on warfarin and 20 mg of prednisone?
  exec 27858 success; route agent; tools ["search_knowledge","search_knowledge","escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   owner: Escalation —
  ok   owner: Client: .*thinking about getting Botox
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Are you there?
  exec 27865 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, what are your opening hours on Saturday?
  exec 27867 success; route agent; tools ["search_knowledge"]
  <- reply: On Saturdays we're open 10:00–16:00. A team member will still be in touch about your earlier question.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2LUMX4","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — wa:+15550000107 Name: unnamed client Reason: Client asked whether Botox is safe alongside their current medications; not covered by the knowledge base and requires clinical judgement. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: 
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 07-medical-out-of-base.md wa
```

### 08-talk-to-human, tg

```text
DIALOG 08-talk-to-human.md channel=tg contact=tg:9000000108 started 2026-10-10T16:25:55.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 27873 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  ok   templates: reply
  ok   lang: en
STEP 2 send: I want to talk to a human, please.
  exec 27877 success; route agent; tools ["escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   tool: escalate
  ok   owner: Escalation —
  ok   owner: Client: Hi there
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Is anyone there?
  exec 27882 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, do you have parking?
  exec 27884 success; route agent; tools ["search_knowledge"]
  <- reply: Yes — there's free client parking in the courtyard, with the entrance from Rosenstrasse. We're at 12 Rosenstrasse, Berlin 10178, second floor. A team member will still be in touch with you shortly.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2LVXZN","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — tg:9000000108 Name: unnamed client Reason: Client explicitly asked to speak with a human. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi there! Bot: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a te
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 08-talk-to-human.md tg
```

### 08-talk-to-human, wa

```text
DIALOG 08-talk-to-human.md channel=wa contact=wa:+15550000108 started 2026-10-10T16:26:49.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 27890 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  ok   templates: reply
  ok   lang: en
STEP 2 send: I want to talk to a human, please.
  exec 27894 success; route agent; tools ["escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   tool: escalate
  ok   owner: Escalation —
  ok   owner: Client: Hi there
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Is anyone there?
  exec 27899 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, do you have parking?
  exec 27901 success; route agent; tools ["search_knowledge"]
  <- reply: Yes — we have free client parking in the courtyard at 12 Rosenstrasse, with the entrance from Rosenstrasse (we're on the second floor). Alexanderplatz U-Bahn is about 5 minutes on foot. A team member will still be in touch with you shortly.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2LX44T","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — wa:+15550000108 Name: unnamed client Reason: Client explicitly asked to speak with a human. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi there! Bot: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a 
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 08-talk-to-human.md wa
```

### 12-russian-client, tg

```text
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-10T16:27:44.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 27907 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и по запросу вас всегда может подхватить сотрудник. Подскажите, пожалуйста, ваши имя и фамилию для записи на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
STEP 2 send: Меня зовут Ольга Тестова.
  exec 27911 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день вам удобно записаться и в какое время суток — утро, день или вечер?
  ok   templates: reply
  ok   lang: ru
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 27914 success; route agent; tools ["check_availability"]
  <- reply: На понедельник, 7 января 2030 года, утром свободно: понедельник, 7 января 2030, 10:00 понедельник, 7 января 2030, 10:30 понедельник, 7 января 2030, 11:00 понедельник, 7 января 2030, 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
STEP 4 send: Первый вариант, пожалуйста.
  exec 27918 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 min) — Mon, Jan 7, 10:00 AM. Бесплатная отмена до 24 hours before. Ответьте YES для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
STEP 5 send: да
  exec 27922 success; route confirm; tools []
  <- BOOKED: Вы забронированы: Botox (30 min) — Mon, Jan 7, 10:00 AM. Мы отправим вам напоминание за день до приема. Чтобы изменить или отменить, просто напишите мне сообщение здесь — отмена бесплатна за 24 часа до вашего визита.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу короткую форму приема и согласия (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2LYAEZ","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MV2LZ6R4YV9 botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d56324c5a365234595639 reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MV2LZ6R4YV9
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MV2LZ6R4YV9
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "ru"
  ok   state: .client.status == "active"
  ok   state: (.client.name // "") | test("Ольга")
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
SUMMARY: client=active/ru appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE
RESULT PASS 12-russian-client.md tg
```

### 12-russian-client, wa

```text
DIALOG 12-russian-client.md channel=wa contact=wa:+15550000112 started 2026-10-10T16:29:06.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 27939 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я виртуальный ассистент клиники Glow Aesthetics Med-Spa, при желании могу передать разговор сотруднику. Подскажите, пожалуйста, ваши имя и фамилию для записи?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
STEP 2 send: Меня зовут Ольга Тестова.
  exec 27943 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток (утро, день или вечер) вам удобно записаться на ботокс?
  ok   templates: reply
  ok   lang: ru
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 27946 success; route agent; tools ["check_availability"]
  <- reply: Свободное утреннее время в понедельник, 7 января 2030 г.: 10:00 10:30 11:00 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
STEP 4 send: Первый вариант, пожалуйста.
  exec 27950 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 мин) — пн, 7 янв., 10:00 AM. Бесплатная отмена за 24 часа до процедуры. Ответьте YES для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
STEP 5 send: да
  exec 27954 success; route confirm; tools []
  <- BOOKED: Вы забронированы: Botox (30 min) — Mon, Jan 7, 10:00 AM. Мы отправим вам напоминание за день до приема. Чтобы изменить или отменить запись, просто напишите мне здесь — отмена бесплатна за 24 часа до визита.
  <- BOOKED_INTAKE: Перед первым визитом, пожалуйста, заполните нашу краткую форму приема и согласия (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2M01G9","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MV2M11ODIDO botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d56324d31314f4449444f reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MV2M11ODIDO
  OWNER: ✅ New booking: Ольга Тестова (wa:+15550000112) — Botox — Mon, Jan 7, 10:00 AM — A-MV2M11ODIDO
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "ru"
  ok   state: .client.status == "active"
  ok   state: (.client.name // "") | test("Ольга")
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
SUMMARY: client=active/ru appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE
RESULT PASS 12-russian-client.md wa
```

### 11-spanish-client, tg

```text
DIALOG 11-spanish-client.md channel=tg contact=tg:9000000111 started 2026-10-10T16:30:33.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 27971 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy la asistente virtual con IA de Glow Aesthetics Med-Spa, y si lo prefieres puedo pasarte con una persona del equipo en cualquier momento. Con gusto te reservo el Botox: ¿me indicas tu nombre y apellido?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
STEP 2 send: Me llamo Lucía Pruebas.
  exec 27975 success; route agent; tools []
  <- reply: Gracias, Lucía. ¿Qué día te vendría bien y prefieres mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 27978 success; route agent; tools ["check_availability"]
  <- reply: Tengo estos horarios para el lunes 7 de enero de 2030: <b>10:00</b>, <b>10:30</b>, <b>11:00</b> y <b>11:30</b> ¿Cuál prefieres?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
STEP 4 send: La primera, por favor.
  exec 27982 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, 7 de ene, 10:00 AM. Cancelación gratuita hasta 24 horas antes. Responde YES para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
STEP 5 send: sí
  exec 27986 success; route confirm; tools []
  <- BOOKED: Estás reservada: Botox (30 min) — Mon, Jan 7, 10:00 AM. Te enviaremos un recordatorio el día anterior. Para cambiar o cancelar, solo escríbeme aquí — la cancelación es gratuita hasta 24 horas antes de tu cita.
  <- BOOKED_INTAKE: Antes de su primera visita, complete nuestro breve formulario de admisión y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2M1WYR","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MV2M2V9X73G botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d56324d32563958373347 reminder_sent_at=-
  EVENT: Botox — Lucía Pruebas 2030-01-07T10:00:00+01:00 A-MV2M2V9X73G
  OWNER: ✅ New booking: Lucía Pruebas (tg:9000000111) — Botox — Mon, Jan 7, 10:00 AM — A-MV2M2V9X73G
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "es"
  ok   state: .client.status == "active"
  ok   state: (.client.name // "") | test("Luc[ií]a"; "i")
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
SUMMARY: client=active/es appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE
RESULT PASS 11-spanish-client.md tg
```

### 11-spanish-client, wa

```text
DIALOG 11-spanish-client.md channel=wa contact=wa:+15550000111 started 2026-10-10T16:32:01.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 28003 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy el asistente virtual (IA) de Glow Aesthetics Med-Spa; si lo prefiere, un miembro del equipo puede atenderle. Con gusto le reservo el Botox: ¿me indica su nombre y apellido?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
STEP 2 send: Me llamo Lucía Pruebas.
  exec 28007 success; route agent; tools []
  <- reply: Gracias, Lucía. ¿Qué día le viene bien y prefiere mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 28010 success; route agent; tools ["check_availability"]
  <- reply: Tengo estos horarios para el lunes 7 de enero de 2030: 10:00, 10:30, 11:00 y 11:30. ¿Cuál prefiere?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
STEP 4 send: La primera, por favor.
  exec 28014 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, ene 7, 10:00 AM. Cancelación gratuita hasta 24 horas antes. Responda YES para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
STEP 5 send: sí
  exec 28018 success; route confirm; tools []
  <- BOOKED: Está reservado: Botox (30 min) — Mon, Jan 7, 10:00 AM. Te enviaremos un recordatorio el día anterior. Para cambiar o cancelar, simplemente envíame un mensaje aquí — la cancelación es gratuita hasta 24 horas antes de tu cita.
  <- BOOKED_INTAKE: Antes de su primera visita, por favor complete nuestro breve formulario de admisión y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2M3SH3","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MV2M4RJEE61 botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d56324d34524a45453631 reminder_sent_at=-
  EVENT: Botox — Lucía Pruebas 2030-01-07T10:00:00+01:00 A-MV2M4RJEE61
  OWNER: ✅ New booking: Lucía Pruebas (wa:+15550000111) — Botox — Mon, Jan 7, 10:00 AM — A-MV2M4RJEE61
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "es"
  ok   state: .client.status == "active"
  ok   state: (.client.name // "") | test("Luc[ií]a"; "i")
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
SUMMARY: client=active/es appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE
RESULT PASS 11-spanish-client.md wa
```

### 10-two-clients-one-slot, tg

```text
DIALOG 10-two-clients-one-slot.md channel=tg contact=tg:9000000110 started 2026-10-10T16:33:28.000Z (clean start checked)
SECOND contact=wa:+15550000210 (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 28035 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
STEP 2 send: My name is Ann Firsttest.
  exec 28039 success; route agent; tools []
  <- reply: Thanks, Ann! Which day would you like to come in for your Botox appointment?
  ok   templates: reply
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 28042 success; route agent; tools ["check_availability"]
  <- reply: I have these morning times on <b>Mon, Jan 7, 2030</b>: 10:00 AM 10:30 AM 11:00 AM 11:30 AM Which one works best for you?
  ok   templates: reply
  ok   regex: \b10:00\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: 10:00 AM, please.
  exec 28046 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: 10:00 AM
STEP 5 send2 (wa:+15550000210): Hi! I'd like to book Botox.
  exec 28050 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
STEP 6 send2 (wa:+15550000210): My name is Bea Secondtest.
  exec 28054 success; route agent; tools []
  <- reply: Thanks, Bea! What day works best for you, and do you prefer morning, afternoon or evening?
  ok   templates: reply
STEP 7 send2 (wa:+15550000210): Monday, January 7, 2030, in the morning, please.
  exec 28057 success; route agent; tools ["check_availability"]
  <- reply: I have these openings that morning: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one would you like?
  ok   templates: reply
  ok   regex: \b10:00\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 8 send2 (wa:+15550000210): 10:00 AM, please.
  exec 28061 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: 10:00 AM
  ok   state: [.appts[].status] == ["pending"] and [.second.appts[].status] == ["pending"] and .appts[0].start_iso == .second.appts[0].start_iso
STEP 9 send: YES
  exec 28073 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 hours before your visit.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   node: Confirm
STEP 10 send2 (wa:+15550000210): YES
  exec 28078 success; route confirm; tools []
  <- SLOT_TAKEN: Sorry — that time was just taken by another booking. Nearby options: Mon, Jan 7, 10:30 AM; Mon, Jan 7, 11:00 AM; Mon, Jan 7, 11:30 AM. Which one works for you?
  ok   templates: SLOT_TAKEN
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV2M5OKG","name":"Ann Firsttest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV2M6N8F1SB botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d56324d364e3846315342 reminder_sent_at=-
  EVENT: Botox — Ann Firsttest 2030-01-07T10:00:00+01:00 A-MV2M6N8F1SB
STATE second wa:+15550000210
  CLIENT: {"client_id":"C-test-MV2M6V40","name":"Bea Secondtest","language":"en","status":"new","intake_completed":null}
  APPT: A-MV2M7SVFERE botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Ann Firsttest (tg:9000000110) — Botox — Mon, Jan 7, 10:00 AM — A-MV2M6N8F1SB
  ok   state: ((.client.client_id // "") | startswith("C-test-")) and ((.second.client.client_id // "") | startswith("C-test-"))
  ok   state: [.appts[].status] == ["booked"]
  ok   state: [.second.appts[].status] == ["cancelled"]
  ok   state: .appts[0].start_iso == .second.appts[0].start_iso
  ok   state: (.events | length) == 1 and (.events[0].start | startswith("2030-01-07T10:00"))
  ok   state: (.second.events | length) == 0
SUMMARY: client=active/en appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE | second: client=new/en appts=cancelled events=0 sent=reply,reply,reply,PENDING_SUMMARY,SLOT_TAKEN
RESULT PASS 10-two-clients-one-slot.md tg
```

### 09-spam, tg

```text
DIALOG 09-spam.md channel=tg contact=tg:9000000109 started 2026-10-10T16:36:08.000Z (clean start checked)
STEP 1 burst: 20 x 'hi', one every 5s
  20 messages posted from 16:36:09 to 16:37:47Z
  exec 28102 success; route agent; tools ["find_client"]
  exec 28104 success; route agent; tools ["find_client"]
  exec 28109 success; route agent; tools []
  exec 28112 success; route agent; tools ["escalate"]
  exec 28115 success; route agent; tools ["escalate"]
  exec 28120 success; route -; tools []
  exec 28123 success; route -; tools []
  exec 28126 success; route -; tools []
  exec 28128 success; route -; tools []
  exec 28130 success; route -; tools []
  exec 28132 success; route -; tools []
  exec 28134 success; route -; tools []
  exec 28136 success; route -; tools []
  exec 28138 success; route -; tools []
  exec 28140 success; route -; tools []
  exec 28142 success; route -; tools []
  exec 28144 success; route -; tools []
  exec 28146 success; route -; tools []
  exec 28148 success; route -; tools []
  exec 28150 success; route -; tools []
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  <- reply: Hello again! Would you like to book a treatment, or do you have a question about our services?
  <- reply: Happy to help! Here's what we offer: Chemical Peel, Dermal Filler, Laser Hair Removal (small area), HydraFacial, Consultation, Botox and Microneedling. Which one would you like to book, or shall I connect you with a team member?
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   count: 20
  ok   templates-in: reply|ESCALATED_REPLY|ESCALATED_HOLD
  ok   state: [.owner[] | select(test("Escalation —"))] | length <= 1
STEP 2 send: hi
  exec 28152 success; route -; tools []
  <- RATE_LIMIT: You have sent many messages in a short time. I will pause for a few minutes; a team member has been notified.
  ok   templates: RATE_LIMIT
  ok   node: Send Rate Limit
  ok   no-node: Agent
  ok   owner: Rate limit: .* sent 21 messages
STEP 3 burst: 4 x 'hi', one every 5s
  4 messages posted from 16:37:58 to 16:38:13Z
  exec 28155 success; route -; tools []
  exec 28156 success; route -; tools []
  exec 28157 success; route -; tools []
  exec 28158 success; route -; tools []
  ok   templates: none
  ok   no-node: Agent
  ok   no-node: Send Rate Limit
  ok   no-node: Notify Spam
STEP 4 run: rate_limit_reset
  rate_limit_reset: wf1_rate_limit row of tg:9000000109 deleted instead of waiting 10 minutes
  ok   templates: none
STEP 5 send: hi, are you back?
  exec 28159 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   count: 1
  ok   templates-in: reply|ESCALATED_HOLD|ESCALATED_REPLY
  ok   node: Client Data
  ok   no-node: Send Rate Limit
STATE
  CLIENT: {"client_id":"C-test-MV2M93JI","name":null,"language":"en","status":"escalated","intake_completed":null}
  OWNER: 🚨 Escalation — tg:9000000109 Name: unnamed client Reason: Client has only sent repeated greetings and I have not been able to understand what they need after several attempts. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: hi Bot: Hi, welcome to 
  OWNER: ⛔ Rate limit: tg:9000000109 sent 21 messages in 10 minutes; paused
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.outbox[] | select(.template_key == "RATE_LIMIT")] | length == 1
  ok   state: [.owner[] | select(test("Rate limit"))] | length == 1
  ok   state: [.owner[] | select(test("Escalation —"))] | length <= 1
  ok   state: (.outbox | length) == 22
SUMMARY: client=escalated/en appts=- events=0 sent=reply,reply,reply,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,RATE_LIMIT,ESCALATED_HOLD
RESULT PASS 09-spam.md tg
```
