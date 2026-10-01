# Tool-level test cases (level 1)

Level 1 of the test plan: each sub-workflow tool is called on its own with fixed
inputs, from the VPS, and its output is compared against a regular expression.
The Public API of n8n cannot run a workflow with data, so the entry point is the
`test-harness` workflow: a Webhook (`POST /webhook/test-tool`, Header Auth with the
`MedSpa Test Key` credential) that unpacks `{workflow_id, input}` and calls the
sub-workflow with Execute Workflow.

## Running

From the repository root:

```
medspa-front-desk/scripts/remote.sh 'tests/tool-cases.sh'              # all cases
medspa-front-desk/scripts/remote.sh 'tests/tool-cases.sh <case name>'  # one case
medspa-front-desk/scripts/remote.sh 'tests/run-case.sh <workflow name> '"'"'<json>'"'"''   # one ad-hoc call
medspa-front-desk/scripts/remote.sh 'tests/cleanup.sh'                 # remove test data
```

`tests/run-case.sh <workflow name> '<json>'` looks the workflow id up by name in
`deploy/workflow-ids.json`, posts it to the harness and prints the JSON that the
last node of the sub-workflow produced. `tests/tool-cases.sh` prints one
`PASS`/`FAIL` line per case and a final `passed N, failed M`; its exit code is
non-zero when any case failed.

## Format of tests/tool-cases.tsv

Tab-separated, one case per line. Lines starting with `#` and empty lines are skipped.

| column | meaning |
|---|---|
| `name` | unique case name, also the argument that selects one case |
| `tool` | workflow name as in `deploy/workflow-ids.json` (for example `test-fixtures`) |
| `input_json` | JSON object passed as the sub-workflow input |
| `expected_regex` | bash extended regex matched against the `verdict` field of the output (the whole JSON when there is no `verdict`); no match, or no output, is a FAIL |
| `setup` | optional bash command run before the call (`at_*` functions and `tests/run-case.sh` are available) |
| `teardown` | optional bash command run after the call, whether it passed or not |

A `setup` that exits non-zero (its last command decides) turns the case into a FAIL without calling the tool,
and a `teardown` that exits non-zero turns a PASS into a FAIL, so both can carry assertions. A teardown that
asserts and also cleans up must keep the status: `<assertion>; r=$?; tests/cleanup.sh; test $r -eq 0`.

Empty `setup` or `teardown` columns are written as empty between tabs. Tab characters
inside a column are not possible, so keep JSON on one line without literal tabs.

Convention for tool workflows: the last node of a tool returns an item with a
`verdict` string (and any structured fields), so a case can assert on `^SOMETHING `.

## Test data hygiene

Test clients use a `client_id` with the prefix `C-test`; test calendar events have
`[TEST]` in the title. `tests/cleanup.sh` removes exactly those and nothing else.

## `tests/lib/airtable.sh`

Shell helpers sourced by the scripts: `at_list TABLE FORMULA`, `at_create TABLE FIELDS_JSON`,
`at_update TABLE REC_ID FIELDS_JSON`, `at_delete TABLE REC_ID`, `at_delete_where TABLE FORMULA`.

## Cases

Cases are appended to the tsv together with the tools they test (tasks 7-12).
The calendar fixtures cases (`fixtures_list_empty`, `fixtures_create_and_delete`)
are added once the `MedSpa Google Calendar` credential exists and `test-fixtures`
has been pushed.

### find_client

`find_client(contact_id)` returns `NEW` or a one-line `KNOWN ...` card. Cases:

| case | why |
|---|---|
| `find_client_unknown` | a `contact_id` with no `Clients` row gives `NEW` (the Airtable Search emits one empty item, which the `Known?` check treats as no client) |
| `find_client_no_name` | a row without `name` is also `NEW`: the agent has not asked for the name yet. The teardown asserts that the row really exists and has no name, so the case cannot pass just because the lookup found nothing |
| `find_client_empty_id`, `find_client_malformed_id`, `find_client_bare_wa_prefix` | `contact_id` of `""`, `xyz` or `wa:` must give `NEW`, never another client's card: a formula like `{phone}=''` matches every row with a blank phone. A named Telegram-only client with notes exists during these cases, which is exactly the row that used to leak |
| `find_client_whitespace_name` | a whitespace-only `name` counts as no name: `NEW` |
| `find_client_no_next_visit` | a `done` appointment without `next_visit_in` gives `last_service=botox upcoming=[...]` with no empty `next_visit_in=` token (optional tokens appear only when the data exists) |
| `find_client_name_quote` | a client-controlled name containing `"` cannot forge a field: quotes become `'`, so `owner_notes=` stays inside `name="..."` and there is no second token |
| `find_client_known` | the full card: last visit from the latest `done` appointment, plus `upcoming=[appt_id service_id start_iso; ...]` with only future `booked`/`reminded`/`confirmed` rows; this is the only place `cancel_booking` gets an `appt_id` from. No `owner_notes` is expected here because `Clients.notes` is empty |
| `find_client_no_appts` | a named client with no appointments gives `upcoming=[]` and no `last_visit` part, not an error |
| `find_client_owner_notes` | non-empty `Clients.notes` is appended as `owner_notes="..."`, with double quotes turned into single quotes and whitespace collapsed |

Airtable node output shape (n8n 2.41.5, Airtable node 2.2): Search returns `{ id, createdTime, fields: { ... } }`,
so expressions read `$json.fields.<column>`, not `$json.<column>`.

### search_knowledge

`search_knowledge(question)` embeds the question and takes the 5 nearest paragraphs of the `medspa_knowledge`
PGVector table (vector search only RANKS), then a relevance gate decides: `Gate` is a Basic LLM Chain on the pinned
snapshot `claude-haiku-4-5-20251001` (max 16 tokens, temperature 0) that receives the question and all 5 numbered
passages and answers YES (plus the numbers of the passages that hold the answer) or NO. The rule is conjunctive: YES
only if EVERY part of the question is answered by the passages; a compound question, a recommendation, a symptom or
complication, a dose or drug interaction, or whether THIS client may proceed given their own condition or medication is
NO, and "tell us / a practitioner will review" is not an answer. The other half, added in the third round with seven
worked examples: a general rule stated in a passage IS an answer even when the client asks about themselves (minimum
age, no injectables in pregnancy, lateness policy, preparation steps, contact details); what is never an answer is a
judgement about this client's own case that the passages do not state. At most 3 passages go to the agent: the ones the
gate cited (so an answer ranked 4th or 5th is not lost), filled up with the best-ranked ones, in rank order. Reason: if the gate said YES for "How long does Botox last, and can I take ibuprofen?", the agent
would hold a Botox passage, the WF-2 guardrail (which escalates drug names only when no passage is in context) would
stay quiet, and the ibuprofen half would be answered from the model's head: a FOUND disarms the second defence.

The tool returns `FOUND\n[topic] text\n\n[topic] text...` (the topic line that the ingest put in front of the embedded
text is stripped again) or `NOT_FOUND`; the output item has exactly one key, `verdict`. An empty or blank question and
an empty (or missing) index return `NOT_FOUND` at once, without an embedding or a gate call. The gate's answer is read
tolerantly (leading quotes, markdown, "Answer:" are ignored). Only an item with NO text at all (the error shape: the
gate node failed after 2 tries, 5 s apart) fails open to `FOUND`, and then `notify_owner` gets "⚠️ Knowledge-base
relevance check unavailable — answers are unfiltered", at most once an hour (workflow static data). An answer that is
present but is not a recognisable YES is `NOT_FOUND`. Angle brackets are removed from the question before it goes into
the `<question>` tags.

The vector score is the pgvector cosine DISTANCE (0 = identical, 2 = opposite), lower is better, and it cannot gate
anything: measured on 60 questions, answerable ones score 0.27-0.76 and unanswerable ones 0.51-0.93, so no cut-off
separates them. That is why the decision is made by the gate. Details, sweep table and gate results:
`raw/n8n/2026-10-01-pgvector-knowledge-base-report.md`.

Run the ingest by hand with `docker compose exec -T -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n execute --id <id of wf4-knowledge-ingest>`
(from `/opt/medspa/deploy`; without the extra port the CLI fails with "Task Broker's port 5679 is already in use").

| case | why |
|---|---|
| `kb_hours`, `kb_botox_prep` | the best match is the right paragraph (`FOUND` then `[topic]` on the next line, so the top result is asserted, not just any of the 3). `kb_botox_prep` failed (NOT_FOUND) under the plain conjunctive rule because the Botox paragraph's second sentence defers medication questions to the practitioner; it passes since the third-round prompt, which has this very question as a worked example (so it is no longer an independent check) |
| `kb_paraphrase_shave` | "Do I need to shave before laser?" shares no sentence with the laser paragraph and must still find it first |
| `kb_strips_topic_line` | the verdict shows `[topic] text` once: the topic line added for embedding is cut off |
| `kb_out_of_base` | a weather question is `NOT_FOUND` (its vector distance, 0.697, is worse than that of the in-base "Where exactly are you located?", 0.755, so only the gate can get both right) |
| `kb_not_found_medical` | "Can I have Botox while taking warfarin?" is `NOT_FOUND`: `kb-contraindications` tells the client to disclose blood thinners but does not say whether this client may proceed. This is the case the NOT_FOUND-then-escalate defence exists for |
| `kb_not_found_service` | "Do you offer massage therapy?": a service the clinic does not offer is `NOT_FOUND` although its distance (0.670) is in the range of real questions |
| `kb_found_location` | "Where exactly are you located?" is `FOUND` with the location paragraph first (a distance threshold lost it) |
| `kb_found_german` | a German question about Saturday opening hours is `FOUND` (the base is English) |
| `kb_not_found_compound` | "How long does Botox last, and can I take ibuprofen before it?": the duration half is in the base, the ibuprofen half is not, so the whole question is `NOT_FOUND` (a partial answer would disarm the guardrail) |
| `kb_not_found_symptom` | a swollen lip with a fever after filler is `NOT_FOUND` |
| `kb_not_found_aspirin` | "Can I have filler while taking aspirin?" is `NOT_FOUND` (same class as warfarin; the first, non-conjunctive prompt let it through) |
| `kb_empty_question` | a blank question is `NOT_FOUND` without any model call |
| `kb_output_only_verdict` | the setup asserts that the output item has exactly the key `verdict` (`jq -e 'keys == ["verdict"]'`), then the case checks a normal `FOUND` |

The gate calls a real model, so these cases cost a fraction of a cent each and depend on the Anthropic API.
To see the fail-open behaviour, push a copy of the workflow with a non-existent model name in `Haiku`: every question
then returns `FOUND` after about 6 s (the retry wait) and the first one also sends the owner warning.

### wf4-knowledge-ingest

Not a tool, so no tsv case. It is run with the command above and checked by `select count(*) from medspa_knowledge`
(14 after every run, never more). It has three triggers: Manual, an Airtable poll every 15 minutes, and an hourly
schedule. `Plan` builds the documents and throws `KB_NO_DOCUMENTS` BEFORE anything is truncated when no Knowledge row
has text. It also compares the (kb_id, text) pairs the index holds with the documents: when they are identical the run
does nothing (no truncate, no embedding, no message), unless it is a manual run, which always rebuilds. So the hourly
run costs nothing on a healthy index and repairs a broken one. After `Insert`, `Count` and `Verify` throw
`KB_INDEX_EMPTY` (no rows, or the table is missing), `KB_INDEX_DUPLICATED` or `KB_INDEX_INCOMPLETE` (distinct kb_id
count different from the documents) so a failed rebuild is never silent. The owner message
`📚 Knowledge base re-indexed: N paragraphs` is sent only for a manual run or when a rebuild changed the content.

### escalate

`escalate(contact_id, reason)` returns `ESCALATED`. Side effects: `Clients.status` becomes `escalated` (only that column is
written) when the contact is a known client, and the owner gets one Telegram message through `notify_owner`:

```
🚨 Escalation — Test One (tg:900000001)
Reason: client asked for a human
Status: client flagged escalated
---
Client: ...
Bot: ...
```

The tool never refuses: an unknown or malformed contact still reaches the owner (an unknown client is itself worth
reporting), with `Status: contact not on file - nothing was flagged`. `Client Formula` is the validated Code node of
`find_client` (`^(tg:\d+|wa:\+\d+)$`, otherwise a formula that matches nothing), so a bad `contact_id` can never flag or
read someone else's row. `Client`, `Flag Escalated` and `History` continue on error, so a failing step still produces an
owner message: a failed flag says `WARNING: could not set the client status to escalated - flag them by hand`, a failed
lookup says `client lookup FAILED`.

The message is built in `Compose` from client- and agent-controlled text (name, `reason`, contact, history). Each piece is
stripped of control, zero-width and bidi characters, whitespace is collapsed to one line, `<`, `>` and `&` are replaced by
look-alikes (`notify_owner` cuts at 4000 characters BEFORE it HTML-escapes, so raw `&` could push a message over
Telegram's 4096), and the pieces are capped (name 60, contact 80, reason 500, one history line 300). The header (who,
contact, reason, status) is composed first; the history gets what remains of a 3500-character budget, newest lines
first, printed oldest first, with `(N earlier messages not shown)` on top. History rows that are not JSON or have another
shape are skipped, as are `tool` rows.

`History` reads the last 20 rows of `n8n_chat_histories` for `session_id = contact_id` (bound parameter; an invalid
`contact_id` binds `''` and reads nothing). That table is created by the Postgres Chat Memory node (Task 12), so until it
exists the query fails; the node is set to continue on error and then emits ONE item whose `message` is the error text
(`relation "n8n_chat_histories" does not exist`) and which has an `error` object. `Compose` keys on `error`, never treats
that item as history, and prints `(conversation history unavailable)`. With the table present but no rows for the contact
it prints `(no conversation history yet)`.

Every test escalation is a real Telegram message to the owner; the reasons start with `[TEST]`.

| case | why |
|---|---|
| `escalate_ok` | a Telegram client goes from `active` to `escalated`; the teardown compares the whole row before and after and allows only `status` to differ |
| `escalate_whatsapp_client` | a `wa:+...` contact is found by `phone` and flagged |
| `escalate_unknown_contact` | an unknown contact still gives `ESCALATED`; the teardown checks that no `Clients` row was created for it and that a bystander client is still `active` |
| `escalate_malformed_id`, `escalate_empty_id`, `escalate_bare_wa_prefix` | `xyz`, `""` and `wa:` escalate to the owner but flag nobody: the bystander client (blank `phone`, the row a `{phone}=''` formula would hit) stays `active` |
| `escalate_hostile_reason` | a reason with tags, `&`, newlines, a forged `Status:` line and a NUL character is delivered (a raw `<b>` or `&` would make Telegram reject the message) and the forged line stays inside the `Reason:` line |

The tsv checks the verdict, the Airtable side effects and that Telegram accepted the message; what the message says is
checked by running `Compose` alone in the n8n container's node against fixed history rows (long rows, junk rows,
hostile text, missing table, failed flag), and once end to end with a throwaway copy of the workflow whose `History`
node returned 20 synthetic rows (3248-character message delivered, 6 oldest lines dropped, header intact). Execution
data of the last runs is in the n8n execution list (`escalate`, `notify_owner` → `Send Owner`).
