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

The teardown can read two variables of the runner: `$out`, the verdict the regex was matched against, and `$raw`, the
whole JSON the tool returned (empty when the call failed). `$raw` is how a case asserts on fields other than the
verdict, for example `printf '%s' "$raw" | jq -e '.first_visit == true'` for `confirm_booking`.

A setup can set `CASE_INPUT` to a JSON object that replaces the `input_json` column, for an input that only exists after
the setup (an `appt_id` that propose_booking generated: `ap=$(bk_appt_id 1) && CASE_INPUT=$(jq -nc --arg a "$ap" '{contact_id:"tg:900000001", appt_id:$a}')`).
The column then shows the shape with a placeholder such as `"<the booked appt_id, set by the setup>"`. The runner unsets
`CASE_INPUT` before every setup. Variables a setup assigns (`ap`, `old`, `t0`) are visible to the teardown; the runner
also unsets the variables setups and teardowns use (`ap old new t0 s e x ev a bg bgf bgp before h t`) before every case,
so a case can never read a value left by the previous one. A new setup variable belongs in that list.

`tests/cleanup.sh --no-calendar` skips only the `[TEST]` sweep of the calendar. Cases that never touch the calendar
(find_client_*, escalate_*, kb_*, propose_*) use it, so they do not depend on Google being up; the plain
`tests/cleanup.sh` also deletes the `[TEST]` events and is for the fixtures, check_availability and confirm_* cases and
for hand use. Cleanup runs every step even when one fails and exits 1 at the end if any did.

Booking events are cleaned up by id. `confirm_booking` titles its events `<service> — <client name>`, which the
`[TEST]` sweep deliberately never deletes (its guard keeps only titles that start with `[TEST]`, and must stay that
way). So, before the test Appointments rows are deleted, `tests/cleanup.sh` collects the `calendar_event_id` of every
Appointments row whose `client_id` starts with `C-test` and calls `test-fixtures` `delete_events_by_id` with exactly
those ids; it prints `booking events: ok DELETED n of m`. The ids only ever come from `C-test` rows, so a real
booking cannot be reached. If that call fails, or answers `DELETED n of m` with n < m (an event that is already gone,
or whose description is not an appt_id, means something else touched it), the rows that carry an event id are kept
(the next cleanup still finds their events) and cleanup exits 1. This step runs even with `--no-calendar` whenever such ids exist, because
deleting the rows first would lose the ids for good; normally only a confirm_* case leaves them.

Empty `setup` or `teardown` columns are written as empty between tabs. Tab characters
inside a column are not possible, so keep JSON on one line without literal tabs.

Convention for tool workflows: the last node of a tool returns an item with a
`verdict` string (and any structured fields), so a case can assert on `^SOMETHING `.

## Test data hygiene

Test clients use a `client_id` with the prefix `C-test`; test calendar events have
`[TEST]` in the title, and booking events made for test clients are found through their Appointments rows (above).
`tests/cleanup.sh` removes exactly those and nothing else.

## `tests/lib/airtable.sh`

Shell helpers sourced by the scripts: `at_list TABLE FORMULA`, `at_create TABLE FIELDS_JSON`,
`at_update TABLE REC_ID FIELDS_JSON`, `at_delete TABLE REC_ID`, `at_delete_where TABLE FORMULA`,
`at_rec_id TABLE FORMULA` (record id of the first match, fails when there is none) and
`at_test_client_with_offer N SLOT_ISO [SERVICE_ID]` (recreates client `C-test-N`, Telegram chat `90000000N`, name
`Test C-test-N`, status `new`, whose last offer, made just now, is exactly that slot for that service, default `botox`,
in check_availability's format `{"service_id":"botox","slots":["<iso>"]}`) and `at_offer N SLOT_ISO [SERVICE_ID]` (the
same offer written on the EXISTING client `C-test-N`, keeping its row, status and bookings: a second proposal in one
case, as a reschedule needs).

## `tests/lib/n8n.sh`

`last_compose WORKFLOW` (the owner message the newest execution composed), and the booking helpers: `cal_on DATE`
(test-fixtures `list_events` for that whole day as JSON; the offset is `+01:00`, so winter dates only),
`bk_propose N SLOT_ISO [REPLACES_APPT_ID]` (propose_booking botox at that slot for `tg:90000000N`, optionally as a
reschedule of that visit, must answer `PENDING A-...`) and `bk_confirm N` (confirm_booking for `tg:90000000N`, must
answer `BOOKED A-...`). Each fails unless the tool gave that verdict, so a setup chained with `&&` stops at the first
step that did not work. `bk_appt_id N` prints the appt_id of client N's booked row and fails unless there is exactly one.

Also: `appt_event_id APPT_ID` (the Google event id confirm_booking gives that booking: `appt` + the hex of the appt_id
bytes), `execs_since WORKFLOW ISO` (how many executions of that workflow started at or after that instant, newest 50;
the cases count owner notifications with `execs_since notify_owner "$t0"`), `last_node_json WORKFLOW NODE` (the first
item that node output in the newest execution of that workflow; `last_node_json notify_owner Trigger | jq -r .text` is
the last owner message, and it fails when the node did not run) and `cal_sweep_day DATE`.

`cal_sweep_day DATE` is the safety net of the cases that can leave a booking event that no row points at when they FAIL
(`confirm_repair`, `confirm_concurrent`, `confirm_repair_replaces`: the event was created but `calendar_event_id` never
written). It runs BEFORE `tests/cleanup.sh`, because it needs the rows: it takes the `C-test` Appointments rows whose
`calendar_event_id` is EMPTY, derives `appt_event_id` of each, and deletes only that day's events with one of those ids
(through `delete_events_by_id`, which also checks the description is an appt_id). A real booking's appt_id is never a
`C-test` row's, so it cannot be reached; events whose id IS stored on a row are left to the cleanup, which deletes them
by id (deleting them here first would make the cleanup's `DELETED n of m` fall short). Until Task 10 it picked every
event of the day whose description looked like an appt_id, which could have reached a real booking on that date.

## Index: which spec point each case closes

Level 1 is "each tool on its own with fixed inputs" (spec, section Testing, point 1). The suite is 96 cases and is
green twice in a row (log: `tests/dialog-runs/2026-10-03-level1.md`). Every case is self-sufficient: it builds its own
state in `setup`, can be run alone (`tests/tool-cases.sh <name>`) and removes its test data in `teardown`. The last row,
`final_cleanup`, leaves the base and the calendar empty of test data. The per-case details are in the tool sections
below; this table only says which spec point the cases of a tool close.

| tool | cases | spec point |
|---|---|---|
| `test-fixtures` | `fixtures_list_empty`, `fixtures_create_and_delete`, `fixtures_created_event_is_listed`, `fixtures_delete_removes_all`, `fixtures_delete_none`, `fixtures_by_id_skips_non_booking`, `final_cleanup` | The test harness itself: a busy block can be created, listed and removed; only `[TEST]` events and booking events of `C-test` rows are ever deleted ("never touch a real booking"); the suite leaves nothing behind. |
| `find_client` | `find_client_unknown`, `find_client_no_name` | Unknown contact, or a row without a name, is `NEW` (the agent asks for the name). |
| | `find_client_known`, `find_client_no_appts`, `find_client_no_next_visit`, `find_client_owner_notes` | The returning-client card: last visit, `upcoming=[...]` (the only source of `appt_id` for cancel), owner notes. |
| | `find_client_empty_id`, `find_client_malformed_id`, `find_client_bare_wa_prefix`, `find_client_whitespace_name`, `find_client_name_quote` | Hostile or malformed input never returns another client's card and a client-controlled name cannot forge card fields. |
| `search_knowledge` | `kb_hours`, `kb_botox_prep`, `kb_paraphrase_shave`, `kb_found_location`, `kb_found_german`, `kb_strips_topic_line`, `kb_output_only_verdict` | A question the base answers returns `FOUND` with the right paragraph first, in any phrasing or language. |
| | `kb_out_of_base`, `kb_not_found_service`, `kb_empty_question` | "Question outside the base gives NOT_FOUND" (the agent then escalates, never invents). |
| | `kb_not_found_medical`, `kb_not_found_aspirin`, `kb_not_found_symptom`, `kb_not_found_compound` | Medical, drug, symptom and half-answered compound questions are `NOT_FOUND`: the first guardrail layer (a FOUND must never disarm the second one in WF-2). |
| `escalate` | `escalate_ok`, `escalate_whatsapp_client`, `escalate_unknown_contact` | A client is flagged `escalated` (found by Telegram id or phone) and the owner is notified; an unknown contact still notifies and creates no row. |
| | `escalate_malformed_id`, `escalate_empty_id`, `escalate_bare_wa_prefix`, `escalate_tg_no_digits`, `escalate_quote_id`, `escalate_long_digits` | Invalid ids flag nobody (no bystander with a blank phone or chat id is hit). |
| | `escalate_hostile_reason` | The owner message survives HTML, `&`, newlines, NUL and a forged `Status:` line. |
| | `escalate_history_present`, `escalate_history_none`, `escalate_history_unreadable` | The owner gets the recent conversation (client/bot lines in order, no tool noise, nothing from another session). |
| `check_availability` | `avail_busy_excluded` | "An occupied slot does not get into FREE" (a real calendar event, boundaries exact). |
| | `avail_morning_only`, `avail_pod_anytime`, `avail_pod_invalid` | `part_of_day` filters (a morning visit ends by 12:00), a loosely typed value is normalised, an invalid one is `NONE invalid part_of_day`. |
| | `avail_closed_day` | "A day without windows gives NONE" plus the next three open days. |
| | `avail_unknown_service` | An unknown service is `UNKNOWN_SERVICE` with the list of real ones. |
| | `avail_saves_offer` | The offered slots are stored on the client row (`last_offer_json`): the only slots `propose_booking` accepts. |
| `propose_booking` | `propose_not_offered`, `propose_stale_offer`, `propose_old_format_offer`, `propose_other_service` | "A slot that was not offered gives SLOT_NOT_OFFERED" (never offered, offer too old, old offer format, offered for another service). |
| | `propose_no_client`, `propose_unknown_service` | `NO_CLIENT_ROW` and `UNKNOWN_SERVICE` write nothing. |
| | `propose_ok`, `propose_after_real_offer` | A valid slot becomes a `pending` row with a TTL, the name is stored for a nameless client; works with the real `check_availability`. |
| | `propose_replaces_pending` | A new proposal cancels the client's older pending rows and nobody else's. |
| | `propose_replaces_own`, `propose_replaces_foreign`, `propose_replaces_past` | Reschedule: `replaces_appt_id` is kept only for the client's own future visit. |
| `confirm_booking` | `confirm_no_pending`, `confirm_other_client_pending` | "YES without a pending visit goes to the agent, not into a booking" (`NO_PENDING`; another client's pending row is not touched). |
| | `confirm_expired` | "YES after the TTL gives EXPIRED" (row cancelled, no event). |
| | `confirm_ok`, `confirm_returning_client` | The booking: row `booked`, exactly one calendar event (title, times, description), client `active` on a first visit, owner notified. |
| | `confirm_again`, `confirm_stray_pending`, `confirm_repair`, `confirm_concurrent` | Idempotence: a second YES, a stray pending row, a crash between event and row, two simultaneous YES all end with one event and one notification. |
| | `confirm_slot_taken` | Two clients, one slot: the second gets `SLOT_TAKEN` with alternatives and a fresh offer. |
| | `confirm_replaces_old`, `confirm_reschedule_late`, `confirm_repair_replaces`, `confirm_replace_failed` | Reschedule through confirm: the old visit is cancelled (never `late_cancel`, client not flagged), the repair path also cancels the old visit, a failed cancel of the old one still books the new one and warns the owner. |
| `cancel_booking` | `cancel_ok`, `cancel_already_gone` | A cancel more than 24 h ahead gives `CANCELLED`, deletes the calendar event, tells the owner (also when Google says the event is gone). |
| | `cancel_late`, `cancel_late_escalated` | "A cancel 3 hours before gives LATE_CANCEL": row `late_cancel`, client `flagged` (an escalated client stays escalated). |
| | `cancel_reschedule_reason`, `cancel_forged_reschedule` | A late cancel with a real replacement is a reschedule, not a penalty; a forged `reschedule` reason is treated as a late cancel. |
| | `cancel_not_found`, `cancel_invalid_id`, `cancel_not_yours`, `cancel_past`, `cancel_already_cancelled` | `NOT_FOUND` / `NOT_YOURS`: unknown, malformed, someone else's, past and already cancelled ids change nothing. |
| | `cancel_pending_in_window` | A pending proposal is cancelled without penalty. |
| `reminder_reply` | `reminder_none`, `reminder_yes`, `reminder_no` | The answer to the reminder: no reminded visit is `NO_REMINDED`; YES confirms exactly the nearest reminded visit; NO cancels it, deletes the event, flags the client and tells the owner. |
| `wf2-agent` | `agent_books_flow` | The agent really calls `check_availability` for a booking request and the offer is saved. This case is non-deterministic (an LLM). |
| | `agent_medical_escalates` | "A medical question goes to the owner": client `escalated`, empty reply (the fixed template is sent), exactly one owner notification. |
| | `agent_discloses_ai` | EU AI Act Art. 50: a new client is told in the first reply that the assistant is an AI. |

Not in this suite. WF-5 is a scheduled workflow, not a sub-workflow tool the harness can call, so its behaviour is
tested separately (`tests/wf5-live.sh`, `tests/wf5-live-markfail.sh`, Code-node stubs in `tests/wf5-code-stubs.sh`):
the reminder and its gate (who is reminded and when), revisit invitations, the cleanup of expired `pending` rows, and
the orphan-pending alert (an expired pending row that already has a calendar event is reported to the owner, not
cancelled). In this suite the TTL rule is covered only on the tool side (`confirm_expired`) and the reminder answer
only on the `reminder_reply` side. The WF-2 guardrail layer (drug names escalate when no knowledge passage is in
context) and the full agent dialogs belong to level 2 (`tests/dialogs/`); here only the three `agent_*` cases touch
the agent.

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
| `delete_events_by_id` | deletes the events whose ids are in `event_ids` (comma-separated) and whose description is an appt_id (`^A-[0-9A-Z]+$`); only `tests/cleanup.sh` and `cal_sweep_day` call it, with the ids of test bookings | `DELETED <n> of <m>` |

`delete_events_by_id` first lists the calendar over the same window and deletes only requested ids that still exist
and whose description is an appt_id (what confirm_booking writes; defence in depth for the test webhook, so it can only
ever reach booking events). Anything else is skipped and shows as n < m. An id whose event is already gone is skipped instead of failing (deleting it again is HTTP 410 `Resource has been
deleted`, and with continue-on-fail the node keeps only the generic message, so a 410 could not be told apart from a
real error). An id that is not a plain Google event id (`[A-Za-z0-9_-]`) fails the call: the delete node puts the id
into the request path unencoded. Checked live: create a `[TEST]` event, `DELETED 1 of 1`, the same id again
`DELETED 0 of 1`, no ids `DELETED 0 of 0`, `../x` HTTP 500.

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
| `fixtures_by_id_skips_non_booking` | a `[TEST]` busy event (description `test-fixture`) passed to `delete_events_by_id` is NOT deleted (`DELETED 0 of 1`, still listed); the teardown removes it with the `[TEST]` sweep (`DELETED 1`) |

`tests/cleanup.sh` calls `delete_test_events` last and exits 1 if that call fails (`--no-calendar` skips it).
`Settings`, `List Test Events`, `List Events`, `Delete Each`, `List For Ids` and `Delete By Id` retry once (2 tries, 5 s apart); `Create Busy` deliberately
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
`propose_booking` will accept. `last_offer_json` is `{"service_id":"<id>","slots":["<iso>",...]}`: the slots are sized to that service, so
`propose_booking` accepts them only for that service. Invalid-input verdicts (`UNKNOWN_SERVICE`, invalid date or part of day) save
`{"service_id":"","slots":[]}`. The dates are in the future on purpose: 2030-01-07 is a Monday (10:00-19:00 in the live `working_hours`), 2030-01-13 a Sunday
(closed). 2030-01-06, the date the fixtures cases use, is a Sunday, so these cases do not use it.

| case | why |
|---|---|
| `avail_unknown_service` | `tattoo` gives `UNKNOWN_SERVICE` followed by the active services with their durations (the regex only requires `botox (Botox, 30 min)` somewhere in the list, because the order is the Airtable record order) |
| `avail_busy_excluded` | the setup deletes old `[TEST]` events and creates a busy block 14:00-15:00 on the Monday; for an afternoon Botox the answer is exactly `12:00, 12:30, 13:00, 13:30, 15:00, 15:30`: 13:30 stays (it ends at 14:00), 14:00 and 14:30 are gone, 15:00 is back. The teardown deletes the `[TEST]` events |
| `avail_morning_only` | HydraFacial (60 min), morning: exactly `10:00, 10:30, 11:00`. A morning visit must END by 12:00, so 11:30 is not offered |
| `avail_closed_day` | a Sunday gives `NONE nearest:` with 10:00 on the following Monday, Tuesday and Wednesday |
| `avail_saves_offer` | with a client row `C-test-1` on file, the teardown reads the row back: `last_offer_json` is `{"service_id":"botox","slots":[...]}` with 6 slots of that day and `last_offer_at` is set (prints `offer_saved`); then `tests/cleanup.sh --no-calendar` removes the row, and a failure on either side fails the case |
| `avail_pod_anytime` | `part_of_day` `" Anytime "` (the model passes things like this) is trimmed and treated as "no filter": the first 6 slots of the day, 10:00 to 12:30 |
| `avail_pod_invalid` | `part_of_day` `brunch` gives `NONE invalid part_of_day, expected morning\|afternoon\|evening` instead of a false "no slots", and (like the other invalid-input verdicts) saves the empty offer: the setup puts a real botox offer on the client row, the teardown asserts `last_offer_json` is now `{"service_id":"","slots":[]}` (prints `offer_cleared`) |

No filter: empty, `any`, `anytime`, `null`, `none` (after trim and lower-casing).

Failure behaviour, not covered by a tsv case because it needs a broken calendar or Settings table (verified live with throwaway workflow copies and with the node code run against stubs, see the Task 8 report, fix round 1): an unknown or inaccessible calendar id makes `FreeBusy` throw (`notFound`), so the tool fails and WF-6 reports it instead of answering `FREE`; `Check Settings` throws on a missing Settings row, a non-positive `slot_step_min`, a non-numeric `min_lead_min`, a missing or invalid `timezone` or `calendar_id`, and a `working_hours` entry that is not `null` or `["HH:MM","HH:MM"]`; `Compute` throws on a non-numeric `duration_min` and on a busy interval that does not parse.

Google Calendar Availability, output format Booked Slots (n8n 2.41.5, node 1.3): one item per busy interval, `{"start":"2030-01-07T13:00:00Z","end":"2030-01-07T14:00:00Z"}`
(UTC, `Z`). With no busy interval there is no item, and `alwaysOutputData` makes it one empty `{}` item, which `Compute` filters out (it keeps only items that have both
`start` and `end`). The node must run once (`executeOnce`), or the seven Services items in front of it would call Google seven times.

### propose_booking

`propose_booking(contact_id, service_id, start_iso, name?, channel?, replaces_appt_id?)` is the only booking tool the
agent has, and all it can create is a `pending` Appointments row. It returns `PENDING <appt_id>` (plus the field
`appt_id`), `SLOT_NOT_OFFERED`, `UNKNOWN_SERVICE <id> (<name>, <min> min); ...` or `NO_CLIENT_ROW`. The slot must be
one that `check_availability` offered THIS client FOR THIS SERVICE (`Clients.last_offer_json` is
`{"service_id","slots"}`; its `service_id` must equal the requested service, the slots are compared as instants) no
more than `Settings.pending_ttl_min` minutes ago (`last_offer_at`); anything else, including an unreadable `start_iso`
or offer and the pre-fix plain-array offer format, is `SLOT_NOT_OFFERED`. Without the service check the agent could get
Botox (30 min) offered at the last slot before closing and then propose Microneedling (60 min) there, and the booking
would run past closing (or past noon for a morning slot). Side effects of `PENDING`: every earlier `pending` row of the client becomes `cancelled` (one live
proposal per client); `name` (trimmed, control characters removed, at most 80 characters) is written to
`Clients.name` only when the row has none; the new row carries `client` and `service` links, `start_iso`/`end_iso` in
the Settings timezone, `start_dt` in UTC, `created_via` (`tg`, `wa`, `test` or `owner`, otherwise `tg`),
`pending_expires_at` = now + `pending_ttl_min`, and `replaces_appt_id`. The calendar is not touched.
`replaces_appt_id` is stored only when it names an Appointments row of THIS client in status
`booked`/`reminded`/`confirmed` whose start is still ahead (read by `Client Appts`); anything else is stored as `''`,
so the cancel of the replaced visit (Task 10) can never reach another client's visit or a past one.

Nodes: `Settings` -> `Client Formula` (the validated one) -> `Client` -> `Client Appts` (the client's live visits) ->
`Services` (`{active}=1`) -> `Validate` ->
`Valid?`; false -> `Result Reject`; true -> `Old Pending` -> `Has Id?` -> `Cancel Old` (one update per old row) ->
`Set Name?` -> `Update Name` (only with a name to set) -> `Appt Fields` -> `Create Appt` -> `Result`. `Set Name?` runs
once (`executeOnce`) and `Appt Fields` turns `Validate.fields` into the single item that `Create Appt` maps
automatically (Airtable 2.2 `autoMapInputData` sends the input item's JSON as the record fields): without that, two old
pending rows would give two new ones. `Validate` throws (-> WF-6) on a missing Settings row, a non-positive
`pending_ttl_min`, an invalid timezone, a non-positive `duration_min`, and a `client_id` that is not a plain id (it goes
into the `Old Pending` formula).

All propose cases use Monday 2030-01-07 (2030-01-06 is a Sunday). Each has its own setup and a teardown that runs
`tests/cleanup.sh --no-calendar`.

| case | why |
|---|---|
| `propose_no_client` | an unknown contact is `NO_CLIENT_ROW` |
| `propose_not_offered` | 12:30 when only 12:00 was offered is `SLOT_NOT_OFFERED`; the teardown asserts that no Appointments row was created |
| `propose_stale_offer` | the right slot, but `last_offer_at` is from 2020: `SLOT_NOT_OFFERED`, no row |
| `propose_unknown_service` | `tattoo` gives `UNKNOWN_SERVICE` with the active services; no row |
| `propose_ok` | the client row has no name; the teardown checks the one new row field by field (`pending`, botox, 12:00-12:30 `+01:00`, `start_dt` `11:00:00.000Z`, `created_via` `test`, `client` linked to the client's record, a `service` link, `pending_expires_at` set, its `appt_id` equal to the verdict and to `$raw.appt_id`) and that `Clients.name` is now `Anna Test` |
| `propose_replaces_pending` | two earlier pending rows of the same client become `cancelled`, a pending row of ANOTHER client stays `pending`, exactly one new pending row exists (4 rows in all), and the existing name `Test C-test-1` is not overwritten by the `name` passed in |
| `propose_other_service` | end to end with the real `check_availability`: Botox offered for Monday evening (`FREE 17:00, 17:30, 18:00, 18:30`), then Microneedling (60 min) at 18:30, which would end at 19:30, after closing: `SLOT_NOT_OFFERED`, no row |
| `propose_after_real_offer` | the same real offer, Botox at 18:30: `PENDING`, the row ends at 19:00 (the two real tools agree on the new offer format) |
| `propose_old_format_offer` | an offer in the pre-fix plain-array format `["...12:00..."]` is no offer: `SLOT_NOT_OFFERED`, no row |
| `propose_replaces_own` | `replaces_appt_id` naming the client's own future `booked` visit is stored on the new pending row |
| `propose_replaces_foreign` | `replaces_appt_id` naming ANOTHER client's future `booked` visit is stored as `''` |
| `propose_replaces_past` | `replaces_appt_id` naming the client's own `booked` visit in the past (2026-06-01) is stored as `''` |

### confirm_booking

`confirm_booking(contact_id)` turns the client's pending row into a real booking. It returns `BOOKED <appt_id>` (plus
`appt_id` and `first_visit`), `SLOT_TAKEN` (plus `alternatives`), `EXPIRED`, `NO_PENDING` or `ALREADY_BOOKED <appt_id>`
(plus `appt_id`; `NO_PENDING` carries `appt_id` = `""`). `Decide` takes the newest `pending` row of the client: none
and a future `booked`/`reminded`/`confirmed` row exists -> `ALREADY_BOOKED` with the earliest one; none at all ->
`NO_PENDING`; the pending row starts exactly when one of the client's `booked`/`reminded`/`confirmed` visits starts (a
stray, which a `Create Appt` retry in propose_booking can leave) -> the stray becomes `cancelled` (`Cancel Stray`) and
the answer is `ALREADY_BOOKED` with the booked visit; `pending_expires_at` passed -> the row becomes `cancelled` and the
answer is `EXPIRED`. Otherwise `Decide` derives the booking's Google event id from its `appt_id` (`event_id` =
`appt` + the hex of the appt_id bytes: Google ids are base32hex `0-9a-v`, 5-1024 characters; `appt_event_id` in
`tests/lib/n8n.sh` computes the same), `FreeBusy` (Google Calendar Availability, Booked Slots) reads the calendar for
exactly that slot and `Any Busy` checks for a real overlap:

- taken: `Own Event` lists the events of that slot and `Own Check` looks for this booking's own `event_id`. If it is
  there, the booking already exists (a concurrent YES, or an earlier run that died after `Create Event`): `Repair Booked`
  sets the row `booked` with that `calendar_event_id`, `Repair Client` does what `Activate Client` does, and the answer
  is `ALREADY_BOOKED <appt_id>` with no owner message. If it is not there, the slot is really taken: the pending row
  becomes `cancelled`, `check_availability` is called for the same service and day with no
  part-of-day filter (which also saves its slots as the client's new offer, so `propose_booking` accepts one of them
  next), and `alternatives` holds its first three slots as `Mon, Jan 7, 10:00 AM; ...` in the Settings timezone (empty
  when that lookup fails or finds nothing; the lookup continues on error, the slot is taken either way);
- free: `Create Event` writes `<service name> — <client name>` with the id `event_id` (description = `appt_id`, no
  attendees, default reminders) into `Settings.calendar_id`. If Google refuses it (a second insert of the same id is
  refused; the node keeps only the generic message `Your request is invalid or could not be processed by the service`),
  the error output goes to the same `Own Event` / `Own Check`: own event there -> the repair above (`ALREADY_BOOKED`, no
  second owner message); not there -> the create really failed and `Own Check` fails the tool (-> WF-6) with the create
  error in the message. On success `Mark Booked` sets `status = booked` and `calendar_event_id`,
  `Activate Client` sets the client to `active` (a `flagged` or `escalated` client keeps that status), `Replaces?`
  sends a reschedule to `Cancel Replaced` (below), `Notify` sends the owner
  `✅ New booking: <name> (<contact>) — <service> — Mon, Jan 7, 12:00 PM — <appt_id>` (plus ` — replaces <old appt_id>`
  for a reschedule), and `Result Booked` answers.

Reschedule (the pending row carries `replaces_appt_id`, which propose_booking only keeps for the client's own future
live visit): `Cancel Replaced` calls `cancel_booking(contact_id, replaces_appt_id, reason = reschedule)`, which frees the
old visit (event deleted, row `cancelled`, never `late_cancel`, the client is not flagged) and tells the owner
`🔁 Rescheduled, old visit cancelled: ...`. The repair path runs it too (`Replaces Repair?`), because a run that died
after `Create Event` never reached it; if that run did cancel the old visit, cancel_booking answers `NOT_FOUND`, so the
call is idempotent. `Cancel Replaced` continues on error: the new booking already exists. `Replace Failed?` treats any
verdict other than `CANCELLED` / `NOT_FOUND` (an error item, `NOT_YOURS`) as a failure and `Notify Replace Failed` tells
the owner `⚠️ Reschedule incomplete: ... the old visit <id> could not be cancelled automatically (<why>). Cancel it by
hand ...`. `Repaired?` then returns to the path it came from: `Result Already` (no new-booking message) or `Notify`.

`first_visit` is true when the client has no `booked`, `reminded`, `confirmed` or `done` row. Because the event id is
deterministic, `Create Event` now retries like every other Airtable and Google node (2 tries, 5 s): a retry after a create
that timed out but succeeded is refused by Google and ends in the repair path, not in a second event. (In that one case
the run answers `ALREADY_BOOKED` and sends no owner message although it made the booking; the event and the row are
right.) `Notify` and `Activate Client` (and `Repair Client`) continue on error: by then the booking exists in the
calendar and in Airtable, so the client must get `BOOKED`. `Decide` throws on a missing Settings row, `calendar_id` or
timezone, on a pending row whose times do not parse and on an appt_id that is not a plain id, before anything is
written; `Any Busy` throws on a busy interval it cannot read.

Checked live (fix round 1): two `confirm_booking` calls for one pending row, 33 ms apart, both passed `FreeBusy`; one
created the event and notified the owner, the other got Google's refusal on `Create Event`, found its own event and
answered `ALREADY_BOOKED` (one event, one booked row, one `notify_owner` run). Google keeps a deleted event's id
reserved: after the booking's event was deleted and the row reset to `pending`, `Create Event` was refused, `Own Event`
listed nothing (deleted events are not listed) and `Own Check` failed the tool with `confirm_booking: Create Event failed
for A-... and no event appt... is in the calendar: ...`, which is the intended loud failure.

Residual risk, not handled: two DIFFERENT clients confirming the same slot at the same instant. Their bookings have
different event ids, so both inserts succeed if both runs pass `FreeBusy` before either event exists. At this clinic's
volume (a pending row lives `pending_ttl_min` minutes, and two clients must have been offered and proposed the same slot
and answer YES within the same few seconds) this is rare; `confirm_slot_taken` covers the sequential case.

Every `BOOKED` sends the owner a real Telegram message (`confirm_ok`, and the setups of `confirm_again`,
`confirm_slot_taken`, `confirm_returning_client`, `confirm_stray_pending`, `confirm_repair`, plus the one booking of
`confirm_concurrent`: seven per full run; the Task 10 cases add 22 more, bookings in their setups plus the cancel,
reschedule and reminder messages, so a full run sends the owner about 29). Each confirm case builds its own state through the real tools
(`at_test_client_with_offer`, `bk_propose`, `bk_confirm`), so it can run alone; the cases that book start by asserting
that Monday 2030-01-07 has no events, and every confirm case ends with the full `tests/cleanup.sh`, which deletes the
booking events by id.

| case | why |
|---|---|
| `confirm_no_pending` | a client with no appointment at all: `NO_PENDING` and `appt_id` `""` |
| `confirm_ok` | after `propose_booking` for 12:00: `BOOKED A-...` with `first_visit` true; the row is `booked` with a `calendar_event_id`, the client is `active`, the day has exactly one event whose id is that `calendar_event_id` and equals `appt_event_id <appt_id>`, which runs 12:00-12:30 `+01:00`, whose title is `Botox — Test C-test-1` and whose description is the `appt_id`. After the cleanup the day is empty again (`EVENTS 0`): the proof that booking events are removed by id |
| `confirm_again` | the setup already booked the slot; a second YES is `ALREADY_BOOKED` with the booked `appt_id` (verdict and field), and the day still has exactly one event |
| `confirm_expired` | a pending row whose `pending_expires_at` is in 2020: `EXPIRED`, the row is `cancelled`, no event |
| `confirm_slot_taken` | two clients, one slot: both proposed 12:00, client 1 confirmed first; client 2 gets `SLOT_TAKEN` with `alternatives` exactly `Mon, Jan 7, 10:00 AM; Mon, Jan 7, 10:30 AM; Mon, Jan 7, 11:00 AM`, its row is `cancelled`, client 1's stays `booked`, client 2's new offer is the six free slots without 12:00, and the day has one event, not two |
| `confirm_returning_client` | a client with a `done` visit in 2026 and status `escalated`: `BOOKED` with `first_visit` false, and the status stays `escalated` |
| `confirm_other_client_pending` | only client 1 has a pending row; client 2 confirms: `NO_PENDING` with `appt_id` `""`, client 1's row is still `pending` with no event id, no event |
| `confirm_stray_pending` | client 1 is booked at 12:00 and a stray pending row `A-TEST-STRAY` starts at 12:00 too: `ALREADY_BOOKED` with the BOOKED visit's appt_id (not `SLOT_TAKEN`), the stray is `cancelled`, still one event |
| `confirm_repair` | the "event created, row not marked" state: after a real booking the row is reset to `pending` with no `calendar_event_id`; confirm answers `ALREADY_BOOKED <appt_id>`, the row is `booked` again with the event's id (`appt_event_id`), the day still has one event, and no `notify_owner` run started since the reset (`execs_since`). It goes through `FreeBusy` (busy) -> `Own Event` -> repair |
| `confirm_concurrent` | the setup starts one `confirm_booking` in the background and the case fires a second at once, for the same pending row: the two verdicts are exactly `BOOKED X` and `ALREADY_BOOKED X`, one booked row whose `calendar_event_id` is `appt_event_id X`, one event, and exactly one `notify_owner` run since the setup. Which run wins varies, so the case's own regex accepts both |
| `confirm_replaces_old` | a real reschedule: client 1 is booked at 12:00 (real event), gets a new offer for 15:00 (`at_offer`) and proposes it with `replaces_appt_id` = the 12:00 visit; confirm answers `BOOKED`, the old row is `cancelled` with an empty `calendar_event_id`, the new one `booked`, the day has exactly one event (15:00, the new booking's id), the client is `active`, and exactly two owner messages since the proposal (`🔁 Rescheduled` and `✅ New booking`) |
| `confirm_reschedule_late` | the old visit starts in 3 hours (inside `cancellation_hours`): the reschedule still makes it `cancelled`, NOT `late_cancel`, and the client stays `active`, not `flagged` |
| `confirm_repair_replaces` | a reschedule whose first confirm "died after Create Event": after a real reschedule the new row is reset to `pending` with no event id and the old row back to `booked`; confirm answers `ALREADY_BOOKED` (repair path) and the old visit is `cancelled` now. Red before Task 10: the repair path skipped `Replaces?` and the old visit stayed booked |
| `confirm_replace_failed` | the old visit is moved to client 2 after the proposal, so `Cancel Replaced` gets `NOT_YOURS`: the client still gets `BOOKED`, the old row is untouched, `Notify Replace Failed` ran and the owner got two messages (the warning and the new booking) |

`confirm_repair`, `confirm_concurrent` and `confirm_repair_replaces` run `cal_sweep_day 2030-01-07` before the cleanup:
when they fail (as they did against the pre-fix workflow, which double-booked), an event can be left that no row points
at, and the cleanup by id cannot find it.

### cancel_booking

`cancel_booking(contact_id, appt_id, reason?)` is the agent's cancel tool (the agent passes `contact_id` and an `appt_id`
from find_client's `upcoming`; `reason` is only passed by confirm_booking's `Cancel Replaced`). Verdicts: `CANCELLED`,
`LATE_CANCEL`, `NOT_YOURS`, `NOT_FOUND`, each with `appt_id` (`""` when the input was not a plain appt_id).

- `appt_id` must match `^A-[0-9A-Z-]{1,40}$` (after trimming) before it goes into the `Appointment` formula; anything else
  searches for a row that cannot exist and is `NOT_FOUND`. (The brief stripped quotes instead, so `A-TEST-C1'` became
  `A-TEST-C1` and cancelled that visit.)
- No row -> `NOT_FOUND`; the row is not this client's (or the contact has no client row) -> `NOT_YOURS`; the row is not
  `pending`/`booked`/`reminded`/`confirmed` (already cancelled, done, ...) -> `NOT_FOUND`, which is what makes a repeated
  cancel idempotent. A visit whose start is now or past -> `NOT_FOUND` and nothing is touched: it is history (done or a
  no-show), and cancelling it would let a no-show rewrite itself as a late cancel and delete its event.
- `reason = reschedule` is honoured only when `Replacement` finds a live (`booked`/`reminded`/`confirmed`) visit of the
  SAME client whose `replaces_appt_id` is this appt_id (confirm_booking books the new visit before it calls cancel). A
  bare claim is a normal cancel, so the late-cancel rule cannot be dodged by saying "reschedule".
- Late: not a (proven) reschedule, the row is not `pending` and it starts in fewer than
  `Settings.cancellation_hours` hours (24) -> `late_cancel`, `Flag Client` sets the client `flagged` (an `escalated`
  client stays `escalated`; continue on error, and the owner message then says the flag must be set by hand). A
  reschedule is never late: the client keeps the clinic booked; the owner message says when it was inside the window.
- `Delete Event` is an HTTP Request (`DELETE .../calendars/<Settings.calendar_id>/events/<calendar_event_id>` with the
  `MedSpa Google Calendar` credential, `neverError` + `fullResponse`) and `Gone Check` reads the exact status: 2xx
  deleted, 404/410 already gone (the owner deleted it, or an earlier run did) -> go on; anything else fails the tool
  (-> WF-6) BEFORE the row is marked, so a cancelled row never leaves a live event blocking the slot. The Google Calendar
  node could not do this: with continue-on-fail it keeps only a generic message, the same for 410 and other errors.
  Network errors and timeouts (30 s) throw and are retried once.
- `Mark` sets the status and clears `calendar_event_id` (the event is gone; the cleanup deletes by the ids still on rows,
  so a stale id would make its `DELETED n of m` fall short).
- `Notify` (continue on error) sends `ℹ️ Cancelled: <name> (<contact>) — <service_id> — Mon, Jan 7, 12:00 PM — <appt_id>`,
  `⚠️ LATE cancellation: ... — client flagged` (or `— client is escalated, left escalated (not flagged)`, or `— the
  client could NOT be flagged automatically, flag them by hand`), or `🔁 Rescheduled, old visit cancelled: ...` (plus
  `— moved inside the 24 h cancellation window` when it was), the time in `Settings.timezone`. When `Gone Check` found
  the event already gone (404/410) every message ends with `— the calendar event was already gone, check the calendar by
  hand`, so a deleted-by-hand event, or a `Settings.calendar_id` pointing at the wrong calendar, is visible to the owner.
- `Decide` throws on a missing Settings row, `calendar_id`, timezone or a `cancellation_hours` that is not a number >= 0,
  on a row whose `start_iso` does not parse and on a `calendar_event_id` that is not a plain id (it goes into the URL).

Checked live: `cancel_ok` deleted with HTTP 204, `cancel_already_gone` got 410 and went on. Any unknown event id is 404 in
Google (an id `BAD_ID` and a 1000-character id both gave 404, so both "cancel"), which means a wrong
`Settings.calendar_id` would also look like "already gone"; every other booking tool would fail loudly on it first.
A non-404/410 error could not be produced without touching the shared Settings or credential, so the throw branch of
`Gone Check` is unproven live.

| case | why |
|---|---|
| `cancel_not_found` | `A-NOPE` does not exist: `NOT_FOUND` |
| `cancel_invalid_id` | `A-TEST-C1'` (a quote appended to the client's own visit id) is not a plain appt_id: `NOT_FOUND`, the row stays `booked` |
| `cancel_not_yours` | client 2 passes client 1's real booked appt_id: `NOT_YOURS`, the row stays `booked` with its event id, the event is still there |
| `cancel_ok` | client 1 cancels its real booking at 12:00: `CANCELLED` with that `appt_id`, the row is `cancelled` with an empty `calendar_event_id`, the day has no event, the client stays `active`, and the owner got exactly `ℹ️ Cancelled: Test C-test-1 (tg:900000001) — botox — Mon, Jan 7, 12:00 PM — <appt_id>` |
| `cancel_already_gone` | the booking's event is deleted in the setup (`DELETED 1 of 1`), then cancelled: still `CANCELLED` (Google 410), row `cancelled`, id cleared, owner message ends `— the calendar event was already gone, check the calendar by hand` |
| `cancel_late` | a `confirmed` visit 3 hours ahead (no event): `LATE_CANCEL`, row `late_cancel`, client `flagged`, owner message `⚠️ LATE cancellation: ... — A-TEST-LATE — client flagged` |
| `cancel_reschedule_reason` | the same visit with `reason` = `reschedule` and a real replacement (`A-TEST-NEW`, booked, `replaces_appt_id` = `A-TEST-LATE`): `CANCELLED`, row `cancelled`, `A-TEST-NEW` untouched, client stays `new`, owner message `🔁 Rescheduled, old visit cancelled: ... — A-TEST-LATE — moved inside the 24 h cancellation window` |
| `cancel_forged_reschedule` | `reason` = `reschedule` but no live visit of this client replaces it (decoys: client 2's booked row and client 1's cancelled row both name it in `replaces_appt_id`): treated as a cancel, `LATE_CANCEL`, client `flagged` |
| `cancel_late_escalated` | an `escalated` client cancels late: `LATE_CANCEL`, the client stays `escalated`, the owner message ends `— client is escalated, left escalated (not flagged)` |
| `cancel_past` | a `booked` visit on 2026-01-05 (with a `calendar_event_id`): `NOT_FOUND`, the row stays `booked` with its event id, client still `new`, no owner message |
| `cancel_pending_in_window` | a `pending` row 3 hours ahead: `CANCELLED` (a proposal is not a booking, so never late), client stays `new` |
| `cancel_already_cancelled` | a `cancelled` row: `NOT_FOUND`, the row unchanged, no owner message |

`cancel_ok`, `cancel_not_yours` and `cancel_already_gone` book for real in the setup (owner messages) and end with the
full cleanup and `EVENTS 0`; `cancel_already_gone` deletes its row before the cleanup, because its event is known to be
gone and a leftover id would make the cleanup's `DELETED n of m` fail.

### reminder_reply

`reminder_reply(contact_id, answer)` is called by WF-1 (Task 13) when a client with a `reminded` visit answers;
`answer` must be `yes` or `no` (case-insensitive), anything else fails the tool. It works on the client's NEXT reminded
visit (earliest `start_iso` still ahead; other clients' rows and later reminded visits are untouched):

- none -> `NO_REMINDED` (`appt_id` `""`);
- yes -> `Mark Confirmed` (`status = confirmed`, `confirmed_at` = now UTC) -> `CONFIRMED` + `appt_id`, no owner message;
- no -> the same `Delete Event` / `Gone Check` as cancel_booking, `Mark Cancelled` (`cancelled`, never `late_cancel`;
  `calendar_event_id` cleared), `Flag Client` (spec, reminders: "no" -> cancelled, slot freed, client flagged; an
  `escalated` client stays `escalated`; continue on error), `Notify` (continue on error)
  `ℹ️ Cancelled via reminder: <name> (<contact>) — <service_id> — Mon, Jan 7, 1:00 PM — <appt_id> — client flagged`
  (same flag and already-gone wording as cancel_booking) -> `CANCELLED` + `appt_id`.

| case | why |
|---|---|
| `reminder_none` | client 2 has only a `booked` visit: `NO_REMINDED`, `appt_id` `""`, the row untouched |
| `reminder_yes` | client 2 has reminded visits on Jan 7 13:00 (`A-TEST-R1`) and Jan 8 (`A-TEST-R2`), client 1 one on Jan 7 10:00 (`A-TEST-R0`): `CONFIRMED` `A-TEST-R1`, only that row is `confirmed` with a `confirmed_at` |
| `reminder_no` | client 2's real booking at 13:00, set to `reminded`: `CANCELLED` with its appt_id, row `cancelled` with no event id, the event deleted, the client `flagged`, owner message exact (ending `— client flagged`) |

### wf2-agent

The agent cases call the whole `wf2-agent` workflow (real model, so non-deterministic: run a new one 3 times).

| case | why |
|---|---|
| `agent_discloses_ai` | EU AI Act Art. 50: a NEW client (a `C-test-1` row without a name) who just says `Hi!` is told in the first reply that this is the clinic's AI assistant. The teardown matches `$raw.reply` against `\bAI\b\|artificial intelligence\|virtual assistant` (case-insensitive) |

### Why confirm_booking is not an agent tool

The agent gets `propose_booking` and never `confirm_booking`. The step that writes the owner's calendar is
called by WF-1 (Task 13), and only after the client answered YES to the summary of the pending booking. If the
"wait for explicit confirmation" rule lived in the prompt, one disobedient turn would put a real appointment into a
real calendar; here the model cannot call the write at all, and the worst it can do is a `pending` row that expires
after `pending_ttl_min`. That is the gap left open in the Make version, where both write tools were agent tools and the
confirmation step was pure instruction: [Case 4 — The confirmation gate, still open](../../wiki/agent-design/configuration-over-prompting.md#case-4--the-confirmation-gate-still-open).

