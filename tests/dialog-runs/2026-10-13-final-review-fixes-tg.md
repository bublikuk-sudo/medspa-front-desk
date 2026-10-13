# Final-review fixes I1-I4: phase 2 deploy and live proof (2026-10-13)

Owner's go-ahead in chat (2026-10-13): "да, заливай исправления финального ревью (I1–I4) на живой бот и запускай живую
проверку (диалоги 01, 03, 04, 15 и тестовые случаи)". Run by the controller. What was fixed (final review of the
branch, phase-1 commits a7a96f8, f5ec16a, 98fc845, dfd5cca, 18167ab, 312473e):

- I1: a booking YES confirms only while the summary is unexpired and is the bot's last message (wf1-inbound `Gate`).
- I2: a reminder "no" is a late cancellation (and flags the client) only inside `Settings.cancellation_hours`
  (reminder_reply).
- I3: the test harness runs only allow-listed tool workflows and only for test contacts (test-harness).
- I4: the medical guardrail matches dose and unit words beyond English (wf2-agent `Guardrail`); wf2-agent also carries
  the new prompt sentences (re-propose after a change of mind; never reveal owner_notes).

## Deploy (controller's report; the command output is in the ledger `progress.md`, not reproduced here)

- Drift check, 14:23Z, read-only: each live workflow pulled with `scripts/n8n-pull.sh` and compared with `jq -S`
  (normalising `webhookId` / `phoneNumberId`) against the last commit that changed it before the fixes:
  reminder_reply `91e1854`, wf2-agent `a7eafa8`, wf1-inbound `735e922`, test-harness `32b898f`. All CONTENT-IDENTICAL.
- Pushes, one at a time, in this order, 14:24:10-14:24:13Z: reminder_reply, wf2-agent (sub-workflows, no activate),
  wf1-inbound `--activate`, test-harness `--activate`. Each was pulled back and compared the same way against the
  commit that changed it last: `f5ec16a`, `312473e`, `a7a96f8`, `dfd5cca`. All CONTENT-IDENTICAL.
  `tests/channels-check.sh`: `channels ok`.
- Stub suites, run on the VPS with the pulled live files as input where the suite takes one:
  - `WF1_STUBS passed 371, failed 0` (live wf1-inbound + wf2-agent);
  - `REMINDER_REPLY_STUBS passed 26, failed 0` (live reminder_reply);
  - `TEST_HARNESS_STUBS passed 24, failed 0` (live test-harness);
  - `CHECK_AVAILABILITY_STUBS passed 29, failed 0` (live wf2-agent with the repo prompt);
  - `SEND_MESSAGE_STUBS passed 318, failed 0` (unchanged workflow, regression only).

## Results

| check | result | evidence |
|---|---|---|
| Harness probe 1: `run-case.sh send_message '{}'` (not on the allow list) | refused | curl `500` (block "Probes and tool cases", line 2). The execution's Unpack output read through the n8n API: `test-harness: workflow "…" is not in the allow-list` (block "Probe executions") |
| Harness probe 2: `run-case.sh find_client` with `tg:123456789` (not a test contact) | refused | curl `500` (line 4); Unpack output: `test-harness: contact_id is not a test contact (tg:9000000NN, tg:9000000NNN, wa:+1555000NNNN)` |
| 20 tool cases, run one by one by name | 20 PASS, 0 FAIL | block "Probes and tool cases". Includes `reminder_no` (free cancel, I2) and the new `reminder_no_late`; every allow-listed tool passed the guard |
| dialog 01 (new client books, tg) | PASS | `RESULT PASS 01-new-client-books.md tg` |
| dialog 03 (reschedule, tg) | PASS | `RESULT PASS 03-reschedule.md tg` |
| dialog 04 (late cancel, tg) | PASS | `RESULT PASS 04-late-cancel.md tg` |
| dialog 15 (change of mind after the summary, tg; new) | PASS | `RESULT PASS 15-change-mind-after-summary.md tg` |

- I1 live (block "Raw output: dialog 15"; "raw line N" = line N of that block):
  - Step 2 sent the summary for 10:00 AM (raw line 14).
  - At step 3 the client asked for the afternoon, and the agent listed afternoon slots (raw line 20).
  - At step 4 a bare "yes" was routed `reminder`, not `confirm` (raw line 27). The agent asked which time; nothing was
    booked, and the morning row stayed pending or cancelled (raw lines 34-35).
  - At step 5 the agent re-proposed 12:00 PM (raw line 38), and the 10:00 row was cancelled (raw line 42).
  - At step 6 "YES" right after that summary was routed `confirm` (raw line 44) and booked 12:00 PM (raw line 45),
    with one calendar event (raw line 60).
  - Dialog 01 is the regression check: a YES straight after a summary still confirms.
- I2 live: tool case `reminder_no` (a 2030 visit, outside the 24-hour window) returned `CANCELLED`, and its checks
  (status `cancelled`, client still `active`) passed. `reminder_no_late` (inside the window) returned `CANCELLED`, and
  its checks (`late_cancel`, client flagged) passed. The checks themselves are in `tests/tool-cases.tsv`.
- I4 has no live test of its own here: no dialog reply contains a dose. Its evidence is the stub suite on the live
  wf2-agent (371/0, multilingual matches and non-matches). The dialogs show that ordinary replies did not trip it,
  since no dialog was escalated.
- Cleanup ran before and after each dialog. After 01, 03 and 15 it deleted the one booked event (`booking events: ok
  DELETED 1 of 1`); 04 ends with the visit cancelled and no event.
- The runner prints each message with whitespace collapsed and cut at 240 characters.

## Probe executions (n8n API, read-only, verbatim)

```
{"id":"29145","status":"success","err":null,"lastNode":"Respond Error"}
{"id":"29144","status":"success","err":null,"lastNode":"Respond Error"}
```

Unpack output of each (workflow ids replaced by `…`):

```
29144: {"error":"test-harness: workflow \"…\" is not in the allow-list [line 10]"}
29145: {"error":"test-harness: contact_id is not a test contact (tg:9000000NN, tg:9000000NNN, wa:+1555000NNNN) [line 16]"}
```

## Probes and tool cases (`remote.sh` output, verbatim)

```
PROBE 1 (send_message, not allow-listed):
curl: (22) The requested URL returned error: 500
PROBE 2 (find_client, real-format contact):
curl: (22) The requested URL returned error: 500
PASS  reminder_none  -> NO_REMINDED
passed 1, failed 0
PASS  reminder_yes  -> CONFIRMED
passed 1, failed 0
PASS  reminder_no  -> CANCELLED
passed 1, failed 0
PASS  reminder_no_late  -> CANCELLED
passed 1, failed 0
PASS  escalate_whatsapp_client  -> ESCALATED
passed 1, failed 0
PASS  escalate_tg_no_digits  -> ESCALATED
passed 1, failed 0
PASS  fixtures_list_empty  -> EVENTS 0
passed 1, failed 0
PASS  find_client_unknown  -> NEW
passed 1, failed 0
PASS  kb_hours  -> FOUND
passed 1, failed 0
PASS  avail_unknown_service  -> UNKNOWN_SERVICE peel (Chemical Peel, 45 min); filler (Dermal Filler, 45 min); laser_small (Laser Hair Removal (small area), 30 min); hydrafacial (HydraFacial, 60 min); consult (Consultation, 20 min); botox (Botox, 30 min); microneedling (Microneedling, 60 min)
passed 1, failed 0
PASS  cancel_not_found  -> NOT_FOUND
passed 1, failed 0
PASS  rcancel_not_found  -> NOT_FOUND
passed 1, failed 0
PASS  escalate_ok  -> ESCALATED
passed 1, failed 0
PASS  escalate_quote_id  -> ESCALATED
passed 1, failed 0
PASS  escalate_empty_id  -> ESCALATED
passed 1, failed 0
PASS  propose_ok  -> PENDING A-MV6RYD7YZS3
passed 1, failed 0
PASS  propose_replaces_pending  -> PENDING A-MV6RYLRE5S1
passed 1, failed 0
PASS  confirm_ok  -> BOOKED A-MV6RYV5NKJ4
passed 1, failed 0
PASS  confirm_expired  -> EXPIRED
passed 1, failed 0
PASS  agent_discloses_ai  -> {"reply":"Hello and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?","template_key":"","tools_used":["find_client"],"cancel_appt_id":"","cancel_verdict":""}
passed 1, failed 0
```

## Raw output: dialog 15 (`15-change-mind-after-summary.md`, tg; verbatim)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 15-change-mind-after-summary.md channel=tg contact=tg:9000000115 started 2026-10-13T14:34:55.000Z (clean start checked)
SETUP: seed_client "$CID" "Mira Changetest" active en
STEP 1 send: Hi, I'd like to book Botox on Monday, January 7, 2030, in the morning.
  exec 29391 success; route agent; tools ["find_client","check_availability"]
  <- reply: Hello Mira, here are the morning openings for Botox: Mon, Jan 7, 2030, 10:00 AM Mon, Jan 7, 2030, 10:30 AM Mon, Jan 7, 2030, 11:00 AM Mon, Jan 7, 2030, 11:30 AM Which time would you like?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
STEP 2 send: The earliest one, please.
  exec 29396 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. You can cancel free of charge no later than 24 hours before the visit. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"] and ((.appts[0].start_iso[11:13] | tonumber) < 12)
STEP 3 send: Actually, can we do another time? Could you check the afternoon of the same day?
  exec 29405 success; route agent; tools ["find_client","check_availability"]
  <- reply: Here are afternoon options: Mon, Jan 7, 2030, 12:00 PM Mon, Jan 7, 2030, 12:30 PM Mon, Jan 7, 2030, 1:00 PM Mon, Jan 7, 2030, 1:30 PM Which one suits you?
  ok   templates: reply
  ok   lang: en
  ok   node: Agent
  ok   no-node: Confirm
  ok   state: [.appts[].status] == ["pending"] and (.events | length) == 0
STEP 4 send: yes
  exec 29414 success; route reminder; tools []
  <- reply: Just to be sure — which afternoon time would you like: 12:00 PM, 12:30 PM, 1:00 PM or 1:30 PM?
  ok   count: 1
  ok   templates-in: reply|PENDING_SUMMARY
  ok   node: Agent
  ok   no-node: Confirm
  ok   no-node: LLM Affirmative
  ok   state: ([.appts[] | select(.status == "booked" or .status == "reminded" or .status == "confirmed")] | length) == 0 and (.events | length) == 0
  ok   state: [.appts[] | select(.start_iso[11:13] | tonumber < 12) | .status] | all(. == "pending" or . == "cancelled")
STEP 5 send: The first afternoon slot, please.
  exec 29425 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 12:00 PM. You can cancel free of charge no later than 24 hours before the visit. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[] | select(.status == "pending") | .start_iso[11:13] | tonumber] | length == 1 and .[0] >= 12
  ok   state: [.appts[] | select(.start_iso[11:13] | tonumber < 12) | .status] == ["cancelled"]
STEP 6 send: YES
  exec 29437 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 12:00 PM. We'll send you a reminder the day before. To change or cancel, just message me here; you can cancel free of charge no later than 24 hours before your visit.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D9000000115","name":"Mira Changetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV6S9DK5VK1 botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MV6SAPAF07P botox 2030-01-07T12:00:00+01:00 booked event=appt412d4d56365341504146303750 reminder_sent_at=-
  EVENT: Botox — Mira Changetest 2030-01-07T12:00:00+01:00 A-MV6SAPAF07P
  OWNER: ✅ New booking: Mira Changetest (tg:9000000115) — Botox — Mon, Jan 7, 12:00 PM — A-MV6SAPAF07P
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[] | select(.status == "booked") | .start_iso] | length == 1 and (.[0] | startswith("2030-01-07T") and (.[11:13] | tonumber) >= 12)
  ok   state: [.appts[] | select(.status != "booked") | .status] | all(. == "cancelled")
  ok   state: [.appts[] | select(.start_iso[11:13] | tonumber < 12) | .status] == ["cancelled"]
  ok   state: (.events | length) == 1 and .events[0].description == ([.appts[] | select(.status == "booked") | .appt_id] | .[0])
  ok   state: .events[0].summary == "Botox — Mira Changetest"
SUMMARY: client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE
RESULT PASS 15-change-mind-after-summary.md tg
EXIT 0
booking events: ok DELETED 1 of 1
calendar cleanup: ok DELETED 0
cleanup done
```

## Raw output: dialog 01 (`01-new-client-books.md`, tg; verbatim)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 01-new-client-books.md channel=tg contact=tg:9000000101 started 2026-10-13T14:28:43.000Z (clean start checked)
STEP 1 send: Hi! I'd like to book Botox.
  exec 29230 success; route agent; tools ["find_client"]
  <- reply: Hello, and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. Could I have your first and last name, please?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
STEP 2 send: My name is Dana Testova.
  exec 29234 success; route agent; tools []
  <- reply: Thank you, Ms. Testova! Which day would you like to come in for Botox, and do you prefer morning, afternoon or evening?
  ok   templates: reply
  ok   lang: en
STEP 3 send: Monday, January 7, 2030, in the morning, please.
  exec 29237 success; route agent; tools ["check_availability"]
  <- reply: I have these morning openings for Botox: Mon, Jan 7, 2030, 10:00 AM Mon, Jan 7, 2030, 10:30 AM Mon, Jan 7, 2030, 11:00 AM Mon, Jan 7, 2030, 11:30 AM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 4 send: The earliest one, please.
  exec 29241 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 10:00 AM. You can cancel free of charge no later than 24 hours before the visit. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   lang: en
  ok   regex: you can cancel free of charge no later than 24 hours before the visit\. reply yes to confirm
  ok   tool: propose_booking
  ok   state: [.appts[].status] == ["pending"]
STEP 5 send: YES
  exec 29249 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 10:00 AM. We'll send you a reminder the day before. To change or cancel, just message me here; you can cancel free of charge no later than 24 hours before your visit.
  <- BOOKED_INTAKE: Before your first visit, please complete our short intake and consent form (about 5 minutes): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   regex: we.ll send you a reminder the day before\. to change or cancel, just message me here; you can cancel free of charge no later than 24 hours before your visit
  ok   no-regex: remind you \d+ hours before
  ok   node: Confirm
  ok   no-node: Agent
  ok   state: [.appts[].status] == ["booked"] and (.events | length) == 1
STEP 6 run: reminder_leg
  reminder_leg: reminder_hours_before 24 -> 1
  reminder_leg: A-MV6S1QPV0HH moved to 2026-10-14 11:00 Europe/Berlin (tomorrow)
  webhook wf5-reminders -> HTTP 200
  execution 29262: success, finished=true, started 2026-10-13T14:30:08.179Z
  settings: reminder_hours_before restored to 24 (read back, attempt 1)
  <- REMINDER: Reminder: Botox — Wed, Oct 14, 11:00 AM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.
  ok   templates: REMINDER
  ok   tg.wa_template: none
  ok   state: [.appts[].status] == ["reminded"]
STEP 7 send: YES
  exec 29268 success; route reminder; tools []
  <- REMINDER_CONFIRMED: Thank you — your appointment for Botox on Wed, Oct 14, 11:00 AM is confirmed. See you soon!
  ok   templates: REMINDER_CONFIRMED
  ok   node: Reminder Reply
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-MV6S0SB3","name":"Dana Testova","language":"en","status":"active","intake_completed":null}
  APPT: A-MV6S1QPV0HH botox 2026-10-14T09:00:00.000Z confirmed event=appt412d4d56365331515056304848 reminder_sent_at=2026-10-13T14:30:12.127Z
  EVENT: Botox — Dana Testova 2030-01-07T10:00:00+01:00 A-MV6S1QPV0HH
  OWNER: ✅ New booking: Dana Testova (tg:9000000101) — Botox — Mon, Jan 7, 10:00 AM — A-MV6S1QPV0HH
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
EXIT 0
booking events: ok DELETED 1 of 1
calendar cleanup: ok DELETED 0
cleanup done
```

## Raw output: dialog 03 (`03-reschedule.md`, tg; verbatim)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 03-reschedule.md channel=tg contact=tg:9000000103 started 2026-10-13T14:31:01.000Z (clean start checked)
SETUP: seed_client "$CID" "Paul Movetest" active en
SETUP: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
STEP 1 send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
  exec 29290 success; route agent; tools ["find_client","check_availability"]
  <- reply: Happy to help, Paul. Here are afternoon openings that day: Mon, Jan 7, 2030, 1:00 PM Mon, Jan 7, 2030, 1:30 PM Mon, Jan 7, 2030, 2:00 PM Mon, Jan 7, 2030, 3:00 PM Which one works best for you?
  ok   templates: reply
  ok   lang: en
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
STEP 2 send: The first one, please.
  exec 29295 success; route agent; tools ["find_client","propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — Mon, Jan 7, 1:00 PM. You can cancel free of charge no later than 24 hours before the visit. Reply YES to confirm.
  ok   templates: PENDING_SUMMARY
  ok   tool: propose_booking
  ok   state: [.appts[].status] | sort == ["booked", "pending"]
  ok   state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
STEP 3 send: YES
  exec 29308 success; route confirm; tools []
  <- BOOKED: You're booked: Botox (30 min) — Mon, Jan 7, 1:00 PM. We'll send you a reminder the day before. To change or cancel, just message me here; you can cancel free of charge no later than 24 hours before your visit.
  ok   templates: BOOKED
  ok   node: Confirm
  ok   no-node: Agent
STATE
  CLIENT: {"client_id":"C-test-D9000000103","name":"Paul Movetest","language":"en","status":"active","intake_completed":null}
  APPT: A-MV6S3SLPZNB botox 2030-01-07T12:00:00+01:00 cancelled event=- reminder_sent_at=-
  APPT: A-MV6S4KPDJQ4 botox 2030-01-07T13:00:00+01:00 booked event=appt412d4d563653344b50444a5134 reminder_sent_at=-
  EVENT: Botox — Paul Movetest 2030-01-07T13:00:00+01:00 A-MV6S4KPDJQ4
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 12:00 PM — A-MV6S3SLPZNB
  OWNER: 🔁 Rescheduled, old visit cancelled: Paul Movetest (tg:9000000103) — botox — Mon, Jan 7, 12:00 PM — A-MV6S3SLPZNB
  OWNER: ✅ New booking: Paul Movetest (tg:9000000103) — Botox — Mon, Jan 7, 1:00 PM — A-MV6S4KPDJQ4 — replaces A-MV6S3SLPZNB
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] | sort == ["booked", "cancelled"]
  ok   state: [.appts[] | select(.status == "cancelled") | .start_iso] == ["2030-01-07T12:00:00+01:00"]
  ok   state: [.appts[] | select(.status == "booked") | .start_iso] | length == 1 and (.[0] | startswith("2030-01-07T") and (.[11:13] | tonumber) >= 12 and . != "2030-01-07T12:00:00+01:00")
  ok   state: (.events | length) == 1 and .events[0].description == ([.appts[] | select(.status == "booked") | .appt_id] | .[0])
  ok   state: .events[0].summary == "Botox — Paul Movetest"
  ok   state: .client.status == "active"
SUMMARY: client=active/en appts=cancelled,booked events=1 sent=reply,PENDING_SUMMARY,BOOKED
RESULT PASS 03-reschedule.md tg
EXIT 0
booking events: ok DELETED 1 of 1
calendar cleanup: ok DELETED 0
cleanup done
```

## Raw output: dialog 04 (`04-late-cancel.md`, tg; verbatim)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 04-late-cancel.md channel=tg contact=tg:9000000104 started 2026-10-13T14:32:56.000Z (clean start checked)
SETUP: seed_client "$CID" "Carl Latetest" active en
SETUP: seed_booking "$CID" botox "$(berlin_in 180)"
SETUP: appt_set "$CID" status confirmed
STEP 1 send: Hi, I need to cancel my appointment today, sorry.
  exec 29333 success; route agent; tools ["find_client","request_cancel"]
  <- LATE_CANCEL_PENDING: Cancel your appointment for Botox on Tue, Oct 13, 8:00 PM? Free cancellation ends 24 hours before the visit, so this will be recorded as a late cancellation. Reply YES to cancel.
  ok   templates: LATE_CANCEL_PENDING
  ok   lang: en
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: free cancellation ends 24 hours before the visit
  ok   regex: late cancellation
  ok   regex: reply yes to cancel
  ok   state: [.appts[].status] == ["confirmed"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
  ok   state: [.owner[] | select(test("cancel"; "i"))] | length == 0
STEP 2 send: Yes, please cancel it.
  exec 29354 success; route llm; tools []
  <- LATE_CANCEL: Your appointment for Botox on Tue, Oct 13, 8:00 PM has been cancelled. Free cancellation ends 24 hours before the visit, so it is recorded as a late cancellation. Message me any time to book again.
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
  exec 29374 success; route agent; tools ["search_knowledge","find_client"]
  <- reply: Cancellations are free up to 24 hours before the appointment; within 24 hours, and for no-shows, the cancellation is recorded and a deposit may be required for future bookings. Also, if you arrive more than 15 minutes late, the treatment ma
  ok   templates: reply
  ok   lang: en
  ok   tool: search_knowledge
  ok   regex: \b24\b
STATE
  CLIENT: {"client_id":"C-test-D9000000104","name":"Carl Latetest","language":"en","status":"flagged","intake_completed":null}
  APPT: A-MV6S69E8PTX botox 2026-10-13T20:00:00+02:00 late_cancel event=- reminder_sent_at=-
  OWNER: ✅ New booking: Carl Latetest (tg:9000000104) — Botox — Tue, Oct 13, 8:00 PM — A-MV6S69E8PTX
  OWNER: ⚠️ LATE cancellation: Carl Latetest (tg:9000000104) — botox — Tue, Oct 13, 8:00 PM — A-MV6S69E8PTX — client flagged
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: [.appts[].status] == ["late_cancel"]
  ok   state: .client.status == "flagged"
  ok   state: (.events | length) == 0
  ok   state: [.owner[] | select(test("LATE cancellation"))] | length == 1
  ok   state: [.outbox[] | .template_key] | index("LATE_CANCEL_PENDING") != null and index("LATE_CANCEL") != null
  ok   state: (.client.cancel_ask_appt_id // "") == ""
SUMMARY: client=flagged/en appts=late_cancel events=0 sent=LATE_CANCEL_PENDING,LATE_CANCEL,reply
RESULT PASS 04-late-cancel.md tg
EXIT 0
calendar cleanup: ok DELETED 0
cleanup done
```

