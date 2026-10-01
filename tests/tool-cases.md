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

`search_knowledge(question)` embeds the question, takes the 3 nearest paragraphs of the `medspa_knowledge`
PGVector table and returns `FOUND\n[topic] text\n\n[topic] text...` (the topic line that the ingest put in front
of the embedded text is stripped again) or `NOT_FOUND`. The output also carries `scores`, the raw values.

The `score` on this node is the pgvector cosine DISTANCE (0 = identical, 2 = opposite), so a LOWER value is better.
`Rank` therefore has `HIGHER_IS_BETTER = false`. `THRESHOLD` is `null`: measured on 60 questions, no single cut-off
separates answerable from unanswerable ones (in-base questions score 0.27-0.76, out-of-base 0.51-0.93), so with a
non-empty index the tool always returns `FOUND` with 3 paragraphs and the agent has to judge relevance itself.
Details and the sweep table: `raw/n8n/2026-10-01-pgvector-knowledge-base-report.md`.

Run the ingest by hand with `docker compose exec -T -e N8N_RUNNERS_BROKER_PORT=5690 n8n n8n execute --id <id of wf4-knowledge-ingest>`
(from `/opt/medspa/deploy`; without the extra port the CLI fails with "Task Broker's port 5679 is already in use").

| case | why |
|---|---|
| `kb_hours`, `kb_botox_prep` | the best match is the right paragraph (`FOUND` then `[topic]` on the next line, so the top result is asserted, not just any of the 3) |
| `kb_paraphrase_shave` | "Do I need to shave before laser?" shares no sentence with the laser paragraph and must still find it first |
| `kb_strips_topic_line` | the verdict shows `[topic] text` once: the topic line added for embedding is cut off |
| `kb_out_of_base` (DISABLED, commented out in the tsv) | the brief expects `NOT_FOUND` for a weather question, but the weather question scores 0.697, worse than in-base questions such as "Where exactly are you located?" (0.755). A threshold that blocks the weather question (0.56 was tried through the real node) turned 11 of 36 genuine in-base questions into `NOT_FOUND`. Enable the row only after `THRESHOLD` in the `Rank` node is set |
