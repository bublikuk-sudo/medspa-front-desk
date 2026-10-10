# 05 — Cancelling somebody else's appointment

Plan Task 20, row 05: the client names another client's appointment id, then the other client's name. Nothing changes;
the reply says the appointment cannot be found under the client's own contact. With the two-step cancel (2026-10-08)
the agent's tool is `request_cancel`: it answers `NOT_YOURS` / `NOT_FOUND` and records nothing, so no cancel question
(`CANCEL_PENDING` / `LATE_CANCEL_PENDING`) is sent and B's visit gets no cancel fields. Played in both channels (client A
`tg:9000000105` / `wa:+15550000105`; the other client B is `…205` in the same channel and never writes).

**Preconditions (setup).** A: Clients row "Nina Mytest" (`active`, no appointments). B: Clients row "Maria Othertest"
(`active`) with a `booked` Botox `A-TEST-D05OTHER` on 2030-01-08 11:00 (no calendar event).

| # | Client A writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi, please cancel appointment A-TEST-D05OTHER. | agent reply: cannot find it under the client's own contact; no cancel question | B's visit still `booked`, no cancel fields |
| 2 | It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest. | exactly one message: either an agent reply refusing to cancel or change it, or `ESCALATED_REPLY`; no cancel question | unchanged |

Step 2 may end in an escalation (ruling 2026-10-09), because a client naming another person's booking is making a third-party request and handing it to a human is the safe outcome; the refusal regex then applies only to a plain agent reply.

**Final state.** A has no appointments and no cancel question opened for A (`cancel_ask_appt_id` empty); A is `active`
with no owner message, or `escalated` with exactly one owner message, an escalation. B's `A-TEST-D05OTHER` is still
`booked`, B still `active`; no cancel request was recorded on B's visit (`cancel_expires_at` empty); B has no owner
message; nothing was sent to B.

**Check.** On the VPS: `tests/dialogs.sh 05`.

```dialog
profile: Nina Mytest
second: same 205
profile2: Maria Othertest
setup: seed_client "$CID" "Nina Mytest" active en
setup: seed_client "$CID2" "Maria Othertest" active en
setup: seed_appt "$CID2" '{"appt_id":"A-TEST-D05OTHER","service_id":"botox","start_iso":"2030-01-08T11:00:00+01:00","end_iso":"2030-01-08T11:30:00+01:00","start_dt":"2030-01-08T10:00:00.000Z","status":"booked","created_via":"test"}'
send: Hi, please cancel appointment A-TEST-D05OTHER.
expect templates: reply
expect lang: en
expect regex: \b(can.?t|cannot|couldn.?t|unable to|not able to|don.?t|do not)\b[^.]{0,60}\b(find|locate|see)\b
expect regex: \byour (own )?(contact|number|account|profile|chat|phone)
expect no-node: Send Cancel Ask
expect state: [.second.appts[].status] == ["booked"]
expect state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
send: It's the Botox on January 8 at 11 AM, booked under the name Maria Othertest.
expect templates-in: reply|ESCALATED_REPLY
expect count: 1
expect lang: en
expect sh: jq -e --arg r '\b(can.?t|cannot|couldn.?t|unable to|not able to|only)\b[^.]{0,80}\b(cancel|change|find|access)\b' '(.[0].template_key != "") or ([.[].text] | join("\n") | test($r; "i"))' "$TMP/rows.json"
expect no-node: Send Cancel Ask
state: (.appts | length) == 0
state: (.client.status == "active" and (.owner | length) == 0) or (.client.status == "escalated" and (.owner | length) == 1)
state: (.client.cancel_ask_appt_id // "") == ""
state: [.second.appts[] | {appt_id, status}] == [{"appt_id": "A-TEST-D05OTHER", "status": "booked"}]
state: [.second.appts[] | (.cancel_expires_at // "")] == [""]
state: .second.client.status == "active"
state: (.second.owner | length) == 0 and (.owner | length) <= 1 and all(.owner[]; test("escalation"; "i"))
state: (.second.outbox | length) == 0
```
