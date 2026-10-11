# 11 — Spanish client

Plan Task 20, row 11: dialog 01's booking, entirely in Spanish. Replies, the summary and BOOKED are in Spanish, Clients
`language=es`, `start_iso` is ISO with an offset, the event is in the calendar. The plan names WhatsApp for this dialog;
it is played in both channel formats (the plan's Step 2 rule "every dialog except 09 and 10 in both channels"), so the
WhatsApp run is the one the table asks for. Contacts `wa:+15550000111`, `tg:9000000111`.

Dialog 01's reminder leg is not repeated here: the row's key checks do not include it, and the reminder path is
covered by dialog 01 in both channels.

**Preconditions.** None.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | ¡Hola! Me gustaría reservar Botox. | Spanish reply that says it is the clinic's AI assistant (IA) | Clients `language=es` |
| 2 | Me llamo Lucía Pruebas. | Spanish reply | — |
| 3 | El lunes 7 de enero de 2030 por la mañana, por favor. | Spanish reply with slot times | — |
| 4 | La primera, por favor. | `PENDING_SUMMARY` in Spanish | `pending` |
| 5 | sí | `BOOKED`, `BOOKED_INTAKE` in Spanish; "sí" is on the deterministic YES list: Confirm, no LLM check, no Agent | `booked`, event |
| 6 | Quiero cancelar mi cita, por favor. | `CANCEL_PENDING` in Spanish, asking for "SÍ"; request_cancel, nothing cancelled yet | `booked`, event, cancel question open |
| 7 | sí | `CANCELLED` in Spanish; the list YES answers the open cancel question: Cancel Visit, no LLM check, no Agent | `cancelled`, no event |

**Client's language (mini-task B, 2026-10-11).** Steps 6 and 7 were added. Every step checks that the client's
messages contain none of these English fragments:

- a weekday abbreviation in the English "Mon," form;
- "Jan" followed by a day number ("Jan 7");
- "AM"/"PM" after a time;
- an English weekday or month name, matched case-sensitively, so Spanish "mayo" or "Mayo" does not count;
- one of the words hour(s), minutes, day(s), reply, yes, cancel, booked, your, you, the, would, which.

"min" and "NO" are correct Spanish, so they are not in the list. The
summary and the cancel question must name the reply word "SÍ" and the window "24 horas", which `send_message` writes
before the translation. The booked state after step 5 was a final-state check before; it is now an `expect state:` of
step 5, because the dialog goes on to cancel.

**Final state.** `language=es`, `active`, the name contains "Lucía"; one appointment, now `cancelled`, whose `start_iso` is
`2030-01-07Thh:mm:ss±hh:mm`; no event left; no cancel question open.

**Check.** On the VPS: `tests/dialogs.sh 11`.

```dialog
profile: Lucía Pruebas
send: ¡Hola! Me gustaría reservar Botox.
expect templates: reply
expect lang: es
expect regex: \bIA\b|inteligencia artificial
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: Me llamo Lucía Pruebas.
expect templates: reply
expect lang: es
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: El lunes 7 de enero de 2030 por la mañana, por favor.
expect templates: reply
expect lang: es
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: La primera, por favor.
expect templates: PENDING_SUMMARY
expect lang: es
expect regex: (?-i:SÍ)
expect regex: 24 horas
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: sí
expect templates: BOOKED, BOOKED_INTAKE
expect lang: es
expect node: Confirm
expect no-node: LLM Affirmative
expect no-node: Agent
expect regex: 24 horas
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect state: [.appts[].status] == ["booked"]
expect state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
expect state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
send: Quiero cancelar mi cita, por favor.
expect templates: CANCEL_PENDING
expect lang: es
expect tool: request_cancel
expect node: Send Cancel Ask
expect no-node: Cancel Visit
expect regex: (?-i:SÍ)
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect state: [.appts[].status] == ["booked"]
expect state: (.events | length) == 1
expect state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
send: sí
expect templates: CANCELLED
expect lang: es
expect node: Cancel Visit
expect no-node: LLM Affirmative
expect no-node: Agent
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect state: [.appts[].status] == ["cancelled"]
expect state: (.events | length) == 0
state: (.client.client_id // "") | startswith("C-test-")
state: .client.language == "es"
state: .client.status == "active"
state: (.client.name // "") | test("Luc[ií]a"; "i")
state: [.appts[].status] == ["cancelled"]
state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
state: (.events | length) == 0
state: (.client.cancel_ask_appt_id // "") == ""
state: [.outbox[] | .template_key] | index("PENDING_SUMMARY") != null and index("BOOKED") != null and index("CANCEL_PENDING") != null and index("CANCELLED") != null
```
