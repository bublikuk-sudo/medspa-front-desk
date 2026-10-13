# 15 — Change of mind after the summary: a later "yes" does not book the first slot

Final review I1: a bare YES used to confirm the client's pending booking whenever one existed, even when the summary was
no longer the bot's last message. Now WF-1's `Gate` confirms only while the summary is the bot's last message
(`Clients.last_agent_reply_at` at most 3 s after the row's `summary_sent_at`, both stamped in the summary's own run) and
the row is unexpired. A client who gets the summary, asks for another time and then says "yes" to the agent's question
must reach the agent, and the first slot must stay unbooked. Telegram only (the routing is channel-independent; contact
`tg:9000000115`).

**Preconditions (setup).** `tests/cleanup.sh` has run. Clients row "Mira Changetest" (`active`, `en`), no appointments.
2030-01-07 (a Monday) has free morning and afternoon slots.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi, I'd like to book Botox on Monday, January 7, 2030, in the morning. | agent lists morning slots (`check_availability`) | — |
| 2 | The earliest one, please. | `PENDING_SUMMARY` (`propose_booking`) | one `pending` row, morning |
| 3 | Actually, can we do another time? Could you check the afternoon of the same day? | agent reply (no summary, no booking) | the morning row still `pending`, not booked; no event |
| 4 | yes | an agent reply: Gate does not route to Confirm (an agent reply came after the summary), the Reminder Gate finds no reminder, the Agent answers | nothing `booked`; no calendar event |
| 5 | The first afternoon slot, please. | `PENDING_SUMMARY` for the afternoon slot (`propose_booking` cancels the morning row) | morning row `cancelled`, afternoon row `pending` |
| 6 | YES | `BOOKED`, `BOOKED_INTAKE` (first visit); Confirm, no Agent | afternoon row `booked`, one event |

Step 4 may also end in a new `PENDING_SUMMARY` if the agent proposes an afternoon slot right away; the step checks only
that nothing was booked and that the message went to the Agent, not to Confirm. Step 5 then proposes again, which
replaces that row too.

**Final state.** Exactly one `booked` appointment, on 2030-01-07 at 12:00 or later; every other appointment of the client
`cancelled`, the morning one among them; exactly one calendar event of the client, `Botox — Mira Changetest`, belonging
to the booked appointment.

**Check.** On the VPS: `tests/cleanup.sh && tests/dialog.sh tests/dialogs/15-change-mind-after-summary.md tg`, or
`tests/dialogs.sh 15`.

```dialog
channels: tg
profile: Mira Changetest
setup: seed_client "$CID" "Mira Changetest" active en
send: Hi, I'd like to book Botox on Monday, January 7, 2030, in the morning.
expect templates: reply
expect lang: en
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
send: The earliest one, please.
expect templates: PENDING_SUMMARY
expect tool: propose_booking
expect state: [.appts[].status] == ["pending"] and ((.appts[0].start_iso[11:13] | tonumber) < 12)
send: Actually, can we do another time? Could you check the afternoon of the same day?
expect templates: reply
expect lang: en
expect node: Agent
expect no-node: Confirm
expect state: [.appts[].status] == ["pending"] and (.events | length) == 0
send: yes
expect count: 1
expect templates-in: reply|PENDING_SUMMARY
expect node: Agent
expect no-node: Confirm
expect no-node: LLM Affirmative
expect state: ([.appts[] | select(.status == "booked" or .status == "reminded" or .status == "confirmed")] | length) == 0 and (.events | length) == 0
expect state: [.appts[] | select(.start_iso[11:13] | tonumber < 12) | .status] | all(. == "pending" or . == "cancelled")
send: The first afternoon slot, please.
expect templates: PENDING_SUMMARY
expect tool: propose_booking
expect state: [.appts[] | select(.status == "pending") | .start_iso[11:13] | tonumber] | length == 1 and .[0] >= 12
expect state: [.appts[] | select(.start_iso[11:13] | tonumber < 12) | .status] == ["cancelled"]
send: YES
expect templates: BOOKED, BOOKED_INTAKE
expect node: Confirm
expect no-node: Agent
state: (.client.client_id // "") | startswith("C-test-")
state: [.appts[] | select(.status == "booked") | .start_iso] | length == 1 and (.[0] | startswith("2030-01-07T") and (.[11:13] | tonumber) >= 12)
state: [.appts[] | select(.status != "booked") | .status] | all(. == "cancelled")
state: [.appts[] | select(.start_iso[11:13] | tonumber < 12) | .status] == ["cancelled"]
state: (.events | length) == 1 and .events[0].description == ([.appts[] | select(.status == "booked") | .appt_id] | .[0])
state: .events[0].summary == "Botox — Mira Changetest"
```
