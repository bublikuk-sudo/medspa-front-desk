# Airtable Interface for the clinic owner

The owner's day-to-day view of the MedSpa Front Desk base: four pages in one Airtable Interface. It is built by hand in
the Airtable UI (the Meta API cannot create Interfaces) and takes about 10 minutes at onboarding. No screenshots: every
step names the control exactly as Airtable words it. Airtable renames controls from time to time; where the current
wording differs from this guide, the intent of the step is the same.

The bot never reads the Interface. Everything here is a filtered, partly editable window onto the `Appointments` and
`Clients` tables.

## Before you start

- Open the base `MedSpa Front Desk` in Airtable with a user that has at least **Creator** (or Owner) access to the base.
- Field names below are the real ones from `airtable/schema.json`. Two things about `Appointments` are easy to miss:
  - `client_id` and `service_id` are plain text (the business ids the bot writes). The *link* fields are called
    `client` and `service`.
  - A link field shows the primary field of the linked row, which in `Clients` and `Services` is the id
    (`client_id`, `service_id`), not the name. To show names, and the client's `intake_completed`, in the pages, add
    three **Lookup** fields to `Appointments` once (step 0). They are not in `schema.json`; the bot neither reads nor
    writes them.

### Step 0. Add three Lookup fields to `Appointments`

Open the table `Appointments` (Data tab, not Interfaces), then for each row of the table:

1. Add a new field (the `+` at the right end of the field headers).
2. Choose the field type **Lookup**.
3. **Select lookup source**: the link field from the table.
4. Pick the field to look up, then click **Create field**.

| New field name | Lookup source | Field to look up |
|---|---|---|
| `client_name` | `client` | `name` |
| `client_intake_completed` | `client` | `intake_completed` |
| `service_name` | `service` | `name` |

## Create the interface

1. In the base, click **Interfaces** (upper part of the screen).
2. First interface in the base: click **Build it yourself** (older wording: **Start building**, then
   **Build an interface**). The "Try building with AI" option is not used: it would invent its own pages.
   Interface already exists: click **+ New interface**.
3. Name the interface `Front desk`, choose an icon, click **Next**.
4. The layout picker opens ("Choose a layout to create a new interface page"). Pages 1 to 4 below each use a table
   layout: **Grid**. If your picker offers no **Grid**, use **List** and read "column" as "field".
5. Each further page: hover the interface name in the left panel and click the `+` button, which opens the same
   layout picker.
6. When all four pages are done, click **Publish** (top right). **Done** only saves a draft; collaborators see nothing
   until **Publish**.

For every page: pick the layout, choose the **Source** table, click **Finish**, then configure the right-hand
properties panel in Edit mode:

- **Page** > **Title**: the page name.
- **Data** > **Source**: the table. **Filter by**: **Add condition** for each line of the filter. The conjunction
  defaults to **And**. These filters are fixed by the builder; the viewer cannot change them. **Sort by**: the sort.
- **Fields**: "pick which fields are visible", in the order shown below. Hide everything else.
- **User actions** > **Edit records inline**: on only where the page says "editable". Then open the cogwheel next to
  the field list, hover each field that must stay read-only, click the `...`, and click **Make view-only**.

Base-level field permissions override the Interface: a field the user cannot edit in the base is not editable here
either.

## Page 1. Today

Who is coming in today.

| | |
|---|---|
| Source | `Appointments` |
| Filter by | `start_dt` **is** **today** **And** `status` **is any of** `booked`, `reminded`, `confirmed` |
| Sort by | `start_dt` ascending |
| Fields | `start_iso`, `service_name`, `client_name`, `status`, `practitioner` |
| Edit records inline | off (read-only page) |

`start_iso` is the column to read the time from (it keeps the clinic's local offset). `start_dt` is stored in UTC and
exists for filtering and sorting.

## Page 2. Awaiting confirmation

Offers the client has not yet said YES to. They expire by themselves at `pending_expires_at`; nothing to do here
except see why a slot looks held.

| | |
|---|---|
| Source | `Appointments` |
| Filter by | `status` **is** `pending` |
| Sort by | `pending_expires_at` ascending |
| Fields | `appt_id`, `client_name`, `service_name`, `start_iso`, `pending_expires_at` |
| Edit records inline | off |

## Page 3. Flagged & escalated

Clients the bot has stopped answering on its own, or flagged after a late cancellation.

| | |
|---|---|
| Source | `Clients` |
| Filter by | `status` **is any of** `flagged`, `escalated` |
| Sort by | `last_visit` descending (optional) |
| Fields | `name`, `phone`, `telegram_chat_id`, `language`, `status`, `notes` |
| Edit records inline | **on**; **Make view-only** on every field except `status` |

The owner clears an escalation by changing `status` to `active` (or `new`). The row then leaves the page. `notes` is
read-only here on purpose, see the paragraph at the end.

## Page 4. After visit

Visits whose time has passed and that still sit in a pre-visit status, so the owner can close them.

| | |
|---|---|
| Source | `Appointments` |
| Filter by | `status` **is any of** `confirmed`, `reminded`, `booked` **And** `start_dt` **is before** **today** |
| Sort by | `start_dt` ascending |
| Fields | `start_iso`, `client_name`, `service_name`, `client_intake_completed`, `status`, `practitioner`, `treatment_notes`, `next_visit_in` |
| Edit records inline | **on**; **Make view-only** on `start_iso`, `client_name`, `service_name`, `client_intake_completed` |

Editable: `status` (set it to `done` or `no_show`), `treatment_notes`, `next_visit_in` (days until the next visit
should be offered), `practitioner`. Setting `status` to `done` removes the row from the page.

**Trade-off in the filter.** The Interface filter builder offers no "now" for a date condition (the choices are
**today**, **tomorrow**, **yesterday**, **exact date** and similar). `start_dt` **is before** **today** therefore
means "any day before today": a visit that ended this afternoon appears tomorrow, not an hour later. If the owner
wants today's finished visits too, use `start_dt` **is on or before** **today** instead; the price is that today's
upcoming visits show on the page as well, so the owner has to read the time column. The default is the stricter one so
that nothing future is ever closed by mistake.

## Time zones

`start_dt` is a date-time field stored in UTC. A filter such as **today** is evaluated against that field's time
zone, so for visits in the first hours after local midnight the day can differ from the clinic's wall clock. For a
clinic that opens in the morning this does not matter; for a late-night clinic, check once at onboarding with a test
appointment.

## Why the bot never edits `notes` and the owner never edits `start_iso` by hand

The calendar is the source of truth for time. A booking exists as a Google Calendar event first; the `Appointments`
row (`start_iso`, `end_iso`, `start_dt`, `calendar_event_id`) is the bot's record of that event. If the owner edits
`start_iso` in Airtable, the row and the event now disagree: the event stays where it was while everything that reads the
row (reminders, the owner pages) now sees a different time, so the client is reminded for a slot the calendar does
not hold, and the real slot looks free to the next booking. To move a visit, ask the bot to reschedule it (or move the event in the calendar and tell the bot); both
paths change the event and the row together. That is why `start_iso` is a read-only column on every page.

The mirror rule is `Clients.notes`: it is the owner's free-text field about the client, and the bot reads it as
context (`find_client` passes it to the agent as `owner_notes`) but never writes it. If the bot wrote into `notes`, it
would overwrite or interleave with what the owner typed, and a note the owner wants to keep could be lost between two
runs. Anything the bot records about a client goes
into its own fields (`status`, `language`, `intake_completed`, `last_offer_json` and so on). So `notes` is the owner's,
`start_iso` is the calendar's, and the Interface keeps each of them on the right side of that line.

## Onboarding checklist for a new clinic (10 minutes)

1. Step 0: three Lookup fields in `Appointments`.
2. Create the interface `Front desk` and the four pages in the order above.
3. Check **Edit records inline** only on pages 3 and 4, and **Make view-only** on every field not marked editable.
4. **Publish**.
5. Invite the owner to the base as an **Editor** (or Commenter plus interface-only access, if the plan allows) and send
   her the link to the interface.
6. Smoke test: book a test appointment through the bot, see it on **Awaiting confirmation**, confirm it, see it on
   **Today** (if for today), cancel it. Set `status` of a test client to `flagged` and see it on page 3 and clear it.
