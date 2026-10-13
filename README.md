# MedSpa Front Desk

## What it is

A WhatsApp and Telegram front desk for a medical-aesthetics clinic. It books, reschedules and cancels appointments,
answers questions from the clinic's own knowledge base, sends reminders, and hands the conversation to a person when
it should. It runs on self-hosted n8n with Claude, Airtable and Google Calendar, and is built as a template that is
deployed once per clinic.

<!-- Placeholder: the image goes here once docs/img/demo.png is added (a frame from the demo video):
![WhatsApp booking: summary, YES, confirmation](docs/img/demo.png) -->

## The problem it solves

Job postings for appointment bots (Upwork and Freelancer.com, August and September 2026) describe one system. Three
requirements come up again and again:

- **Booking in WhatsApp, around the clock**, through the official WhatsApp Business API.
- **Real-time slots without double booking**: one posting asks for "prevention of double bookings through real-time
  blocking of occupied times".
- **A reminder before the visit**, "e.g., 24 hours before the appointment".

The same postings ask for a master template that a new client can be onboarded onto in 15-30 minutes, and for clean
documentation. Source notes: the author's notes on booking-bot client requirements.

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
                                           escalation resolved by owner  → delete that chat memory once, go on
                                       → otherwise WF-2 → reply, or instead the pending summary / the cancel
                                         question built from the row → send_message
WF-2  Agent       AI Agent on Claude (claude-opus-5), Postgres chat memory per contact_id, guardrail
                  tools: find_client, check_availability, propose_booking, request_cancel,
                         search_knowledge, escalate
WF-3  Tools       sub-workflows with named inputs over Google Calendar + Airtable; each returns a verdict
                  string. Internal, never given to the agent: confirm_booking, cancel_booking, reminder_reply
WF-4  Knowledge   ingest: Airtable Knowledge → OpenAI embeddings → pgvector (Run Now after a Knowledge edit,
                  and a daily self-repair)
                  query: top 5 by vector distance → Claude Haiku relevance gate → ≤ 3 passages | NOT_FOUND
WF-5  Reminders   daily (07:05 UTC): reminders the day before the visit, revisit invitations (only with marketing
                  consent), expiry of stale pending bookings
WF-6  Errors      Error Trigger → owner's Telegram; the failing workflow stays active. The alert carries the provider's own
                  error text: n8n's message plus the node error's description ("Your credit balance is too low ...")
Shared            send_message (template with dates and units in the client's language, translation, the English-line
                  guard on agent replies, channel formatting, WhatsApp template vs free text)
                  notify_owner (owner's Telegram; a direct fallback when Airtable is unreachable)
* key-protected webhook used only by the automated dialog tests, for test contacts only
```

| Tool | Named inputs | Returns |
|---|---|---|
| `find_client` | `contact_id`* | `NEW`, or `KNOWN` with name, language, last visit and service, `next_visit_in`, upcoming appointments with their `appt_id`, the owner's notes |
| `check_availability` | `contact_id`*, `service_id`, `date`, `part_of_day?` | `FREE <ISO slots>` plus `slots_local` (weekday, date and local time computed by the tool, in the client's language), `NONE <alternatives or reason>`, `UNKNOWN_SERVICE <active services>`. The offer is saved on the client as `{service_id, slots}` |
| `propose_booking` | `contact_id`*, `channel`*, `service_id`, `start_iso`, `name?`, `replaces_appt_id?` | `PENDING <appt_id>`: an Airtable row with status `pending`, calendar untouched. `SLOT_NOT_OFFERED` if the slot or service is not in the saved offer, `UNKNOWN_SERVICE`, `NO_CLIENT_ROW` |
| `request_cancel` | `contact_id`*, `appt_id` | `CANCEL_PENDING <appt_id>` / `LATE_CANCEL_PENDING <appt_id>` (the cancellation would be late): a pending cancellation is recorded, nothing is cancelled. `NOT_YOURS` / `NOT_FOUND` |
| `search_knowledge` | `question` | `FOUND` with up to 3 passages and their topic, or `NOT_FOUND` |
| `escalate` | `contact_id`*, `reason` | `ESCALATED`: flags the client, sends the owner the conversation |

\* filled by n8n from the incoming message, never by the model.

**The client confirms, not the model.** The agent has no `confirm` tool. `propose_booking` writes a `pending` row and
returns `PENDING <appt_id>`. WF-1 then discards whatever the agent wrote and has `send_message` render the
`PENDING_SUMMARY` template from that row ("Botox (30 min) — Mon, Jan 7, 10:00 AM. You can cancel free of charge no
later than 24 hours before the visit. Reply YES to confirm."). The client's next message is checked by WF-1 before the
agent sees it: if a live `pending` row exists and the text is a confirmation (a word list per language, then a short Haiku check for
other short phrasings), n8n re-checks the calendar, creates the event and moves the row to `booked`. Any other text
goes to the agent and the pending row expires after `pending_ttl_min`. The service can only be an existing
`service_id` and the time only a slot from the saved offer, so the model cannot invent either, and what the client
confirms is exactly what gets written.

Cancelling works the same way: the agent cannot cancel. `request_cancel` checks that the visit is the client's own
and still ahead, records a pending cancellation and says whether it would be late (inside
`Settings.cancellation_hours`). WF-1 sends the question built from the row ("Cancel your appointment for Botox on Mon, Jan 7, 10:00 AM?
Reply YES to cancel.", with the late-cancellation notice when it applies), and only a YES to that question, while it is
the bot's last message and has not expired, makes n8n run `cancel_booking` (event deleted, `cancelled` or
`late_cancel`, a late canceller flagged, the owner notified). NO or anything else goes to the agent and the visit stays
booked. The reminder's own "Reply YES to confirm or NO to cancel" works as before.

**The client's language.** The bot writes to a client only in `Clients.language` (detected from their first message).
The agent is told to reply in it. A template message is rendered in English and then translated, but its dates, times
and units are not left to the translation: `send_message` writes them in the client's language itself, with
`Intl.DateTimeFormat` in `Settings.timezone` (weekday, day, month, and the locale's own clock, 24-hour for German,
Spanish or Russian) and `Intl.NumberFormat` units with the locale's plural rules ("20 мин", "24 Stunden", "1 час").
`Intl` was chosen over a hand-kept word list because the n8n image's Node carries full ICU, so any language a client
writes in is covered with no list to maintain; a language ICU does not know falls back to English. The translation
(Claude Haiku) then translates every word except people's names, the clinic's name, links and ids; brand names (Botox,
HydraFacial) keep their spelling, generic treatment names are translated as a clinic in that language names them. The
terms listed in `Settings.untranslated_terms` (comma-separated, e.g. `Botox, HydraFacial`) never reach the translator at
all: `send_message` replaces each with a placeholder token before the translation and puts the term back after it, so
they arrive exactly as written in the list. Matching is case-sensitive and whole-word, so each entry must be spelled
exactly as on the price list (`Services.name`): `botox` in the list does not protect "Botox". When the translator
mangles a token, the message is translated once more without tokens and is sent only if every listed term survived,
otherwise the English message is sent. Every
message uses the formal form of address (Sie, usted, vous, вы, ...) from a per-language map in `send_message`, not each
translation's own choice, and the agent prompt asks for the same; a clinic that wants the informal form changes that map
and that prompt line. The words the client
is asked to reply with ("Reply YES to confirm", the cancel question, the reminder's YES / NO) are not the translator's
choice: `send_message` puts them in from a short per-language list (ДА / НЕТ, JA / NEIN, SÍ / NO, OUI / NON, SI / NO,
...) that holds only words WF-1's YES/NO word lists already accept, and the translation keeps them as written. A
language without such a pair keeps YES / NO, which WF-1 accepts from every client. This matters most for a Telegram
reminder: an answer WF-1 did not recognise would go to the agent, which cannot record it. If the translation fails, the
English message is sent: an English message is better than none. The slots the agent offers come from
`check_availability`'s `slots_local`, which is written in the client's language the same way, and the agent copies them
as written. The agent's own reply is checked too: in a reply to a client whose language is not written in Latin letters
(Russian, Ukrainian, Arabic, ...), a line that reads as English is dropped when a line in the client's script remains
(the model once wrote "On which day would they like it?" above its Russian question); a reply that reads as English
otherwise is translated whole, nothing dropped. Either way it goes through the same translation; this costs a Haiku call
only for such a reply.
WhatsApp's reminder and revisit invitation outside the 24-hour window are approved Meta templates and stay in English,
parameters included (owner decision 2026-10-11); a clinic adds templates in its own languages at onboarding
([docs/onboarding-checklist.md](docs/onboarding-checklist.md)). Inside the window and on Telegram they are translated
like any other message.

## Data model

Google Calendar is the source of truth for time, Airtable for people and status; neither duplicates the other.
Airtable base `MedSpa Front Desk` (`airtable/schema.json`):

- **Settings** (one row, everything that changes per clinic): `business_name`, `timezone`, `working_hours`,
  `calendar_id`, `owner_contact`, `whatsapp_number`, `intake_form_url`, `cancellation_hours`, `reminder_hours_before`,
  `pending_ttl_min`, `slot_step_min`, `min_lead_min`, `untranslated_terms` (brand names kept exactly as written in every
  translated message; empty = none).
- **Services** (the price list, edited by the clinic): `service_id`, `name`, `duration_min`, `price`,
  `deposit_required`, `active`.
- **Clients** (one person, several channels): `client_id`, `name`, `phone`, `telegram_chat_id`, `email`, `language`,
  `first_seen`, `last_visit`, `status` (`new | active | flagged | escalated`), `escalated_at` (set by `escalate` with the
  status, emptied by WF-1 after it reset the chat memory of a resolved escalation), `intake_completed`, `notes` (written by
  the clinic, read by the agent), `last_offer_json`, `last_offer_at`, `last_agent_reply_at`, `cancel_ask_appt_id` (the
  open cancel question; send_message clears it on any other message to the client), `marketing_consent` (ticked by
  the clinic when the client opted in to marketing messages; the bot never sets it).
- **Appointments** (one row per visit, life cycle in one field): `appt_id`, links `client` and `service` plus their
  text ids `client_id` and `service_id`, `start_iso`, `end_iso`, `start_dt`, `status` (`pending → booked → reminded →
  confirmed | cancelled | late_cancel | no_show | done`), `calendar_event_id`, `created_via`, `pending_expires_at`,
  `summary_sent_at`, `reminder_sent_at`, `confirmed_at`, `revisit_invited_at`, `replaces_appt_id`,
  `cancel_expires_at` (the two-step cancel), and the
  practitioner's fields `treatment_notes`, `next_visit_in`, `practitioner`.
- **Knowledge** (the clinic's document, one paragraph per row): `kb_id`, `topic`, `text`, `updated_at`.

The owner works in an Airtable Interface (today's visits, pending confirmations, flagged and escalated clients, after
visit, clients with their marketing consent): [docs/airtable-interface.md](docs/airtable-interface.md).

**Resolving an escalation.** While a client is `escalated` the bot only answers "a team member will contact you". When
the owner has dealt with it, she changes `status` away from `escalated` (to `active`, or `flagged` if it should stay on
her list). That also resets the bot's memory of the conversation: on the client's next message WF-1 deletes that
client's chat history (`n8n_chat_histories`, that contact only), empties `escalated_at`, and answers as usual. The
client is greeted afresh, as if the conversation were new, while their name, notes and visits stay in Airtable and
reach the agent through `find_client`. Nothing the bot needs lives only in the chat history; what is lost is the
wording of the earlier conversation, including the question that was escalated. If the history cannot be deleted, the
client is still answered, the owner gets "⚠️ Escalation reset failed for …", and the next message tries again. If the
history was deleted but `escalated_at` could not be emptied (checked on Airtable's answer), she gets "⚠️ Escalation
reset for …" asking her to empty it by hand, because until then each message deletes the history again. Only an
escalation made by the bot carries `escalated_at`: a client the owner set to `escalated` by hand keeps the old
conversation when the status is changed back.

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
- **Marketing consent is enforced.** The revisit invitation is a WhatsApp template Meta classified as MARKETING, so
  WF-5 sends it only to a client whose `Clients.marketing_consent` is ticked: for a `done` visit with
  `Appointments.next_visit_in` > 0, once that many days have passed. The checkbox is empty by default and only the
  clinic ticks it, when the client has opted in (for example in the intake and consent form); the bot never sets it.
  A visit of a client without consent is neither sent nor marked, so ticking the box later still lets the invitation
  go out on the next daily run: one invitation per client, for the newest due visit, and all of that client's due
  visits are then marked, so a backlog never sends a stack of stale invitations. Withdrawn consent: untick the box.
- **Privacy notice.** The clinic's patient privacy notice names the AI assistant and the processors above.
- **AI disclosure.** The bot tells a new client in its first reply that it is the clinic's AI assistant, and answers
  truthfully when asked (EU AI Act Art. 50). This does not rest on the model's wording: in the run that creates the
  client's row, and in the run that first detects the client's language (on Telegram the row is created by /start,
  before the language is known), `send_message` checks the reply for the word for AI in the client's language (AI, KI,
  IA, ИИ, ШІ, SI, or the full phrase) and, when it is missing, puts one fixed sentence before it ("I am {clinic}'s AI
  assistant; a team member can take over at any time if you prefer.", in the client's language).
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
[docs/onboarding-checklist.md](docs/onboarding-checklist.md). The commands, run from the project root (the scripts
copy the project to the server and run there over SSH):

```bash
# on the server, in /opt/medspa/deploy, after filling .env and secrets.env
docker compose up -d
# from your machine
scripts/remote.sh 'scripts/n8n-credentials.sh'   # 8 credentials from secrets.env
scripts/remote.sh 'scripts/airtable-schema.sh'   # base + 5 tables, resumable
scripts/remote.sh 'scripts/airtable-seed.sh'     # Settings, Services, Knowledge
scripts/remote.sh 'scripts/push-all.sh'          # every workflow, in dependency order
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
  these numbers. Translation is one Haiku call per template message to a non-English client, plus one for an agent
  reply in which the English-line guard found a line to drop; an agent reply in the client's language costs none.
- **Claude (knowledge gate).** About 0.0011 USD per knowledge question: 901 input and 46.9 output tokens per call on
  average, at Haiku 4.5's $1 / $5 per million (same pricing page). An estimate from measured tokens, not an invoice.
- **OpenAI embeddings.** Negligible: one full re-index of the 14 demo paragraphs is 856 tokens of
  `text-embedding-3-small`.
- **Meta WhatsApp.** Per-message prices for Germany from third-party rate tables: Marketing ≈ €0.113, Utility
  ≈ €0.046. From 2026-10-01 Meta bills service messages (free-form replies inside the 24-hour window) per delivered
  message after 1,000 free per number per month, and stops delivering them for businesses with no payment method on
  file.
- **Airtable: the demo runs on the Free plan; a clinic needs a paid one.** The Free plan allows 1,000 public API calls
  per month per workspace and 5 requests per second per base; Team allows 100,000 calls per month
  (support.airtable.com, "Managing API call limits in Airtable", checked 2026-10-09). The scheduled jobs were cut for Free: WF-5 runs once a day (5 Airtable searches, 6 once a
  visit waits for a client's consent), WF-4 checks Knowledge once a day (1 search) and is re-indexed by hand after an
  edit (`scripts/n8n-run.sh wf4-knowledge-ingest`). Idle load: 180 to 210 calls in a 30-day month, down from 7,200
  (hourly WF-5 3,600, WF-4's 15-minute Airtable trigger 2,880, its hourly check 720). Counted from the workflow JSON, a
  five-message booking (dialog 01: greeting, name, day, slot, YES) makes about 72 Airtable calls and any other agent
  answer about 10, so Free leaves room for roughly ten bookings a month: enough for a demo, not for a clinic. When the
  month's calls run out the bot stops answering until the next month. The test suites cannot run on Free either.
  Interface-only sharing is also a paid-plan feature.
- **Server.** The demo runs on a Hetzner CX23.
- **Set monthly spend limits** on the Anthropic and OpenAI accounts.

## Testing

- **Level 1, tools** (`tests/tool-cases.sh`, cases in `tests/tool-cases.tsv`, described in `tests/tool-cases.md`):
  every sub-workflow called alone with fixed inputs through a key-protected test harness, compared against a regular
  expression; each case builds and removes its own data. 105 cases: 105 passed on 2026-10-09
  (`tests/dialog-runs/2026-10-09-free-airtable-level1.md`); the 96 cases before `escalate_already_escalated` was added passed twice
  in a row on 2026-10-03 (`tests/dialog-runs/2026-10-03-level1.md`). Code nodes also have stub suites (`tests/*-stubs.sh`).
- **Level 2, dialogs** (`tests/dialogs.sh`, scripts in `tests/dialogs/`): 13 end-to-end dialogs through the real WF-1,
  in Telegram and WhatsApp payload formats (dialogs 09 and 10 run once), 24 runs per pass. A key-protected test inbound
  feeds the same `Normalize` as the real triggers; `send_message` writes outbound messages for test contacts to a
  Postgres table `test_outbox` instead of sending them. Checks are on state, template keys and language, never on the
  model's wording. Dialog 13 (German client) and the cancellation legs of dialogs 11 (Spanish) and 12 (Russian) were
  added on 2026-10-11 for the client's language. Every step also checks that none of these reached the client:
  - an English weekday or month name, or the English "Mon," and "Jan 7" forms;
  - AM/PM after a time;
  - in German, "min" after a number;
  - a set of English words (hours, minutes, days, reply, yes, cancel, booked, your, you, the, would, which).

  For the Russian dialog, any Latin word of three or more letters other than the clinic's name, HydraFacial, Botox and
  the parts of a link counts. They have not run yet; the results below are for the 12 dialogs before that. Run 1 (2026-10-05): 22 passed. Run 2 (2026-10-05): 20 passed, 2 failed, both because the Anthropic
  credit ran out mid-run, not because of a bot defect.
  Final runs on the final configuration (two-step cancel, day-before reminders, free-Airtable budget): run 1
  (2026-10-09, `tests/dialog-runs/2026-10-09-dialogs-run-1.md`) passed 21 of 22 runs; the one failure was dialog 05 on
  Telegram, where on step 2 the agent escalated to a human instead of saying it cannot cancel another client's
  appointment (state unchanged). By ruling, dialog 05 now accepts that escalation as a correct outcome (it still requires
  that nobody can cancel or change the other client's visit and that no cancel question opens), and run 1's log,
  re-evaluated against the amended check without a re-run, passes 22 of 22. Run 2 was repeated on 2026-10-10 after the
  Anthropic credit was topped up (`tests/dialog-runs/2026-10-10-dialogs-run-2.md`): passed 22, failed 0. An earlier
  attempt on 2026-10-09 was invalid because the credit ran out (passed 2, failed 20,
  `tests/dialog-runs/2026-10-09-dialogs-run-2-credit-exhausted.md`). So the 12 dialogs pass twice in a row, with the
  caveat that run 1's dialog 05 was judged from its log.
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
- WhatsApp templates are English only: a non-English client gets the reminder and the revisit invitation in English when
  they go out as templates (outside the 24-hour window; WF-5 always sends them as templates). Owner decision
  2026-10-11; per-language templates are an onboarding step for the clinic's languages.
- The English-line guard on agent replies counts English function words per line, so a short English line ("Thank
  you!") is not caught, and a line that mixes English with the client's script ("On which day? Какой день?") is never
  treated as English; the agent is still told to reply in the client's language.
- Italian clients are asked to reply "SI" (WF-1's word list has `si`, not `sì`); Turkish clients keep YES / NO (WF-1's
  `hayır` cannot be shown in capitals that lower-case back to it).
- A Google OAuth app in Testing mode issues a token that expires every 7 days; publish the app (it needs a home page
  and a privacy policy on a domain the clinic owns).
- A retried send can deliver a message twice (a timeout after Meta or Telegram already delivered it). Accepted: a
  duplicate is cheaper than a lost booking confirmation.
- If `notify_owner` itself fails, WF-6 cannot alert anyone; the n8n execution list is the only trace.
- A forged WhatsApp webhook is dropped silently with HTTP 200 and leaves no execution.
- Two clients and one slot: if the second confirms after the first, they get `SLOT_TAKEN` with alternatives; two
  confirmations at the same instant could both succeed (not reproduced).
- A visit booked less than `reminder_hours_before` ahead gets no reminder.
- WF-5 runs once a day (Airtable Free plan), at 07:05 UTC, and reminds every visit of tomorrow by the clinic's
  calendar (`Settings.timezone`): the reminder arrives the day before the visit, at about 08:05 Berlin time in winter
  and 09:05 in summer (the booking confirmation says "We'll send you a reminder the day before"). A visit booked after
  that run but still at least `reminder_hours_before` ahead is reminded on the morning of the visit day, so the run
  hour must come before the clinic's first appointment of the day. Expired `pending` offers are marked
  cancelled by the same daily run; until then a late YES gets "That offer has expired" from `confirm_booking`.
- A Knowledge edit reaches the bot after `scripts/n8n-run.sh wf4-knowledge-ingest`, or with the next daily WF-4 run.
- An exhausted Anthropic credit is named in the WF-6 alert for `wf2-agent` ("Bad request - please check your parameters —
  Your credit balance is too low ..."). WF-1's own "Reply failed ... (step: Agent)" alert shows only n8n's generic
  message (an Execute Workflow node hands its error output a plain string, the description does not travel with it) and
  points the owner there: "(cause: see the ⚠️ wf2-agent alert)".
- The conversation history in Postgres has no retention job yet.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`: Code nodes can read the environment, including the encryption key and database
  password. Run one clinic per instance.
- `TEST_KEY` (credential `MedSpa Test Key`) is live in production, because the test suites run against the live
  instance. It unlocks the test harness (`/webhook/test-tool`: only the allow-listed tool workflows, only for test
  contacts), Test Inbound (`/webhook/wf1-test`: test contacts only) and the Run Now webhooks of WF-4 and WF-5. A leaked
  key can re-run WF-5, which sends every due reminder and revisit invitation again (paid WhatsApp templates), and
  re-index the knowledge base. Generate it with `openssl rand -hex 32` and rotate it with the other secrets; Test
  Inbound runs keep the key header in the run log for 7 days.

## License

MIT.
