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
asserts and also cleans up must keep both statuses: `<assertion>; r=$?; tests/cleanup.sh --no-calendar && test $r -eq 0`
(a failing cleanup fails the case, and the cleanup still runs when the assertion failed).

`tests/cleanup.sh --no-calendar` skips only the calendar step. Cases that never touch the calendar (find_client_*,
escalate_*, kb_*) use it, so they do not depend on Google being up; the plain `tests/cleanup.sh` also deletes the
`[TEST]` events and is for the fixtures cases and for hand use. Cleanup runs every step even when one fails and exits 1
at the end if any did.

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

### test-fixtures

`test-fixtures(action, start_iso, end_iso)` works on the Google Calendar named `MedSpa` (the id is
`Settings.calendar_id`; Airtable hands records over as `{id, createdTime, fields}`, so the workflow reads
`.fields.calendar_id`). `action` is routed by a Switch:

| action | does | verdict |
|---|---|---|
| `create_busy` | creates `[TEST] busy` (description `test-fixture`) from `start_iso` to `end_iso` | `BUSY_CREATED <event id>` |
| `list_events` | lists every event between `start_iso` and `end_iso`; also returns `events` (id, summary, description, start, end) | `EVENTS <n>` |
| `delete_test_events` | deletes every event whose title starts with `[TEST]`, from a year ago to ten years ahead | `DELETED <n>` |

`delete_test_events` searches with the query `[TEST]` and then keeps only items whose summary really starts with
`[TEST]`, so a real client booking is never deleted even if the search matches loosely. The window must cover far-future
test dates (the cases use 2030): the brief's -30/+60 days missed them. With nothing to delete it still answers
`DELETED 0` (the list node has Always Output Data and an If routes the empty case straight to the result).

| case | why |
|---|---|
| `fixtures_list_empty` | a day in 2030 with no events is `EVENTS 0` (the setup clears leftovers first) |
| `fixtures_create_and_delete` | create answers `BUSY_CREATED ...`; the teardown deletes it |
| `fixtures_created_event_is_listed` | a created event shows up in `list_events` (`EVENTS 1`) |
| `fixtures_delete_removes_all` | two events are deleted (`DELETED 2`) and the day is empty afterwards |
| `fixtures_delete_none` | the zero-events case: `DELETED 0`, no error |

`tests/cleanup.sh` calls `delete_test_events` last and exits 1 if that call fails (`--no-calendar` skips it).
`Settings`, `List Test Events`, `List Events` and `Delete Each` retry once (2 tries, 5 s apart); `Create Busy` deliberately
does not: a retry after a timed-out success would create a duplicate busy block (its `notes` field says so).

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
snapshot `claude-haiku-4-5-20251001` (max 250 tokens, temperature 0) that receives the question and all 5 numbered
passages, reasons first (one short sentence naming the passage that states the information, if any) and ends with a line
`VERDICT: YES <numbers of the passages that hold the answer>` or `VERDICT: NO`. The rule is conjunctive: YES
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
an empty (or missing) index return `NOT_FOUND` at once, without an embedding or a gate call. The gate's output is read for
its LAST line of the form `VERDICT: YES|NO ...` (markdown and case are ignored). Only an item with NO text at all (the
error shape: the gate node failed after 2 tries, 5 s apart) fails open to `FOUND`, and then `notify_owner` gets
"⚠️ Knowledge-base relevance check unavailable — answers are unfiltered", at most once an hour (workflow static data).
Anything else that is not a `VERDICT: YES`, including a missing VERDICT line (for example output cut off by the token
cap), is `NOT_FOUND`: escalation is the safe direction. That case is not silent: the `Gate Check` item of the execution
carries `truncated: true` (gate answered, no VERDICT line), so the owner can count them. Angle brackets are removed from the question before it goes into
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

`escalate(contact_id, reason)` returns `ESCALATED`. The order of the steps is the point of the design:

`Client` (lookup) -> `History` -> `Compose` -> `Notify` (the owner is told FIRST) -> `Has Client?` -> `Flag Escalated` -> `Flag Failed?` -> `Notify Flag Failure` (only when the flag failed) -> `Result`.

The client is flagged only after the owner has been told. A flagged client nobody knows about is the unrecoverable state (WF-1 keeps
answering them "a team member will contact you" while no team member knows), so the tool never produces it: if `Notify` fails
(`notify_owner` retries its own Airtable and Telegram nodes, 2 tries 5 s apart; `Notify` itself has no retry, which would only multiply
those) the execution fails BEFORE `Flag Escalated`, the client stays as it was, the tool call returns an error
instead of `ESCALATED`, and WF-6 reports the failed execution to the owner (`⚠️ escalate failed at Notify: ...`). If the flag fails after the owner was told (2 tries, 5 s
apart), a second best-effort message says `Escalation follow-up: <contact> (Clients row recXXX) was reported to you, but its status
could NOT be set to escalated. Set Clients.status = escalated by hand`, and the verdict is still `ESCALATED` because the owner knows.
Only `Clients.status` is written.

Owner message:

```
🚨 Escalation — tg:900000001
Name: Test One
Reason: client asked for a human
Status: client on file - being set to escalated (you get a second message if that fails)
---
Client: ...
Bot: ...
```

The contact is on the first line, before the client-controlled name. The tool never refuses: an unknown or malformed contact still reaches
the owner (`Name: (not on file)`, `Status: contact not on file - nothing to flag`; an invalid id is shown as `<id> [INVALID contact_id]`). A failed
client lookup says `client lookup FAILED - nothing was flagged; ... by hand`. The validated `Client Formula` Code node of `find_client` is used
with the digits capped: `^(tg:\d{1,20}|wa:\+\d{1,20})$` (in `Client Formula`, `History` and `Compose`), otherwise a formula that matches nothing, so
a bad `contact_id` never flags or reads someone else's row. (`find_client` still carries the uncapped regex.)

`Compose` cleans everything client- or agent-controlled (name, reason, contact, history): the input is cut BEFORE it is expanded, then control,
zero-width and bidi characters (including U+061C) are stripped, whitespace is collapsed, `<`, `>` and `&` become look-alikes (`notify_owner`
cuts at 4000 characters BEFORE it HTML-escapes, so raw `&` could push a message over Telegram's 4096), and the pieces are capped (name 60,
contact 40 when invalid, reason 500, one history line 300). The header is composed first; the history gets what remains of a 3500-character
budget, newest lines first, printed oldest first, with `(N earlier messages not shown)` on top. Rows that are not JSON, have another shape or
are `tool` rows are skipped.

`History` reads the last 20 rows of `n8n_chat_histories` for `session_id = contact_id` (bound parameter; the query carries `AND $1 <> ''`, and an invalid
id binds `''`, so Postgres evaluates a constant-false filter instead of scanning an unindexed table). Three distinct empty states, because the
reader must be able to tell a quiet conversation from a broken lookup:

| state | what the owner reads |
|---|---|
| the query failed (table missing, database down) | `(conversation history unavailable)`. The Postgres node, set to continue on error, emits ONE item whose `message` is the error text (`relation "n8n_chat_histories" does not exist`) and which has an `error` object; `Compose` keys on `error` and never treats it as a row |
| the query worked and returned no rows | `(no conversation history yet)` |
| rows came back but none could be read (unparseable, wrong shape, only `tool` rows, which is how a wrong session-id convention or message format would show up) | `(history rows present but unreadable: N)` |
| the contact id is invalid, so no lookup was made | `(history not looked up: invalid contact_id)` |

Every test escalation is a real Telegram message to the owner; the reasons start with `[TEST]`.

| case | why |
|---|---|
| `escalate_ok` | a Telegram client goes from `active` to `escalated`; the teardown compares the whole row before and after and allows only `status` to differ |
| `escalate_whatsapp_client` | a `wa:+...` contact is found by `phone` and flagged |
| `escalate_unknown_contact` | an unknown contact still gives `ESCALATED`; no `Clients` row is created for it and a bystander client stays `active` |
| `escalate_malformed_id`, `escalate_empty_id`, `escalate_bare_wa_prefix` | `xyz`, `""` and `wa:` escalate to the owner but flag nobody: the bystander (blank `phone`, the row a `{phone}=''` formula would hit) stays `active` |
| `escalate_tg_no_digits` | `tg:` flags nobody: the bystander is a WhatsApp-only client with a blank `telegram_chat_id`, the row an unvalidated `{telegram_chat_id}=''` would hit; the header says `[INVALID contact_id]` |
| `escalate_quote_id` | `tg:1'--` is rejected by the validation and flags nobody |
| `escalate_long_digits` | `tg:` plus 21 digits is invalid: the bystander's `telegram_chat_id` IS that number, so an uncapped regex would flag it |
| `escalate_hostile_reason` | a reason with tags, `&`, newlines, a forged `Status:` line and a NUL is delivered (a raw `<b>` or `&` would make Telegram reject the message) and the forged line stays inside the `Reason:` line |
| `escalate_history_present` | the history path with a real table: seeded rows (human, junk string, tool row, ai, plus a row of ANOTHER session) give `Client: ...` then `Bot: ...` in conversation order, with no junk, no tool noise and nothing from the other session |
| `escalate_history_none` | table present, no rows for the contact (a row of another session exists): `(no conversation history yet)` |
| `escalate_history_unreadable` | 3 rows present but none readable: `(history rows present but unreadable: 3)` |

The history cases need the table, which the Postgres Chat Memory node (Task 12) normally creates. `tests/lib/pg.sh` creates it with the node's own DDL
(`CREATE TABLE IF NOT EXISTS n8n_chat_histories (id SERIAL PRIMARY KEY, session_id VARCHAR(255) NOT NULL, message JSONB NOT NULL)`), seeds rows under
session ids `tg:9000000NN`, and `chat_table_release` in the teardown deletes exactly those rows and drops the table again only if the case created it and it is
empty. Because it is the same DDL with `IF NOT EXISTS`, it cannot conflict with the Chat Memory node; the only residual risk is the node creating the table in the
instant between a case's create and its drop, and the drop is skipped unless the table is empty. `tests/cleanup.sh` also removes any leftover `tg:9000000%` rows.
`tests/lib/n8n.sh` (`last_compose`) reads the owner message the newest `escalate` execution composed from the n8n API, so cases can assert on the text.

Not in the tsv: the failure paths need a workflow that fails on purpose. Verified by hand with throwaway copies of `escalate.json` (deleted afterwards), each
differing in one node: `escalate_ft_notify`, whose `Notify` calls a workflow that throws, gave HTTP 500 from the harness, stopped at `Notify` (no `Flag Escalated`
in its run data), left the client `active`, and WF-6 sent `⚠️ escalate_ft_notify failed at Notify: ...`; `escalate_ft_flag`, whose `Flag Escalated` targets a
record id that does not exist, returned `ESCALATED`, sent the owner message and then the follow-up message, and left the client `active`. (n8n refuses to
activate a workflow whose Execute Workflow node points at an id that does not exist, so the notify failure needs a real throwing workflow.) The text
branches (query failed, junk rows, huge rows, hostile text) were checked by running `Compose` alone in the n8n container's node.

### check_availability

`check_availability(contact_id, service_id, date, part_of_day?)` is the first calendar-backed tool. It returns `FREE <iso>, ...` (up to 6 slots of the
requested day), `NONE nearest: <iso>, <iso>, <iso>` (the first slot of each of the next days that has one, within 7 days), `NONE no slots in the next 7 days`
or `UNKNOWN_SERVICE <id> (<name>, <min> min); ...`, and writes the slots it offered to `Clients.last_offer_json` / `last_offer_at`, which is the only thing
`propose_booking` will accept. The dates are in the future on purpose: 2030-01-07 is a Monday (10:00-19:00 in the live `working_hours`), 2030-01-13 a Sunday
(closed). 2030-01-06, the date the fixtures cases use, is a Sunday, so these cases do not use it.

| case | why |
|---|---|
| `avail_unknown_service` | `tattoo` gives `UNKNOWN_SERVICE` followed by the active services with their durations (the regex only requires `botox (Botox, 30 min)` somewhere in the list, because the order is the Airtable record order) |
| `avail_busy_excluded` | the setup deletes old `[TEST]` events and creates a busy block 14:00-15:00 on the Monday; for an afternoon Botox the answer is exactly `12:00, 12:30, 13:00, 13:30, 15:00, 15:30`: 13:30 stays (it ends at 14:00), 14:00 and 14:30 are gone, 15:00 is back. The teardown deletes the `[TEST]` events |
| `avail_morning_only` | HydraFacial (60 min), morning: exactly `10:00, 10:30, 11:00`. A morning visit must END by 12:00, so 11:30 is not offered |
| `avail_closed_day` | a Sunday gives `NONE nearest:` with 10:00 on the following Monday, Tuesday and Wednesday |
| `avail_saves_offer` | with a client row `C-test-1` on file, the teardown reads the row back: `last_offer_json` is a JSON list of 6 slots of that day and `last_offer_at` is set (prints `offer_saved`); then `tests/cleanup.sh --no-calendar` removes the row, and a failure on either side fails the case |
| `avail_pod_anytime` | `part_of_day` `" Anytime "` (the model passes things like this) is trimmed and treated as "no filter": the first 6 slots of the day, 10:00 to 12:30 |
| `avail_pod_invalid` | `part_of_day` `brunch` gives `NONE invalid part_of_day, expected morning\|afternoon\|evening` instead of a false "no slots", and (like the other invalid-input verdicts) saves `[]`: the setup puts a real offer on the client row, the teardown asserts `last_offer_json` is now `[]` (prints `offer_cleared`) |

No filter: empty, `any`, `anytime`, `null`, `none` (after trim and lower-casing).

Failure behaviour, not covered by a tsv case because it needs a broken calendar or Settings table (verified live with throwaway workflow copies and with the node code run against stubs, see the Task 8 report, fix round 1): an unknown or inaccessible calendar id makes `FreeBusy` throw (`notFound`), so the tool fails and WF-6 reports it instead of answering `FREE`; `Check Settings` throws on a missing Settings row, a non-positive `slot_step_min`, a non-numeric `min_lead_min`, a missing or invalid `timezone` or `calendar_id`, and a `working_hours` entry that is not `null` or `["HH:MM","HH:MM"]`; `Compute` throws on a non-numeric `duration_min` and on a busy interval that does not parse.

Google Calendar Availability, output format Booked Slots (n8n 2.41.5, node 1.3): one item per busy interval, `{"start":"2030-01-07T13:00:00Z","end":"2030-01-07T14:00:00Z"}`
(UTC, `Z`). With no busy interval there is no item, and `alwaysOutputData` makes it one empty `{}` item, which `Compute` filters out (it keeps only items that have both
`start` and `end`). The node must run once (`executeOnce`), or the seven Services items in front of it would call Google seven times.

