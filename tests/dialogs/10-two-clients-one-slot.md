# 10 — Two clients, one slot

Plan Task 20, row 10: two new clients each bring the same slot (Monday 2030-01-07 10:00) to the summary; the first says
YES and is booked; the second says YES and gets SLOT_TAKEN with alternatives, and their pending is cancelled. One event
in the calendar. Played once with two contacts, one per channel: A `tg:9000000110` (Telegram format), B
`wa:+15550000210` (WhatsApp format).

**Preconditions.** None for either contact; 2030-01-07 10:00 is free.

| # | Who | Writes | Expected reaction | Expected state |
|---|---|---|---|---|
| 1–3 | A | Hi! I'd like to book Botox. / My name is Ann Firsttest. / Monday, January 7, 2030, in the morning, please. | agent replies, slots include 10:00 | — |
| 4 | A | 10:00 AM, please. | `PENDING_SUMMARY` at 10:00 AM | A `pending` |
| 5–7 | B | the same with "Bea Secondtest" | agent replies, slots include 10:00 (a pending does not hold the slot) | — |
| 8 | B | 10:00 AM, please. | `PENDING_SUMMARY` at 10:00 AM | B `pending` |
| 9 | A | YES | `BOOKED`, `BOOKED_INTAKE` | A `booked`, event |
| 10 | B | YES | `SLOT_TAKEN` with alternative times, Confirm (no agent) | B `cancelled` |

**Final state.** A: one `booked` appointment and one event at 2030-01-07 10:00; B: one `cancelled` appointment for the
same start, no event.

**Check.** On the VPS: `tests/dialogs.sh 10`.

```dialog
channels: tg
profile: Ann Firsttest
second: wa 210
profile2: Bea Secondtest
send: Hi! I'd like to book Botox.
expect templates: reply
send: My name is Ann Firsttest.
expect templates: reply
send: Monday, January 7, 2030, in the morning, please.
expect templates: reply
expect regex: \b10:00\b
expect no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
send: 10:00 AM, please.
expect templates: PENDING_SUMMARY
expect regex: 10:00 AM
send2: Hi! I'd like to book Botox.
expect templates: reply
send2: My name is Bea Secondtest.
expect templates: reply
send2: Monday, January 7, 2030, in the morning, please.
expect templates: reply
expect regex: \b10:00\b
expect no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
send2: 10:00 AM, please.
expect templates: PENDING_SUMMARY
expect regex: 10:00 AM
expect state: [.appts[].status] == ["pending"] and [.second.appts[].status] == ["pending"] and .appts[0].start_iso == .second.appts[0].start_iso
send: YES
expect templates: BOOKED, BOOKED_INTAKE
expect node: Confirm
send2: YES
expect templates: SLOT_TAKEN
expect regex: \b\d{1,2}:\d{2}\b
expect node: Confirm
expect no-node: Agent
state: ((.client.client_id // "") | startswith("C-test-")) and ((.second.client.client_id // "") | startswith("C-test-"))
state: [.appts[].status] == ["booked"]
state: [.second.appts[].status] == ["cancelled"]
state: .appts[0].start_iso == .second.appts[0].start_iso
state: (.events | length) == 1 and (.events[0].start | startswith("2030-01-07T10:00"))
state: (.second.events | length) == 0
```
