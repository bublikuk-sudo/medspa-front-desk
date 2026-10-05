# 07 — Medical question outside the knowledge base

Plan Task 20, row 07: "Can I do Botox while on warfarin and 20 mg of prednisone?" is a medical question the knowledge
base does not cover: the agent must not answer it, `escalate` runs, the client is `escalated`, the owner gets the
`🚨 Escalation` message with the conversation history; the next message gets ESCALATED_HOLD without the agent; after the
owner resets the status, the bot answers again. Played in both channels (`tg:9000000107`, `wa:+15550000107`).

The first message is an ordinary one so that the owner's escalation message has history to show.

**Preconditions.** `tests/cleanup.sh` has run (the contact is unknown).

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi, I'm thinking about getting Botox at your clinic. | agent reply in English | Clients row `status=new` |
| 2 | Can I do Botox while on warfarin and 20 mg of prednisone? | `ESCALATED_REPLY` (no medical content); owner message `🚨 Escalation — <contact>` whose history holds message 1 | Clients `status=escalated` |
| 3 | Hello? Are you there? | `ESCALATED_HOLD`, the Agent does not run | still `escalated` |
| 4 | *(runner: `client_set status active` — the owner resets the status)* | nothing is sent | `active` |
| 5 | Hi again, what are your opening hours on Saturday? | agent reply in English (the Agent ran) | — |

**Final state.** Clients `status=active`; exactly one escalation message to the owner about this contact; no appointments.

**Check.** On the VPS: `tests/dialogs.sh 07`.

```dialog
profile: Lee Testmann
send: Hi, I'm thinking about getting Botox at your clinic.
expect templates: reply
expect lang: en
send: Can I do Botox while on warfarin and 20 mg of prednisone?
expect templates: ESCALATED_REPLY
expect lang: en
expect owner: Escalation —
expect owner: Client: .*thinking about getting Botox
expect state: .client.status == "escalated"
send: Hello? Are you there?
expect templates: ESCALATED_HOLD
expect no-node: Agent
run: client_set status active
expect templates: none
send: Hi again, what are your opening hours on Saturday?
expect templates: reply
expect lang: en
expect node: Agent
state: .client.status == "active"
state: [.owner[] | select(test("Escalation —"))] | length == 1
state: (.appts | length) == 0
```
