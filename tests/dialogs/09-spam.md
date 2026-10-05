# 09 — Spam: 21 messages in about 2 minutes

Plan Task 20, row 09: the client sends "hi" again and again. The 21st message within 10 minutes gets RATE_LIMIT and the
owner `⛔ Rate limit`; messages 22–25 get no answer and no second owner alert; after the pause the bot answers again.
Played once, in the Telegram format (`tg:9000000109`), as the plan says.

**Messages 1–20.** Each gets exactly one message back, but which one is the agent's choice: the system prompt (rule 7)
escalates a client whose messages it has not understood twice, and a stream of bare "hi" often ends there (seen in the
first development run: two replies, then ESCALATED_REPLY, then ESCALATED_HOLD for every further message, which WF-1 sends
without the agent). So the step asserts 20 messages, each a reply, ESCALATED_REPLY or ESCALATED_HOLD, and at most one
escalation message to the owner (the development run sent two, from two overlapping agent runs: fixed in `escalate`,
node `Already Escalated?`). The rate limit counts every message before any of this, so the 21st is limited either way.

**The 10-minute recovery is not waited for.** The rate limit counts the hits of the last 10 minutes in Postgres
`wf1_rate_limit`. Instead of waiting 10 minutes, the runner deletes this contact's row (`rate_limit_reset`), which is
exactly the state 10 minutes of silence produce; the log line of that step says so. "The bot answers" then means one
message comes back past the rate limit (a reply, or ESCALATED_HOLD when the client was escalated in messages 1–20).

**Preconditions.** None.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1–20 | hi (20 times, one every 5 s, without waiting for the answers) | 20 messages (reply / ESCALATED_REPLY / ESCALATED_HOLD) | Clients row created |
| 21 | hi | `RATE_LIMIT`, owner `⛔ Rate limit: <contact> sent 21 messages in 10 minutes; paused`; Agent not run | — |
| 22–25 | hi (4 times, one every 5 s) | nothing; neither Agent, Send Rate Limit nor Notify Spam runs | — |
| — | *(runner: `rate_limit_reset`, stands in for the 10-minute pause)* | nothing | — |
| 26 | hi, are you back? | one message, the rate limit is not hit | — |

**Final state.** Exactly one RATE_LIMIT message, exactly one `Rate limit` owner message and at most one escalation
message about this contact; 22 messages to the client in total.

**Check.** On the VPS: `tests/dialogs.sh 09`.

```dialog
channels: tg
profile: Sam Spamtest
burst: 20 5 hi
expect count: 20
expect templates-in: reply|ESCALATED_REPLY|ESCALATED_HOLD
expect state: [.owner[] | select(test("Escalation —"))] | length <= 1
send: hi
expect templates: RATE_LIMIT
expect node: Send Rate Limit
expect no-node: Agent
expect owner: Rate limit: .* sent 21 messages
burst: 4 5 hi
expect templates: none
expect no-node: Agent
expect no-node: Send Rate Limit
expect no-node: Notify Spam
run: rate_limit_reset
expect templates: none
send: hi, are you back?
expect count: 1
expect templates-in: reply|ESCALATED_HOLD|ESCALATED_REPLY
expect node: Client Data
expect no-node: Send Rate Limit
state: (.client.client_id // "") | startswith("C-test-")
state: [.outbox[] | select(.template_key == "RATE_LIMIT")] | length == 1
state: [.owner[] | select(test("Rate limit"))] | length == 1
state: [.owner[] | select(test("Escalation —"))] | length <= 1
state: (.outbox | length) == 22
```
