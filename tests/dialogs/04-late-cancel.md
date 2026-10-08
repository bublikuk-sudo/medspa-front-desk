# 04 — Late cancellation

Plan Task 20, row 04, with the two-step cancel (owner decision 2026-10-08: a cancellation happens only on the client's
SECOND message, after the bot has asked). A client with a `confirmed` visit about 3 hours ahead says "I need to cancel".
The agent calls `request_cancel`, which only records a pending cancellation and answers `LATE_CANCEL_PENDING`; WF-1
replaces the agent's text with the `LATE_CANCEL_PENDING` template built from the row (the visit, the 24-hour window and
the late-cancellation notice, "Reply YES to cancel") and the visit stays `confirmed`. The client's YES then makes WF-1 run
`cancel_booking` without the agent: the visit becomes `late_cancel`, the client `flagged`, the calendar event is deleted,
the owner gets `⚠️ LATE cancellation` once, and the client gets the `LATE_CANCEL` template. Asked about the policy, the
agent answers from the knowledge base (kb-cancellation: free up to 24 hours before). Played in both channels
(`tg:9000000104`, `wa:+15550000104`).

**Preconditions (setup, "creates the visit directly").** Clients row "Carl Latetest" (`active`, `en`); a real booking
through the tools (`seed_booking`) at the next half hour after now + 3 h, Berlin time, then the row set to `confirmed`.
So the visit has a real calendar event `Botox — Carl Latetest` today, which the dialog must delete. confirm_booking
notifies the owner.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi, I need to cancel my appointment today, sorry. | `LATE_CANCEL_PENDING` only (the agent called `request_cancel`; its own text is replaced): the visit, "less than 24 hours", "late cancellation", "Reply YES to cancel"; nothing cancelled | still `confirmed`, the event still there, `cancel_asked_at` set, no owner message about a cancellation |
| 2 | Yes, please cancel it. | `LATE_CANCEL` only: short non-yes/no reply -> Haiku reads it as YES -> `Cancel Visit` (cancel_booking), no agent | `late_cancel`, client `flagged`, no event, one `LATE cancellation` owner message |
| 3 | What is your cancellation policy? | agent reply with the 24-hour rule from `search_knowledge` | — |

**Final state.** The appointment `late_cancel`; Clients `flagged`; no calendar event of the client left; exactly one
`LATE cancellation` owner message about this contact; the client got the cancel question and the late-cancel
confirmation as templates.

**Check.** On the VPS: `tests/dialogs.sh 04`.

```dialog
profile: Carl Latetest
setup: seed_client "$CID" "Carl Latetest" active en
setup: seed_booking "$CID" botox "$(berlin_in 180)"
setup: appt_set "$CID" status confirmed
send: Hi, I need to cancel my appointment today, sorry.
expect templates: LATE_CANCEL_PENDING
expect lang: en
expect tool: request_cancel
expect node: Send Cancel Ask
expect no-node: Cancel Visit
expect regex: less than 24 hours
expect regex: late cancellation
expect regex: reply yes to cancel
expect state: [.appts[].status] == ["confirmed"]
expect state: (.events | length) == 1
expect state: [.appts[] | (.cancel_asked_at // "") != ""] == [true]
expect state: [.owner[] | select(test("cancel"; "i"))] | length == 0
send: Yes, please cancel it.
expect templates: LATE_CANCEL
expect lang: en
expect node: LLM Affirmative
expect node: Cancel Visit
expect no-node: Agent
expect regex: has been cancelled
expect regex: \b24 hours\b
expect state: [.appts[].status] == ["late_cancel"]
expect state: .client.status == "flagged"
expect state: (.events | length) == 0
expect owner: LATE cancellation
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
state: [.outbox[] | .template_key] | index("LATE_CANCEL_PENDING") != null and index("LATE_CANCEL") != null
```
