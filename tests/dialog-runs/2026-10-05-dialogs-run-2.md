# Task 20 level 2, run 2: 12 dialogs

| | |
|---|---|
| Started | 2026-10-05T19:50:45Z |
| Finished | 2026-10-05T20:39:17Z |
| Dialogs | 01 02 03 04 05 06 07 08 12 11 10 09 |
| Result | passed 20, failed 2 |
| Final cleanup | ok: cleanup done |

- templates-in: reply\|ESCALATED_REPLY\|ESCALATED_HOLD (got: ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR)
- Real owner Telegram alerts were sent during the run (owner decision: notify_owner is not captured): new booking, reschedule, late cancellation, escalation and rate-limit messages about the test contacts.
- During each reminder leg of dialog 01 Settings.reminder_hours_before was 1 for a few minutes; a real BOOKED message sent in that window would have read "remind you 1 hours before" (no real booking happened; the value was restored and read back each time).
- Dialog 09: the 10-minute recovery is simulated by deleting the contact row in wf1_rate_limit (rate_limit_reset), not waited for.

| dialog | channel | result | state | notes |
|---|---|---|---|---|
| 01-new-client-books | tg | PASS | client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED |  |
| 01-new-client-books | wa | PASS | client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED |  |
| 02-returning-same-as-last-time | tg | PASS | client=active/en appts=done,pending events=0 sent=reply,PENDING_SUMMARY |  |
| 02-returning-same-as-last-time | wa | PASS | client=active/en appts=done,pending events=0 sent=reply,PENDING_SUMMARY |  |
| 03-reschedule | tg | PASS | client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,BOOKED |  |
| 03-reschedule | wa | PASS | client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,BOOKED |  |
| 04-late-cancel | tg | PASS | client=flagged/en appts=late_cancel events=0 sent=reply,reply,reply |  |
| 04-late-cancel | wa | PASS | client=flagged/en appts=late_cancel events=0 sent=reply,reply,reply |  |
| 05-cancel-not-yours | tg | PASS | client=active/en appts=- events=0 sent=reply,reply | second: client=active/en appts=booked events=0 sent= |  |
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
| 10-two-clients-one-slot | tg | FAIL | client=new/en appts=pending events=0 sent=reply,reply,reply,PENDING_SUMMARY | second: client=new/en appts=- events=0 sent=reply,reply,ERROR | templates: reply (got: ERROR);regex: \b10:00\b |
| 09-spam | tg | FAIL | client=new/- appts=- events=0 sent=ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR | templates-in: reply\|ESCALATED_REPLY\|ESCALATED_HOLD (got: ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR) |

## Raw output

### 01-new-client-books, tg

```text
DIALOG 01-new-client-books.md channel=tg contact=tg:9000000101 started 2026-10-05T19:50:48.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 22499 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 22503 success; route agent; tools []
  <- reply: Thanks, Dana! Which day would you like to come in, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 22506 success; route agent; tools ["check_availability"]
  <- reply: I have these morning openings for Botox: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 22510 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 22518 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll remind you 24 hours before. To change or cancel, just message me here.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   node: Confirm
  ok   no-node: Agent
  ok   state: [.appts[].status] == ["booked"] and (.events | length) == 1
STEP 6 run: reminder_leg
  reminder_leg: waiting for minute 10-44 (the hourly WF-5 run is at :05), now :52
  reminder_leg: reminder_hours_before 24 -> 1
  reminder_leg: A-MUVO14NVY18 moved to 21:07Z today
  webhook wf5-reminders -> HTTP 200
  execution 22533: success, finished=true, started 2026-10-05T20:10:14.659Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER: Reminder: Botox — Mon, Oct 5, 11:07 PM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   tg.wa_template: none
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 22539 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Mon, Oct 5, 11:07 PM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVO06JH","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVO14NVY18 botox 2026-10-05T21:07:00.000Z confirmed event=appt412d4d55564f31344e56593138 reminder_sent_at=2026-10-05T20:10:18.531Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MUVO14NVY18
  OWNER: ✅ New booking: Dana Testova (tg:9000000101) — Botox — Mon, Jan 7, 10:00 AM — A-MUVO14NVY18
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
DIALOG 01-new-client-books.md channel=wa contact=wa:+15550000101 started 2026-10-05T20:10:46.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 22554 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 22558 success; route agent; tools []
  <- reply: Thanks, Dana! Which day would work best for you, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 22561 success; route agent; tools ["check_availability"]
  <- reply: I have these Botox openings that morning: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one would you like?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 22565 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 22573 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll remind you 24 hours before. To change or cancel, just message me here.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   node: Confirm
  ok   no-node: Agent
  ok   state: [.appts[].status] == ["booked"] and (.events | length) == 1
STEP 6 run: reminder_leg
  reminder_leg: reminder_hours_before 24 -> 1
  reminder_leg: A-MUVOQYLN9F7 moved to 21:13Z today
  webhook wf5-reminders -> HTTP 200
  execution 22586: success, finished=true, started 2026-10-05T20:15:22.624Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER [wa template medspa_reminder|en]: Reminder: Botox — Mon, Oct 5, 11:13 PM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   wa.wa_template: medspa_reminder
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 22592 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Mon, Oct 5, 11:13 PM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVOPUK3","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVOQYLN9F7 botox 2026-10-05T21:13:00.000Z confirmed event=appt412d4d55564f51594c4e394637 reminder_sent_at=2026-10-05T20:15:26.433Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MUVOQYLN9F7
  OWNER: ✅ New booking: Dana Testova (wa:+15550000101) — Botox — Mon, Jan 7, 10:00 AM — A-MUVOQYLN9F7
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
DIALOG 02-returning-same-as-last-time.md channel=tg contact=tg:9000000102 started 2026-10-05T20:15:54.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 22607 success; route agent; tools ["find_client","check_availability"]
  <- reply: Welcome back, Rita! For your HydraFacial next Tuesday morning I have: Tue, Oct 13 at 10:00 AM Tue, Oct 13 at 10:30 AM Tue, Oct 13 at 11:00 AM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: find_client
  ok   tool: check_availability
  ok   regex: hydra ?facial
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? Oct(ober)?\.? 13\b
  ok   no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
STEP 2 send: The first one, please.
  exec 22612 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: HydraFacial (60 min) — Tue, Oct 13, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: HydraFacial
  ok   tool: propose_booking
STATE
  CLIENT: {"client_id":"C-test-D9000000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  APPT: A-MUVOWYM42C2 hydrafacial 2026-10-13T10:00:00+02:00 pending event=- reminder_sent_at=-
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
DIALOG 02-returning-same-as-last-time.md channel=wa contact=wa:+15550000102 started 2026-10-05T20:16:40.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 22626 success; route agent; tools ["find_client","check_availability"]
  <- reply: Welcome back, Rita! For a HydraFacial next Tuesday morning I have: Tue, Oct 13 at 10:00 AM Tue, Oct 13 at 10:30 AM Tue, Oct 13 at 11:00 AM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: find_client
  ok   tool: check_availability
  ok   regex: hydra ?facial
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? Oct(ober)?\.? 13\b
  ok   no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
STEP 2 send: The first one, please.
  exec 22631 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: HydraFacial (60 min) — Tue, Oct 13, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: HydraFacial
  ok   tool: propose_booking
STATE
  CLIENT: {"client_id":"C-test-D15550000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  APPT: A-MUVOY2QNP0W hydrafacial 2026-10-13T10:00:00+02:00 pending event=- reminder_sent_at=-
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
DIALOG 03-reschedule.md channel=tg contact=tg:9000000103 started 2026-10-05T20:17:32.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 22650 success; route agent; tools ["find_client","check_availability"]
  <- reply: Hi Paul! Here are afternoon openings for your Botox on Mon, Jan 7: Mon, Jan 7 at 1:00 PM Mon, Jan 7 at 1:30 PM Mon, Jan 7 at 2:00 PM Mon, Jan 7 at 3:00 PM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 2 send: The first one, please.
  exec 22655 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 1:00 PM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] | sort == ["booked", "pending"]
  ok   state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
STEP 3 send: YES
  exec 22668 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 1:00 PM. We'll remind you 24 hours before. To change or cancel, just message me here.
  ok   templates: BOOKED
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D9000000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVOYM5QJBK botox 2030-01-07T12:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MUVOZEWP18A botox 2030-01-07T13:00:00+01:00 booked event=appt412d4d55564f5a455750313841 reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T13:00:00+01:00 A-MUVOZEWP18A
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 12:00 PM — A-MUVOYM5QJBK
  OWNER: 🔁 Rescheduled, old visit cancelled: Paul Movetest (tg:9000000103) — botox — Mon, Jan 7, 12:00 PM — A-MUVOYM5QJBK
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 1:00 PM — A-MUVOZEWP18A — replaces A-MUVOYM5QJBK
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
DIALOG 03-reschedule.md channel=wa contact=wa:+15550000103 started 2026-10-05T20:18:55.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 22691 success; route agent; tools ["find_client","check_availability"]
  <- reply: Hi Paul! Here are afternoon openings for your Botox on Mon, Jan 7, 2030: 12:30 PM 1:00 PM 2:00 PM 3:00 PM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 2 send: The first one, please.
  exec 22696 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 12:30 PM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] | sort == ["booked", "pending"]
  ok   state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
STEP 3 send: YES
  exec 22709 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 12:30 PM. We'll remind you 24 hours before. To change or cancel, just message me here.
  ok   templates: BOOKED
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D15550000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVP0DTV2Y0 botox 2030-01-07T12:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MUVP17WWWVP botox 2030-01-07T12:30:00+01:00 booked event=appt412d4d55565031375757575650 reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T12:30:00+01:00 A-MUVP17WWWVP
  OWNER: ✅ New booking: Paul Movetest (wa:+15550000103) — Botox — Mon, Jan 7, 12:00 PM — A-MUVP0DTV2Y0
  OWNER: 🔁 Rescheduled, old visit cancelled: Paul Movetest (wa:+15550000103) — botox — Mon, Jan 7, 12:00 PM — A-MUVP0DTV2Y0
  OWNER: ✅ New booking: Paul Movetest (wa:+15550000103) — Botox — Mon, Jan 7, 12:30 PM — A-MUVP17WWWVP — replaces A-MUVP0DTV2Y0
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
DIALOG 04-late-cancel.md channel=tg contact=tg:9000000104 started 2026-10-05T20:20:20.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 22732 success; route agent; tools ["find_client"]
  <- reply: Hi Carl, I see one upcoming appointment: <b>Botox on Tue, Oct 6 at 1:30 AM</b>. Shall I cancel that one for you?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Yes, please cancel it.
  exec 22736 success; route agent; tools ["cancel_booking"]
  <- reply: That appointment is now cancelled, Carl. Since it was within 24 hours of the start time, it's recorded as a late cancellation. Let me know if you'd like to rebook.
  ok   templates: reply
  ok   lang: en
  ok   state: [.appts[].status] == ["late_cancel"]
STEP 3 send: What is your cancellation policy?
  exec 22745 success; route agent; tools ["search_knowledge"]
  <- reply: You can reschedule or cancel free of charge up to 24 hours before your appointment. Cancellations made less than 24 hours ahead, and no-shows, are recorded and may require a deposit for future bookings. Also, if you arrive more than 15 minu
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \b24\b
STATE
  CLIENT: {"client_id":"C-test-D9000000104","name":"Carl Latetest","language":"en","status":"flagged","intake_completed":null}
  APPT: A-MUVP27RMBAB botox 2026-10-06T01:30:00+02:00 late_cancel event=- reminder_sent_at=-
  OWNER: ✅ New booking: Carl Latetest (tg:9000000104) — Botox — Tue, Oct 6, 1:30 AM — A-MUVP27RMBAB
  OWNER: ⚠️ LATE cancellation: Carl Latetest (tg:9000000104) — botox — Tue, Oct 6, 1:30 AM — A-MUVP27RMBAB — client flagged
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] == ["late_cancel"]
  ok   state: .client.status == "flagged"
  ok   state: (.events | length) == 0
  ok   state: [.owner[] | select(test("LATE cancellation"))] | length == 1
  ok   state: [.outbox[].text] | join(" ") | test("late"; "i")
SUMMARY: client=flagged/en appts=late_cancel events=0 sent=reply,reply,reply
RESULT PASS 04-late-cancel.md tg
```

### 04-late-cancel, wa

```text
DIALOG 04-late-cancel.md channel=wa contact=wa:+15550000104 started 2026-10-05T20:21:35.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 22764 success; route agent; tools ["find_client"]
  <- reply: I see one upcoming appointment: Botox on Tue, Oct 6 at 1:30 AM. Shall I cancel that one for you?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Yes, please cancel it.
  exec 22768 success; route agent; tools ["cancel_booking"]
  <- reply: Your Botox appointment has been cancelled. Since it was within 24 hours of the start time, it's recorded as a late cancellation. Would you like me to find a new time for you?
  ok   templates: reply
  ok   lang: en
  ok   state: [.appts[].status] == ["late_cancel"]
STEP 3 send: What is your cancellation policy?
  exec 22777 success; route agent; tools ["search_knowledge"]
  <- reply: You can cancel or reschedule free of charge up to 24 hours before your appointment. Cancellations made less than 24 hours ahead, and no-shows, are recorded and may require a deposit for future bookings. Also, arriving more than 15 minutes l
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \b24\b
STATE
  CLIENT: {"client_id":"C-test-D15550000104","name":"Carl Latetest","language":"en","status":"flagged","intake_completed":null}
  APPT: A-MUVP3T9QPZN botox 2026-10-06T01:30:00+02:00 late_cancel event=- reminder_sent_at=-
  OWNER: ✅ New booking: Carl Latetest (wa:+15550000104) — Botox — Tue, Oct 6, 1:30 AM — A-MUVP3T9QPZN
  OWNER: ⚠️ LATE cancellation: Carl Latetest (wa:+15550000104) — botox — Tue, Oct 6, 1:30 AM — A-MUVP3T9QPZN — client flagged
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] == ["late_cancel"]
  ok   state: .client.status == "flagged"
  ok   state: (.events | length) == 0
  ok   state: [.owner[] | select(test("LATE cancellation"))] | length == 1
  ok   state: [.outbox[].text] | join(" ") | test("late"; "i")
SUMMARY: client=flagged/en appts=late_cancel events=0 sent=reply,reply,reply
RESULT PASS 04-late-cancel.md wa
```

### 05-cancel-not-yours, tg

```text
DIALOG 05-cancel-not-yours.md channel=tg contact=tg:9000000105 started 2026-10-05T20:22:56.000Z (clean start checked)
SECOND contact=tg:9000000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 22791 success; route agent; tools ["find_client"]
  <- reply: Hi Nina! I don't see any upcoming appointments under your contact, so I can't find that booking to cancel. If you think it was made under a different phone number or email, I can have a team member check for you.
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  ok   regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   state: [.second.appts[].status] == ["booked"]
STEP 2 send: It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest.
  exec 22799 success; route agent; tools []
  <- reply: I'm sorry, but I can only cancel appointments booked under your own contact, and that one isn't listed there. For a booking in someone else's name, the person themselves would need to contact us, or I can pass this to a team member to look 
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|only)\b[^.]{0,80}\b(cancel|change|find|access)\b
STATE
  CLIENT: {"client_id":"C-test-D9000000105","name":"Nina Mytest","language":"en","status":"active","intake_completed":null}
STATE second tg:9000000205
  CLIENT: {"client_id":"C-test-D9000000205","name":"Maria Othertest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D05OTHER botox 2030-01-08T11:00:00+01:00 booked event=- reminder_sent_at=-
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "active"
  ok   state: [.second.appts[] | {appt_id, status}] == [{"appt_id": "A-TEST-D05OTHER", "status": "booked"}]
  ok   state: .second.client.status == "active"
  ok   state: (.owner | length) == 0 and (.second.owner | length) == 0
  ok   state: (.second.outbox | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,reply | second: client=active/en appts=booked events=0 sent=
RESULT PASS 05-cancel-not-yours.md tg
```

### 05-cancel-not-yours, wa

```text
DIALOG 05-cancel-not-yours.md channel=wa contact=wa:+15550000105 started 2026-10-05T20:23:40.000Z (clean start checked)
SECOND contact=wa:+15550000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 22812 success; route agent; tools ["find_client"]
  <- reply: Hi Nina — I don't see any upcoming appointments under your contact, so I can't cancel that one. If you booked it under a different phone number or email, let me know and I'll have a team member check. Would you like me to pass this to the t
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  ok   regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   state: [.second.appts[].status] == ["booked"]
STEP 2 send: It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest.
  exec 22820 success; route agent; tools []
  <- reply: I'm sorry — I can only cancel appointments booked under your own contact, so I'm not able to cancel one in someone else's name. Maria is welcome to message or call us directly, or I can pass this to a team member for you. Would you like me 
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|only)\b[^.]{0,80}\b(cancel|change|find|access)\b
STATE
  CLIENT: {"client_id":"C-test-D15550000105","name":"Nina Mytest","language":"en","status":"active","intake_completed":null}
STATE second wa:+15550000205
  CLIENT: {"client_id":"C-test-D15550000205","name":"Maria Othertest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D05OTHER botox 2030-01-08T11:00:00+01:00 booked event=- reminder_sent_at=-
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "active"
  ok   state: [.second.appts[] | {appt_id, status}] == [{"appt_id": "A-TEST-D05OTHER", "status": "booked"}]
  ok   state: .second.client.status == "active"
  ok   state: (.owner | length) == 0 and (.second.owner | length) == 0
  ok   state: (.second.outbox | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,reply | second: client=active/en appts=booked events=0 sent=
RESULT PASS 05-cancel-not-yours.md wa
```

### 06-knowledge-in-base, tg

```text
DIALOG 06-knowledge-in-base.md channel=tg contact=tg:9000000106 started 2026-10-05T20:24:31.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 22833 success; route agent; tools ["find_client","search_knowledge"]
  <- reply: Hello! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Yes — we have <b>free client parking</b> in the courtyard at 12 Rosenstrasse, Berlin 10178, with the entrance from Rosenstrasse (we're on the second 
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: courtyard|free (client )?parking
STEP 2 send: How much is filler and is there a deposit?
  exec 22838 success; route agent; tools ["search_knowledge"]
  <- reply: Dermal filler is <b>$550 per syringe</b> and takes about 45 minutes. Yes — a <b>$100 deposit</b> is required when you book. Would you like me to look for an appointment time?
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \$\s?550\b
  ok   regex: \$\s?100\b[^.]*deposit|deposit[^.]*\$\s?100\b
STATE
  CLIENT: {"client_id":"C-test-MUVP7JAE","name":null,"language":"en","status":"new","intake_completed":null}
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "new"
  ok   state: (.owner | length) == 0
SUMMARY: client=new/en appts=- events=0 sent=reply,reply
RESULT PASS 06-knowledge-in-base.md tg
```

### 06-knowledge-in-base, wa

```text
DIALOG 06-knowledge-in-base.md channel=wa contact=wa:+15550000106 started 2026-10-05T20:25:07.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 22844 success; route agent; tools ["find_client","search_knowledge"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa — I'm the clinic's AI assistant, and a team member can take over any time you'd like. Yes, we have free client parking in the courtyard, with the entrance from Rosenstrasse (we're at 12 Rosenstrasse, s
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: courtyard|free (client )?parking
STEP 2 send: How much is filler and is there a deposit?
  exec 22849 success; route agent; tools ["search_knowledge"]
  <- reply: Dermal filler is $550 per syringe and takes about 45 minutes. A $100 deposit is required when booking, and the rest is paid at the clinic after treatment. Would you like me to look for a time?
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \$\s?550\b
  ok   regex: \$\s?100\b[^.]*deposit|deposit[^.]*\$\s?100\b
STATE
  CLIENT: {"client_id":"C-test-MUVP8AZM","name":null,"language":"en","status":"new","intake_completed":null}
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "new"
  ok   state: (.owner | length) == 0
SUMMARY: client=new/en appts=- events=0 sent=reply,reply
RESULT PASS 06-knowledge-in-base.md wa
```

### 07-medical-out-of-base, tg

```text
DIALOG 07-medical-out-of-base.md channel=tg contact=tg:9000000107 started 2026-10-05T20:25:43.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 22855 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Botox is 30 minutes at $350 — may I have your first and last name to get started?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Can I do Botox while on warfarin and 20 mg of prednisone?
  exec 22859 success; route agent; tools ["search_knowledge","escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   owner: Escalation —
  ok   owner: Client: .*thinking about getting Botox
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Are you there?
  exec 22865 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, what are your opening hours on Saturday?
  exec 22867 success; route agent; tools ["search_knowledge"]
  <- reply: We're open on Saturdays from 10:00 AM to 4:00 PM. A team member will still be in touch about your earlier question.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVP92MN","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — tg:9000000107 Name: unnamed client Reason: Client asked a medication-related medical safety question about Botox that the knowledge base does not cover. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi, I'm thinking about getting 
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 07-medical-out-of-base.md tg
```

### 07-medical-out-of-base, wa

```text
DIALOG 07-medical-out-of-base.md channel=wa contact=wa:+15550000107 started 2026-10-05T20:26:41.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 22873 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Botox is 30 minutes at $350 — could I have your first and last name to get started?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Can I do Botox while on warfarin and 20 mg of prednisone?
  exec 22877 success; route agent; tools ["search_knowledge","escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   owner: Escalation —
  ok   owner: Client: .*thinking about getting Botox
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Are you there?
  exec 22883 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, what are your opening hours on Saturday?
  exec 22885 success; route agent; tools ["search_knowledge"]
  <- reply: On Saturdays we're open 10:00 AM to 4:00 PM. A team member will still be in touch about your earlier question.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVPABAL","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — wa:+15550000107 Name: unnamed client Reason: Client asked a medical suitability question about Botox with current medications; not covered by the knowledge base. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi, I'm thinking about
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 07-medical-out-of-base.md wa
```

### 08-talk-to-human, tg

```text
DIALOG 08-talk-to-human.md channel=tg contact=tg:9000000108 started 2026-10-05T20:27:42.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 22891 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  ok   templates: reply
  ok   lang: en
STEP 2 send: I want to talk to a human, please.
  exec 22895 success; route agent; tools ["escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   tool: escalate
  ok   owner: Escalation —
  ok   owner: Client: Hi there
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Is anyone there?
  exec 22900 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, do you have parking?
  exec 22902 success; route agent; tools ["search_knowledge"]
  <- reply: Yes — we have free client parking in the courtyard at 12 Rosenstrasse, Berlin 10178, with the entrance from Rosenstrasse. We're on the second floor, and Alexanderplatz U-Bahn is about 5 minutes away on foot. A team member will still be in t
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVPBME2","name":null,"language":"en","status":"active","intake_completed":null}
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
DIALOG 08-talk-to-human.md channel=wa contact=wa:+15550000108 started 2026-10-05T20:28:40.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 22908 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  ok   templates: reply
  ok   lang: en
STEP 2 send: I want to talk to a human, please.
  exec 22912 success; route agent; tools ["escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   tool: escalate
  ok   owner: Escalation —
  ok   owner: Client: Hi there
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Is anyone there?
  exec 22917 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, do you have parking?
  exec 22919 success; route agent; tools ["search_knowledge"]
  <- reply: Yes — we have free client parking in the courtyard at 12 Rosenstrasse, Berlin 10178, with the entrance from Rosenstrasse. We're on the second floor, and Alexanderplatz U-Bahn is about 5 minutes away on foot. A team member will still be in t
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVPCVJD","name":null,"language":"en","status":"active","intake_completed":null}
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
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-05T20:29:35.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 22925 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я — ИИ-ассистент клиники Glow Aesthetics Med-Spa, при желании могу передать разговор сотруднику. Подскажите, пожалуйста, ваши имя и фамилию для записи?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
STEP 2 send: Меня зовут Ольга Тестова.
  exec 22929 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток вам удобно записаться на ботокс?
  ok   templates: reply
  ok   lang: ru
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 22932 success; route agent; tools ["check_availability"]
  <- reply: Вот свободное время на ботокс в понедельник, 7 января 2030 года: Пн, 7 янв 2030, 10:00 Пн, 7 янв 2030, 10:30 Пн, 7 янв 2030, 11:00 Пн, 7 янв 2030, 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
STEP 4 send: Первый вариант, пожалуйста.
  exec 22936 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 min) — Mon, Jan 7, 10:00 AM. Ответьте YES для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
STEP 5 send: да
  exec 22940 success; route confirm; tools []
  <- BOOKED: Вы забронированы: Botox (30 min) — Mon, Jan 7, 10:00 AM. Мы напомним вам за 24 часа до процедуры. Чтобы изменить или отменить, просто напишите мне здесь.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу краткую форму регистрации и согласия (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVPE219","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MUVPF59CPM4 botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d55565046353943504d34 reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MUVPF59CPM4
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MUVPF59CPM4
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
DIALOG 12-russian-client.md channel=wa contact=wa:+15550000112 started 2026-10-05T20:31:09.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 22957 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я — ИИ-ассистент клиники Glow Aesthetics Med-Spa, и в любой момент可以 подключить сотрудника, если захотите. Подскажите, пожалуйста, ваши имя и фамилию для записи на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
STEP 2 send: Меня зовут Ольга Тестова.
  exec 22961 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день вам удобно прийти и в какое время — утро, день или вечер?
  ok   templates: reply
  ok   lang: ru
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 22964 success; route agent; tools ["check_availability"]
  <- reply: Свободно в понедельник, 7 января 2030 г.: 10:00 10:30 11:00 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
STEP 4 send: Первый вариант, пожалуйста.
  exec 22968 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 мин) — пн, янв 7, 10:00 AM. Ответьте YES для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
STEP 5 send: да
  exec 22972 success; route confirm; tools []
  <- BOOKED: Вы записаны: Botox (30 min) — Mon, Jan 7, 10:00 AM. Мы напомним вам за 24 часа до процедуры. Чтобы изменить или отменить запись, просто напишите мне здесь.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу короткую форму согласия и сбора информации (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVPG2E3","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MUVPH2XJMAT botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d5556504832584a4d4154 reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MUVPH2XJMAT
  OWNER: ✅ New booking: Ольга Тестова (wa:+15550000112) — Botox — Mon, Jan 7, 10:00 AM — A-MUVPH2XJMAT
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
DIALOG 11-spanish-client.md channel=tg contact=tg:9000000111 started 2026-10-05T20:32:36.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 22989 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy el asistente virtual (IA) de Glow Aesthetics Med-Spa, y si lo prefiere, un miembro del equipo puede atenderle en cualquier momento. Con gusto le reservo el Botox. ¿Me indica su nombre y apellido, por favor?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
STEP 2 send: Me llamo Lucía Pruebas.
  exec 22993 success; route agent; tools []
  <- reply: Encantado, Lucía. ¿Qué día le viene bien y prefiere mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 22996 success; route agent; tools ["check_availability"]
  <- reply: Tenemos estos horarios disponibles ese día: lunes 7 de enero de 2030 a las 10:00 lunes 7 de enero de 2030 a las 10:30 lunes 7 de enero de 2030 a las 11:00 lunes 7 de enero de 2030 a las 11:30 ¿Cuál prefiere?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
STEP 4 send: La primera, por favor.
  exec 23000 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, 7 de ene, 10:00 AM. Responda YES para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
STEP 5 send: sí
  exec 23004 success; route confirm; tools []
  <- BOOKED: Estás reservada: Botox (30 min) — Mon, Jan 7, 10:00 AM. Te recordaremos 24 horas antes. Para cambiar o cancelar, solo envíame un mensaje aquí.
  <- BOOKED_INTAKE: Antes de su primera visita, complete nuestro breve formulario de ingreso y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVPHXPN","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MUVPIW9UBDB botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d55565049573955424442 reminder_sent_at=-
  EVENT: Botox — Lucía Pruebas 2030-01-07T10:00:00+01:00 A-MUVPIW9UBDB
  OWNER: ✅ New booking: Lucía Pruebas (tg:9000000111) — Botox — Mon, Jan 7, 10:00 AM — A-MUVPIW9UBDB
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
DIALOG 11-spanish-client.md channel=wa contact=wa:+15550000111 started 2026-10-05T20:34:07.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 23021 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy la asistente virtual (IA) de Glow Aesthetics Med-Spa, y si lo prefieres puedo pasarte con una persona del equipo en cualquier momento. Con gusto te ayudo a reservar tu Botox. ¿Me dices tu nombre y apellido, por favor?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
STEP 2 send: Me llamo Lucía Pruebas.
  exec 23025 success; route agent; tools []
  <- reply: Encantada, Lucía. ¿Qué día te vendría bien y prefieres mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 23028 success; route agent; tools ["check_availability"]
  <- reply: Tengo estos horarios libres para Botox: lunes 7 de enero de 2030 a las 10:00 lunes 7 de enero de 2030 a las 10:30 lunes 7 de enero de 2030 a las 11:00 lunes 7 de enero de 2030 a las 11:30 ¿Cuál prefieres?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
STEP 4 send: La primera, por favor.
  exec 23032 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, 7 de ene, 10:00 AM. Responda YES para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
STEP 5 send: sí
  exec 23036 success; route confirm; tools []
  <- BOOKED: Estás reservado: Botox (30 min) — Mon, Jan 7, 10:00 AM. Te recordaremos 24 horas antes. Para cambiar o cancelar, solo envíame un mensaje aquí.
  <- BOOKED_INTAKE: Antes de su primera visita, complete nuestro breve formulario de admisión y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVPJVKJ","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MUVPKW6XX45 botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d5556504b573658583435 reminder_sent_at=-
  EVENT: Botox — Lucía Pruebas 2030-01-07T10:00:00+01:00 A-MUVPKW6XX45
  OWNER: ✅ New booking: Lucía Pruebas (wa:+15550000111) — Botox — Mon, Jan 7, 10:00 AM — A-MUVPKW6XX45
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
DIALOG 10-two-clients-one-slot.md channel=tg contact=tg:9000000110 started 2026-10-05T20:35:32.000Z (clean start checked)
SECOND contact=wa:+15550000210 (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 23053 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
STEP 2 send: My name is Ann Firsttest.
  exec 23057 success; route agent; tools []
  <- reply: Thanks, Ann! What day works best for you, and do you prefer morning, afternoon or evening?
  ok   templates: reply
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 23060 success; route agent; tools ["check_availability"]
  <- reply: I have these morning openings for Botox: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one would you like?
  ok   templates: reply
  ok   regex: \b10:00\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: 10:00 AM, please.
  exec 23064 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: 10:00 AM
STEP 5 send2 (wa:+15550000210): Hi! I'd like to book Botox.
  exec 23068 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox appointment started?
  ok   templates: reply
STEP 6 send2 (wa:+15550000210): My name is Bea Secondtest.
  exec 23072 success; route agent; tools []
  <- reply: Thanks, Bea! What day works best for you, and do you prefer morning, afternoon or evening?
  ok   templates: reply
STEP 7 send2 (wa:+15550000210): Monday, January 7, 2030, in the morning, please.
  exec 23075 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  FAIL: regex: \b10:00\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MUVPLPPC","name":"Ann Firsttest","language":"en","status":"new","intake_completed":null}
  APPT: A-MUVPMQCHRNM botox 2030-01-07T10:00:00+01:00 pending event=- reminder_sent_at=-
STATE second wa:+15550000210
  CLIENT: {"client_id":"C-test-MUVPMYP2","name":null,"language":"en","status":"new","intake_completed":null}
  OWNER (second): ❌ Reply failed for wa:+15550000210: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/en appts=pending events=0 sent=reply,reply,reply,PENDING_SUMMARY | second: client=new/en appts=- events=0 sent=reply,reply,ERROR
RESULT FAIL 10-two-clients-one-slot.md tg (2 failed)
```

### 09-spam, tg

```text
DIALOG 09-spam.md channel=tg contact=tg:9000000109 started 2026-10-05T20:37:18.000Z (clean start checked)
STEP 1 burst: 20 x 'hi', one every 5s
  20 messages posted from 20:37:18 to 20:38:56Z
  exec 23091 success; route agent; tools []
  exec 23092 success; route agent; tools []
  exec 23097 success; route agent; tools []
  exec 23102 success; route agent; tools []
  exec 23107 success; route agent; tools []
  exec 23112 success; route agent; tools []
  exec 23117 success; route agent; tools []
  exec 23122 success; route agent; tools []
  exec 23127 success; route agent; tools []
  exec 23132 success; route agent; tools []
  exec 23137 success; route agent; tools []
  exec 23142 success; route agent; tools []
  exec 23147 success; route agent; tools []
  exec 23152 success; route agent; tools []
  exec 23157 success; route agent; tools []
  exec 23162 success; route agent; tools []
  exec 23167 success; route agent; tools []
  exec 23172 success; route agent; tools []
  exec 23177 success; route agent; tools []
  exec 23182 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  ok   count: 20
  FAIL: templates-in: reply|ESCALATED_REPLY|ESCALATED_HOLD (got: ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR)
  ok   state: [.owner[] | select(test("Escalation —"))] | length <= 1
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MUVPO6LC","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
  OWNER: ❌ Reply failed for tg:9000000109: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR
RESULT FAIL 09-spam.md tg (1 failed)
```
