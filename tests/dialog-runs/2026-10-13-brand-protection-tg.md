# Brand protection (E): phase 2 deploy and live proof (2026-10-13)

Owner's go-ahead in chat (2026-10-13): "да, добавляй поле untranslated_terms, заливай E на живой бот и запускай живую
проверку (диалоги 12 и 13)". Run by the controller.

## Deploy (controller's report; the command output is in the ledger `progress.md`, not reproduced here)

- Drift check (~09:37Z, read-only): live `send_message` pulled with `scripts/n8n-pull.sh` and compared with `jq -S`
  against the repo at `fd60910`, normalising `webhookId` and `phoneNumberId`: CONTENT-IDENTICAL, no drift.
- Schema, field first (~09:37Z): `scripts/airtable-schema.sh` through `remote.sh` printed
  `field Settings.untranslated_terms: added` and changed nothing else. Settings has 1 row; one PATCH set the field;
  read back `{"untranslated_terms":"Botox, HydraFacial"}`. Both names are spelled as in `Services.name`.
- Push (09:38Z): `scripts/n8n-push.sh workflows/shared/send_message.json --activate` printed
  `updated send_message -> kbDqztgeR3GX6WDI` and `activated send_message`. Pulled back and compared with `jq -S` against
  the repo at `d2c0813` (same normalisation): CONTENT-IDENTICAL. `tests/channels-check.sh`: `channels ok`. No other
  workflow was pushed.
- Stubs on the pushed state: `SEND_MESSAGE_STUBS passed 316, failed 0` (on the pulled live file),
  `WF1_STUBS passed 321, failed 0`, `CHECK_AVAILABILITY_STUBS passed 27, failed 0` (the last from the workstation, as its
  header requires).

## Results

| run | result | note |
|---|---|---|
| 12 ru | PASS, steps 1-7 | `RESULT PASS 12-russian-client.md tg` (dialog 12 raw line 108; dialog 13 raw line 94). First ru run to reach steps 6-7 since C: CANCEL_PENDING (raw line 63) and CANCELLED (raw line 80) were produced in Russian |
| 13 de | PASS, steps 1-7 | `RESULT PASS 13-german-client.md tg`, the regression check |

- Brand: every translated ru and de message that names the service has Latin `Botox` (ru raw lines 31, 44, 63, 80;
  de raw lines 31, 40, 55, 69). No Cyrillic `ботокс` and no letter glued to `Botox` in any translated message (the
  dialog 12 checks at steps 4-7 passed).
- Cancellation window: ru PENDING_SUMMARY and BOOKED both say "не позднее чем за 24 часа до визита" (raw lines 31, 44);
  the `до\s+24\s+час` check passed at steps 4 and 5. de: "bis spätestens 24 Stunden vor dem Termin" (raw line 31).
- Which path each message took, read from the `send_message` executions (block "Merge outcomes" below): 10 messages
  went through Translate (5 per dialog). In 8 of them Render had masked `Botox` as `⟦1⟧`. BOOKED_INTAKE names no
  service, so it had nothing to mask. Merge Text returned `retranslate=false` for all 10. Merge Again never ran. The
  token path held every time, and the fallback fired 0 times. The agent's own replies (`key=reply`) are written in the
  client's language and are not translated (`translate=false`).
- The runner prints each message with whitespace collapsed and cut at 240 characters (`tests/dialog.sh`, `read_outbox`).
  That is why de BOOKED (raw line 40) ends in "Term". The message itself is not cut.
- Cleanup ran before and after each dialog (`cleanup done`, `calendar cleanup: ok DELETED 0`).

## Findings (not failures)

1. ru CANCEL_PENDING: "Отменить вашу Botox" (raw line 63). The translator guesses the gender of the masked name, and
   `вашу` does not agree with `Botox`. The same wording appeared before E ("вашу Ботокс", 2026-10-12 log).
2. ru CANCELLED "Ваш прием у Botox" and de CANCELLED "Ihr Termin bei Botox" (raw lines 80 and 69). Once the service is a
   token, "Your {service} on …" becomes "your appointment with/at Botox", which reads as if Botox were a person or a
   place. Candidate fix: rephrase the English CANCEL_PENDING/CANCELLED templates as "your {service} appointment".
3. The agent's own ru replies write the service as "ботокс" (dialog 12 raw lines 14 and 21). Those replies are not
   translated, so E does not touch them, and dialog 12 checks the brand only at steps 4-7.

## Merge outcomes (send_message executions 09:39:30Z-09:45:30Z, read-only script output, verbatim)

```
exec 28794 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и при желании я передам разговор специалисту. Подскажите, 
exec 28797 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Спасибо, Ольга! На какой день и какое время суток (утро, день или вечер) вам удобно прийти на ботокс?
exec 28801 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: На ботокс свободно: пн, 7 янв. 2030 г., 10:00 пн, 7 янв. 2030 г., 10:30 пн, 7 янв. 2030 г., 11:00 пн, 7 янв. 2030 г., 11
exec 28805 success key=PENDING_SUMMARY translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: ⟦1⟧ (30 мин) — пн, 7 янв., 10:00. You can cancel free of charge no later than 24 часа before the visit. Reply ДА to conf
exec 28809 success key=BOOKED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: You're booked: ⟦1⟧ (30 мин) — пн, 7 янв., 10:00. We'll send you a reminder the day before. To change or cancel, just mes
exec 28810 success key=BOOKED_INTAKE translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Before your first visit, please complete our short intake and consent form (about 5 минут): https://example.com/intake-f
exec 28827 success key=CANCEL_PENDING translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Cancel your ⟦1⟧ on пн, 7 янв., 10:00? Reply ДА to cancel.
exec 28843 success key=CANCELLED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Your ⟦1⟧ on пн, 7 янв., 10:00 has been cancelled. Message me any time to book again.
exec 28867 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Hallo und willkommen bei Glow Aesthetics Med-Spa! Ich bin die KI-Assistentin der Klinik – auf Wunsch übernimmt jederzeit
exec 28870 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Vielen Dank, Herr Testmann. An welchem Tag und zu welcher Tageszeit würden Sie den Botox-Termin gerne wahrnehmen?
exec 28874 success key=reply translate=false mergeText.retranslate=false mergeAgain.fallback=-
  masked: Gerne, für Botox sind an diesem Vormittag folgende Zeiten frei: Mo., 7. Jan. 2030, 10:00 Mo., 7. Jan. 2030, 10:30 Mo., 7
exec 28878 success key=PENDING_SUMMARY translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: ⟦1⟧ (30 Min.) — Mo., 7. Jan., 10:00. You can cancel free of charge no later than 24 Stunden before the visit. Reply JA t
exec 28882 success key=BOOKED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: You're booked: ⟦1⟧ (30 Min.) — Mo., 7. Jan., 10:00. We'll send you a reminder the day before. To change or cancel, just 
exec 28883 success key=BOOKED_INTAKE translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Before your first visit, please complete our short intake and consent form (about 5 Minuten): https://example.com/intake
exec 28900 success key=CANCEL_PENDING translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Cancel your ⟦1⟧ on Mo., 7. Jan., 10:00? Reply JA to cancel.
exec 28916 success key=CANCELLED translate=true mergeText.retranslate=false mergeAgain.fallback=-
  masked: Your ⟦1⟧ on Mo., 7. Jan., 10:00 has been cancelled. Message me any time to book again.
```

## Raw output: dialog 12 ru (`remote.sh` output, verbatim; "raw line N" above = line N of this block)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-13T09:39:45.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 28791 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и при желании я передам разговор специалисту. Подскажите, пожалуйста, ваши имя и фамилию для записи?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 2 send: Меня зовут Ольга Тестова.
  exec 28795 success; route agent; tools []
  <- reply: Спасибо, Ольга! На какой день и какое время суток (утро, день или вечер) вам удобно прийти на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 28798 success; route agent; tools ["check_availability"]
  <- reply: На ботокс свободно: пн, 7 янв. 2030 г., 10:00 пн, 7 янв. 2030 г., 10:30 пн, 7 янв. 2030 г., 11:00 пн, 7 янв. 2030 г., 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 4 send: Первый вариант, пожалуйста.
  exec 28802 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 мин) — пн, 7 янв., 10:00. Вы можете отменить запись бесплатно не позднее чем за 24 часа до визита. Ответьте ДА для подтверждения.
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
  exec 28806 success; route confirm; tools []
  <- BOOKED: Вы записаны: Botox (30 мин) — пн, 7 янв., 10:00. Напомним вам за день до визита. Чтобы изменить или отменить запись, просто напишите мне здесь; отменить можно бесплатно не позднее чем за 24 часа до визита.
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
  exec 28823 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: Отменить вашу Botox на пн, 7 янв., 10:00? Ответьте ДА для отмены.
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
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
STEP 7 send: да
  exec 28840 success; route cancel; tools []
  <- CANCELLED: Ваш прием у Botox на пн, 7 янв., 10:00 был отменен. Напишите мне в любое время, чтобы записаться снова.
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
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV6HP6J9","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MV6HQ4R83LZ botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MV6HQ4R83LZ
  OWNER: ℹ️ Cancelled: Ольга Тестова (tg:9000000112) — botox — Mon, Jan 7, 10:00 AM — A-MV6HQ4R83LZ
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

## Raw output: dialog 13 de (verbatim; "raw line N" above = line N of this block)

```
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 13-german-client.md channel=tg contact=tg:9000000113 started 2026-10-13T09:42:57.000Z (clean start checked)
STEP 1 send: Hallo! Ich möchte einen Termin für Botox buchen.
  exec 28864 success; route agent; tools ["find_client"]
  <- reply: Hallo und willkommen bei Glow Aesthetics Med-Spa! Ich bin die KI-Assistentin der Klinik – auf Wunsch übernimmt jederzeit gerne ein Mitarbeiter. Darf ich zuerst Ihren Vor- und Nachnamen erfahren?
  ok   templates: reply
  ok   lang: de
  ok   regex: \bKI\b|künstliche Intelligenz
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 2 send: Ich heiße Jonas Testmann.
  exec 28868 success; route agent; tools []
  <- reply: Vielen Dank, Herr Testmann. An welchem Tag und zu welcher Tageszeit würden Sie den Botox-Termin gerne wahrnehmen?
  ok   templates: reply
  ok   lang: de
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 3 send: Am Montag, 7. Januar 2030, vormittags, bitte.
  exec 28871 success; route agent; tools ["check_availability"]
  <- reply: Gerne, für Botox sind an diesem Vormittag folgende Zeiten frei: Mo., 7. Jan. 2030, 10:00 Mo., 7. Jan. 2030, 10:30 Mo., 7. Jan. 2030, 11:00 Mo., 7. Jan. 2030, 11:30 Welche Uhrzeit passt Ihnen am besten?
  ok   templates: reply
  ok   lang: de
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),? (den )?7\. Jan|\b(Di|Mi|Do|Fr|Sa|So)\., 7\. Jan
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 4 send: Den ersten, bitte.
  exec 28875 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 Min.) — Mo., 7. Jan., 10:00. Sie können bis spätestens 24 Stunden vor dem Termin kostenlos absagen. Antworten Sie mit JA zur Bestätigung.
  ok   templates: PENDING_SUMMARY
  ok   lang: de
  ok   regex: (?-i:\bJA\b)
  ok   regex: 24 Stunden
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 5 send: ja
  exec 28879 success; route confirm; tools []
  <- BOOKED: Sie sind gebucht: Botox (30 Min.) — Mo., 7. Jan., 10:00. Wir senden Ihnen einen Tag vor Ihrem Termin eine Erinnerung. Um zu ändern oder abzusagen, schreiben Sie mir einfach hier; Sie können kostenlos bis spätestens 24 Stunden vor Ihrem Term
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
  exec 28896 success; route agent; tools ["find_client","request_cancel"]
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
  exec 28913 success; route cancel; tools []
  <- CANCELLED: Ihr Termin bei Botox am Mo., 7. Jan., 10:00 wurde storniert. Schreiben Sie mir jederzeit, um einen neuen Termin zu vereinbaren.
  ok   templates: CANCELLED
  ok   lang: de
  ok   node: Cancel Visit
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV6HTAAC","name":"Jonas Testmann","language":"de","status":"active","intake_completed":null}
  APPT: A-MV6HU8H0A26 botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Jonas Testmann (tg:9000000113) — Botox — Mon, Jan 7, 10:00 AM — A-MV6HU8H0A26
  OWNER: ℹ️ Cancelled: Jonas Testmann (tg:9000000113) — botox — Mon, Jan 7, 10:00 AM — A-MV6HU8H0A26
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
