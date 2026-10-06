# 04 — Late cancellation

Plan Task 20, row 04: a client with a `confirmed` visit about 3 hours ahead says "I need to cancel". The visit becomes
`late_cancel`, the client `flagged`, the calendar event is deleted, the owner gets `⚠️ LATE cancellation`, and the client
is told the policy from the knowledge base (kb-cancellation: free up to 24 hours before). Played in both channels
(`tg:9000000104`, `wa:+15550000104`).

**Preconditions (setup, "creates the visit directly").** Clients row "Carl Latetest" (`active`, `en`); a real booking
through the tools (`seed_booking`) at the next half hour after now + 3 h, Berlin time, then the row set to `confirmed`.
So the visit has a real calendar event `Botox — Carl Latetest` today, which the dialog must delete. confirm_booking
notifies the owner.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi, I need to cancel my appointment today, sorry. | agent reply (asks which/confirms, or cancels) | — |
| 2 | Yes, please cancel it. | agent reply (late cancellation recorded; the 24-hour policy stated, as the plan says the client is told the policy on cancellation) | `late_cancel` |
| 3 | What is your cancellation policy? | agent reply with the 24-hour rule from `search_knowledge` | — |

**Final state.** The appointment `late_cancel`; Clients `flagged`; no calendar event of the client left; exactly one
`LATE cancellation` owner message about this contact; the replies mention the late cancellation.

**Check.** On the VPS: `tests/dialogs.sh 04`.

```dialog
profile: Carl Latetest
setup: seed_client "$CID" "Carl Latetest" active en
setup: seed_booking "$CID" botox "$(berlin_in 180)"
setup: appt_set "$CID" status confirmed
send: Hi, I need to cancel my appointment today, sorry.
expect templates: reply
expect lang: en
send: Yes, please cancel it.
expect templates: reply
expect lang: en
expect regex: \b24\b
expect state: [.appts[].status] == ["late_cancel"]
send: What is your cancellation policy?
expect templates: reply
expect lang: en
expect tool: search_knowledge
expect regex: \b24\b
state: (.client.client_id // "") | startswith("C-test-")
state: [.appts[].status] == ["late_cancel"]
state: .client.status == "flagged"
state: (.events | length) == 0
state: [.owner[] | select(test("LATE cancellation"))] | length == 1
state: [.outbox[].text] | join(" ") | test("late"; "i")
```
