# Case card: AI front desk for a med-spa (WhatsApp)

**The problem and the result.** Clinics and salons post the same request: book appointments in WhatsApp around the
clock, check real calendar slots without double bookings, remind clients before the visit, and make the whole thing a
template that a new client can be put on quickly. This bot books, reschedules and cancels in WhatsApp (and Telegram),
answers questions from the clinic's own knowledge base, reminds clients and hands over to a person when it should; the
client, not the model, confirms every booking. It tells new clients it is the clinic's AI assistant, never asks for
health information, and never creates a calendar invite that emails the client.

**How it is built.** Self-hosted n8n on a small VPS, Claude as the agent, Airtable for clients, appointments and the
price list, Google Calendar for time, a pgvector knowledge base with a relevance gate so the bot says "I don't know"
instead of guessing. Six workflow groups: inbound, agent, booking tools, knowledge, reminders, error handler. The agent
can only propose a booking; the client's YES goes through a deterministic gate in n8n, which re-checks the calendar
before it writes the event. A failing workflow alerts the owner and stays active, so one error does not silence the
bot. Tested at two levels: 97 tool cases, and 12 end-to-end dialogs in both channel formats that check calendar and
database state rather than the model's wording.

**What the clinic gets.** A template deployed per clinic from a checklist (one settings row, the price list, the
clinic's knowledge text, and its own keys), with every account on the clinic's card and a written handover. Full
documentation: architecture, data model, what is deliberately not stored, GDPR checklist, running costs, accepted risks.
The test suites, and a 60-90 second video of a real WhatsApp booking.

Screenshots:

1. WhatsApp: the client's request, the summary built from the booking row, the client's YES and the confirmation.
2. Google Calendar: the event `{service} — {client name}`, no attendees.
3. Airtable Interface, page "Today": today's visits with service, client and status.
