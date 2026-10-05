# 08 — "I want to talk to a human"

Plan Task 20, row 08: as dialog 07, without medical content. The agent calls `escalate`, the client is `escalated`, the
owner gets `🚨 Escalation` with the history; the next message gets ESCALATED_HOLD without the agent; after the owner
resets the status the bot answers again. Played in both channels (`tg:9000000108`, `wa:+15550000108`).

**Preconditions.** None (the contact is unknown after `tests/cleanup.sh`).

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi there! | agent reply in English | Clients row `new` |
| 2 | I want to talk to a human, please. | `ESCALATED_REPLY`; `escalate` in tools_used; owner `🚨 Escalation — <contact>` with message 1 in the history | `escalated` |
| 3 | Hello? Is anyone there? | `ESCALATED_HOLD`, Agent not run | `escalated` |
| 4 | *(runner: `client_set status active`)* | nothing sent | `active` |
| 5 | Hi again, do you have parking? | agent reply in English | — |

**Final state.** `active`; exactly one escalation message about this contact; no appointments.

**Check.** On the VPS: `tests/dialogs.sh 08`.

```dialog
profile: Hugo Humantest
send: Hi there!
expect templates: reply
expect lang: en
send: I want to talk to a human, please.
expect templates: ESCALATED_REPLY
expect lang: en
expect tool: escalate
expect owner: Escalation —
expect owner: Client: Hi there
expect state: .client.status == "escalated"
send: Hello? Is anyone there?
expect templates: ESCALATED_HOLD
expect no-node: Agent
run: client_set status active
expect templates: none
send: Hi again, do you have parking?
expect templates: reply
expect lang: en
expect node: Agent
state: (.client.client_id // "") | startswith("C-test-")
state: .client.status == "active"
state: [.owner[] | select(test("Escalation —"))] | length == 1
state: (.appts | length) == 0
```
