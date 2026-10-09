# Task 20 level 2, run 2 (final configuration): 12 dialogs

| | |
|---|---|
| Started | 2026-10-09T12:09:32Z |
| Finished | 2026-10-09T12:23:38Z |
| Dialogs | 01 02 03 04 05 06 07 08 12 11 10 09 |
| Result | passed 2, failed 20 |
| Final cleanup | ok: cleanup done |

- Final configuration at commit 20205e8, unchanged since run 1 (2026-10-09 11:31-12:02Z); run 1 was followed by three re-runs of dialog 05 alone, no configuration change. Started 2026-10-09 outside 06:30-07:25 UTC.
- Dialog 09: the 10-minute recovery is checked by clearing that test contact rows in wf1_rate_limit in teardown.

| dialog | channel | result | state | notes |
|---|---|---|---|---|
| 01-new-client-books | tg | PASS | client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED |  |
| 01-new-client-books | wa | PASS | client=active/en appts=confirmed events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,REMINDER,REMINDER_CONFIRMED |  |
| 02-returning-same-as-last-time | tg | FAIL | client=active/en appts=done events=0 sent=ERROR | templates: reply (got: ERROR);tool: find_client;tool: check_availability |
| 02-returning-same-as-last-time | wa | FAIL | client=active/en appts=done events=0 sent=ERROR | templates: reply (got: ERROR);tool: find_client;tool: check_availability |
| 03-reschedule | tg | FAIL | client=active/en appts=booked events=1 sent=ERROR | templates: reply (got: ERROR);tool: check_availability;regex: \b\d{1,2}:\d{2}\b |
| 03-reschedule | wa | FAIL | client=active/en appts=booked events=1 sent=ERROR | templates: reply (got: ERROR);tool: check_availability;regex: \b\d{1,2}:\d{2}\b |
| 04-late-cancel | tg | FAIL | client=active/en appts=confirmed events=1 sent=ERROR | templates: LATE_CANCEL_PENDING (got: ERROR);tool: request_cancel;node: Send Cancel Ask |
| 04-late-cancel | wa | FAIL | client=active/en appts=confirmed events=1 sent=ERROR | templates: LATE_CANCEL_PENDING (got: ERROR);tool: request_cancel;node: Send Cancel Ask |
| 05-cancel-not-yours | tg | FAIL | client=active/en appts=- events=0 sent=ERROR | second: client=active/en appts=booked events=0 sent= | templates: reply (got: ERROR);regex: \b(can.?t\|cannot\|couldn.?t\|unable to\|not able to\|don.?t\|do not)\b[^.]{0,60}\b(find\|locate\|see)\b;regex: \byour (own )?(contact\|number\|account\|profile\|chat\|phone) |
| 05-cancel-not-yours | wa | FAIL | client=active/en appts=- events=0 sent=ERROR | second: client=active/en appts=booked events=0 sent= | templates: reply (got: ERROR);regex: \b(can.?t\|cannot\|couldn.?t\|unable to\|not able to\|don.?t\|do not)\b[^.]{0,60}\b(find\|locate\|see)\b;regex: \byour (own )?(contact\|number\|account\|profile\|chat\|phone) |
| 06-knowledge-in-base | tg | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR);tool: search_knowledge;regex: courtyard\|free (client )?parking |
| 06-knowledge-in-base | wa | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR);tool: search_knowledge;regex: courtyard\|free (client )?parking |
| 07-medical-out-of-base | tg | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR) |
| 07-medical-out-of-base | wa | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR) |
| 08-talk-to-human | tg | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR) |
| 08-talk-to-human | wa | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR) |
| 12-russian-client | tg | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR);lang: ru;regex: ИИ\|искусственн |
| 12-russian-client | wa | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR);lang: ru;regex: ИИ\|искусственн |
| 11-spanish-client | tg | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR);lang: es;regex: \bIA\b\|inteligencia artificial |
| 11-spanish-client | wa | FAIL | client=new/- appts=- events=0 sent=ERROR | templates: reply (got: ERROR);lang: es;regex: \bIA\b\|inteligencia artificial |
| 10-two-clients-one-slot | tg | FAIL | client=new/- appts=- events=0 sent=ERROR | second: client=-/- appts=- events=0 sent= | templates: reply (got: ERROR) |
| 09-spam | tg | FAIL | client=new/- appts=- events=0 sent=ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR | templates-in: reply\|ESCALATED_REPLY\|ESCALATED_HOLD (got: ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR,ERROR) |

## Raw output

### 01-new-client-books, tg

```text
DIALOG 01-new-client-books.md channel=tg contact=tg:9000000101 started 2026-10-09T12:09:35.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 26903 success; route agent; tools ["find_client"]
  <- reply: Hi! I'm the clinic's AI assistant — a team member can take over any time you'd like. I'd be happy to book your Botox appointment; could I have your first and last name, please?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 26907 success; route agent; tools []
  <- reply: Thanks, Dana! What day would you like to come in, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 26910 success; route agent; tools ["check_availability"]
  <- reply: I have these morning openings on <b>Mon, Jan 7, 2030</b>: 10:00 AM 10:30 AM 11:00 AM 11:30 AM Which one works for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 26914 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   regex: free cancellation up to 24 hours before\. reply yes to confirm
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 26922 success; route confirm; tools []
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
  reminder_leg: A-MV0XBHMW2AS moved to 2026-10-10 11:00 Europe/Berlin (tomorrow)
  webhook wf5-reminders -> HTTP 200
  execution 26935: success, finished=true, started 2026-10-09T12:11:10.314Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER: Reminder: Botox — Sat, Oct 10, 11:00 AM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   tg.wa_template: none
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 26941 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Sat, Oct 10, 11:00 AM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV0XAGF6","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MV0XBHMW2AS botox 2026-10-10T09:00:00.000Z confirmed event=appt412d4d56305842484d57324153 reminder_sent_at=2026-10-09T12:11:14.170Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MV0XBHMW2AS
  OWNER: ✅ New booking: Dana Testova (tg:9000000101) — Botox — Mon, Jan 7, 10:00 AM — A-MV0XBHMW2AS
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
DIALOG 01-new-client-books.md channel=wa contact=wa:+15550000101 started 2026-10-09T12:11:43.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 26956 success; route agent; tools ["find_client"]
  <- reply: Hi! I'm Glow Aesthetics' AI assistant, and a team member can take over any time you'd like. I'd be happy to book your Botox appointment — could I have your first and last name?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 26960 success; route agent; tools []
  <- reply: Thanks, Dana! What day would work best for you, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 26963 success; route agent; tools ["check_availability"]
  <- reply: We have these openings that morning: Mon, Jan 7, 2030 at 10:00 AM Mon, Jan 7, 2030 at 10:30 AM Mon, Jan 7, 2030 at 11:00 AM Mon, Jan 7, 2030 at 11:30 AM Which one would you like?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 26967 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. Free cancellation up to 24 hours before. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   regex: free cancellation up to 24 hours before\. reply yes to confirm
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 26975 success; route confirm; tools []
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
  reminder_leg: A-MV0XE822RBG moved to 2026-10-10 11:00 Europe/Berlin (tomorrow)
  webhook wf5-reminders -> HTTP 200
  execution 26988: success, finished=true, started 2026-10-09T12:13:11.492Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER [wa template medspa_reminder|en]: Reminder: Botox — Sat, Oct 10, 11:00 AM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   wa.wa_template: medspa_reminder
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 26994 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your Botox on Sat, Oct 10, 11:00 AM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV0XD7RG","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MV0XE822RBG botox 2026-10-10T09:00:00.000Z confirmed event=appt412d4d56305845383232524247 reminder_sent_at=2026-10-09T12:13:15.313Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MV0XE822RBG
  OWNER: ✅ New booking: Dana Testova (wa:+15550000101) — Botox — Mon, Jan 7, 10:00 AM — A-MV0XE822RBG
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
DIALOG 02-returning-same-as-last-time.md channel=tg contact=tg:9000000102 started 2026-10-09T12:13:41.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
SETUP: NW_TZ=$(at_list Settings 1 | jq -er '.records[0].fields.timezone') && NW_TODAY=$(TZ="$NW_TZ" date +%F) && NW_TUE=$(date -d "$NW_TODAY + $((9 - $(date -d "$NW_TODAY" +%u))) days" +%F) && printf '  weekday check: Tuesday of next week = %s (today %s in %s)\n' "$NW_TUE" "$NW_TODAY" "$NW_TZ" >&2
  weekday check: Tuesday of next week = 2026-10-13 (today 2026-10-09 in Europe/Berlin)
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 27009 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: tool: find_client
  FAIL: tool: check_availability
  FAIL: regex: hydra ?facial
  FAIL: regex: \b\d{1,2}:\d{2}\b
  ok   sh: [ -n "$NW_TUE" ] && jq -e --arg r "\\b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\\.?,? ($(date -d "$NW_TUE" +%b)|$(date -d "$NW_TUE" +%B))\\.? $(date -d "$NW_TUE" +%-d)\\b" '[.[].text] | join("\n") | test($r; "i") | not' "$TMP/rows.json"
  ok   no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D9000000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  OWNER: ❌ Reply failed for tg:9000000102: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=done events=0 sent=ERROR
RESULT FAIL 02-returning-same-as-last-time.md tg (5 failed)
```

### 02-returning-same-as-last-time, wa

```text
DIALOG 02-returning-same-as-last-time.md channel=wa contact=wa:+15550000102 started 2026-10-09T12:14:02.000Z (clean start checked)
SETUP: seed_client "$CID" "Rita Returntest" active en
SETUP: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
SETUP: NW_TZ=$(at_list Settings 1 | jq -er '.records[0].fields.timezone') && NW_TODAY=$(TZ="$NW_TZ" date +%F) && NW_TUE=$(date -d "$NW_TODAY + $((9 - $(date -d "$NW_TODAY" +%u))) days" +%F) && printf '  weekday check: Tuesday of next week = %s (today %s in %s)\n' "$NW_TUE" "$NW_TODAY" "$NW_TZ" >&2
  weekday check: Tuesday of next week = 2026-10-13 (today 2026-10-09 in Europe/Berlin)
STEP 1 send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
  exec 27025 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: tool: find_client
  FAIL: tool: check_availability
  FAIL: regex: hydra ?facial
  FAIL: regex: \b\d{1,2}:\d{2}\b
  ok   sh: [ -n "$NW_TUE" ] && jq -e --arg r "\\b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\\.?,? ($(date -d "$NW_TUE" +%b)|$(date -d "$NW_TUE" +%B))\\.? $(date -d "$NW_TUE" +%-d)\\b" '[.[].text] | join("\n") | test($r; "i") | not' "$TMP/rows.json"
  ok   no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D15550000102","name":"Rita Returntest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D02DONE hydrafacial 2026-08-04T10:00:00+02:00 done event=- reminder_sent_at=-
  OWNER: ❌ Reply failed for wa:+15550000102: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=done events=0 sent=ERROR
RESULT FAIL 02-returning-same-as-last-time.md wa (5 failed)
```

### 03-reschedule, tg

```text
DIALOG 03-reschedule.md channel=tg contact=tg:9000000103 started 2026-10-09T12:14:22.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 27045 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: tool: check_availability
  FAIL: regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D9000000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV0XGNUVWKN botox 2030-01-07T12:00:00+01:00 booked event=appt412d4d563058474e5556574b4e reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T12:00:00+01:00 A-MV0XGNUVWKN
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 12:00 PM — A-MV0XGNUVWKN
  OWNER: ❌ Reply failed for tg:9000000103: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=booked events=1 sent=ERROR
RESULT FAIL 03-reschedule.md tg (3 failed)
```

### 03-reschedule, wa

```text
DIALOG 03-reschedule.md channel=wa contact=wa:+15550000103 started 2026-10-09T12:14:52.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 27067 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: tool: check_availability
  FAIL: regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D15550000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV0XHBC4LWY botox 2030-01-07T12:00:00+01:00 booked event=appt412d4d563058484243344c5759 reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T12:00:00+01:00 A-MV0XHBC4LWY
  OWNER: ✅ New booking: Paul Movetest (wa:+15550000103) — Botox — Mon, Jan 7, 12:00 PM — A-MV0XHBC4LWY
  OWNER: ❌ Reply failed for wa:+15550000103: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=booked events=1 sent=ERROR
RESULT FAIL 03-reschedule.md wa (3 failed)
```

### 04-late-cancel, tg

```text
DIALOG 04-late-cancel.md channel=tg contact=tg:9000000104 started 2026-10-09T12:15:23.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 27089 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: LATE_CANCEL_PENDING (got: ERROR)
  ok   lang: en
  FAIL: tool: request_cancel
  FAIL: node: Send Cancel Ask
  ok   no-node: Cancel Visit
  FAIL: regex: less than 24 hours
  FAIL: regex: late cancellation
  FAIL: regex: reply yes to cancel
  ok   state: [.appts[].status] == ["confirmed"]
  ok   state: (.events | length) == 1
  FAIL: state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
  ok   state: [.owner[] | select(test("cancel"; "i"))] | length == 0
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D9000000104","name":"Carl Latetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV0XHZ3VELY botox 2026-10-09T17:30:00+02:00 confirmed event=appt412d4d563058485a3356454c59 reminder_sent_at=-
  EVENT: Botox — Carl Latetest 2026-10-09T17:30:00+02:00 A-MV0XHZ3VELY
  OWNER: ✅ New booking: Carl Latetest (tg:9000000104) — Botox — Fri, Oct 9, 5:30 PM — A-MV0XHZ3VELY
  OWNER: ❌ Reply failed for tg:9000000104: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=confirmed events=1 sent=ERROR
RESULT FAIL 04-late-cancel.md tg (7 failed)
```

### 04-late-cancel, wa

```text
DIALOG 04-late-cancel.md channel=wa contact=wa:+15550000104 started 2026-10-09T12:16:09.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 27127 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: LATE_CANCEL_PENDING (got: ERROR)
  ok   lang: en
  FAIL: tool: request_cancel
  FAIL: node: Send Cancel Ask
  ok   no-node: Cancel Visit
  FAIL: regex: less than 24 hours
  FAIL: regex: late cancellation
  FAIL: regex: reply yes to cancel
  ok   state: [.appts[].status] == ["confirmed"]
  ok   state: (.events | length) == 1
  FAIL: state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
  ok   state: [.owner[] | select(test("cancel"; "i"))] | length == 0
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D15550000104","name":"Carl Latetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV0XIYA4KRQ botox 2026-10-09T17:30:00+02:00 confirmed event=appt412d4d563058495941344b5251 reminder_sent_at=-
  EVENT: Botox — Carl Latetest 2026-10-09T17:30:00+02:00 A-MV0XIYA4KRQ
  OWNER: ✅ New booking: Carl Latetest (wa:+15550000104) — Botox — Fri, Oct 9, 5:30 PM — A-MV0XIYA4KRQ
  OWNER: ❌ Reply failed for wa:+15550000104: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=confirmed events=1 sent=ERROR
RESULT FAIL 04-late-cancel.md wa (7 failed)
```

### 05-cancel-not-yours, tg

```text
DIALOG 05-cancel-not-yours.md channel=tg contact=tg:9000000105 started 2026-10-09T12:16:55.000Z (clean start checked)
SECOND contact=tg:9000000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 27160 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  FAIL: regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   no-node: Send Cancel Ask
  ok   state: [.second.appts[].status] == ["booked"]
  ok   state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D9000000105","name":"Nina Mytest","language":"en","status":"active","intake_completed":null}
STATE second tg:9000000205
  CLIENT: {"client_id":"C-test-D9000000205","name":"Maria Othertest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D05OTHER botox 2030-01-08T11:00:00+01:00 booked event=- reminder_sent_at=-
  OWNER: ❌ Reply failed for tg:9000000105: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=- events=0 sent=ERROR | second: client=active/en appts=booked events=0 sent=
RESULT FAIL 05-cancel-not-yours.md tg (3 failed)
```

### 05-cancel-not-yours, wa

```text
DIALOG 05-cancel-not-yours.md channel=wa contact=wa:+15550000105 started 2026-10-09T12:17:27.000Z (clean start checked)
SECOND contact=wa:+15550000205 (clean start checked)
SETUP: seed_client "$CID" "Nina Mytest" active en
SETUP: seed_client "$CID2" "Maria Othertest" active en
SETUP: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
STEP 1 send: Hi, please cancel appointment A-TEST-D05OTHER.
  exec 27183 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
  FAIL: regex: \byour (own )?(contact|number|account|profile|chat|phone)
  ok   no-node: Send Cancel Ask
  ok   state: [.second.appts[].status] == ["booked"]
  ok   state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-D15550000105","name":"Nina Mytest","language":"en","status":"active","intake_completed":null}
STATE second wa:+15550000205
  CLIENT: {"client_id":"C-test-D15550000205","name":"Maria Othertest","language":"en","status":"active","intake_completed":null}
  APPT: A-TEST-D05OTHER botox 2030-01-08T11:00:00+01:00 booked event=- reminder_sent_at=-
  OWNER: ❌ Reply failed for wa:+15550000105: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=active/en appts=- events=0 sent=ERROR | second: client=active/en appts=booked events=0 sent=
RESULT FAIL 05-cancel-not-yours.md wa (3 failed)
```

### 06-knowledge-in-base, tg

```text
DIALOG 06-knowledge-in-base.md channel=tg contact=tg:9000000106 started 2026-10-09T12:17:59.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 27206 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: tool: search_knowledge
  FAIL: regex: courtyard|free (client )?parking
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XLDDR","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for tg:9000000106: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 06-knowledge-in-base.md tg (3 failed)
```

### 06-knowledge-in-base, wa

```text
DIALOG 06-knowledge-in-base.md channel=wa contact=wa:+15550000106 started 2026-10-09T12:18:19.000Z (clean start checked)
STEP 1 send: Hi, do you have parking?
  exec 27213 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  FAIL: tool: search_knowledge
  FAIL: regex: courtyard|free (client )?parking
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XLSGP","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for wa:+15550000106: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 06-knowledge-in-base.md wa (3 failed)
```

### 07-medical-out-of-base, tg

```text
DIALOG 07-medical-out-of-base.md channel=tg contact=tg:9000000107 started 2026-10-09T12:18:38.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 27220 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XM7BV","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for tg:9000000107: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 07-medical-out-of-base.md tg (1 failed)
```

### 07-medical-out-of-base, wa

```text
DIALOG 07-medical-out-of-base.md channel=wa contact=wa:+15550000107 started 2026-10-09T12:18:58.000Z (clean start checked)
STEP 1 send: Hi, I'm thinking about getting Botox at your clinic.
  exec 27227 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XMMAG","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for wa:+15550000107: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 07-medical-out-of-base.md wa (1 failed)
```

### 08-talk-to-human, tg

```text
DIALOG 08-talk-to-human.md channel=tg contact=tg:9000000108 started 2026-10-09T12:19:17.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 27234 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XN1B5","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for tg:9000000108: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 08-talk-to-human.md tg (1 failed)
```

### 08-talk-to-human, wa

```text
DIALOG 08-talk-to-human.md channel=wa contact=wa:+15550000108 started 2026-10-09T12:19:36.000Z (clean start checked)
STEP 1 send: Hi there!
  exec 27241 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  ok   lang: en
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XNG4X","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for wa:+15550000108: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 08-talk-to-human.md wa (1 failed)
```

### 12-russian-client, tg

```text
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-09T12:19:56.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 27248 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  FAIL: lang: ru
  FAIL: regex: ИИ|искусственн
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XNV78","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for tg:9000000112: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 12-russian-client.md tg (3 failed)
```

### 12-russian-client, wa

```text
DIALOG 12-russian-client.md channel=wa contact=wa:+15550000112 started 2026-10-09T12:20:15.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 27255 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  FAIL: lang: ru
  FAIL: regex: ИИ|искусственн
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XOA66","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for wa:+15550000112: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 12-russian-client.md wa (3 failed)
```

### 11-spanish-client, tg

```text
DIALOG 11-spanish-client.md channel=tg contact=tg:9000000111 started 2026-10-09T12:20:35.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 27262 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  FAIL: lang: es
  FAIL: regex: \bIA\b|inteligencia artificial
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XOPGR","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for tg:9000000111: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 11-spanish-client.md tg (3 failed)
```

### 11-spanish-client, wa

```text
DIALOG 11-spanish-client.md channel=wa contact=wa:+15550000111 started 2026-10-09T12:20:54.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 27269 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  FAIL: lang: es
  FAIL: regex: \bIA\b|inteligencia artificial
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XP4CH","name":null,"language":null,"status":"new","intake_completed":null}
  OWNER: ❌ Reply failed for wa:+15550000111: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR
RESULT FAIL 11-spanish-client.md wa (3 failed)
```

### 10-two-clients-one-slot, tg

```text
DIALOG 10-two-clients-one-slot.md channel=tg contact=tg:9000000110 started 2026-10-09T12:21:14.000Z (clean start checked)
SECOND contact=wa:+15550000210 (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 27276 success; route agent; tools []
  <- ERROR: Something went wrong on our side — a team member will get back to you shortly.
  FAIL: templates: reply (got: ERROR)
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV0XPJW0","name":null,"language":null,"status":"new","intake_completed":null}
STATE second wa:+15550000210
  CLIENT: {"client_id":null,"name":null,"language":null,"status":null,"intake_completed":null}
  OWNER: ❌ Reply failed for tg:9000000110: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
SUMMARY: client=new/- appts=- events=0 sent=ERROR | second: client=-/- appts=- events=0 sent=
RESULT FAIL 10-two-clients-one-slot.md tg (1 failed)
```

### 09-spam, tg

```text
DIALOG 09-spam.md channel=tg contact=tg:9000000109 started 2026-10-09T12:21:35.000Z (clean start checked)
STEP 1 burst: 20 x 'hi', one every 5s
  20 messages posted from 12:21:36 to 12:23:14Z
  exec 27283 success; route agent; tools []
  exec 27284 success; route agent; tools []
  exec 27289 success; route agent; tools []
  exec 27294 success; route agent; tools []
  exec 27299 success; route agent; tools []
  exec 27304 success; route agent; tools []
  exec 27309 success; route agent; tools []
  exec 27314 success; route agent; tools []
  exec 27319 success; route agent; tools []
  exec 27324 success; route agent; tools []
  exec 27329 success; route agent; tools []
  exec 27334 success; route agent; tools []
  exec 27339 success; route agent; tools []
  exec 27344 success; route agent; tools []
  exec 27349 success; route agent; tools []
  exec 27354 success; route agent; tools []
  exec 27359 success; route agent; tools []
  exec 27364 success; route agent; tools []
  exec 27369 success; route agent; tools []
  exec 27374 success; route agent; tools []
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
  CLIENT: {"client_id":"C-test-MV0XPZOB","name":null,"language":null,"status":"new","intake_completed":null}
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
