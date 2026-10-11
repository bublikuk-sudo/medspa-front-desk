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
| 6 | Хочу отменить запись. | `CANCEL_PENDING` in Russian, asking for «ДА»; request_cancel, nothing cancelled yet | `booked`, event, cancel question open |
| 7 | да | `CANCELLED` in Russian; the list YES answers the open cancel question: Cancel Visit, no LLM Affirmative, no Agent | `cancelled`, no event |

**Client's language (mini-task B, 2026-10-11).** Steps 6 and 7 were added. Every step also checks that no Latin word
reached the client except the clinic's and brands' names (Glow Aesthetics Med-Spa, HydraFacial, Botox) and the intake
link's parts (a word inside a URL is skipped). Words of one or two letters are not counted (`<b>` from the Telegram
format), and "AM"/"PM" after a time is checked on its own. The summary and the cancel question must name the reply word
«ДА» and the window «24 часа», which `send_message` writes before the translation. An "AI" in step 1 would fail this
check: the owner asked for no English at all, and the step's own regex expects ИИ. The booked state after step 5 was a
final-state check before; it is now an `expect state:` of step 5, because the dialog goes on to cancel.

**Final state.** `language=ru`, `active`, the name contains "Ольга"; one appointment, now `cancelled`, `start_iso` ISO
with an offset; no event left; no cancel question open.

**Check.** On the VPS: `tests/dialogs.sh 12`.

```dialog
profile: Ольга Тестова
send: Здравствуйте! Хочу записаться на ботокс.
expect templates: reply
expect lang: ru
expect regex: ИИ|искусственн
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
send: Меня зовут Ольга Тестова.
expect templates: reply
expect lang: ru
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
send: В понедельник, 7 января 2030 года, утром, пожалуйста.
expect templates: reply
expect lang: ru
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
send: Первый вариант, пожалуйста.
expect templates: PENDING_SUMMARY
expect lang: ru
expect regex: (?-i:ДА)
expect regex: 24 час
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
send: да
expect templates: BOOKED, BOOKED_INTAKE
expect lang: ru
expect node: Confirm
expect no-node: LLM Affirmative
expect no-node: Agent
expect regex: 24 час
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
expect state: [.appts[].status] == ["booked"]
expect state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
expect state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
send: Хочу отменить запись.
expect templates: CANCEL_PENDING
expect lang: ru
expect tool: request_cancel
expect node: Send Cancel Ask
expect no-node: Cancel Visit
expect regex: (?-i:ДА)
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
expect state: [.appts[].status] == ["booked"]
expect state: (.events | length) == 1
expect state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
send: да
expect templates: CANCELLED
expect lang: ru
expect node: Cancel Visit
expect no-node: LLM Affirmative
expect no-node: Agent
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
expect state: [.appts[].status] == ["cancelled"]
expect state: (.events | length) == 0
state: (.client.client_id // "") | startswith("C-test-")
state: .client.language == "ru"
state: .client.status == "active"
state: (.client.name // "") | test("Ольга")
state: [.appts[].status] == ["cancelled"]
state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
state: (.events | length) == 0
state: (.client.cancel_ask_appt_id // "") == ""
state: [.outbox[] | .template_key] | index("PENDING_SUMMARY") != null and index("BOOKED") != null and index("CANCEL_PENDING") != null and index("CANCELLED") != null
```
