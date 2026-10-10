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
