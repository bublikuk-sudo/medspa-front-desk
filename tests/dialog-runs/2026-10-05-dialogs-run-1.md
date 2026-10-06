# Task 20 level 2, run 1: 12 dialogs

| | |
|---|---|
| Started | 2026-10-05T19:16:04Z |
| Finished | 2026-10-05T19:50:45Z |
| Dialogs | 01 02 03 04 05 06 07 08 12 11 10 09 |
| Result | passed 22, failed 0 |
| Final cleanup | ok: cleanup done |

- 
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
| 10-two-clients-one-slot | tg | PASS | client=active/en appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE | second: client=new/en appts=cancelled events=0 sent=reply,reply,reply,PENDING_SUMMARY,SLOT_TAKEN |  |
| 09-spam | tg | PASS | client=escalated/en appts=- events=0 sent=reply,reply,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,RATE_LIMIT,ESCALATED_HOLD |  |

## Raw output

### 01-new-client-books, tg

```text
DIALOG 01-new-client-books.md channel=tg contact=tg:9000000101 started 2026-10-05T19:16:08.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 21818 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 21822 success; route agent; tools []
  <- reply: Thank you, Dana! Which day would work best for you, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 21825 success; route agent; tools ["check_availability"]
  <- reply: I have these morning openings: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one would you like?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 21829 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 21837 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll remind you 24 hours before. To change or cancel, just message me here.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   node: Confirm
  ok   no-node: Agent
  ok   state: [.appts[].status] == ["booked"] and (.events | length) == 1
STEP 6 run: reminder_leg
  reminder_leg: reminder_hours_before 24 -> 1
  reminder_leg: A-MUVMSJACPSY moved to 20:18Z today
  webhook wf5-reminders -> HTTP 200
  execution 21850: success, finished=true, started 2026-10-05T19:20:55.981Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER: Reminder: Botox — Mon, Oct 5, 10:18 PM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   tg.wa_template: none
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 21856 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Mon, Oct 5, 10:18 PM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVMRLLW","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVMSJACPSY botox 2026-10-05T20:18:00.000Z confirmed event=appt412d4d55564d534a4143505359 reminder_sent_at=2026-10-05T19:20:59.775Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MUVMSJACPSY
  OWNER: ✅ New booking: Dana Testova (tg:9000000101) — Botox — Mon, Jan 7, 10:00 AM — A-MUVMSJACPSY
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
DIALOG 01-new-client-books.md channel=wa contact=wa:+15550000101 started 2026-10-05T19:21:27.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 21871 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 21875 success; route agent; tools []
  <- reply: Thanks, Dana! Which day would you like to come in, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 21878 success; route agent; tools ["check_availability"]
  <- reply: I have these openings that morning: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 21882 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 21890 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll remind you 24 hours before. To change or cancel, just message me here.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   node: Confirm
  ok   no-node: Agent
  ok   state: [.appts[].status] == ["booked"] and (.events | length) == 1
STEP 6 run: reminder_leg
  reminder_leg: reminder_hours_before 24 -> 1
  reminder_leg: A-MUVMZSYJ6RS moved to 20:24Z today
  webhook wf5-reminders -> HTTP 200
  execution 21903: success, finished=true, started 2026-10-05T19:25:49.117Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER [wa template medspa_reminder|en]: Reminder: Botox — Mon, Oct 5, 10:24 PM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   wa.wa_template: medspa_reminder
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 21909 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Mon, Oct 5, 10:24 PM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVMYG0G","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVMZSYJ6RS botox 2026-10-05T20:24:00.000Z confirmed event=appt412d4d55564d5a53594a365253 reminder_sent_at=2026-10-05T19:25:52.824Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MUVMZSYJ6RS
  OWNER: ✅ New booking: Dana Testova (wa:+15550000101) — Botox — Mon, Jan 7, 10:00 AM — A-MUVMZSYJ6RS
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
DIALOG 02-returning-same-as-last-time.md channel=tg contact=tg:9000000102 started 2026-10-05T19:26:20.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 21924 success; route agent; tools ["find_client","check_availability"]
  <- reply: Hi Rita! For your HydraFacial next Tuesday morning I have: Tue, Oct 13 at 10:00 AM Tue, Oct 13 at 10:30 AM Tue, Oct 13 at 11:00 AM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: find_client
  ok   tool: check_availability
  ok   regex: hydra ?facial
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? Oct(ober)?\.? 13\b
  ok   no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
STEP 2 send: The first one, please.
  exec 21929 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: HydraFacial (60 min) — Tue, Oct 13, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: HydraFacial
  ok   tool: propose_booking
STATE
  CLIENT: {"client_id":"C-test-D9000000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  APPT: A-MUVN5DAXENO hydrafacial 2026-10-13T10:00:00+02:00 pending event=- reminder_sent_at=-
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
DIALOG 02-returning-same-as-last-time.md channel=wa contact=wa:+15550000102 started 2026-10-05T19:27:12.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 21944 success; route agent; tools ["find_client","check_availability"]
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
  exec 21949 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: HydraFacial (60 min) — Tue, Oct 13, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: HydraFacial
  ok   tool: propose_booking
STATE
  CLIENT: {"client_id":"C-test-D15550000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  APPT: A-MUVN6BSD1K9 hydrafacial 2026-10-13T10:00:00+02:00 pending event=- reminder_sent_at=-
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
DIALOG 03-reschedule.md channel=tg contact=tg:9000000103 started 2026-10-05T19:27:58.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 21968 success; route agent; tools ["find_client","check_availability"]
  <- reply: Hi Paul! Here are afternoon openings on <b>Mon, Jan 7, 2030</b>: 12:30 PM 1:00 PM 1:30 PM 2:00 PM Which one works for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 2 send: The first one, please.
  exec 21973 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 12:30 PM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] | sort == ["booked", "pending"]
  ok   state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
STEP 3 send: YES
  exec 21986 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 12:30 PM. We'll remind you 24 hours before. To change or cancel, just message me here.
  ok   templates: BOOKED
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D9000000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVN6V05MTO botox 2030-01-07T12:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MUVN7KH07CX botox 2030-01-07T12:30:00+01:00 booked event=appt412d4d55564e374b4830374358 reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T12:30:00+01:00 A-MUVN7KH07CX
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 12:00 PM — A-MUVN6V05MTO
  OWNER: 🔁 Rescheduled, old visit cancelled: Paul Movetest (tg:9000000103) — botox — Mon, Jan 7, 12:00 PM — A-MUVN6V05MTO
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 12:30 PM — A-MUVN7KH07CX — replaces A-MUVN6V05MTO
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
DIALOG 03-reschedule.md channel=wa contact=wa:+15550000103 started 2026-10-05T19:29:17.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 22009 success; route agent; tools ["find_client","check_availability"]
  <- reply: Hi Paul! Here are afternoon openings for your Botox on Mon, Jan 7, 2030: 12:30 PM 1:00 PM 2:00 PM 3:00 PM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 2 send: The first one, please.
  exec 22014 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 12:30 PM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] | sort == ["booked", "pending"]
  ok   state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
STEP 3 send: YES
  exec 22027 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 12:30 PM. We'll remind you 24 hours before. To change or cancel, just message me here.
  ok   templates: BOOKED
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D15550000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVN8JSZIH9 botox 2030-01-07T12:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MUVN9AS5CDK botox 2030-01-07T12:30:00+01:00 booked event=appt412d4d55564e3941533543444b reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T12:30:00+01:00 A-MUVN9AS5CDK
  OWNER: ✅ New booking: Paul Movetest (wa:+15550000103) — Botox — Mon, Jan 7, 12:00 PM — A-MUVN8JSZIH9
  OWNER: 🔁 Rescheduled, old visit cancelled: Paul Movetest (wa:+15550000103) — botox — Mon, Jan 7, 12:00 PM — A-MUVN8JSZIH9
  OWNER: ✅ New booking: Paul Movetest (wa:+15550000103) — Botox — Mon, Jan 7, 12:30 PM — A-MUVN9AS5CDK — replaces A-MUVN8JSZIH9
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
DIALOG 04-late-cancel.md channel=tg contact=tg:9000000104 started 2026-10-05T19:30:42.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 22050 success; route agent; tools ["find_client"]
  <- reply: You have one upcoming appointment: <b>Botox on Tue, Oct 6 at 1:00 AM</b>. Shall I cancel that one for you?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Yes, please cancel it.
  exec 22054 success; route agent; tools ["cancel_booking"]
  <- reply: Your Botox appointment is cancelled. Since it was within 24 hours of the start time, it's recorded as a <b>late cancellation</b>. Let me know if you'd like me to book a new time.
  ok   templates: reply
  ok   lang: en
  ok   state: [.appts[].status] == ["late_cancel"]
STEP 3 send: What is your cancellation policy?
  exec 22063 success; route agent; tools ["search_knowledge"]
  <- reply: You can cancel or reschedule free of charge up to <b>24 hours before</b> your appointment. Cancellations less than 24 hours ahead, and no-shows, are recorded and may require a deposit for future bookings. Also, if you arrive more than 15 mi
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \b24\b
STATE
  CLIENT: {"client_id":"C-test-D9000000104","name":"Carl Latetest","language":"en","status":"flagged","intake_completed":null}
  APPT: A-MUVNAE26876 botox 2026-10-06T01:00:00+02:00 late_cancel event=- reminder_sent_at=-
  OWNER: ✅ New booking: Carl Latetest (tg:9000000104) — Botox — Tue, Oct 6, 1:00 AM — A-MUVNAE26876
  OWNER: ⚠️ LATE cancellation: Carl Latetest (tg:9000000104) — botox — Tue, Oct 6, 1:00 AM — A-MUVNAE26876 — client flagged
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
DIALOG 04-late-cancel.md channel=wa contact=wa:+15550000104 started 2026-10-05T19:31:51.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 22082 success; route agent; tools ["find_client"]
  <- reply: I see one upcoming appointment: Botox on Tue, Oct 6 at 1:00 AM. Shall I cancel that one for you?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Yes, please cancel it.
  exec 22086 success; route agent; tools ["cancel_booking"]
  <- reply: Your Botox appointment is cancelled, Carl. Since it was within 24 hours of the start time, it's recorded as a late cancellation. Let me know if you'd like to rebook.
  ok   templates: reply
  ok   lang: en
  ok   state: [.appts[].status] == ["late_cancel"]
STEP 3 send: What is your cancellation policy?
  exec 22095 success; route agent; tools ["search_knowledge"]
  <- reply: You can reschedule or cancel free of charge up to 24 hours before your appointment. Cancellations less than 24 hours ahead, as well as no-shows, are recorded and may require a deposit for future bookings. Also, if you arrive more than 15 mi
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \b24\b
STATE
  CLIENT: {"client_id":"C-test-D15550000104","name":"Carl Latetest","language":"en","status":"flagged","intake_completed":null}
  APPT: A-MUVNBV28FRY botox 2026-10-06T01:00:00+02:00 late_cancel event=- reminder_sent_at=-
  OWNER: ✅ New booking: Carl Latetest (wa:+15550000104) — Botox — Tue, Oct 6, 1:00 AM — A-MUVNBV28FRY
  OWNER: ⚠️ LATE cancellation: Carl Latetest (wa:+15550000104) — botox — Tue, Oct 6, 1:00 AM — A-MUVNBV28FRY — client flagged
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
DIALOG 05-cancel-not-yours.md channel=tg contact=tg:9000000105 started 2026-10-05T19:33:00.000Z (clean start checked)
SECOND contact=tg:9000000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 22109 success; route agent; tools ["find_client"]
  <- reply: I can't find that appointment under your contact — there are no upcoming bookings on your record. If you'd like, I can help you book a new appointment, or pass this to a team member to check further.
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  ok   regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   state: [.second.appts[].status] == ["booked"]
STEP 2 send: It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest.
  exec 22117 success; route agent; tools []
  <- reply: I'm sorry — I can only cancel appointments booked under your own contact, and that one isn't on your record. I can't make changes to another person's booking for privacy reasons. Would you like me to pass this to a team member, or can I hel
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
DIALOG 05-cancel-not-yours.md channel=wa contact=wa:+15550000105 started 2026-10-05T19:33:57.000Z (clean start checked)
SECOND contact=wa:+15550000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 22130 success; route agent; tools ["find_client"]
  <- reply: Hi Nina, I can't find that appointment under your contact — there are no upcoming bookings on your file. If you'd like, I can help you book a new appointment or pass this to a team member to look into.
  ok   templates: reply
  ok   lang: en
  ok   regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  ok   regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   state: [.second.appts[].status] == ["booked"]
STEP 2 send: It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest.
  exec 22138 success; route agent; tools []
  <- reply: I'm sorry, but I can only cancel appointments booked under your own contact, and that one isn't on your file. If Maria needs to cancel, she can message us from her own contact — or I can pass this to a team member to handle.
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
DIALOG 06-knowledge-in-base.md channel=tg contact=tg:9000000106 started 2026-10-05T19:34:41.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 22151 success; route agent; tools ["find_client","search_knowledge"]
  <- reply: Hello! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Yes — we have free client parking in the courtyard at 12 Rosenstrasse, with the entrance from Rosenstrasse (we're on the second floor). Would you lik
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: courtyard|free (client )?parking
STEP 2 send: How much is filler and is there a deposit?
  exec 22156 success; route agent; tools ["search_knowledge"]
  <- reply: Dermal filler is $550 per syringe and takes about 45 minutes. A $100 deposit is required when booking, and the rest is paid at the clinic. Would you like me to look for an appointment?
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \$\s?550\b
  ok   regex: \$\s?100\b[^.]*deposit|deposit[^.]*\$\s?100\b
STATE
  CLIENT: {"client_id":"C-test-MUVNFGHR","name":null,"language":"en","status":"new","intake_completed":null}
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "new"
  ok   state: (.owner | length) == 0
SUMMARY: client=new/en appts=- events=0 sent=reply,reply
RESULT PASS 06-knowledge-in-base.md tg
```

### 06-knowledge-in-base, wa

```text
DIALOG 06-knowledge-in-base.md channel=wa contact=wa:+15550000106 started 2026-10-05T19:35:17.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 22162 success; route agent; tools ["find_client","search_knowledge"]
  <- reply: Hello, and welcome to Glow Aesthetics Med-Spa — I'm the clinic's AI assistant, and a team member can take over anytime you'd like. Yes, we have free client parking in the courtyard, with the entrance from Rosenstrasse (we're at 12 Rosenstra
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: courtyard|free (client )?parking
STEP 2 send: How much is filler and is there a deposit?
  exec 22167 success; route agent; tools ["search_knowledge"]
  <- reply: Dermal filler is $550 per syringe and takes about 45 minutes. A $100 deposit is taken at the time of booking, with the balance paid at the clinic after your treatment. Would you like me to look for an appointment time?
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \$\s?550\b
  ok   regex: \$\s?100\b[^.]*deposit|deposit[^.]*\$\s?100\b
STATE
  CLIENT: {"client_id":"C-test-MUVNG82H","name":null,"language":"en","status":"new","intake_completed":null}
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: (.appts | length) == 0
  ok   state: .client.status == "new"
  ok   state: (.owner | length) == 0
SUMMARY: client=new/en appts=- events=0 sent=reply,reply
RESULT PASS 06-knowledge-in-base.md wa
```

### 07-medical-out-of-base, tg

```text
DIALOG 07-medical-out-of-base.md channel=tg contact=tg:9000000107 started 2026-10-05T19:36:11.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 22173 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Botox is 30 minutes at $350 — would you like me to look for an appointment, or do you have questions first?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Can I do Botox while on warfarin and 20 mg of prednisone?
  exec 22177 success; route agent; tools ["search_knowledge","escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   owner: Escalation —
  ok   owner: Client: .*thinking about getting Botox
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Are you there?
  exec 22183 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, what are your opening hours on Saturday?
  exec 22185 success; route agent; tools ["search_knowledge"]
  <- reply: On Saturdays we're open 10:00 to 16:00. A team member will still be in touch with you about your earlier question.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNHE47","name":null,"language":"en","status":"active","intake_completed":null}
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
DIALOG 07-medical-out-of-base.md channel=wa contact=wa:+15550000107 started 2026-10-05T19:37:16.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 22191 success; route agent; tools ["find_client"]
  <- reply: Hi, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Botox is 30 minutes at $350 — would you like me to look for an appointment, or do you have questions first?
  ok   templates: reply
  ok   lang: en
STEP 2 send: Can I do Botox while on warfarin and 20 mg of prednisone?
  exec 22195 success; route agent; tools ["search_knowledge","escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   owner: Escalation —
  ok   owner: Client: .*thinking about getting Botox
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Are you there?
  exec 22201 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, what are your opening hours on Saturday?
  exec 22203 success; route agent; tools ["search_knowledge"]
  <- reply: On Saturdays we're open 10:00 to 16:00. A team member will still be in touch about your earlier question.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNIRLH","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — wa:+15550000107 Name: unnamed client Reason: Medical safety question about Botox with the client's current medications; not covered by the knowledge base. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi, I'm thinking about gettin
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 07-medical-out-of-base.md wa
```

### 08-talk-to-human, tg

```text
DIALOG 08-talk-to-human.md channel=tg contact=tg:9000000108 started 2026-10-05T19:38:18.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 22209 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  ok   templates: reply
  ok   lang: en
STEP 2 send: I want to talk to a human, please.
  exec 22213 success; route agent; tools ["escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   tool: escalate
  ok   owner: Escalation —
  ok   owner: Client: Hi there
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Is anyone there?
  exec 22218 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, do you have parking?
  exec 22220 success; route agent; tools ["search_knowledge"]
  <- reply: Yes — we have free client parking in the courtyard at 12 Rosenstrasse, Berlin 10178, with the entrance from Rosenstrasse. We're on the second floor, and Alexanderplatz U-Bahn is about 5 minutes away on foot. A team member will still be in t
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNK3CJ","name":null,"language":"en","status":"active","intake_completed":null}
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
DIALOG 08-talk-to-human.md channel=wa contact=wa:+15550000108 started 2026-10-05T19:39:09.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 22226 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  ok   templates: reply
  ok   lang: en
STEP 2 send: I want to talk to a human, please.
  exec 22230 success; route agent; tools ["escalate"]
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
  ok   templates: ESCALATED_REPLY
  ok   lang: en
  ok   tool: escalate
  ok   owner: Escalation —
  ok   owner: Client: Hi there
  ok   state: .client.status == "escalated"
STEP 3 send: Hello? Is anyone there?
  exec 22235 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   templates: ESCALATED_HOLD
  ok   no-node: Agent
STEP 4 run: client_set status active
  ok   templates: none
STEP 5 send: Hi again, do you have parking?
  exec 22237 success; route agent; tools []
  <- reply: A team member will be with you shortly and can answer that about parking.
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNL76A","name":null,"language":"en","status":"active","intake_completed":null}
  OWNER: 🚨 Escalation — wa:+15550000108 Name: unnamed client Reason: Client explicitly requested to speak with a human. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: Hi there! Bot: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, an
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.status == "active"
  ok   state: [.owner[] | select(test("Escalation —"))] | length == 1
  ok   state: (.appts | length) == 0
SUMMARY: client=active/en appts=- events=0 sent=reply,ESCALATED_REPLY,ESCALATED_HOLD,reply
RESULT PASS 08-talk-to-human.md wa
```

### 12-russian-client, tg

```text
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-05T19:40:01.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 22242 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и по вашей просьбе к разговору всегда может подключиться сотрудник. Подскажите, пожалуйста, ваши имя и фамилию для записи на ботокс.
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
STEP 2 send: Меня зовут Ольга Тестова.
  exec 22246 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток (утро, день или вечер) вам удобно записаться?
  ok   templates: reply
  ok   lang: ru
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 22249 success; route agent; tools ["check_availability"]
  <- reply: На понедельник, 7 января 2030 г., утром свободно: понедельник, 7 января 2030 г., 10:00 понедельник, 7 января 2030 г., 10:30 понедельник, 7 января 2030 г., 11:00 понедельник, 7 января 2030 г., 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
STEP 4 send: Первый вариант, пожалуйста.
  exec 22253 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 min) — Mon, Jan 7, 10:00 AM. Ответьте YES для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
STEP 5 send: да
  exec 22257 success; route confirm; tools []
  <- BOOKED: Вы забронированы: Botox (30 min) — Mon, Jan 7, 10:00 AM. Мы напомним вам за 24 часа до процедуры. Чтобы изменить или отменить, просто напишите мне здесь.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу короткую форму регистрации и согласия (около 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNMBDO","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MUVNN9Y3A9C botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d55564e4e395933413943 reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MUVNN9Y3A9C
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MUVNN9Y3A9C
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
DIALOG 12-russian-client.md channel=wa contact=wa:+15550000112 started 2026-10-05T19:41:29.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 22274 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, при желании可以 подключить сотрудника. Подскажите, пожалуйста, ваши имя и фамилию для записи?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
STEP 2 send: Меня зовут Ольга Тестова.
  exec 22278 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток вам удобно записаться на ботокс?
  ok   templates: reply
  ok   lang: ru
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 22281 success; route agent; tools ["check_availability"]
  <- reply: На ботокс в понедельник, 7 января 2030 года, утром свободно: 10:00 10:30 11:00 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
STEP 4 send: Первый вариант, пожалуйста.
  exec 22285 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 min) — Mon, Jan 7, 10:00 AM. Ответьте YES для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
STEP 5 send: да
  exec 22289 success; route confirm; tools []
  <- BOOKED: Вы забронированы: Botox (30 min) — Mon, Jan 7, 10:00 AM. Мы напомним вам за 24 часа до этого. Чтобы изменить или отменить, просто напишите мне здесь.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу короткую форму регистрации и согласия (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNO742","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MUVNP62NQJY botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d55564e5036324e514a59 reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MUVNP62NQJY
  OWNER: ✅ New booking: Ольга Тестова (wa:+15550000112) — Botox — Mon, Jan 7, 10:00 AM — A-MUVNP62NQJY
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
DIALOG 11-spanish-client.md channel=tg contact=tg:9000000111 started 2026-10-05T19:42:57.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 22306 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy la asistente virtual (IA) de Glow Aesthetics Med-Spa, y si lo prefieres un miembro del equipo puede atenderte. Con gusto te reservo el Botox: ¿me dices tu nombre y apellido, por favor?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
STEP 2 send: Me llamo Lucía Pruebas.
  exec 22310 success; route agent; tools []
  <- reply: Encantada, Lucía. ¿Qué día te vendría bien y prefieres mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 22313 success; route agent; tools ["check_availability"]
  <- reply: Tengo estos horarios disponibles para el <b>lunes 7 de enero de 2030</b>: 10:00, 10:30, 11:00 y 11:30 de la mañana. ¿Cuál prefieres?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
STEP 4 send: La primera, por favor.
  exec 22317 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, ene 7, 10:00 AM. Responda YES para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
STEP 5 send: sí
  exec 22321 success; route confirm; tools []
  <- BOOKED: Estás reservado: Botox (30 min) — Mon, Jan 7, 10:00 AM. Te recordaremos 24 horas antes. Para cambiar o cancelar, solo envíame un mensaje aquí.
  <- BOOKED_INTAKE: Antes de su primera visita, por favor complete nuestro breve formulario de admisión y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNQ2JC","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MUVNR2RTKSG botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d55564e523252544b5347 reminder_sent_at=-
  EVENT: Botox — Lucía Pruebas 2030-01-07T10:00:00+01:00 A-MUVNR2RTKSG
  OWNER: ✅ New booking: Lucía Pruebas (tg:9000000111) — Botox — Mon, Jan 7, 10:00 AM — A-MUVNR2RTKSG
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
DIALOG 11-spanish-client.md channel=wa contact=wa:+15550000111 started 2026-10-05T19:44:21.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 22338 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy el asistente virtual (IA) de Glow Aesthetics Med-Spa, y si lo prefiere, un miembro del equipo puede atenderle en cualquier momento. Con gusto le reservo el Botox. ¿Me indica su nombre y apellido, por favor?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
STEP 2 send: Me llamo Lucía Pruebas.
  exec 22342 success; route agent; tools []
  <- reply: Gracias, Lucía. ¿Qué día le viene bien y prefiere mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 22345 success; route agent; tools ["check_availability"]
  <- reply: Tengo estos horarios disponibles para Botox: lunes 7 de enero de 2030 a las 10:00 lunes 7 de enero de 2030 a las 10:30 lunes 7 de enero de 2030 a las 11:00 lunes 7 de enero de 2030 a las 11:30 ¿Cuál prefiere?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
STEP 4 send: La primera, por favor.
  exec 22349 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, 7 de enero, 10:00 AM. Responda YES para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
STEP 5 send: sí
  exec 22353 success; route confirm; tools []
  <- BOOKED: Estás reservada: Botox (30 min) — Mon, Jan 7, 10:00 AM. Te recordaremos 24 horas antes. Para cambiar o cancelar, simplemente envíame un mensaje aquí.
  <- BOOKED_INTAKE: Antes de su primera visita, complete nuestro breve formulario de admisión y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNRVZW","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MUVNSU59AMK botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d55564e53553539414d4b reminder_sent_at=-
  EVENT: Botox — Lucía Pruebas 2030-01-07T10:00:00+01:00 A-MUVNSU59AMK
  OWNER: ✅ New booking: Lucía Pruebas (wa:+15550000111) — Botox — Mon, Jan 7, 10:00 AM — A-MUVNSU59AMK
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
DIALOG 10-two-clients-one-slot.md channel=tg contact=tg:9000000110 started 2026-10-05T19:45:46.000Z (clean start checked)
SECOND contact=wa:+15550000210 (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 22370 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
STEP 2 send: My name is Ann Firsttest.
  exec 22374 success; route agent; tools []
  <- reply: Thanks, Ann! Which day works best for you, and do you prefer morning, afternoon or evening?
  ok   templates: reply
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 22377 success; route agent; tools ["check_availability"]
  <- reply: I have these morning openings for Botox: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one would you like?
  ok   templates: reply
  ok   regex: \b10:00\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: 10:00 AM, please.
  exec 22381 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: 10:00 AM
STEP 5 send2 (wa:+15550000210): Hi! I'd like to book Botox.
  exec 22385 success; route agent; tools ["find_client"]
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name to get the Botox booking started?
  ok   templates: reply
STEP 6 send2 (wa:+15550000210): My name is Bea Secondtest.
  exec 22389 success; route agent; tools []
  <- reply: Thanks, Bea! Which day would you like to come in for your Botox appointment?
  ok   templates: reply
STEP 7 send2 (wa:+15550000210): Monday, January 7, 2030, in the morning, please.
  exec 22392 success; route agent; tools ["check_availability"]
  <- reply: I have these morning openings: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one works best for you?
  ok   templates: reply
  ok   regex: \b10:00\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 8 send2 (wa:+15550000210): 10:00 AM, please.
  exec 22396 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   regex: 10:00 AM
  ok   state: [.appts[].status] == ["pending"] and [.second.appts[].status] == ["pending"] and .appts[0].start_iso == .second.appts[0].start_iso
STEP 9 send: YES
  exec 22408 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll remind you 24 hours before. To change or cancel, just message me here.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   node: Confirm
STEP 10 send2 (wa:+15550000210): YES
  exec 22413 success; route confirm; tools []
  <- SLOT_TAKEN: Sorry — that time was just taken by another booking. Nearby options: Mon, Jan 7, 10:30 AM; Mon, Jan 7, 11:00 AM; Mon, Jan 7, 11:30 AM. Which one works for you?
  ok   templates: SLOT_TAKEN
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MUVNTPYA","name":"Ann Firsttest","language":"en","status":"active","intake_completed":null}
  APPT: A-MUVNUNV1KRU botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d55564e554e56314b5255 reminder_sent_at=-
  EVENT: Botox — Ann Firsttest 2030-01-07T10:00:00+01:00 A-MUVNUNV1KRU
STATE second wa:+15550000210
  CLIENT: {"client_id":"C-test-MUVNUW86","name":"Bea Secondtest","language":"en","status":"new","intake_completed":null}
  APPT: A-MUVNVUBR9GL botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Ann Firsttest (tg:9000000110) — Botox — Mon, Jan 7, 10:00 AM — A-MUVNUNV1KRU
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
DIALOG 09-spam.md channel=tg contact=tg:9000000109 started 2026-10-05T19:48:26.000Z (clean start checked)
STEP 1 burst: 20 x 'hi', one every 5s
  20 messages posted from 19:48:27 to 19:50:05Z
  exec 22437 success; route agent; tools ["find_client"]
  exec 22440 success; route agent; tools ["find_client"]
  exec 22444 success; route agent; tools ["escalate"]
  exec 22447 success; route agent; tools ["escalate"]
  exec 22452 success; route -; tools []
  exec 22456 success; route -; tools []
  exec 22458 success; route -; tools []
  exec 22460 success; route -; tools []
  exec 22462 success; route -; tools []
  exec 22464 success; route -; tools []
  exec 22466 success; route -; tools []
  exec 22468 success; route -; tools []
  exec 22470 success; route -; tools []
  exec 22472 success; route -; tools []
  exec 22474 success; route -; tools []
  exec 22476 success; route -; tools []
  exec 22478 success; route -; tools []
  exec 22480 success; route -; tools []
  exec 22482 success; route -; tools []
  exec 22484 success; route -; tools []
  <- reply: Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?
  <- reply: Hello again! Would you like to book a treatment or ask a question about our services?
  <- ESCALATED_REPLY: I've passed this to our team — a team member will contact you shortly.
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
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   count: 20
  ok   templates-in: reply|ESCALATED_REPLY|ESCALATED_HOLD
  ok   state: [.owner[] | select(test("Escalation —"))] | length <= 1
STEP 2 send: hi
  exec 22486 success; route -; tools []
  <- RATE_LIMIT: You have sent many messages in a short time. I will pause for a few minutes; a team member has been notified.
  ok   templates: RATE_LIMIT
  ok   node: Send Rate Limit
  ok   no-node: Agent
  ok   owner: Rate limit: .* sent 21 messages
STEP 3 burst: 4 x 'hi', one every 5s
  4 messages posted from 19:50:16 to 19:50:31Z
  exec 22489 success; route -; tools []
  exec 22490 success; route -; tools []
  exec 22491 success; route -; tools []
  exec 22492 success; route -; tools []
  ok   templates: none
  ok   no-node: Agent
  ok   no-node: Send Rate Limit
  ok   no-node: Notify Spam
STEP 4 run: rate_limit_reset
  rate_limit_reset: wf1_rate_limit row of tg:9000000109 deleted instead of waiting 10 minutes
  ok   templates: none
STEP 5 send: hi, are you back?
  exec 22493 success; route -; tools []
  <- ESCALATED_HOLD: A team member will contact you shortly. Automatic replies are paused for this conversation.
  ok   count: 1
  ok   templates-in: reply|ESCALATED_HOLD|ESCALATED_REPLY
  ok   node: Client Data
  ok   no-node: Send Rate Limit
STATE
  CLIENT: {"client_id":"C-test-MUVNX520","name":null,"language":"en","status":"escalated","intake_completed":null}
  OWNER: 🚨 Escalation — tg:9000000109 Name: unnamed client Reason: Client has sent three greetings with no request; unable to determine what they need. Status: client on file - being set to escalated (you get a second message if that fails) --- Client: hi Bot: Hi, welcome to Glow Aesthetics Med-Spa! I'm the 
  OWNER: ⛔ Rate limit: tg:9000000109 sent 21 messages in 10 minutes; paused
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.outbox[] | select(.template_key == "RATE_LIMIT")] | length == 1
  ok   state: [.owner[] | select(test("Rate limit"))] | length == 1
  ok   state: [.owner[] | select(test("Escalation —"))] | length <= 1
  ok   state: (.outbox | length) == 22
SUMMARY: client=escalated/en appts=- events=0 sent=reply,reply,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_REPLY,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,ESCALATED_HOLD,RATE_LIMIT,ESCALATED_HOLD
RESULT PASS 09-spam.md tg
```
