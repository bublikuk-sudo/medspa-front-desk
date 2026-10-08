# Airtable Interface for the clinic owner

The owner's day-to-day view of the MedSpa Front Desk base: five pages in one Airtable Interface. It is built by hand in
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
4. The layout picker opens ("Choose a layout to create a new interface page"). Pages 1 and 2 (read-only) use the table
   layout **Grid**; if your picker offers no **Grid**, use **List**. Pages 3, 4 and 5 (the editable ones) use **List**,
   always: Airtable documents per-field **Make view-only** for **List**, and the Grid documentation names only the
   page-wide **Edit records inline** toggle. Read "column" as "field" in **List**.
5. Each further page: hover the interface name in the left panel and click the `+` button, which opens the same
   layout picker.
6. When all five pages are done, click **Publish** (top right). **Done** only saves a draft; collaborators see nothing
   until **Publish**.

For every page: pick the layout, choose the **Source** table, click **Finish**, then configure the right-hand
properties panel in Edit mode:

- **Page** > **Title**: the page name.
- **Data** > **Source**: the table. **Filter by**: **Add condition** for each line of the filter. The conjunction
  defaults to **And**. These filters are fixed by the builder; the viewer cannot change them. **Sort by**: the sort.
- **Fields**: "pick which fields are visible", in the order shown below. Hide everything else.
- **User actions** > **Edit records inline**: on only where the page says "editable". Then open the cogwheel next to
  the field list, hover each field that must stay read-only, click the `...`, and click **Make view-only**.
- **User actions** > **Add/delete records inline**: **off** on every page. The bot owns the rows; a row created or
  deleted by hand has no calendar event (or leaves an orphan one).
- **User actions** > **Click into record details**: **off** on every page. The expanded record can show fields beyond
  the page's own field list, including `start_iso`, `end_iso` and `calendar_event_id`. If the toggle cannot be turned
  off, open the record detail layout (cogwheel next to it) and set **Permissions** to **View-only**, with only the
  fields this page makes editable set to **Editable**.

**Never editable on any page:** `start_iso`, `end_iso`, `start_dt`, `calendar_event_id` (Appointments) and `notes`
(Clients). If the UI offers no per-field view-only for the layout you are on, stop and take a screenshot instead of
publishing a page that makes one of them editable.

Base-level field permissions override the Interface: a field the user cannot edit in the base is not editable here
either. They do not work in the other direction, so an Interface setting never protects the base itself, see the
onboarding checklist.

## Page 1. Today

Who is coming in today.

| | |
|---|---|
| Layout | **Grid** (fallback **List**) |
| Source | `Appointments` |
| Filter by | `start_dt` **is** **today** **And** `status` **is any of** `booked`, `reminded`, `confirmed` |
| Sort by | `start_dt` ascending |
| Fields | `start_iso`, `service_name`, `client_name`, `status`, `practitioner` |
| User actions | **Edit records inline** off, **Add/delete records inline** off, **Click into record details** off |

`start_iso` is the column to read the time from (it keeps the clinic's local offset). `start_dt` is stored in UTC and
exists for filtering and sorting.

## Page 2. Awaiting confirmation

Offers the client has not yet said YES to. They expire at `pending_expires_at` (a YES after that gets "That offer has
expired"); the daily WF-5 run (07:05 UTC) then marks them cancelled, so an expired offer can stay on this page for up
to a day. Nothing to do here except see why a slot looks held.

| | |
|---|---|
| Layout | **Grid** (fallback **List**) |
| Source | `Appointments` |
| Filter by | `status` **is** `pending` |
| Sort by | `pending_expires_at` ascending |
| Fields | `appt_id`, `client_name`, `service_name`, `start_iso`, `pending_expires_at` |
| User actions | **Edit records inline** off, **Add/delete records inline** off, **Click into record details** off |

## Page 3. Flagged & escalated

Clients the bot has stopped answering on its own, or flagged after a late cancellation.

| | |
|---|---|
| Layout | **List** (not Grid: per-field **Make view-only** is documented for **List**) |
| Source | `Clients` |
| Filter by | `status` **is any of** `flagged`, `escalated` |
| Sort by | none (`Clients.last_visit` is not written by any workflow, so it is always empty and sorting on it is meaningless) |
| Fields | `name`, `phone`, `telegram_chat_id`, `language`, `status`, `notes` |
| User actions | **Edit records inline** **on**, **Make view-only** on every field except `status`; **Add/delete records inline** off; **Click into record details** off |

The owner clears an escalation by changing `status` to `active` (or `new`). The row then leaves the page. `notes` is
read-only here on purpose, see the paragraph at the end.

## Page 4. After visit

Visits whose time has passed and that still sit in a pre-visit status, so the owner can close them.

| | |
|---|---|
| Layout | **List** (not Grid: per-field **Make view-only** is documented for **List**) |
| Source | `Appointments` |
| Filter by | `status` **is any of** `confirmed`, `reminded`, `booked` **And** `start_dt` **is before** **today** |
| Sort by | `start_dt` ascending |
| Fields | `start_iso`, `client_name`, `service_name`, `client_intake_completed`, `status`, `practitioner`, `treatment_notes`, `next_visit_in` |
| User actions | **Edit records inline** **on**, **Make view-only** on `start_iso`, `client_name`, `service_name`, `client_intake_completed`; **Add/delete records inline** off; **Click into record details** off |

Editable: `status` (set it to `done` or `no_show`), `treatment_notes`, `next_visit_in` (days until the next visit
should be offered), `practitioner`. Setting `status` to `done` removes the row from the page.

**Trade-off in the filter.** The Interface filter builder offers no "now" for a date condition (the choices are
**today**, **tomorrow**, **yesterday**, **exact date** and similar). `start_dt` **is before** **today** therefore
means "any day before today": a visit that ended this afternoon appears tomorrow, not an hour later. If the owner
wants today's finished visits too, use `start_dt` **is on or before** **today** instead; the price is that today's
upcoming visits show on the page as well, so the owner has to read the time column. The default is the stricter one so
that nothing future is ever closed by mistake.

## Page 5. Clients and marketing consent

Every client, so the owner can record a marketing opt-in. `marketing_consent` is the only field the owner edits here:
the revisit invitation (a MARKETING template) goes only to a client with the box ticked, and the bot never ticks it.

| | |
|---|---|
| Layout | **List** (not Grid: per-field **Make view-only** is documented for **List**) |
| Source | `Clients` |
| Filter by | none |
| Sort by | `name` ascending |
| Fields | `name`, `phone`, `telegram_chat_id`, `language`, `status`, `marketing_consent` |
| User actions | **Edit records inline** **on**, **Make view-only** on every field except `marketing_consent`; **Add/delete records inline** off; **Click into record details** off |

Tick `marketing_consent` only when the client has agreed (for example in the clinic's intake and consent form); untick
it when they withdraw. A visit whose client has no consent stays due, so a box ticked later still lets the invitation go
out on the next daily WF-5 run.

## Time zones

`start_dt` is a date-time field with time zone `utc`. A filter such as **today** MAY be evaluated against that
field's zone rather than the clinic's (not verified against Airtable's documentation). For a clinic in Europe/Berlin
(UTC+1 in winter, UTC+2 in summer) that has two visible effects: a visit between 00:00 and 01:00 local in winter, or
between 00:00 and 02:00 local in summer, falls on the previous UTC day, so it can land on the wrong day on **Today**; and
a visit just after local midnight can show on **After visit** before it has happened, because the page already counts the
new day while the stored UTC day is still the old one. For a clinic that opens in the morning this does not matter; for
a late-night clinic, check once at onboarding with a test appointment near midnight.

## Why the bot never edits `notes` and the owner never edits `start_iso` by hand

The calendar is the source of truth for time. A booking exists as a Google Calendar event first; the `Appointments`
row (`start_iso`, `end_iso`, `start_dt`, `calendar_event_id`) is the bot's record of that event, and nothing syncs a
change in either direction after the booking. Availability is read from the calendar (`check_availability` asks Google
FreeBusy), not from the rows. If the owner edits `start_iso` by hand, the event stays at the old time, so the old slot
stays busy, while the row now claims a new time that has no event behind it: another client can be offered that new
time and booked into it, and the reminder goes out for a time the calendar does not hold. Editing the calendar event
instead is no better: no workflow copies a calendar change back into `Appointments`, and the bot has no owner-move
flow. The only supported way to move a visit is a client reschedule through the bot, which creates the new booking
(event and row together) and then cancels the old one. That is why `start_iso` is a read-only column on every page.

The mirror rule is `Clients.notes`: it is the owner's free-text field about the client, and the bot reads it as
context (`find_client` passes it to the agent as `owner_notes`) but never writes it. If the bot wrote into `notes`, it
would overwrite or interleave with what the owner typed, and a note the owner wants to keep could be lost between two
runs. Anything the bot records about a client goes
into its own fields (`status`, `language`, `intake_completed`, `last_offer_json` and so on). So `notes` is the owner's,
`start_iso` is the calendar's, and the Interface keeps each of them on the right side of that line.

## Onboarding checklist for a new clinic (10 minutes)

1. Step 0: three Lookup fields in `Appointments`.
2. Create the interface `Front desk` and the five pages in the order above.
3. Check the layout: **Grid** (or **List**) for pages 1 and 2, **List** for pages 3, 4 and 5. Check **Edit records
   inline** only on pages 3, 4 and 5, and **Make view-only** on every field not marked editable. On every page check **Add/delete
   records inline** is off and **Click into record details** is off. Check that `start_iso`, `calendar_event_id` and
   `Clients.notes` are not editable anywhere; if the UI offers no per-field view-only, stop and take a screenshot.
4. **Publish**.
5. Give clinic staff interface-only access, which is the primary recommendation: click **Share** on the interface and
   choose **Interface-only editor** (pages 3, 4 and 5 need editing) or **Interface-only viewer**. Interface-only access is a
   paid-plan feature (sharing an interface separately from the base is restricted to paid plans). If the plan does not
   allow it, the fallback is to invite the person to the base itself.
   **Warning:** a user who is a base **Editor** (or higher) can open the **Data** tab and edit `start_iso` and every
   other field directly; the Interface restrictions do not apply there. Never make clinic staff base Editors if
   interface-only access is available; if you must, tell them in writing never to edit `start_iso`.
   Send her the link to the interface.
   Source status: the interface-only labels (**Share**, **Interface-only viewer / commenter / editor**) and the paid-plan
   restriction are taken from Airtable's own documentation; the base-role label **Editor** and the exact **Share** dialog
   wording are unverified in a live account.
6. Smoke test: book a test appointment through the bot, see it on **Awaiting confirmation**, confirm it, see it on
   **Today** (if for today), cancel it. Set `status` of a test client to `flagged` and see it on page 3 and clear it.
