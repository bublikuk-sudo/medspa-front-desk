# Escalation reset: phase 2 deploy and live proof (2026-10-11)

Owner's go-ahead in chat: "да, заливай сброс памяти при снятии эскалации на живой бот". Run by the controller (the
permission classifier refuses live ssh from subagents in this session). Deployed code: commits `2b0e378`, `9d4a2ab`.

## Deploy (one step at a time, each read back)

| Step | Command | Read-back |
|---|---|---|
| Schema field | `scripts/remote.sh 'scripts/airtable-schema.sh'` | Meta API: `{"name":"escalated_at","type":"dateTime"}` in Clients |
| escalate | `scripts/n8n-push.sh workflows/wf3-tools/escalate.json --activate` | pulled back, `jq -S` compared with the repo: CONTENT-IDENTICAL |
| wf1-inbound | `scripts/n8n-push.sh workflows/wf1-inbound.json --activate` | pulled back, `jq -S` compared with the repo: CONTENT-IDENTICAL |
| channels | `tests/channels-check.sh` | telegram webhook set, `pending_update_count` 0, no error; whatsapp subscription active; `channels ok` |

Pushes started 09:38Z, outside the 06:30-07:25 UTC window. Before the deploy, a live count showed 0 clients with
status `escalated`, so no client needed a backfilled marker.

## Live proof: `tests/escalation-reset-live.sh`

Test contact `tg:9000000101` through the `wf1-test` input (client `C-test-MV3MW4VC`, replies captured in
`test_outbox`, nothing sent to Telegram). The output, with the host and long numbers left out:

```text
== 1. first message
  exec 28296 success; nodes: Agent, Escalated?, Escalation Resolved?
  reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и при желании к разговору подключится сотрудник. Чем могу помочь — записать вас на процедуру или о
  history rows: 4
PASS: agent memory written
  client: {"id":"rec15bUYvkGphUkSd","client_id":"C-test-MV3MW4VC","status":"new","escalated_at":null}
== 2. escalate (deterministic, escalate tool)
  verdict: {"verdict":"ESCALATED"}
  client: {"id":"rec15bUYvkGphUkSd","client_id":"C-test-MV3MW4VC","status":"escalated","escalated_at":"2026-10-11T09:42:09.027Z"}
PASS: status escalated + escalated_at set
== 3. message while escalated
  exec 28303 success; nodes: Escalated?, Send Hold
  reply: Член команды свяжется с вами в ближайшее время. Автоматические ответы приостановлены для этого разговора.
  history rows: 4 -> 4
PASS: hold, no agent, no reset
PASS: hold reply not written to agent memory
== 4. owner resolves: status -> active
  client: {"id":"rec15bUYvkGphUkSd","client_id":"C-test-MV3MW4VC","status":"active","escalated_at":"2026-10-11T09:42:09.027Z"}; history rows N=4
== 5. first message after resolution
  exec 28305 success; nodes: Agent, Clear Marker, Escalated?, Escalation Resolved?, Marker Cleared?, Reset Memory
  Escalation Resolved? -> [1,0]
  Reset Memory out: [[{"deleted":4}],[]]
  Marker Cleared? -> [1,0]
  tools: ["find_client"]
  reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, при желании могу подключить сотрудника. Подскажите, пожалуйста, ваши имя и фамилию?
  client: {"id":"rec15bUYvkGphUkSd","client_id":"C-test-MV3MW4VC","status":"active","escalated_at":null}; history rows: 4
PASS: reset path ran, no failure alert
PASS: escalated_at cleared (typecast null reached Airtable)
FAIL: history 4 rows after reset
PASS: agent did not escalate
== 6. next message: no second reset
  exec 28309 success; nodes: Agent, Escalated?, Escalation Resolved?
  reply: Отлично, записываю вас на консультацию (20 минут, бесплатно). Подскажите, пожалуйста, ваши имя и фамилию?
PASS: no reset, agent answered
PASS: memory kept growing (4 -> 6)
== cleanup
  clean: client rows 0, history 0
RESULT: FAIL (1)
```

The one FAIL is a wrong threshold in the script, not a defect: the check expected at most 2 history rows after the
reset, but one agent turn with a tool call writes 4 (step 1 shows the same 4 for a first turn). Step 5 shows
`Reset Memory` deleted exactly the 4 rows that existed before the message (N = 4) and the 4 rows left are that turn's.
The script's check is now "deleted exactly N, and no row of the old conversation (id at or below the session's newest
id before the message) is left"; see the revision section below. It was not re-run (each run costs about 3 agent
answers).

## What this proves

- escalate writes `escalated_at` in the same update as `status`.
- While `escalated`, WF-1 answers with `Send Hold`, the agent does not run, and the hold reply is NOT written to the
  agent's chat memory (history 4 -> 4). This is the premise of the ruling that hand-set escalations need no marker.
- After the status is changed to `active`, the next message runs `Escalation Resolved?` true -> `Reset Memory`
  (deleted 4) -> `Clear Marker` -> `Marker Cleared?` true -> the agent; `escalated_at` is empty afterwards, so the
  `typecast: true` null reached Airtable (the open question of phase 1). The agent greeted the client afresh and
  asked for a name - no "сотрудник свяжется", no escalate call.
- The next message did not reset again; memory grew 4 -> 6.

Not proven live:

- the failure branches (`Reset Memory` or `Clear Marker` error, `Marker Cleared?` false -> `Notify Reset Failure`) -
  stubs only;
- the level-1 tool cases `escalate_ok` and `escalate_already_escalated`, edited in phase 1 to assert the marker, were
  not run (step 2 above calls escalate once, with the same effect as `escalate_ok`, but not the case's teardown checks);
- the count of 0 clients with status `escalated` before the deploy was a read by the controller; its output is not
  committed anywhere.

One owner Telegram alert was sent by the escalate step (`🚨 … [TEST] escalation reset proof`).

## Script revised after this run (not re-run)

The phase-2 review found defects in `tests/escalation-reset-live.sh` (not in the deployed workflows), fixed afterwards:
a failed cleanup is now a FAIL (at the start it aborts) and the end asserts 0 client rows and 0 history rows; the
execution under test must carry this message's `update_id` in `Test Inbound` and `tg:9000000101` as `Normalize`'s
`contact_id` (other new executions are skipped, polling goes on); step 5 asserts no row with an id at or below the
session's newest id before the message survives, instead of a row-count bound; history counts must be numbers;
step 4 touches the row only if its `client_id` starts with `C-test-`; `Escalation Resolved?` and `Marker Cleared?`
true, status `active` after step 5 and `escalated_at` unchanged by the hold (step 3 vs step 2) are asserted, not only
printed; the execution JSON goes to a `mktemp` directory removed on exit. The output above is from the script as it
was before these changes. The revised script has not been run: a run costs about 3 agent answers, and the controller
decides whether to spend them.
