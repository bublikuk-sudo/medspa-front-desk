# MedSpa Front Desk

## What it is

A WhatsApp and Telegram front desk for a medical-aesthetics clinic. It books, reschedules and cancels appointments,
answers questions from the clinic's own knowledge base, sends reminders, and hands the conversation to a person when
it should. It runs on self-hosted n8n with Claude, Airtable and Google Calendar, and is built as a template that is
deployed once per clinic.

![WhatsApp booking: summary, YES, confirmation](docs/img/demo.png)
<!-- Placeholder: the owner adds a frame from the demo video as docs/img/demo.png. -->

## The problem it solves

Job postings for appointment bots (Upwork and Freelancer.com, August and September 2026) describe one system. Three
requirements come up again and again:

- **Booking in WhatsApp, around the clock**, through the official WhatsApp Business API.
- **Real-time slots without double booking**: one posting asks for "prevention of double bookings through real-time
  blocking of occupied times".
- **A reminder before the visit**, "e.g., 24 hours before the appointment".

The same postings ask for a master template that a new client can be onboarded onto in 15-30 minutes, and for clean
documentation. Source notes: [booking-bot client requirements](../wiki/market/booking-bot-client-requirements.md).

## Architecture

One VPS, Docker Compose: n8n 2.41.5, Postgres 16 with pgvector, Caddy for HTTPS. Inside n8n, six workflow groups
(16 workflows, each a JSON file in `workflows/`, plus two test workflows):

```
WF-1  Inbound     Telegram Trigger ─┐
                  WhatsApp Trigger ─┼→ Normalize {channel, contact_id, text} → rate limit → client lookup
                  Test Inbound* ────┘  → language detection (Haiku), only for a client with no language yet
                                       → deterministic gates, before the agent:
                                           YES to the last cancel question → cancel_booking
                                           YES to a live pending summary → confirm_booking
                                           yes/no answering a reminder   → reminder_reply
                                           client already escalated      → "a team member will contact you"
                                       → otherwise WF-2 → reply, or instead the pending summary / the cancel
                                         question built from the row → send_message
WF-2  Agent       AI Agent on Claude (claude-opus-5), Postgres chat memory per contact_id, guardrail
                  tools: find_client, check_availability, propose_booking, request_cancel,
                         search_knowledge, escalate
WF-3  Tools       sub-workflows with named inputs over Google Calendar + Airtable; each returns a verdict
                  string. Internal, never given to the agent: confirm_booking, cancel_booking, reminder_reply
WF-4  Knowledge   ingest: Airtable Knowledge → OpenAI embeddings → pgvector (on change, and hourly self-repair)
                  query: top 5 by vector distance → Claude Haiku relevance gate → ≤ 3 passages | NOT_FOUND
WF-5  Reminders   hourly: reminders, revisit invitations, expiry of stale pending bookings
WF-6  Errors      Error Trigger → owner's Telegram; the failing workflow stays active
Shared            send_message (template, translation, channel formatting, WhatsApp template vs free text)
                  notify_owner (owner's Telegram; a direct fallback when Airtable is unreachable)
* key-protected webhook used only by the automated dialog tests, for test contacts only
```

| Tool | Named inputs | Returns |
|---|---|---|
| `find_client` | `contact_id`* | `NEW`, or `KNOWN` with name, language, last visit and service, `next_visit_in`, upcoming appointments with their `appt_id`, the owner's notes |
| `check_availability` | `contact_id`*, `service_id`, `date`, `part_of_day?` | `FREE <ISO slots>` plus `slots_local` (weekday and local time computed by the tool), `NONE <alternatives or reason>`, `UNKNOWN_SERVICE <active services>`. The offer is saved on the client as `{service_id, slots}` |
| `propose_booking` | `contact_id`*, `channel`*, `service_id`, `start_iso`, `name?`, `replaces_appt_id?` | `PENDING <appt_id>`: an Airtable row with status `pending`, calendar untouched. `SLOT_NOT_OFFERED` if the slot or service is not in the saved offer, `UNKNOWN_SERVICE`, `NO_CLIENT_ROW` |
| `request_cancel` | `contact_id`*, `appt_id` | `CANCEL_PENDING <appt_id>` / `LATE_CANCEL_PENDING <appt_id>` (the cancellation would be late): a pending cancellation is recorded, nothing is cancelled. `NOT_YOURS` / `NOT_FOUND` |
| `search_knowledge` | `question` | `FOUND` with up to 3 passages and their topic, or `NOT_FOUND` |
| `escalate` | `contact_id`*, `reason` | `ESCALATED`: flags the client, sends the owner the conversation |

\* filled by n8n from the incoming message, never by the model.

**The client confirms, not the model.** The agent has no `confirm` tool. `propose_booking` writes a `pending` row and
returns `PENDING <appt_id>`. WF-1 then discards whatever the agent wrote and has `send_message` render the
`PENDING_SUMMARY` template from that row ("Botox (30 min) — Mon, Jan 7, 10:00 AM. Free cancellation up to 24 hours
before. Reply YES to confirm."). The client's next message is checked by WF-1 before the agent sees it:
if a live `pending` row exists and the text is a confirmation (a word list per language, then a short Haiku check for
other short phrasings), n8n re-checks the calendar, creates the event and moves the row to `booked`. Any other text
goes to the agent and the pending row expires after `pending_ttl_min`. The service can only be an existing
`service_id` and the time only a slot from the saved offer, so the model cannot invent either, and what the client
confirms is exactly what gets written.

Cancelling works the same way: the agent cannot cancel. `request_cancel` checks that the visit is the client's own
and still ahead, records a pending cancellation and says whether it would be late (inside
`Settings.cancellation_hours`). WF-1 sends the question built from the row ("Cancel your Botox on Mon, Jan 7, 10:00 AM?
Reply YES to cancel.", with the late-cancellation notice when it applies), and only a YES to that question, while it is
the bot's last message and has not expired, makes n8n run `cancel_booking` (event deleted, `cancelled` or
`late_cancel`, a late canceller flagged, the owner notified). NO or anything else goes to the agent and the visit stays
booked. The reminder's own "Reply YES to confirm or NO to cancel" works as before.

## Data model

Google Calendar is the source of truth for time, Airtable for people and status; neither duplicates the other.
Airtable base `MedSpa Front Desk` (`airtable/schema.json`):

- **Settings** (one row, everything that changes per clinic): `business_name`, `timezone`, `working_hours`,
  `calendar_id`, `owner_contact`, `whatsapp_number`, `intake_form_url`, `cancellation_hours`, `reminder_hours_before`,
  `pending_ttl_min`, `slot_step_min`, `min_lead_min`.
- **Services** (the price list, edited by the clinic): `service_id`, `name`, `duration_min`, `price`,
  `deposit_required`, `active`.
- **Clients** (one person, several channels): `client_id`, `name`, `phone`, `telegram_chat_id`, `email`, `language`,
  `first_seen`, `last_visit`, `status` (`new | active | flagged | escalated`), `intake_completed`, `notes` (written by
  the clinic, read by the agent), `last_offer_json`, `last_offer_at`, `last_agent_reply_at`, `cancel_ask_appt_id` (the
  open cancel question; send_message clears it on any other message to the client).
- **Appointments** (one row per visit, life cycle in one field): `appt_id`, links `client` and `service` plus their
  text ids `client_id` and `service_id`, `start_iso`, `end_iso`, `start_dt`, `status` (`pending → booked → reminded →
  confirmed | cancelled | late_cancel | no_show | done`), `calendar_event_id`, `created_via`, `pending_expires_at`,
  `summary_sent_at`, `reminder_sent_at`, `confirmed_at`, `revisit_invited_at`, `replaces_appt_id`,
  `cancel_expires_at` (the two-step cancel), and the
  practitioner's fields `treatment_notes`, `next_visit_in`, `practitioner`.
- **Knowledge** (the clinic's document, one paragraph per row): `kb_id`, `topic`, `text`, `updated_at`.

The owner works in an Airtable Interface (today's visits, pending confirmations, flagged and escalated clients, after
visit): [docs/airtable-interface.md](docs/airtable-interface.md).

## What we deliberately do not store, and why

- **No medical questionnaire.** Allergies, medication, pregnancy and diagnoses are special-category health data. The
  agent is instructed never to ask for them and not to repeat them back if a client volunteers them. On the first booking the client
  gets a link to the clinic's own intake and consent form (`Settings.intake_form_url`; in a real deployment the clinic's
  EMR form). The clinic ticks `Clients.intake_completed`; the answers live in the EMR, not in Airtable or the chat.
- **Short-lived run logs.** n8n stores every node's input and output for every run, including message texts and
  numbers. `EXECUTIONS_DATA_PRUNE=true` and `EXECUTIONS_DATA_MAX_AGE=168` delete run records older than 7 days.
- **Calendar events without attendees.** The event is `{service} — {client name}` with the `appt_id` as description.
  No attendee is ever added, so Google never emails the client an invite (the earlier Make.com bot did exactly that).
  The client hears about the booking from the bot.
- **Secrets only on the server, never in git.** `deploy/secrets.env` holds the API keys and tokens the scripts use;
  `deploy/.env` holds `POSTGRES_PASSWORD` and `N8N_ENCRYPTION_KEY`; n8n's credential store (encrypted with that key)
  holds the copies the workflows use, plus the Google OAuth client secret and tokens, which exist only there. Both
  files are git-ignored; workflow JSON refers to credentials by name.

**HIPAA / BAA: what a real US deployment adds** (this template does not claim any of it):

- a BAA with the hosting provider and with every vendor that sees patient messages (LLM, messaging, database);
- encryption of the database and backups at rest;
- role-based access to n8n, Airtable and the calendar, and an access log;
- the same review for the chat history table (see GDPR below).

## GDPR

What an EU deployment needs. This is a checklist, not legal advice.

- **Data and where it lives.** Airtable: client name, phone or Telegram id, language, status, notes, appointments.
  Google Calendar: service, client name, time; when the client has no name yet, the event title falls back to the
  `contact_id`, which is a phone number or a Telegram id. Postgres on the server: the conversation history per contact
  (`n8n_chat_histories`, read by the agent; the template has no retention job for it yet), run logs (7 days), the
  knowledge-base index, rate-limit counters. Anthropic: message texts in every agent, translation and YES-check call.
  OpenAI: knowledge-base paragraphs and client questions, for embeddings only.
- **Processors:** Hetzner (server), Anthropic, OpenAI, Airtable, Google, Meta (WhatsApp), Telegram.
- **Roles.** The clinic is the controller. The developer is a processor while they have access: a DPA (Art. 28) with
  technical and organisational measures (TOMs). If the developer works from outside the EU/EEA, Standard Contractual
  Clauses as well.
- **Marketing consent: revisits are not switchable.** WF-5 sends the revisit invitation (a WhatsApp template Meta
  classified as MARKETING) to every client whose visit is `done` with `Appointments.next_visit_in` > 0, once that many
  days have passed. There is no consent check and no on/off setting. Until a consent field exists, keep revisits off
  in one of two ways: leave `Appointments.next_visit_in` empty (the practitioner's field; the WF-5 search requires a
  value above 0), or disable the `Due Revisits` node in `workflows/wf5-reminders.json` and push it. The clinic
  collects opt-in at booking before revisits are switched on.
- **Privacy notice.** The clinic's patient privacy notice names the AI assistant and the processors above.
- **AI disclosure.** The bot tells a new client in its first reply that it is the clinic's AI assistant, and answers
  truthfully when asked (EU AI Act Art. 50).
- **DPIA.** Likely needed: automated processing next to health data. The clinic decides.

## Channels and WhatsApp providers

| | WhatsApp (primary) | Telegram (secondary / demo) |
|---|---|---|
| Role | What the clinic buys; the video and case card show only this | Development, tests, public demo link |
| Demo | Meta Cloud API test number: free, at most 5 recipients, each added and verified in the Meta dashboard | Free; anyone can write |
| Formatting | Plain text, up to 1500 characters per message | HTML, up to 4000 characters per message |

| Provider | Fit | Notes |
|---|---|---|
| Meta Cloud API | **Chosen; this project is built on it** | No reseller markup; native n8n nodes; the `WhatsApp Trigger` answers Meta's verification and checks the payload signature itself |
| 360dialog | Agencies without a technical onboarding person | Not built |
| Twilio | Evaluated, not used | One provider for WhatsApp + SMS + voice; its trial SMS verification refused the author's number |
| Wati / ManyChat | Not a fit for this architecture | — |

Meta test-number limits: 5 recipients; the first temporary token expires in 24 hours (use a permanent System User
token); free-form messages only inside the 24-hour window after the client's last message, so the reminder and the
revisit invitation go out as approved templates (`medspa_reminder`, UTILITY; `medspa_revisit`, MARKETING; English only).
Details: [docs/whatsapp-providers.md](docs/whatsapp-providers.md).

## Deploy in 30 minutes

Step by step, including the accounts to prepare beforehand:
[docs/onboarding-checklist.md](docs/onboarding-checklist.md). The commands, run from the repository root (the scripts
copy the project to the server and run there over SSH):

```bash
# on the server, in /opt/medspa/deploy, after filling .env and secrets.env
docker compose up -d
# from your machine
medspa-front-desk/scripts/remote.sh 'scripts/n8n-credentials.sh'   # 8 credentials from secrets.env
medspa-front-desk/scripts/remote.sh 'scripts/airtable-schema.sh'   # base + 5 tables, resumable
medspa-front-desk/scripts/remote.sh 'scripts/airtable-seed.sh'     # Settings, Services, Knowledge
medspa-front-desk/scripts/remote.sh 'scripts/push-all.sh'          # every workflow, in dependency order
```

The Google Calendar credential is the ninth and is connected in the n8n UI (OAuth). The 30 minutes assume the accounts
already exist; Meta template approval and Google app publishing take longer and are listed as lead-time items. The
timings are targets: a complete deployment on a fresh server has not been timed end to end yet.

## Handover: who owns what

Every account is registered by the clinic, on the clinic's card: Hetzner, Anthropic, OpenAI, Meta Business (WhatsApp
Business Account), Airtable, Google, and the Telegram bot (transferred through @BotFather). The developer is invited
with scoped access (an Airtable token for one base, a Meta system user with WhatsApp permissions only, spend limits on
the paid keys) and never holds the clinic's passwords. At handover the clinic rotates every key: it edits each n8n
credential in place with the new value (so the workflows stay bound to it), updates `deploy/secrets.env` to match,
re-authorises Google, and removes the developer's invitations; the onboarding checklist lists each secret and where
it is issued. Because every secret sits in a known place on the server (`deploy/secrets.env`, `deploy/.env`, n8n's
credential store) and none is in git, the clinic can check this itself. The developer keeps the reusable template; the clinic gets its configuration
and a licence (see the contract checklist in the onboarding document).

## Running costs

- **Claude (agent).** Measured on the 2026-10-05 dialog run (run 1, 12 dialogs): 70 agent executions, 138 model calls,
  549,526 input and 13,522 output tokens on `claude-opus-5`. That is about 7,850 input and 193 output tokens per client
  message that reaches the agent (549,526 / 70 and 13,522 / 70). At Anthropic's published `claude-opus-5` price, $5
  per million input and $25 per million output tokens (platform.claude.com/docs/en/about-claude/pricing, checked
  2026-10-08), that is about $0.044 per agent answer: 7,850 × $5 / 1M ≈ $0.039 plus 193 × $25 / 1M ≈ $0.005, at the
  base input price with no caching discount. Translation, language detection and the YES check (Haiku) are not in
  these numbers.
- **Claude (knowledge gate).** About 0.0011 USD per knowledge question: 901 input and 46.9 output tokens per call on
  average, at Haiku 4.5's $1 / $5 per million (same pricing page). An estimate from measured tokens, not an invoice.
- **OpenAI embeddings.** Negligible: one full re-index of the 14 demo paragraphs is 856 tokens of
  `text-embedding-3-small`.
- **Meta WhatsApp.** Per-message prices for Germany from third-party rate tables: Marketing ≈ €0.113, Utility
  ≈ €0.046. From 2026-10-01 Meta bills service messages (free-form replies inside the 24-hour window) per delivered
  message after 1,000 free per number per month, and stops delivering them for businesses with no payment method on
  file.
- **Airtable needs a paid plan.** The Free plan allows 1,000 public API calls per month per workspace; the bot's hourly
  jobs alone exceed it (WF-5's four searches an hour are about 2,900 a month, WF-4's hourly check about 720) before any
  client writes. Source: support.airtable.com, "Managing API call limits in Airtable". Interface-only sharing is also
  a paid-plan feature.
- **Server.** The demo runs on a Hetzner CX23.
- **Set monthly spend limits** on the Anthropic and OpenAI accounts.

## Testing

- **Level 1, tools** (`tests/tool-cases.sh`, cases in `tests/tool-cases.tsv`, described in `tests/tool-cases.md`):
  every sub-workflow called alone with fixed inputs through a key-protected test harness, compared against a regular
  expression; each case builds and removes its own data. 97 cases: 97 passed on 2026-10-08
  (`tests/dialog-runs/2026-10-08-level1.md`); the 96 cases before `escalate_already_escalated` was added passed twice
  in a row on 2026-10-03 (`tests/dialog-runs/2026-10-03-level1.md`). Code nodes also have stub suites (`tests/*-stubs.sh`).
- **Level 2, dialogs** (`tests/dialogs.sh`, scripts in `tests/dialogs/`): 12 end-to-end dialogs through the real WF-1,
  in Telegram and WhatsApp payload formats (dialogs 09 and 10 run once), 22 runs per pass. A key-protected test inbound
  feeds the same `Normalize` as the real triggers; `send_message` writes outbound messages for test contacts to a
  Postgres table `test_outbox` instead of sending them. Checks are on state, template keys and language, never on the
  model's wording. Run 1 (2026-10-05): 22 passed. Run 2 (2026-10-05): 20 passed, 2 failed, both because the Anthropic
  credit ran out mid-run, not because of a bot defect.
  PENDING: run 2 is being repeated on 2026-10-08 after the Anthropic credit top-up; this sentence will be replaced by the result.
- **Level 3, the owner as a client.** Live runs from a phone: a Telegram booking and cancellation and a Spanish
  WhatsApp booking and cancellation (2026-10-03), and both WhatsApp templates delivered (2026-10-05). The owner's
  final acceptance run is still open.

## Lessons carried over from the Make.com version

An earlier Telegram booking bot on Make.com had four defects with one cure: a decision left to the model that should
have been configuration. Here each is configuration from the start.

| Make.com defect | Closed here by |
|---|---|
| Sheet columns shifted because the model omitted a positional value | Every tool is a sub-workflow with named inputs; `contact_id` and `channel` come from the message, not the model |
| A booked slot read as free (the model compared a UTC interval with a local one) | `check_availability` computes slots in `Settings.timezone` and returns a verdict; it also returns `slots_local`, after the dialogs caught the model naming the wrong weekday |
| Raw `**` reached the client | The model writes plain text with `**`; `send_message` converts it to Telegram HTML or strips it for WhatsApp, and trims to the channel limit |
| A booking without the client's confirmation | No `confirm` tool; `pending` row, summary from data, deterministic YES in WF-1, calendar re-check in `confirm_booking` |

The rule carried over: two failed rounds of prompt edits mean the decision moves out of the model; a third prompt edit
is not tried. And one platform difference: in Make an unhandled module error deactivates the scenario and the bot goes
silent for everyone; here a workflow that throws stays active, the owner gets an alert, and the next message is handled.

## Known limitations and accepted risks

- The model can misunderstand the client before `pending`. The client then sees the wrong slot in the summary and does
  not reply YES; no booking is created.
- The Meta test number is a demo (5 recipients). Production needs the clinic's own verified WhatsApp number.
- One calendar, one location. No payment or deposit. Voice is phase 2.
- WhatsApp templates are English only: a non-English client gets the reminder and the revisit invitation in English.
- A Google OAuth app in Testing mode issues a token that expires every 7 days; publish the app (it needs a home page
  and a privacy policy on a domain the clinic owns).
- A retried send can deliver a message twice (a timeout after Meta or Telegram already delivered it). Accepted: a
  duplicate is cheaper than a lost booking confirmation.
- If `notify_owner` itself fails, WF-6 cannot alert anyone; the n8n execution list is the only trace.
- A forged WhatsApp webhook is dropped silently with HTTP 200 and leaves no execution.
- Two clients and one slot: if the second confirms after the first, they get `SLOT_TAKEN` with alternatives; two
  confirmations at the same instant could both succeed (not reproduced).
- A visit booked less than `reminder_hours_before` ahead gets no reminder.
- An exhausted Anthropic credit reaches the owner as "Bad request - please check your parameters"; a fix that passes
  the real cause through is planned.
- The conversation history in Postgres has no retention job yet.
- No consent flag for REVISIT: WF-5 sends the MARKETING revisit template to every client with a `done` visit and
  `next_visit_in` > 0. Keep `next_visit_in` empty or disable `Due Revisits` until a consent field exists (see GDPR).
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`: Code nodes can read the environment, including the encryption key and database
  password. Run one clinic per instance.

## License

MIT.
