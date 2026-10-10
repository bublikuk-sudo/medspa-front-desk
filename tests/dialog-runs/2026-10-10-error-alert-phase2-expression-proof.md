# Error-alert mini-task, phase 2, step 1: live expression proof (2026-10-10, ~17:55 UTC)

Scope: ONLY step 1 of the controller's phase 2 order was run. No production workflow was pushed or activated (step 2 was blocked, see the report).

## What ran

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

## Result

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

## Cleanup

`tmp-expr-proof-001791654539` deactivated and deleted through the API; `GET /workflows` lists 0 workflows named `tmp-*`; /tmp files on the VPS removed.

## Baseline taken before the (blocked) push

Pulled the three live workflows with `scripts/n8n-pull.sh` and compared canonical JSON (`jq -S -c`) with the repo files as of `600cf26~1`: wf6-error-handler, wf5-reminders and
wf1-inbound were IDENTICAL (live == repo before my changes), so a push replaces exactly the reviewed diff. Live `updatedAt` after the blocked attempt is unchanged
(wf6 2026-10-02T08:42:54Z, wf5 2026-10-09T11:04:27Z, wf1 2026-10-08T19:42:57Z).

## Step 2 (done by the controller in the owner's session, recorded here as the controller's report, not verified by me)

The controller pushed `wf6-error-handler`, `wf5-reminders`, `wf1-inbound` in that order, each with `--activate`, at about 17:53-17:55Z, and pulled each back and compared it with
`jq -S` on the VPS against the repo at `0b04a8c`: CONTENT-IDENTICAL for all three. I pushed nothing.

## Steps 3 and 4: run by the controller (2026-10-10, 17:59-18:05Z, owner's go-ahead "да, делай проверку сама")

The implementer's blocked script (below) was read in full and run unchanged by the controller in the owner's session.

Step 3, failing-branch proof. Throwaway `tmp-alert-proof-001791655156` (id `p0xs6N60jf44VplY`, errorWorkflow `trsMOjXdObkwO7DE` = WF-6, active),
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
Compose text; the script's marker grep counted 1 line because Anthropic's own message contains the header NAME `x-api-key`. The key value does
appear once in WF-6's stored execution data (the Error Trigger payload carries the failing node's definition, including its literal header) -
n8n's own stored data, not the alert; a real key lives in a credential, not in node parameters.

Step 4. Throwaway deactivated and deleted (`DELETE` returned it), `GET /workflows`: 0 `tmp-*` workflows; VPS `/tmp/proofB.*` and
`/tmp/alertproof.jq` removed. Stub suites on the pushed state (repo at 48c5d17 == live, per the step-2 read-back), container Node:
`WF1_STUBS passed 249, failed 0`, `311 passed, 0 failed` (wf5), `WF6_STUBS passed 39, failed 0`, `24 passed, 0 failed` (wf4),
`SEND_MESSAGE_STUBS passed 61, failed 0`.

What this proves: WF-6 Compose live on a real n8n 2.41.5 Error Trigger payload shows `message — cause`; notify_owner delivered it. Not proven live:
the Anthropic credit-error text itself (evidence: stored execution 27315 + stubs); WF-1's and WF-5's alert wiring end to end (stubs; WF-1's
expressions proven in the real engine by step 1).

## Steps 3 and 4 as first attempted by the implementer: NOT RUN (blocked)

From 2026-10-10 ~18:05Z the permission classifier ([Production Deploy]) refused my ssh commands to the VPS: first the creation and run of the failing-branch throwaway
(`tmp-alert-proof-*`, errorWorkflow = WF-6, one invalid-key Anthropic call, one owner Telegram alert), then even a read-only GET of the workflow list. Per the instruction I stopped and looked for
no other route. Consequence: the failing-branch proof, the throwaway cleanup check and the container stub reruns after the push are NOT done. Nothing from step 3 was created (the refused command ran
nothing: no `tmp-alert-proof-*` workflow, no webhook call, no owner message).
