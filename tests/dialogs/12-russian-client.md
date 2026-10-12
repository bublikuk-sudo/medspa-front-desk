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
«ДА» and the window «24 часа», which `send_message` writes before the translation. A Latin word of one or two letters
("AI", "OK") is not caught by this check; in step 1 the step's own regex still requires «ИИ» or «искусственн…».

A Russian reply that names a service in Latin letters other than HydraFacial and Botox (for example "Dermal Filler" or
"Chemical Peel" in a list of services) fails the check. That is a finding to judge from the log: an untranslated
service name, not necessarily a bot defect. The booked state after step 5 was a
final-state check before; it is now an `expect state:` of step 5, because the dialog goes on to cancel.

**Translation quality (mini-task C, 2026-10-12).** From the live proof of B (`tests/dialog-runs/2026-10-12-client-language-tg.md`):

- every step checks the formal register: no ты, тебя, тебе, тобой, твой / твоя / твоё / твою / твои or another case of
  твой (finding 2, the register drift; the agent prompt now asks for вы too, so steps 1–3 get the check);
- steps 4 and 5 check that «до 24 час…» is gone (finding 5: «Бесплатная отмена до 24 часа до процедуры» in
  PENDING_SUMMARY, «до 24 часа до вашего визита» in BOOKED);
- steps 4–7, the translated templates, check that the brand name keeps its Latin spelling: no «ботокс» (finding 4:
  CANCEL_PENDING «вашу Ботокс» next to CANCELLED «Ваш Botox»). The agent's own replies in steps 1–3 may still write
  «ботокс»; they are not translations.

Cyrillic words are bounded with `(?<!\p{L})` / `(?!\p{L})`, not `\b`. jq 1.7 on the VPS matched these regexes, case-
insensitively, on correct and faulty samples (mini-task C report). Step 1's «ИИ» check is also the live check of the
agent prompt's AI-disclosure wording (mini-task C, requirement 9).

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
expect no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
send: Меня зовут Ольга Тестова.
expect templates: reply
expect lang: ru
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
expect no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
send: В понедельник, 7 января 2030 года, утром, пожалуйста.
expect templates: reply
expect lang: ru
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
expect no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
send: Первый вариант, пожалуйста.
expect templates: PENDING_SUMMARY
expect lang: ru
expect regex: (?-i:ДА)
expect regex: 24 час
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
expect no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
expect no-regex: (?<!\p{L})до\s+24\s+час
expect no-regex: ботокс
send: да
expect templates: BOOKED, BOOKED_INTAKE
expect lang: ru
expect node: Confirm
expect no-node: LLM Affirmative
expect no-node: Agent
expect regex: 24 час
expect no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
expect no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
expect no-regex: (?<!\p{L})до\s+24\s+час
expect no-regex: ботокс
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
expect no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
expect no-regex: ботокс
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
expect no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
expect no-regex: ботокс
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
