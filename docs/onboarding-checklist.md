# New client in 30 minutes

Developer-facing checklist for deploying MedSpa Front Desk for a new clinic. The 30 minutes are the six timed steps
below. They assume the accounts in "Before the 30 minutes" already exist; some of those take days. The timings are
targets: a complete deployment on a fresh server has not been timed end to end yet.

Conventions: the scripts in `scripts/` run on the server. `scripts/remote.sh '<command>'` copies the project folders to
`/opt/medspa` on the server and runs the command there over SSH (it expects an SSH host alias `medspa`). Run it from
the repository root as `medspa-front-desk/scripts/remote.sh`. Never put a secret value in a command line, a commit, a
chat or a ticket; values go only into `deploy/.env` and `deploy/secrets.env` on the server.

## Before the 30 minutes (lead-time items)

Every account is the clinic's, registered on the clinic's card (see "Handover" below). The developer is invited.

- [ ] **Server.** A Hetzner VPS (the demo runs on a CX23, Ubuntu 24.04) with Docker, `jq`, and your SSH key; a host
      name for HTTPS (`<your-domain>`).
- [ ] **Anthropic** and **OpenAI** API keys, each with a monthly spend limit set in the console.
- [ ] **Airtable** workspace, **paid plan for a clinic**. Free allows 1,000 API calls per month per workspace, Team
      100,000 (support.airtable.com, "Managing API call limits in Airtable"). With the daily jobs the bot uses 180 to
      210 calls a month idle, and a five-message booking about 72 (README, Running costs): Free carries a demo with
      roughly ten bookings a month, not a clinic, and not the test suites. Interface-only sharing also needs a paid
      plan. A personal access token with scopes `data.records:read`, `data.records:write`, `schema.bases:read`,
      `schema.bases:write`, limited to this workspace.
- [ ] **Google**: a calendar for the clinic, and a Google Cloud project with the Calendar API enabled, an OAuth consent
      screen and a Web OAuth client whose redirect URI is the n8n OAuth callback on `<your-domain>`. **Publish the
      app** (it needs a home page and a privacy policy on a domain the clinic owns); in Testing mode the token expires
      every 7 days.
- [ ] **Meta**: a Business account with a WhatsApp Business Account, a Meta app with the WhatsApp product, and a
      permanent System User token with `whatsapp_business_messaging` and `whatsapp_business_management`. **Verify the
      clinic's real business number**: the test number reaches at most 5 recipients and is for demos only.
- [ ] **Meta templates**: create `medspa_reminder` (category UTILITY) and `medspa_revisit` (Meta may classify it
      MARKETING), language English, bodies matching `REMINDER` and `REVISIT` in `templates/messages.en.json`, and wait
      for approval. For the demo, approval took two days (submitted 2026-10-03, approved 2026-10-05).
- [ ] **Telegram**: a new bot from @BotFather for the clinic. The owner opens the bot and presses Start once, so the bot
      can message them; owner alerts arrive there.
- [ ] **Contract** signed (see "Contract checklist for the developer" at the end).

## The 30 minutes

### 1. Accounts and base (5 min)

- [ ] Collect the values for `deploy/secrets.env` (names as in `deploy/secrets.env.example`; the file itself is
      written on the server in step 2). Keep them in the clinic's password manager meanwhile, never in the repo or a chat:
  - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`;
  - `AIRTABLE_PAT`, `AIRTABLE_WORKSPACE_ID` (where `airtable-schema.sh` creates the base), `AIRTABLE_BASE_ID` (empty
    on the scripted path, see below);
  - `TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_CHAT_ID`;
  - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` (the WABA id), `WHATSAPP_PHONE_NUMBER_ID`,
    `WHATSAPP_FROM_DISPLAY` (the sender number in E.164, no spaces: `secrets.env` is sourced by bash, and spaces or
    brackets break every script), `META_APP_ID`, `META_APP_SECRET`;
  - `GOOGLE_CALENDAR_ID`;
  - `POSTGRES_PASSWORD`: generate it now; the same value goes into `deploy/.env` in step 2 (the n8n Postgres
    credential is created from `secrets.env`, the database from `.env`, so they must match);
  - `TEST_KEY`: a random string;
  - `N8N_HOST` (`<your-domain>`) now, `N8N_API_KEY` after n8n is up (step 2);
  - `OWNER_WHATSAPP_NUMBER`: optional, used only for manual template tests; no script reads it.
- [ ] Airtable base, either way:
  - scripted (the path the template is built on): leave `AIRTABLE_BASE_ID` empty and run
    `scripts/airtable-schema.sh` in step 4; it creates the base and five tables and writes the ids;
  - or **Duplicate base** of an existing deployment in the Airtable UI (without its client records), then run
    `EXISTING_BASE=<new base id> scripts/airtable-schema.sh` in step 4 so it records the new table ids and adds
    anything missing.
- [ ] Confirm the calendar, the WhatsApp number (or the test number for a demo) and the Telegram bot are the clinic's.

### 2. Server (5 min)

- [ ] Copy `deploy/` to `/opt/medspa/deploy` on the server. Create `deploy/.env` from `deploy/.env.example`:
      `N8N_HOST=<your-domain>`, `N8N_VERSION=2.41.5`, `POSTGRES_PASSWORD` (the value from step 1), a generated
      `N8N_ENCRYPTION_KEY`, `OWNER_TELEGRAM_CHAT_ID`. Create `deploy/secrets.env` with the values from step 1. Both
      files mode 600, never in git.
- [ ] `cd /opt/medspa/deploy && docker compose up -d`. Check `https://<your-domain>/healthz` answers ok.
- [ ] In the n8n UI: create the owner account, then an API key (Settings → n8n API); put it in `secrets.env` as
      `N8N_API_KEY`, and `N8N_HOST` there too.

### 3. Credentials (5 min)

- [ ] `medspa-front-desk/scripts/remote.sh 'scripts/n8n-credentials.sh'`: creates eight credentials (`MedSpa
      Anthropic`, `MedSpa OpenAI`, `MedSpa Airtable`, `MedSpa Telegram`, `MedSpa WhatsApp`, `MedSpa WhatsApp Trigger`,
      `MedSpa Postgres`, `MedSpa Test Key`) and records their ids in `deploy/credentials.map.json`. A credential with a
      missing value prints `skipped (no value)`; fill it and re-run.
- [ ] In the n8n UI: Credentials → Add → Google Calendar OAuth2 API, named exactly `MedSpa Google Calendar`, client id
      and secret from the Google OAuth client, Sign in with Google with the clinic's account. Add its id (from the
      credential's URL) to `deploy/credentials.map.json` as `"MedSpa Google Calendar": "<id>"`.

### 4. Clinic data (5 min)

- [ ] `medspa-front-desk/scripts/remote.sh 'scripts/airtable-schema.sh'` (scripted path; resumable, safe to re-run).
- [ ] Edit `airtable/seed/settings.json`, `services.json` and `knowledge.json` for the clinic, then
      `medspa-front-desk/scripts/remote.sh 'scripts/airtable-seed.sh'`. The seed fills `calendar_id`,
      `owner_contact` and `whatsapp_number` from `secrets.env`. Settings is skipped when a row exists, so later changes
      are made in Airtable.
- [ ] **Settings**: `business_name`, `timezone`, `working_hours`, `calendar_id`, `owner_contact`, `whatsapp_number`,
      `cancellation_hours`, `intake_form_url` (the clinic's own intake and consent form), and check
      `reminder_hours_before`, `pending_ttl_min`, `slot_step_min`, `min_lead_min`. Reminders: WF-5 runs once a day at
      07:05 UTC and reminds every visit of tomorrow by the clinic's calendar (`Settings.timezone`), at about 08:05 Berlin
      time in winter and 09:05 in summer; a visit booked after that run but still `reminder_hours_before` ahead is
      reminded on its own morning, and one booked less than `reminder_hours_before` ahead gets none. Condition: in the
      clinic's time zone the run hour must come before the clinic's first appointment of the day (opening time). For
      another time zone, change the hour in the `Daily` node of `workflows/wf5-reminders.json`.
- [ ] **Services**: the clinic's price list (`service_id` lowercase, duration, price, `active`).
- [ ] **Knowledge**: the clinic's document, one paragraph per row with a `topic`. No medical advice in it: the bot
      answers only from these rows.

### 5. Workflows and webhooks (5 min)

- [ ] Commit or stash local changes first: `remote.sh` refuses to run `push-all.sh` when `workflows/` or `scripts/`
      have uncommitted changes.
- [ ] `medspa-front-desk/scripts/remote.sh 'scripts/push-all.sh'`: pushes every workflow in dependency order (two
      passes), activates the triggers and WF-6, and verifies each workflow carries WF-6 as its error workflow. Expect
      `push-all done`.
- [ ] Brand-new instance only (not yet exercised): n8n 2.41.5 refuses to activate a workflow whose Execute Workflow
      node or error workflow points at a workflow with no published version, and `push-all.sh` does not activate the
      tool sub-workflows. If an activation fails with "references workflow ... which is not published" or "has no
      published version", activate the called workflows first, in `push-all.sh`'s order up to `wf2-agent`:
      `medspa-front-desk/scripts/remote.sh 'scripts/n8n-push.sh workflows/<path>.json --activate'` for each, then run
      `push-all.sh` again.
- [ ] Knowledge index: `medspa-front-desk/scripts/remote.sh 'scripts/n8n-run.sh wf4-knowledge-ingest'` (or open
      `wf4-knowledge-ingest` in the n8n editor and run it once). The owner gets "Knowledge base re-indexed". Otherwise
      the daily run (06:35 UTC) builds the index the next morning and the bot answers NOT_FOUND until then.
- [ ] Telegram: activating `wf1-inbound` sets the bot's webhook; nothing else to do.
- [ ] WhatsApp: activating `wf1-inbound` registers the Meta app's webhook subscription (field `messages`). Also
      subscribe the app to the WhatsApp Business Account once: `POST /<WABA id>/subscribed_apps` with the System User
      token (expected `{"success":true}`).

### 6. Smoke test (5 min)

From a phone, as a client, using the first messages of three dialog scripts:

- [ ] `tests/dialogs/01-new-client-books.md`: "Hi! I'd like to book Botox." The bot says it is the clinic's AI
      assistant and asks for the name; continue to the summary, reply YES, get the confirmation and the intake link;
      the event appears in the calendar, the row in Airtable.
- [ ] `tests/dialogs/06-knowledge-in-base.md`: a question the knowledge base answers (parking, hours, a price).
- [ ] `tests/dialogs/08-talk-to-human.md`: ask for a person; the owner gets the escalation in Telegram, and the bot then
      answers only that a team member will be in touch. Clear the client's `escalated` status in Airtable afterwards.
- [ ] Cancel the test booking through the bot and delete the test client in Airtable.

What changes per client: one Settings row, the Services and Knowledge tables, and the values in `deploy/.env` and
`deploy/secrets.env`. What never changes: the workflows.

## After the 30 minutes

- [ ] **Airtable Interface** for the owner (about 10 minutes): follow [airtable-interface.md](airtable-interface.md),
      including its **Step 0**, three Lookup fields in `Appointments` created by hand in the UI (the Airtable API cannot
      create lookup fields, so `airtable-schema.sh` does not).
- [ ] Optional full regression on the clinic's server: `medspa-front-desk/scripts/remote.sh 'tests/tool-cases.sh'`.
      It uses test contacts and 2030 dates and cleans up after itself, but the owner receives real Telegram alerts
      during the run.
- [ ] **Marketing consent for revisits.** WF-5 sends the revisit invitation (the MARKETING template on WhatsApp) only
      to clients whose `Clients.marketing_consent` is ticked, for a `done` visit whose `Appointments.next_visit_in` is
      above 0, once that many days have passed. Agree with the clinic where the opt-in is collected (a consent line in
      its intake and consent form is the usual place) and who ticks the box in Airtable; the bot never ticks it. A
      client without the box gets no invitation and the visit stays due, so ticking it later still sends the invitation
      on the next daily run (one per client, for the newest due visit; the older due visits are marked with it).
      Unticking it stops further invitations.
- [ ] **Knowledge edits are re-indexed by hand.** After the clinic changes the Knowledge table, run
      `medspa-front-desk/scripts/remote.sh 'scripts/n8n-run.sh wf4-knowledge-ingest'`; the owner gets "Knowledge base
      re-indexed: N paragraphs". Without it the bot uses the old text until the daily WF-4 run (06:35 UTC) repairs the
      index. Tell the clinic who does this.
- [ ] Spend limits confirmed on Anthropic and OpenAI; Airtable plan chosen: paid for a real clinic (Free only for a
      demo, see "Before the 30 minutes").

## Handover (about 15 minutes, done by the clinic)

At handover the clinic takes every key over. Names only; never send values.

| Secret (`deploy/secrets.env`) | Where it is issued | Action |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | create new, delete old |
| `OPENAI_API_KEY` | platform.openai.com → API keys | create new, delete old |
| `AIRTABLE_PAT` | airtable.com/create/tokens | create new (same four scopes), revoke old |
| `TELEGRAM_BOT_TOKEN` | @BotFather → the bot → API token | revoke and re-issue |
| `WHATSAPP_ACCESS_TOKEN` | Meta Business settings → System users | generate a new token, revoke old |
| `META_APP_SECRET` | developers.facebook.com → the app → App settings | reset |
| `N8N_API_KEY` | n8n → Settings → n8n API | create new, delete old |
| `TEST_KEY` | any random string | replace |

Then:

- [ ] **Edit each credential in place** in the n8n UI (Credentials → open `MedSpa Anthropic`, `MedSpa OpenAI`,
      `MedSpa Airtable`, `MedSpa Telegram`, `MedSpa WhatsApp`, `MedSpa WhatsApp Trigger`, `MedSpa Test Key` → paste the
      new value → Save). The credential ids stay the same, so every workflow stays bound to them. Why not re-run
      `scripts/n8n-credentials.sh`: it skips every name already in `deploy/credentials.map.json`, and if you delete the
      entries it creates NEW credentials with new ids while the pushed workflows still point at the old ones, which
      hold the revoked keys.
- [ ] Update `deploy/secrets.env` on the server with the same new values, so the scripts stay in sync (`N8N_API_KEY`
      and `TEST_KEY` are read by the scripts and tests directly; the others are what a later re-create would use).
- [ ] Re-register the webhooks with the new Telegram token and Meta app secret: deactivate and re-activate
      `wf1-inbound`, `medspa-front-desk/scripts/remote.sh 'scripts/n8n-push.sh workflows/wf1-inbound.json --deactivate
      && scripts/n8n-push.sh workflows/wf1-inbound.json --activate'`. Deactivation removes the Meta app subscription and
      activation registers it and the Telegram webhook again; the bot is offline for those seconds.
- [ ] Alternative, if you prefer re-creating: remove the rotated credentials' entries from
      `deploy/credentials.map.json`, re-run `scripts/n8n-credentials.sh` (new ids are written to the map), run
      `medspa-front-desk/scripts/remote.sh 'scripts/push-all.sh'` (it re-pushes every workflow, binding credentials
      by name to the ids in the map, and re-activates the trigger workflows), check `push-all done`, then delete the
      old credentials in the n8n UI.
- [ ] Re-authorise `MedSpa Google Calendar` in the n8n UI with the clinic's Google account (in place; same id).
- [ ] Change the n8n owner password; remove the developer's n8n user, if any.
- [ ] Remove the developer from Airtable, the Google Cloud project, Meta Business (system users and people), the
      Hetzner project, and the developer's SSH key from the server.
- [ ] Send one test message and check the owner alert arrives.

`deploy/.env` (`POSTGRES_PASSWORD`, `N8N_ENCRYPTION_KEY`) is generated on the clinic's server; the developer keeps no
copy. The encryption key protects the stored n8n credentials, so it is not rotated casually.

## Contract checklist for the developer

- [ ] **No non-compete.** Refuse any clause that forbids working for other clinics or competitors: the business is
      selling this template to many clinics.
- [ ] **IP.** The developer keeps the reusable template (workflows, scripts, prompts, tests) as background IP. The
      clinic receives its own configuration (Settings, Services, Knowledge, credentials) and a licence to use the
      template.
- [ ] **DPA** (GDPR Art. 28) with technical and organisational measures, offered by the developer; Standard
      Contractual Clauses if the developer works from outside the EU/EEA.
- [ ] Accounts on the clinic's card, scoped invitations for the developer, handover as above.
