# 12 — Russian client

Plan Task 20, row 12: as dialog 11 in Russian; the confirmation is the word «да», which the deterministic YES list of
WF-1's Classify recognises — the run takes the `confirm` route through Confirm, without the LLM check (`LLM Affirmative`)
and without the Agent. The plan names Telegram; it is played in both channel formats (Step 2 rule), so the Telegram run is
the one the table asks for. Contacts `tg:9000000112`, `wa:+15550000112`.

The reminder leg is not repeated (see dialog 11).

**Preconditions.** None.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Здравствуйте! Хочу записаться на ботокс. | Russian reply that says it is the clinic's AI assistant (ИИ) | Clients `language=ru` |
| 2 | Меня зовут Ольга Тестова. | Russian reply | — |
| 3 | В понедельник, 7 января 2030 года, утром, пожалуйста. | Russian reply with slot times | — |
| 4 | Первый вариант, пожалуйста. | `PENDING_SUMMARY` in Russian | `pending` |
| 5 | да | `BOOKED`, `BOOKED_INTAKE` in Russian; Confirm, no LLM Affirmative, no Agent | `booked`, event |

**Final state.** `language=ru`, `active`, the name contains "Ольга"; one `booked` appointment, `start_iso` ISO with an
offset; one event `Botox — <name>`.

**Check.** On the VPS: `tests/dialogs.sh 12`.

```dialog
profile: Ольга Тестова
send: Здравствуйте! Хочу записаться на ботокс.
expect templates: reply
expect lang: ru
expect regex: ИИ|искусственн
send: Меня зовут Ольга Тестова.
expect templates: reply
expect lang: ru
send: В понедельник, 7 января 2030 года, утром, пожалуйста.
expect templates: reply
expect lang: ru
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
send: Первый вариант, пожалуйста.
expect templates: PENDING_SUMMARY
expect lang: ru
send: да
expect templates: BOOKED, BOOKED_INTAKE
expect lang: ru
expect node: Confirm
expect no-node: LLM Affirmative
expect no-node: Agent
state: (.client.client_id // "") | startswith("C-test-")
state: .client.language == "ru"
state: .client.status == "active"
state: (.client.name // "") | test("Ольга")
state: [.appts[].status] == ["booked"]
state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
```
