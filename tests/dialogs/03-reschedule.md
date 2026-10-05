# 03 — Reschedule to the afternoon

Plan Task 20, row 03: a client with a `booked` Botox on Monday 2030-01-07 at 12:00 (the plan's 2030-01-06 is a Sunday)
asks to move it to the afternoon and confirms with YES. The old visit becomes `cancelled` and its calendar event is
deleted; the new one is `booked` with its own event; the client has exactly one event. Played in both channels
(`tg:9000000103`, `wa:+15550000103`).

**Preconditions (setup).** Clients row "Paul Movetest" (`active`, `en`) and a real booking made through the tools
(`seed_booking`: offer -> propose_booking -> confirm_booking), so it has the calendar event `Botox — Paul Movetest` at
2030-01-07 12:00+01:00 exactly as the bot would have created it. confirm_booking notifies the owner.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi, I need to move my Botox appointment on January 7 to the afternoon. | agent reply with afternoon slot times (`check_availability`) | — |
| 2 | The first one, please. | `PENDING_SUMMARY` (`propose_booking` with `replaces_appt_id`) | old `booked` + new `pending` that replaces it |
| 3 | YES | `BOOKED` only (not a first visit: no intake form), Confirm, no Agent | old `cancelled`, new `booked` |

**Final state.** Exactly two appointments: the 12:00 one `cancelled`, a new one `booked` on 2030-01-07 after 12:00;
exactly one calendar event of the client, `Botox — Paul Movetest`, belonging to the new appointment.

**Check.** On the VPS: `tests/dialogs.sh 03`.

```dialog
profile: Paul Movetest
setup: seed_client "$CID" "Paul Movetest" active en
setup: seed_booking "$CID" botox 2030-01-07T12:00:00+01:00
send: Hi, I need to move my Botox appointment on January 7 to the afternoon.
expect templates: reply
expect lang: en
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: \b(Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? (Jan(uary)?\.? )?7\b
send: The first one, please.
expect templates: PENDING_SUMMARY
expect tool: propose_booking
expect state: [.appts[].status] | sort == ["booked", "pending"]
expect state: [.appts[] | select(.status == "pending") | .replaces_appt_id] == [.appts[] | select(.status == "booked") | .appt_id]
send: YES
expect templates: BOOKED
expect node: Confirm
expect no-node: Agent
state: (.client.client_id // "") | startswith("C-test-")
state: [.appts[].status] | sort == ["booked", "cancelled"]
state: [.appts[] | select(.status == "cancelled") | .start_iso] == ["2030-01-07T12:00:00+01:00"]
state: [.appts[] | select(.status == "booked") | .start_iso] | length == 1 and (.[0] | startswith("2030-01-07T") and (.[11:13] | tonumber) >= 12 and . != "2030-01-07T12:00:00+01:00")
state: (.events | length) == 1 and .events[0].description == ([.appts[] | select(.status == "booked") | .appt_id] | .[0])
state: .events[0].summary == "Botox — Paul Movetest"
state: .client.status == "active"
```
