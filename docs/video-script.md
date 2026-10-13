# Demo video script (60-90 seconds)

Filmed by the owner on a phone, plus screen recordings of Google Calendar and Airtable. WhatsApp only (the channel the
clinic buys). No narration needed; one caption per shot. No real phone numbers, names or keys on screen: use a demo
client name, and crop or blur the phone's own number and the WhatsApp header if it shows one.

| Time | Shot | On screen | Caption |
|---|---|---|---|
| 0-10 s | Phone, WhatsApp chat with the clinic | The client types "Hi! I'd like to book Botox." The bot answers that it is the clinic's AI assistant and asks for the name. | "A client writes to the clinic on WhatsApp." |
| 10-40 s | Phone, same chat | Name, then a day and part of day; the bot lists free times; the client picks one; the bot sends the summary "Botox (30 min) — ... Reply YES to confirm."; the client replies YES; the confirmation and the intake-form link arrive. | "Real free slots. The client confirms, not the AI." |
| 40-60 s | Screen: Google Calendar, then Airtable | The new event `Botox — <client name>` with no attendees; the `Appointments` row with status `booked` and the client row. | "Calendar and database updated; it re-checks the calendar before booking." |
| 60-80 s | Phone, same chat | The reminder arrives ("Reminder: Botox — ... Reply YES to confirm or NO to cancel."), the client replies YES, the bot thanks them. | "Reminder before the visit, answered in one word." |
| 80-90 s | Screen: Airtable Interface, page "Today" | The visit in today's list with status `confirmed`. | "The clinic's dashboard. Self-hosted n8n, Claude, Airtable, Google Calendar." |

## Production notes

- **Phone number.** With the Meta test number, the filming phone must be one of the 5 recipients added and verified in
  the Meta dashboard.
- **Booking.** Book the filmed visit for TOMORROW, inside `Settings.working_hours`. The confirmation reads "We'll send
  you a reminder the day before", as in production. The "Today" shot is filmed the next morning (or show the row on
  "Awaiting confirmation" / in the Appointments table instead).
- **Making the reminder arrive on camera.** WF-5 runs once a day at 07:05 UTC and reminds every visit of tomorrow (by
  the clinic's calendar, `Settings.timezone`) that was booked at least `reminder_hours_before` before its start, so with
  the default 24 hours a visit booked today for tomorrow is reminded only if it was booked a full day ahead. After the
  booking shots, use the method of the live tests: set `Settings.reminder_hours_before` to `1` (the visit booked a
  moment ago for tomorrow is then due at once), then run WF-5 with
  `scripts/remote.sh 'scripts/n8n-run.sh wf5-reminders'`.
  **Set `reminder_hours_before` back to `24` straight after**, and do this only when no real client has a visit
  tomorrow or in the next hour: with the value 1 the run reminds every such visit booked an hour or more ahead.
- On WhatsApp the reminder goes out as the approved template `medspa_reminder`, so it arrives whether or not the
  24-hour window is open.
- **Clean up** afterwards: cancel the visit through the bot (or in Airtable and the calendar) and remove the demo client.
- Optional frame for `docs/img/demo.png` (README): the summary, the YES and the confirmation in one screenshot.
