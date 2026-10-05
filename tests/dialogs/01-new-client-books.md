# 01 — New client books Botox, then confirms the reminder

Plan Task 20, row 01: a new client gives a name, a service and a day, picks a slot, gets the summary and replies YES;
then the reminder arrives and the client answers YES. Played in both channels by `tests/dialog.sh` (contacts
`tg:9000000101` and `wa:+15550000101`).

**Preconditions.** `tests/cleanup.sh` has run: no Clients row for the contact, no appointments, no chat memory, no
test_outbox rows. 2030-01-07 (a Monday) has free morning slots. No real appointment is due for a WF-5 action in the next
2 hours (`reminder_leg` refuses otherwise).

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi! I'd like to book Botox. | agent reply in English that says it is the clinic's AI assistant (EU AI Act Art. 50 ruling) and asks for the name | Clients row created, `status=new` |
| 2 | My name is Dana Testova. | agent reply (asks for the day) | — |
| 3 | Monday, January 7, 2030, in the morning, please. | agent lists free slots with times | the offer saved on the client |
| 4 | The earliest one, please. | `PENDING_SUMMARY` only (the agent's own text after PENDING is suppressed) | Appointments `pending` |
| 5 | YES | `BOOKED`, then `BOOKED_INTAKE` (first visit); the list YES goes to Confirm, no Agent | `booked`, event `Botox — <name>` |
| 6 | *(runner: `reminder_leg`)* the visit is moved to about an hour ahead in Airtable, `reminder_hours_before = 1` behind an EXIT trap, WF-5 Run Now | `REMINDER`; on WhatsApp through the template path `medspa_reminder` (wa_template), on Telegram free-form | `reminded`, `reminder_sent_at` set; Settings restored |
| 7 | YES | `REMINDER_CONFIRMED`; Reminder Reply, no Agent | `confirmed` |

**Final state.** Clients `status=active`, `language=en`, the name contains "Dana"; exactly one appointment, `confirmed`,
with `reminder_sent_at`; exactly one calendar event of the client, titled `Botox — <client name>` (it stays on
2030-01-07: `reminder_leg` moves only the Airtable row); BOOKED_INTAKE and REMINDER were sent.

**Check.** On the VPS: `tests/cleanup.sh && tests/dialog.sh tests/dialogs/01-new-client-books.md tg` (and `wa`), or
`tests/dialogs.sh 01`.

```dialog
profile: Dana Testova
send: Hi! I'd like to book Botox.
expect templates: reply
expect lang: en
expect regex: \bAI\b|artificial intelligence
send: My name is Dana Testova.
expect templates: reply
expect lang: en
send: Monday, January 7, 2030, in the morning, please.
expect templates: reply
expect lang: en
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
send: The earliest one, please.
expect templates: PENDING_SUMMARY
expect lang: en
expect tool: propose_booking
expect state: [.appts[].status] == ["pending"]
send: YES
expect templates: BOOKED, BOOKED_INTAKE
expect node: Confirm
expect no-node: Agent
expect state: [.appts[].status] == ["booked"] and (.events | length) == 1
run: reminder_leg
expect templates: REMINDER
expect wa.wa_template: medspa_reminder
expect tg.wa_template: none
expect state: [.appts[].status] == ["reminded"]
send: YES
expect templates: REMINDER_CONFIRMED
expect node: Reminder Reply
expect no-node: Agent
state: .client.status == "active"
state: .client.language == "en"
state: (.client.name // "") | test("Dana"; "i")
state: [.appts[].status] == ["confirmed"]
state: (.appts[0].reminder_sent_at // "") != ""
state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
state: [.outbox[].template_key] | index("BOOKED_INTAKE") != null and index("REMINDER") != null
```
