# Cancel templates name the appointment (F): phase 2 deploy and live proof (2026-10-13)

Owner's go-ahead in chat (2026-10-13): "да, правь шаблоны отмены и залей с проверкой (диалоги 12 и 13". Run by the
controller. Why: in the E proof (`2026-10-13-brand-protection-tg.md`, Findings), the masked service name made
"Your {service} on {when}" come out as «Ваш прием у Botox» / «Ihr Termin bei Botox» and «Отменить вашу Botox».

## Deploy (controller's report; the command output is in the ledger `progress.md`, not reproduced here)

Two pushes of `send_message` only, each with `--activate`. Before each, the live file was pulled and compared with
`jq -S` (normalising `webhookId` / `phoneNumberId`) against the previous commit; after each, it was pulled back and
compared against the pushed commit. Every comparison was CONTENT-IDENTICAL; `tests/channels-check.sh` printed
`channels ok` each time.

| push | wording of the six templates | drift check against | read-back against | stubs |
|---|---|---|---|---|
| 1, ~11:01-11:02Z | "your {service} appointment on {when}" | `d2c0813` (= `8f5fd04`) | `bc44ec5` | send-message 318/0, wf1 321/0, check_availability 27/0 |
| 2, 11:44Z | "your appointment for {service} on {when}" | `bc44ec5` | `896a4b8` | send-message 318/0, wf1 321/0, check_availability 27/0 |

Where the stub suites ran, per the controller's report, for both pushes: the send-message stubs ran on the pulled live
file (`/tmp/sm-live.json` on the VPS, the read-back of the push); the wf1 stubs ran on the repo copy that `remote.sh` had
just synced to the VPS; the check_availability stubs ran from the workstation on the repo files (its header requires
that). The ledger itself records the pulled live file only for push 1 (`progress.md` line 696: "send-message 318/0
(pulled live file), wf1 321/0, check_availability 27/0 (workstation)"); for push 2 it says only "stubs 318/0, 321/0,
27/0" (line 704). Also per the controller's report (not in the ledger): `jq -S` was used for the push 2 comparisons under
the same normalisation as push 1, and push 2 pushed `send_message` only (remote command `n8n-push.sh
workflows/shared/send_message.json --activate`). The stub suites of each push ran before the next dialog started (the
stub completion times were not recorded). The six templates are REMINDER_CONFIRMED, REMINDER_CANCELLED, CANCEL_PENDING, LATE_CANCEL_PENDING,
CANCELLED and LATE_CANCEL; REMINDER and REVISIT (WhatsApp templates) were not changed.

## Results

| run | wording live | result | note |
|---|---|---|---|
| 12 ru, run 1 (after push 1) | "your {service} appointment" | FAIL at step 6 | only F's new check: CANCEL_PENDING «Отменить вашу Botox запись на пн, 7 янв., 10:00? Ответьте ДА для отмены.» (run 1 raw line 63; the failed check at raw line 75; `RESULT FAIL` at raw line 86). The translator kept the English word order of "your ⟦1⟧ appointment". Steps 1-5 passed; step 7 did not run. This led to push 2 |
| 12 ru, run 2 (after push 2) | "your appointment for {service}" | PASS, steps 1-7 | CANCEL_PENDING «Отменить Вашу запись на Botox на пн, 7 янв., 10:00? Ответьте ДА для отмены.» (raw line 63); CANCELLED «Ваша запись на Botox на пн, 7 янв., 10:00 отменена. …» (raw line 81); `RESULT PASS` (raw line 110) |
| 13 de (after push 2) | "your appointment for {service}" | PASS, steps 1-7 | CANCEL_PENDING «Möchten Sie Ihren Termin für Botox am Mo., 7. Jan., 10:00 absagen? …» (raw line 55); CANCELLED «Ihr Termin für Botox am Mo., 7. Jan., 10:00 wurde storniert. …» (raw line 69); `RESULT PASS` (raw line 95) |

- In the passing runs, the cancel messages put the service after a preposition: «запись на Botox», «Termin für Botox».
  The E findings («прием у Botox», «Termin bei Botox», «вашу Botox») did not recur, and the F checks at dialog 12
  steps 6-7 and dialog 13 step 7 passed. This is one run per language: the translator is probabilistic, so it shows the
  wording works, not that it always will.
- Brand and cancellation window, as in E: Latin `Botox` in every translated message that names the service, and
  «не позднее чем за 24 часа до визита» in ru PENDING_SUMMARY and BOOKED (run 2 raw lines 31, 44). The E checks
  passed in dialog 12 (the brand regexes exist only in dialog 12; for de, the Latin `Botox` is shown by the delivered
  texts, not by a check).
- Masking (block "Merge outcomes" below, read-only script `e-merge-outcomes.sh` over the `send_message` executions):
  - push 2 window: 16 executions. 10 went through Translate; in 8 of them Render masked `Botox` as `⟦1⟧` (the two
    BOOKED_INTAKE messages name no service). Merge Text gave `retranslate=false` for all 10 and Merge Again never ran.
    The delivered texts carry Latin `Botox`, so the token path held in the 8 masked messages.
  - push 1 window (run 1): 7 executions, 3 masked, all `retranslate=false`.
  - The Merge Again fallback did not fire in any run here, so it remains proven by stubs only.
- The agent's own ru replies (not translated) still write «ботокс» (run 2 raw line 14, 21), as noted in the E log.
- The runner prints each message with whitespace collapsed and cut at 240 characters, which is why de BOOKED (raw line
  40) ends mid-word.
- Cleanup ran before and after each dialog (`cleanup done`, `calendar cleanup: ok DELETED 0`). The after-cleanup of run 1
  also deleted the 1 booking event left by the aborted run (`booking events: ok DELETED 1 of 1`, run 1 raw line 88).

## Merge outcomes, push 2 window (script arguments 2026-10-13T11:45:00 2026-10-13T11:51:00, per the controller's report: chosen around the dialogs' start and end times, not printed in the output; block verbatim)

The script prints Render's `masked_text` (the plain text for messages that are not translated) with whitespace collapsed
and cut at 120 characters. Rows 29003-29052 are dialog 12 run 2, rows 29076-29125 are dialog 13.

```
exec 29003 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, при желании я передам беседу сотруднику. Подскажите, пожал
exec 29006 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Приятно познакомиться, Ольга! На какой день и время суток (утро, день или вечер) вам удобно записаться на ботокс?
exec 29010 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: На ботокс свободно: пн, 7 янв. 2030 г., 10:00; пн, 7 янв. 2030 г., 10:30; пн, 7 янв. 2030 г., 11:00; пн, 7 янв. 2030 г.,
exec 29014 success key=PENDING_SUMMARY translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: ⟦1⟧ (30 мин) — пн, 7 янв., 10:00. You can cancel free of charge no later than 24 часа before the visit. Reply ДА to conf
exec 29018 success key=BOOKED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: You're booked: ⟦1⟧ (30 мин) — пн, 7 янв., 10:00. We'll send you a reminder the day before. To change or cancel, just mes
exec 29019 success key=BOOKED_INTAKE translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Before your first visit, please complete our short intake and consent form (about 5 минут): https://example.com/intake-f
exec 29036 success key=CANCEL_PENDING translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Cancel your appointment for ⟦1⟧ on пн, 7 янв., 10:00? Reply ДА to cancel.
exec 29052 success key=CANCELLED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Your appointment for ⟦1⟧ on пн, 7 янв., 10:00 has been cancelled. Message me any time to book again.
exec 29076 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Hallo und willkommen bei Glow Aesthetics Med-Spa! Ich bin die KI-Assistentin der Klinik – auf Wunsch übernimmt gerne ein
exec 29079 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Vielen Dank, Herr Testmann. An welchem Tag und zu welcher Tageszeit hätten Sie gern Ihren Botox-Termin?
exec 29083 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Gern, für Botox sind an diesem Tag folgende Zeiten frei: Mo., 7. Jan. 2030, 10:00 Mo., 7. Jan. 2030, 10:30 Mo., 7. Jan. 
exec 29087 success key=PENDING_SUMMARY translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: ⟦1⟧ (30 Min.) — Mo., 7. Jan., 10:00. You can cancel free of charge no later than 24 Stunden before the visit. Reply JA t
exec 29091 success key=BOOKED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: You're booked: ⟦1⟧ (30 Min.) — Mo., 7. Jan., 10:00. We'll send you a reminder the day before. To change or cancel, just 
exec 29092 success key=BOOKED_INTAKE translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Before your first visit, please complete our short intake and consent form (about 5 Minuten): https://example.com/intake
exec 29109 success key=CANCEL_PENDING translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Cancel your appointment for ⟦1⟧ on Mo., 7. Jan., 10:00? Reply JA to cancel.
exec 29125 success key=CANCELLED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Your appointment for ⟦1⟧ on Mo., 7. Jan., 10:00 has been cancelled. Message me any time to book again.
```

## Merge outcomes, push 1 window (script arguments 2026-10-13T11:02:00 2026-10-13T11:05:00, per the controller's report: chosen around the dialog's start and end times, not printed in the output; block verbatim; dialog 12 run 1)

```
exec 28940 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и по вашей просьбе к разговору подключится сотрудник. Подс
exec 28943 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Приятно познакомиться, Ольга! На какой день и время суток вам удобно записаться на ботокс?
exec 28947 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Есть свободное время на ботокс: пн, 7 янв. 2030 г., 10:00 пн, 7 янв. 2030 г., 10:30 пн, 7 янв. 2030 г., 11:00 пн, 7 янв.
exec 28951 success key=PENDING_SUMMARY translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: ⟦1⟧ (30 мин) — пн, 7 янв., 10:00. You can cancel free of charge no later than 24 часа before the visit. Reply ДА to conf
exec 28955 success key=BOOKED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: You're booked: ⟦1⟧ (30 мин) — пн, 7 янв., 10:00. We'll send you a reminder the day before. To change or cancel, just mes
exec 28956 success key=BOOKED_INTAKE translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Before your first visit, please complete our short intake and consent form (about 5 минут): https://example.com/intake-f
exec 28973 success key=CANCEL_PENDING translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Cancel your ⟦1⟧ appointment on пн, 7 янв., 10:00? Reply ДА to cancel.
```

## Raw output: dialog 12 ru, run 1 (after push 1; `remote.sh` output, verbatim; "run 1 raw line N" = line N of this block)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-13T11:02:28.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 28937 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и по вашей просьбе к разговору подключится сотрудник. Подскажите, пожалуйста, ваши имя и фамилию для записи на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 2 send: Меня зовут Ольга Тестова.
  exec 28941 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток вам удобно записаться на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 28944 success; route agent; tools ["check_availability"]
  <- reply: Есть свободное время на ботокс: пн, 7 янв. 2030 г., 10:00 пн, 7 янв. 2030 г., 10:30 пн, 7 янв. 2030 г., 11:00 пн, 7 янв. 2030 г., 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 4 send: Первый вариант, пожалуйста.
  exec 28948 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 мин) — пн, 7 янв., 10:00. Вы можете отменить бронирование бесплатно не позднее чем за 24 часа до визита. Ответьте ДА для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
  ok   regex: (?-i:ДА)
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: (?<!\p{L})до\s+24\s+час
  ok   no-regex: ботокс
  ok   regex: (?-i:Botox)
  ok   no-regex: (?-i:Botox)\p{L}|\p{L}(?-i:Botox)
STEP 5 send: да
  exec 28952 success; route confirm; tools []
  <- BOOKED: Вы забронированы: Botox (30 мин) — пн, 7 янв., 10:00. Мы отправим вам напоминание за день до приёма. Чтобы изменить или отменить бронь, просто напишите мне здесь; вы можете отменить бронь бесплатно не позднее чем за 24 часа до визита.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу короткую анкету и форму согласия (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: (?<!\p{L})до\s+24\s+час
  ok   no-regex: ботокс
  ok   regex: (?-i:Botox)
  ok   no-regex: (?-i:Botox)\p{L}|\p{L}(?-i:Botox)
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
STEP 6 send: Хочу отменить запись.
  exec 28969 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: Отменить вашу Botox запись на пн, 7 янв., 10:00? Ответьте ДА для отмены.
  ok   templates: CANCEL_PENDING
  ok   lang: ru
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: (?-i:ДА)
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: ботокс
  ok   regex: (?-i:Botox)
  ok   no-regex: (?-i:Botox)\p{L}|\p{L}(?-i:Botox)
  FAIL: no-regex: (?<!\p{L})у\s+(?-i:Botox)|(?<!\p{L})вашу\s+(?-i:Botox)
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV6KNKN7","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MV6KOIJA04D botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d56364b4f494a41303444 reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MV6KOIJA04D
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MV6KOIJA04D
SUMMARY: client=active/ru appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,CANCEL_PENDING
RESULT FAIL 12-russian-client.md tg (1 failed)
EXIT 1
booking events: ok DELETED 1 of 1
calendar cleanup: ok DELETED 0
cleanup done
```

## Raw output: dialog 12 ru, run 2 (after push 2, verbatim; "raw line N" in the dialog 12 run 2 row = line N of this block)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-13T11:45:22.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 29000 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, при желании я передам беседу сотруднику. Подскажите, пожалуйста, ваши имя и фамилию для записи?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 2 send: Меня зовут Ольга Тестова.
  exec 29004 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток (утро, день или вечер) вам удобно записаться на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 29007 success; route agent; tools ["check_availability"]
  <- reply: На ботокс свободно: пн, 7 янв. 2030 г., 10:00; пн, 7 янв. 2030 г., 10:30; пн, 7 янв. 2030 г., 11:00; пн, 7 янв. 2030 г., 11:30. Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 4 send: Первый вариант, пожалуйста.
  exec 29011 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 мин) — пн, 7 янв., 10:00. Вы можете отменить визит бесплатно не позднее чем за 24 часа до визита. Ответьте ДА для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
  ok   regex: (?-i:ДА)
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: (?<!\p{L})до\s+24\s+час
  ok   no-regex: ботокс
  ok   regex: (?-i:Botox)
  ok   no-regex: (?-i:Botox)\p{L}|\p{L}(?-i:Botox)
STEP 5 send: да
  exec 29015 success; route confirm; tools []
  <- BOOKED: Вы записаны: Botox (30 мин) — пн, 7 янв., 10:00. Мы отправим вам напоминание за день до визита. Чтобы изменить или отменить запись, просто напишите мне здесь; отмену можно произвести бесплатно не позднее чем за 24 часа до визита.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу краткую форму первичного осмотра и согласия (займет около 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: (?<!\p{L})до\s+24\s+час
  ok   no-regex: ботокс
  ok   regex: (?-i:Botox)
  ok   no-regex: (?-i:Botox)\p{L}|\p{L}(?-i:Botox)
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
STEP 6 send: Хочу отменить запись.
  exec 29032 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: Отменить Вашу запись на Botox на пн, 7 янв., 10:00? Ответьте ДА для отмены.
  ok   templates: CANCEL_PENDING
  ok   lang: ru
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: (?-i:ДА)
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: ботокс
  ok   regex: (?-i:Botox)
  ok   no-regex: (?-i:Botox)\p{L}|\p{L}(?-i:Botox)
  ok   no-regex: (?<!\p{L})у\s+(?-i:Botox)|(?<!\p{L})вашу\s+(?-i:Botox)
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
STEP 7 send: да
  exec 29049 success; route cancel; tools []
  <- CANCELLED: Ваша запись на Botox на пн, 7 янв., 10:00 отменена. Напишите мне в любое время, чтобы записаться снова.
  ok   templates: CANCELLED
  ok   lang: ru
  ok   node: Cancel Visit
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: ботокс
  ok   regex: (?-i:Botox)
  ok   no-regex: (?-i:Botox)\p{L}|\p{L}(?-i:Botox)
  ok   no-regex: (?<!\p{L})у\s+(?-i:Botox)|(?<!\p{L})вашу\s+(?-i:Botox)
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV6M6PXN","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MV6M7NR6ZVZ botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MV6M7NR6ZVZ
  OWNER: ℹ️ Cancelled: Ольга Тестова (tg:9000000112) — botox — Mon, Jan 7, 10:00 AM — A-MV6M7NR6ZVZ
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "ru"
  ok   state: .client.status == "active"
  ok   state: (.client.name // "") | test("Ольга")
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 0
  ok   state: (.client.cancel_ask_appt_id // "") == ""
  ok   state: [.outbox[] | .template_key] | index("PENDING_SUMMARY") != null and index("BOOKED") != null and index("CANCEL_PENDING") != null and index("CANCELLED") != null
SUMMARY: client=active/ru appts=cancelled events=0 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,CANCEL_PENDING,CANCELLED
RESULT PASS 12-russian-client.md tg
EXIT 0
calendar cleanup: ok DELETED 0
cleanup done
```

## Raw output: dialog 13 de (after push 2, verbatim)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 13-german-client.md channel=tg contact=tg:9000000113 started 2026-10-13T11:48:14.000Z (clean start checked)
STEP 1 send: Hallo! Ich möchte einen Termin für Botox buchen.
  exec 29073 success; route agent; tools ["find_client"]
  <- reply: Hallo und willkommen bei Glow Aesthetics Med-Spa! Ich bin die KI-Assistentin der Klinik – auf Wunsch übernimmt gerne ein Teammitglied. Darf ich zuerst Ihren Vor- und Nachnamen erfahren?
  ok   templates: reply
  ok   lang: de
  ok   regex: \bKI\b|künstliche Intelligenz
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 2 send: Ich heiße Jonas Testmann.
  exec 29077 success; route agent; tools []
  <- reply: Vielen Dank, Herr Testmann. An welchem Tag und zu welcher Tageszeit hätten Sie gern Ihren Botox-Termin?
  ok   templates: reply
  ok   lang: de
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 3 send: Am Montag, 7. Januar 2030, vormittags, bitte.
  exec 29080 success; route agent; tools ["check_availability"]
  <- reply: Gern, für Botox sind an diesem Tag folgende Zeiten frei: Mo., 7. Jan. 2030, 10:00 Mo., 7. Jan. 2030, 10:30 Mo., 7. Jan. 2030, 11:00 Mo., 7. Jan. 2030, 11:30 Welche Uhrzeit passt Ihnen am besten?
  ok   templates: reply
  ok   lang: de
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),? (den )?7\. Jan|\b(Di|Mi|Do|Fr|Sa|So)\., 7\. Jan
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 4 send: Den ersten, bitte.
  exec 29084 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 Min.) — Mo., 7. Jan., 10:00. Sie können bis spätestens 24 Stunden vor dem Termin kostenlos absagen. Antworten Sie mit JA zur Bestätigung.
  ok   templates: PENDING_SUMMARY
  ok   lang: de
  ok   regex: (?-i:\bJA\b)
  ok   regex: 24 Stunden
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 5 send: ja
  exec 29088 success; route confirm; tools []
  <- BOOKED: Sie sind gebucht: Botox (30 Min.) — Mo., 7. Jan., 10:00. Wir senden Ihnen einen Tag vorher eine Erinnerung. Um zu ändern oder zu stornieren, schreiben Sie mir einfach hier; Sie können kostenfrei bis spätestens 24 Stunden vor Ihrem Termin st
  <- BOOKED_INTAKE: Bitte füllen Sie vor Ihrem ersten Besuch unser kurzes Aufnahme- und Einwilligungsformular aus (etwa 5 Minuten): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: de
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 Stunden
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
STEP 6 send: Ich möchte meinen Termin bitte absagen.
  exec 29105 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: Möchten Sie Ihren Termin für Botox am Mo., 7. Jan., 10:00 absagen? Antworten Sie mit JA, um abzusagen.
  ok   templates: CANCEL_PENDING
  ok   lang: de
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: (?-i:\bJA\b)
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
STEP 7 send: ja
  exec 29122 success; route cancel; tools []
  <- CANCELLED: Ihr Termin für Botox am Mo., 7. Jan., 10:00 wurde storniert. Schreiben Sie mir jederzeit, um einen neuen Termin zu vereinbaren.
  ok   templates: CANCELLED
  ok   lang: de
  ok   node: Cancel Visit
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
  ok   no-regex: \bbei\s+(?-i:Botox)
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV6MAMD3","name":"Jonas Testmann","language":"de","status":"active","intake_completed":null}
  APPT: A-MV6MBM67OJI botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Jonas Testmann (tg:9000000113) — Botox — Mon, Jan 7, 10:00 AM — A-MV6MBM67OJI
  OWNER: ℹ️ Cancelled: Jonas Testmann (tg:9000000113) — botox — Mon, Jan 7, 10:00 AM — A-MV6MBM67OJI
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "de"
  ok   state: .client.status == "active"
  ok   state: (.client.name // "") | test("Jonas")
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 0
  ok   state: (.client.cancel_ask_appt_id // "") == ""
  ok   state: [.outbox[] | .template_key] | index("PENDING_SUMMARY") != null and index("BOOKED") != null and index("CANCEL_PENDING") != null and index("CANCELLED") != null
SUMMARY: client=active/de appts=cancelled events=0 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,CANCEL_PENDING,CANCELLED
RESULT PASS 13-german-client.md tg
EXIT 0
calendar cleanup: ok DELETED 0
cleanup done
```
