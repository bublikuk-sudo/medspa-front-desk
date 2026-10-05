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

**Final state.** `language=es`, `active`, the name contains "Lucía"; one `booked` appointment whose `start_iso` is
`2030-01-07Thh:mm:ss±hh:mm`; one event `Botox — <name>`.

**Check.** On the VPS: `tests/dialogs.sh 11`.

```dialog
profile: Lucía Pruebas
send: ¡Hola! Me gustaría reservar Botox.
expect templates: reply
expect lang: es
expect regex: \bIA\b|inteligencia artificial
send: Me llamo Lucía Pruebas.
expect templates: reply
expect lang: es
send: El lunes 7 de enero de 2030 por la mañana, por favor.
expect templates: reply
expect lang: es
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
send: La primera, por favor.
expect templates: PENDING_SUMMARY
expect lang: es
send: sí
expect templates: BOOKED, BOOKED_INTAKE
expect lang: es
expect node: Confirm
expect no-node: LLM Affirmative
expect no-node: Agent
state: (.client.client_id // "") | startswith("C-test-")
state: .client.language == "es"
state: .client.status == "active"
state: (.client.name // "") | test("Luc[ií]a"; "i")
state: [.appts[].status] == ["booked"]
state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
```
