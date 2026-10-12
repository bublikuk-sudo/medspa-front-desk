# Airtable Interface for the clinic owner

The owner's day-to-day view of the MedSpa Front Desk base: five pages in one Airtable Interface. It is built by hand in
the Airtable UI (the Meta API cannot create Interfaces) and takes about 10 minutes at onboarding. No screenshots: every
step names the control exactly as Airtable words it (this guide follows Airtable's current Interface Designer as built on
2026-10-12). Airtable renames controls from time to time; where the current wording differs from this guide, the intent of
the step is the same.

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
4. All five pages use the layout **List**. There is no Grid page: the **Grid** visualization was removed from **Today**
   so that only **List** remains. The "Generate with Omni" option is not used.
5. Each page: hover the interface name in the left panel and click the `+` ("Add page to interface"). In "Choose a
   layout" pick **List** and click **Next**. In "Connect to a table" choose the table and click **Finish**.
6. When all five pages are done, click **Publish** (top right). The "Publish interfaces" dialog opens; click
   **Publish** in it. **Done** only saves a draft; collaborators see nothing until **Publish**. A "Share new
   interface?" prompt follows; while no users are invited yet, answer **Not now**.

For every page, configure the right-hand properties panel in Edit mode. Click the page header for the page settings:

- **Title**: the page name.
- **Data** > **Source**: the table. **Levels** is left as it is ("Customize record name" there only renames the word
  for a record, it does not choose the title field).
- **Filter by**: a popover. Click **Add condition**, choose the field, the operator and the value; conditions are
  joined by **and**. These filters are fixed by the builder; the viewer cannot change them.
- **Appearance** > **Visualizations**: **List** only.
- **User filters** and **User actions** (the **Sort**, **Search**, **Filter**, **Group**, **Row height** toggles): left on.
- **Advanced**: left as it is.

Then click inside the list (or a column header area); the panel shows "Page > List":

- **Sort by**: a popover with a field and the direction ("Earliest -> Latest" for dates, "A -> Z" for text). The default
  sort is stored with the list.
- **Group by**, **Prefix field**: left empty.
- **Fields** ("N visible", with a cog): the columns. Add one with the `+` at the end of the column headers (search the
  field, press Enter). Hide one with its **Actions** (`...`) menu > **Hide field**. Show the columns in the order given
  below and hide everything else.
- **User actions**: **Edit records inline**, **Add records inline**, **Delete records inline**, **Click into record
  details**.

**The first column is the table's primary field and cannot be hidden.** In `Appointments` it is `appt_id`, in `Clients`
it is `client_id`. It is read-only on every page.

**Empty page.** **Fields**, **Sort by** and **User actions** appear only while at least one record is on screen. On a
page whose filter currently matches nothing, widen the filter temporarily (for example add one more status), configure
the list, then restore the filter.

**Per-field editability.** Select a column header; the panel shows "List > Field". Under **User actions** the switch
**Edit this column inline** decides whether that one column is editable. When **Edit records inline** is on, every
column starts editable, so switch it off for each column that must stay read-only. Lookup columns (`client_name`,
`service_name`, `client_intake_completed`) are computed and never editable; their switch is greyed out.

**On every page:**

- **Add records inline** and **Delete records inline**: **off**. The bot owns the rows; a row created or deleted by hand
  has no calendar event (or leaves an orphan one).
- **Click into record details**: **off**. The expanded record can show fields beyond the page's own column list,
  including `start_iso`, `end_iso` and `calendar_event_id`.
- **Edit records inline**: **on** only where the page says "editable", and then only the named columns.

**Never editable on any page:** `start_iso`, `end_iso`, `start_dt`, `calendar_event_id` (Appointments) and `notes`
(Clients). If a page ever leaves one of them editable, switch **Edit this column inline** off before publishing.

Base-level field permissions override the Interface: a field the user cannot edit in the base is not editable here
either. They do not work in the other direction, so an Interface setting never protects the base itself, see the
onboarding checklist.

## Page 1. Today

Who is coming in today.

| | |
|---|---|
| Layout | **List** |
| Source | `Appointments` |
| Filter by | `start_dt` **is** **today** **and** `status` **is any of** `booked`, `reminded`, `confirmed` |
| Sort by | `start_dt` Earliest -> Latest |
| Fields | `appt_id`, `start_iso`, `service_name`, `client_name`, `practitioner`, `status` |
| User actions | **Edit records inline** off, **Add records inline** off, **Delete records inline** off, **Click into record details** off |

`appt_id` is the first (primary) column. `start_iso` is the column to read the time from (it keeps the clinic's local offset). `start_dt` is stored in UTC and
exists for filtering and sorting.

## Page 2. Awaiting confirmation

Offers the client has not yet said YES to. They expire at `pending_expires_at` (a YES after that gets "That offer has
expired"); the daily WF-5 run (07:05 UTC) then marks them cancelled, so an expired offer can stay on this page for up
to a day. Nothing to do here except see why a slot looks held.

| | |
|---|---|
| Layout | **List** |
| Source | `Appointments` |
| Filter by | `status` **is** `pending` |
| Sort by | `pending_expires_at` Earliest -> Latest |
| Fields | `appt_id`, `start_iso`, `client_name`, `service_name`, `pending_expires_at` |
| User actions | **Edit records inline** off, **Add records inline** off, **Delete records inline** off, **Click into record details** off |

## Page 3. Flagged & escalated

Clients the bot has stopped answering on its own, or flagged after a late cancellation.

| | |
|---|---|
| Layout | **List** |
| Source | `Clients` |
| Filter by | `status` **is any of** `flagged`, `escalated` |
| Sort by | none (`Clients.last_visit` is not written by any workflow, so it is always empty and sorting on it is meaningless) |
| Fields | `client_id`, `name`, `phone`, `telegram_chat_id`, `language`, `status`, `notes` |
| User actions | **Edit records inline** **on**, **Edit this column inline** on for `status` only; **Add records inline** off; **Delete records inline** off; **Click into record details** off |

The owner clears an escalation by changing `status` to `active` (or `new`). The row then leaves the page. `notes` is
read-only here on purpose, see the paragraph at the end.

Changing `status` away from `escalated` also resets the bot's memory of that conversation. On the client's next
message the bot deletes its chat history with that client (and only that client), then answers as usual: the client
is greeted afresh, as if writing for the first time, while their name, notes and visits stay in Airtable and the bot
still finds them. Without the reset the bot kept reading its own earlier "a team member will contact you" and went on
deferring. The same happens when the owner chooses `flagged`: any status other than `escalated` counts as resolved. If
the reset fails, the client is still answered, the owner gets a Telegram message starting "⚠️ Escalation reset", and
the client's next message tries again. The reset only follows an escalation the bot made (it stamps the hidden field
`escalated_at`); a client the owner set to `escalated` by hand keeps the old conversation. `escalated_at` is not shown
on this page; it needs a hand only when a "⚠️ Escalation reset" message asks to empty it (in the `Clients` table).

## Page 4. After visit

Visits whose time has passed and that still sit in a pre-visit status, so the owner can close them.

| | |
|---|---|
| Layout | **List** |
| Source | `Appointments` |
| Filter by | `status` **is any of** `booked`, `reminded`, `confirmed` **and** `start_dt` **is before** **today** |
| Sort by | `start_dt` Earliest -> Latest |
| Fields | `appt_id`, `start_iso`, `client_name`, `service_name`, `client_intake_completed`, `status`, `practitioner`, `treatment_notes`, `next_visit_in` |
| User actions | **Edit records inline** **on**, **Edit this column inline** on for `status`, `practitioner`, `treatment_notes`, `next_visit_in` only (`appt_id` and `start_iso` off; the lookup columns are read-only by nature); **Add records inline** off; **Delete records inline** off; **Click into record details** off |

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
| Layout | **List** |
| Source | `Clients` |
| Filter by | none |
| Sort by | `name` A -> Z |
| Fields | `client_id`, `name`, `phone`, `telegram_chat_id`, `language`, `status`, `marketing_consent` |
| User actions | **Edit records inline** **on**, **Edit this column inline** on for `marketing_consent` only; **Add records inline** off; **Delete records inline** off; **Click into record details** off |

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
a late-night clinic, check once at onboarding with a test appointment near midnight. The **today** value in a date
condition shows a small time-zone tag ("GM...") next to it.

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
2. Create the interface `Front desk` and the five pages, all with the **List** layout, in the order above.
3. Check the layout is **List** on all five pages. Check **Edit records inline** is on only for pages 3, 4 and 5, and
   that **Edit this column inline** is on only for the columns named in the page tables (`status` on page 3; `status`,
   `practitioner`, `treatment_notes`, `next_visit_in` on page 4; `marketing_consent` on page 5). On every page check
   **Add records inline** and **Delete records inline** are off and **Click into record details** is off. Check that
   `start_iso`, `calendar_event_id` and `Clients.notes` are not editable anywhere.
4. **Publish** > **Publish** in the "Publish interfaces" dialog. At "Share new interface?" choose **Not now** if no
   users are invited yet.
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
