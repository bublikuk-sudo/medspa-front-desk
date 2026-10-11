# Error-alert phase 2: live proof (steps 1-4) (2026-10-10)

Scope: all four steps of the controller's phase 2 order ran on 2026-10-10. The sections below are in chronological order and each says who ran the step:

1. Step 1, live expression proof - the implementer, about 17:49Z.
2. Baseline taken before the push - the implementer.
3. Step 2, the push of wf6 / wf5 / wf1 (17:53:37Z, 17:54:50Z, 17:55:47Z) and the read-back - the controller.
4. The implementer's blocked attempt at steps 3-4 (about 17:56-17:58Z) - superseded, kept as history.
5. Step 3, run 1 (17:59-18:01Z) - the controller.
6. Step 3, run 2 (18:06Z) - the owner, redundant.
7. Step 4, cleanup and stub reruns - the controller.

## Step 1: live expression proof (the implementer, about 17:49Z)

The throwaway name carries its creation epoch (1791654539 = 17:48:59Z); the commit that recorded this step (0b04a8c) is 17:51:09Z, before the first push at 17:53:37Z.
No production workflow was pushed or activated by this step.

### What ran

A throwaway workflow `tmp-expr-proof-001791654539` (id `8qy2DQfyENihFjYh`) was created through the API, activated for one webhook call, and deleted afterwards.
No errorWorkflow, no notify_owner, no Telegram node: nothing could notify anyone.

- Webhook (POST, random path, responseMode onReceived) -> `Normalize` (Code, `{contact_id: "tg:4242", text: "I want a facial"}`)
- -> Code nodes named `Agent` and `Confirm`, each emitting 6 items with an `error` field: a plain string (the Execute Workflow shape), an object with a
  plain `description` (the Anthropic credit text as stored in execution 27315), an object with a JSON-string description, with a `400 {json}` description,
  an object without description, an object with a 400-line description.
- each of them -> two Set nodes whose value is the EXACT text of `Notify Failure` and `Notify Send Failure`, extracted with `jq` from
  `workflows/wf1-inbound.json` (md5 1ca62dc203a56ba5a156ece038076fd0 on both the workstation and the VPS), so `$prevNode.name` is `Agent` in one pair and `Confirm` in the other.

Execution 28165, status success, all 8 nodes ran, no node error. The execution data was compared item by item with the same expression text evaluated by the stub
method (`new Function` with `$json`, `$('Normalize')`, `$prevNode`), in the n8n container's Node.

### Result

`EXPR_PROOF live == stub: 24 passed, 0 failed` (4 Set nodes x 6 items). Live texts, for the record:

```
NF  Agent    string          : ❌ Reply failed for tg:4242: Bad request - please check your parameters (cause: see the ⚠️ wf2-agent alert) (step: Agent; the client got the ERROR message)
NF  Agent    object-plain    : ❌ Reply failed for tg:4242: Bad request - please check your parameters — Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits. (step: Agent; the client got the ERROR message)
NF  Agent    object-json     : same as object-plain (error.message extracted from the JSON string, no JSON in the text)
NF  Agent    "400 {json}"    : same as object-plain
NF  Agent    object-nodesc   : ❌ Reply failed for tg:4242: Bad request - please check your parameters (step: Agent; the client got the ERROR message)
NF  Agent    object-long     : message — word word ... , 421 characters in all (cause cut to 300)
NF  Confirm  string          : ❌ Reply failed for tg:4242: Bad request - please check your parameters (step: Confirm; the client got the ERROR message)     <- no pointer for another step
NF  Confirm  object-plain    : message — credit text (step: Confirm; ...)
NSF Agent    string          : ❌ Could not send a message to tg:4242 (step: Agent): Bad request - please check your parameters. Their message: I want a facial
NSF Agent    object-plain    : ❌ Could not send a message to tg:4242 (step: Agent): Bad request - please check your parameters — Your credit balance is too low ... purchase credits.. Their message: I want a facial
NSF Confirm  (all six)       : same pattern as the Agent rows, step: Confirm
```

The IIFE, the regex literals, `try/catch`, `JSON.parse` and the ternary all evaluate in n8n 2.41.5's real expression engine, and give the stubs' text exactly.

Cosmetic, not a bug: a cause that ends with a full stop gives `credits.. Their message` in `Notify Send Failure` (the template's own `. Their message:` follows). Not changed.

### Cleanup

`tmp-expr-proof-001791654539` deactivated and deleted through the API; `GET /workflows` lists 0 workflows named `tmp-*`; /tmp files on the VPS removed.

## Baseline taken before the push (the implementer)

Pulled the three live workflows with `scripts/n8n-pull.sh` and compared canonical JSON (`jq -S -c`) with the repo files as of `600cf26~1`: wf6-error-handler, wf5-reminders and
wf1-inbound were IDENTICAL (live == repo before my changes), so a push replaces exactly the reviewed diff. Live `updatedAt` after the implementer's own refused push attempt was unchanged
(wf6 2026-10-02T08:42:54Z, wf5 2026-10-09T11:04:27Z, wf1 2026-10-08T19:42:57Z).

## Step 2: the push and the read-back (the controller's, in the owner's session; recorded here as the controller's report, not verified by the implementer)

The controller pushed `wf6-error-handler` (17:53:37Z), `wf5-reminders` (17:54:50Z), `wf1-inbound` (17:55:47Z) in that order, each with `--activate`, and read each back with `jq -S`
on the VPS against the repo at `0b04a8c`: CONTENT-IDENTICAL for all three. The implementer pushed nothing.

## Superseded - kept as history: the implementer's steps 3-4 attempt (blocked)

Steps 3-4 were later run by the controller and the owner, see below; they were not done by the implementer.

From about 17:56-17:58Z (commit 48c5d17, which already records the refusal, is 17:57:59Z) the permission classifier ([Production Deploy]) refused the implementer's ssh commands to the VPS: first the creation and run of the failing-branch throwaway
(`tmp-alert-proof-*`, errorWorkflow = WF-6, one invalid-key Anthropic call, one owner Telegram alert), then even a read-only GET of the workflow list. Per the instruction the implementer stopped and looked for
no other route. At that point the failing-branch proof, the throwaway cleanup check and the container stub reruns after the push were not done by the implementer. Nothing from step 3 was created by the refused command
(no `tmp-alert-proof-*` workflow, no webhook call, no owner message).

The script that the controller and the owner later ran is `.superpowers/sdd/2026-09-16-medspa-front-desk/error-alert-proof-remote.sh` (git-ignored): the implementer's `proofB.sh` plus an exit trap that deletes the throwaway.

## Step 3, run 1 (the controller, 2026-10-10, 17:59-18:01Z, owner's go-ahead "да, делай проверку сама")

Provenance: this section is the controller's report. That run's output reached the commit 301f2d8 (18:00:57Z); the raw output was not retained (the tool result was lost, see run 2). Executions 28166 and 28167 are
quoted from that report. Run 2 below is the one backed by a retained raw output.

The implementer's blocked script was read in full and run unchanged by the controller in the owner's session.

Failing-branch proof. Throwaway `tmp-alert-proof-001791655156` (id `p0xs6N60jf44VplY`, errorWorkflow `trsMOjXdObkwO7DE` = WF-6, active),
ONE webhook call -> HTTP 200. Throwaway execution 28166: `status error`. Its stored error:

```text
{"name":"NodeApiError","message":"Authorization failed - please check your credentials","httpCode":"401","keys":["context","description","functionality","httpCode","level","message","messages","name","node","shouldReport","stack","tags","timestamp"],"description":"invalid x-api-key","has_cause":false}
```

WF-6 execution 28167 (`success`, started 2026-10-10T17:59:20.097Z). Error Trigger payload carried the same `message` and `description`.
Compose output, the text the owner received:

```text
⚠️ tmp-alert-proof-001791655156 failed at Anthropic Invalid Key: Authorization failed - please check your credentials — invalid x-api-key
execution: https://<n8n host>/workflow/p0xs6N60jf44VplY/executions/28166
```

Notify (notify_owner): `executionStatus success`, `verdict SENT`. Leak check: the literal key value `invalid-key-for-alert-proof` is NOT in the
Compose text; the script's marker grep counted 1 line because Anthropic's own message contains the header NAME `x-api-key`. The key value is
expected to appear in WF-6's stored execution data (the Error Trigger payload carries the failing node's definition, including its literal header), but this was
not checked. That would be n8n's own stored data, not the alert; a real key lives in a credential, not in node parameters.

## Step 3, run 2 (the owner, redundant, 2026-10-10 18:06Z)

The controller's 17:59Z run above succeeded, but its tool output was lost to a tool internal error. The controller's
follow-up check found no `/tmp/proofB*` files and 0 `tmp-*` workflows - the state the 17:59 cleanup had already left -
and misread it as "never ran". The owner then ran the same proof herself (script `error-alert-proof-remote.sh` in the
SDD folder, scp + ssh), so step 3 ran twice and the owner received TWO test alerts instead of one.

Second run: throwaway `tmp-alert-proof-001791655592` (id `MxRgbAp9y3UESrm2`), webhook HTTP 200, execution 28169
`error` (`NodeApiError`, message `Authorization failed - please check your credentials`, httpCode `401`, description
`invalid x-api-key`), WF-6 execution 28170 `success`, Compose text:

```text
⚠️ tmp-alert-proof-001791655592 failed at Anthropic Invalid Key: Authorization failed - please check your credentials — invalid x-api-key
execution: https://<n8n host>/workflow/MxRgbAp9y3UESrm2/executions/28169
```

notify_owner execution 28171 (the controller's read-back): `verdict SENT`. Same result as the first run.

The leak check counted 1 for the same reason as in run 1: the header NAME `x-api-key` appears in Anthropic's message; no key value, no `{`, no `request_id` is in the Compose text.

The raw output of this run is retained in `.superpowers/sdd/2026-09-16-medspa-front-desk/error-alert-proof.out` (git-ignored). It is quoted in full here, changed only by replacing the n8n host with `<n8n host>`, so a reader of the repo can verify the claims above:

```text
WF-6 id: trsMOjXdObkwO7DE; active: true
created tmp-alert-proof-001791655592 -> MxRgbAp9y3UESrm2 (errorWorkflow: trsMOjXdObkwO7DE)
{"active":true}
webhook call (ONE) -> HTTP 200: {"message":"Workflow was started"}
{"id":"28169","status":"error","mode":"webhook"}
throwaway execution: 28169
--- throwaway stored error (values cut)
{"name":"NodeApiError","message":"Authorization failed - please check your credentials","httpCode":"401","keys":["context","description","functionality","httpCode","level","message","messages","name","node","shouldReport","stack","tags","timestamp"],"description":"invalid x-api-key","has_cause":false}
{"id":"28170","status":"success","startedAt":"2026-10-10T18:06:34.873Z"}
{"id":"28167","status":"success","startedAt":"2026-10-10T17:59:20.097Z"}
{"id":"27395","status":"success","startedAt":"2026-10-09T12:24:42.504Z"}
{"id":"27387","status":"success","startedAt":"2026-10-09T12:24:25.560Z"}
{"id":"27380","status":"success","startedAt":"2026-10-09T12:23:23.024Z"}
WF-6 execution: 28170
--- WF-6 Error Trigger payload (error part)
{"workflow":{"id":"MxRgbAp9y3UESrm2","name":"tmp-alert-proof-001791655592"},"lastNode":"Anthropic Invalid Key","error":{"name":"NodeApiError","message":"Authorization failed - please check your credentials","httpCode":"401","keys":["context","description","functionality","httpCode","level","message","messages","name","node","shouldReport","stack","tags","timestamp"],"description":"invalid x-api-key"}}
--- WF-6 Compose output
⚠️ tmp-alert-proof-001791655592 failed at Anthropic Invalid Key: Authorization failed - please check your credentials — invalid x-api-key
execution: https://<n8n host>/workflow/MxRgbAp9y3UESrm2/executions/28169
--- WF-6 Notify (notify_owner) status
{"executionStatus":"success","out":{"verdict":"SENT"}}
--- leak check on WF-6 Compose text (count of key/JSON markers, expected 0)
1
{"deleted":null}
tmp-* workflows left: 1
```

The script's exit trap printed `{"deleted":null}` and `tmp-* workflows left: 1` (the throwaway was deactivated but not
deleted; cause not determined).

## Step 4: cleanup and stub reruns

Run 1 (the controller): the throwaway `tmp-alert-proof-001791655156` was deactivated and deleted (`DELETE` returned it), `GET /workflows` listed 0 `tmp-*` workflows; VPS `/tmp/proofB.*` and
`/tmp/alertproof.jq` removed. Stub suites on the pushed state (repo at 48c5d17 == live, per the step-2 read-back), container Node:
`WF1_STUBS passed 249, failed 0`, `311 passed, 0 failed` (wf5), `WF6_STUBS passed 39, failed 0`, `24 passed, 0 failed` (wf4),
`SEND_MESSAGE_STUBS passed 61, failed 0`.

Run 2 (the controller's read-back): the controller deleted `MxRgbAp9y3UESrm2` by hand after checking its name starts with
`tmp-alert-proof-` (`DELETE` returned the workflow), then verified: 0 `tmp-*` workflows; no `/tmp/proofB*`,
`/tmp/alertproof.jq`, `/tmp/error-alert-proof-remote.sh` on the VPS; wf1-inbound, wf5-reminders, wf6-error-handler
active with `updatedAt` 17:55:47Z / 17:54:50Z / 17:53:37Z (the pushes, nothing since). Stub suites re-run on the
pushed state: `WF1_STUBS passed 249, failed 0`, `SEND_MESSAGE_STUBS passed 61, failed 0` (VPS container),
`WF6_STUBS passed 39, failed 0`, `311 passed, 0 failed` (wf5), `24 passed, 0 failed` (wf4).

## What this proves

WF-6 Compose live on a real n8n 2.41.5 Error Trigger payload shows `message — cause`; notify_owner delivered it. Not proven live:
the Anthropic credit-error text itself (evidence: stored execution 27315 + stubs); WF-1's and WF-5's alert wiring end to end (stubs; WF-1's
expressions proven in the real engine by step 1). The live HTTP 401 description was a plain string (`invalid x-api-key`), so the
JSON-string description branch stays proven only by the stubs and the step-1 Set-node proof.

Lesson: after a lost tool result on a live action, read the instance's execution list before concluding nothing
ran - an absent artefact can mean "cleaned up", not "never created".
