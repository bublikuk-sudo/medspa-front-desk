# Translation quality (C) + AI disclosure (D): phase 2 deploy and live proof (2026-10-13)

Owner's go-ahead in chat (2026-10-12/13): "да, заливай C и D на живой бот и запускай живую проверку (диалоги 12, 11,
13, временный тестовый воркфлоу и проверку /start)". Run by the controller.

## Deploy (controller's report; the command output is in the ledger `progress.md`, not reproduced here)

- Drift check (2026-10-12 20:20Z, read-only): live `send_message` (normalised `webhookId` / `phoneNumberId`) and
  `wf2-agent` identical to `8d3092e`; live `wf1-inbound` identical to `9612391`.
- Pushed one at a time with `--activate`, each pulled back and compared with `jq -S` against the repo at `34511ce`:
  `send_message` 08:14Z, `wf2-agent` 08:15Z, `wf1-inbound` 08:16Z, CONTENT-IDENTICAL x3; `tests/channels-check.sh`:
  `channels ok` (Telegram webhook and WhatsApp subscription unchanged).
- Stubs on the pulled live files: `SEND_MESSAGE_STUBS passed 264, failed 0`, `WF1_STUBS passed 321, failed 0`,
  `CHECK_AVAILABILITY_STUBS passed 27, failed 0`.

## Results

| run | result | note |
|---|---|---|
| 12 ru (run 1) | FAIL at step 5 | only the C check `до\s+24\s+час`: BOOKED "отмена бесплатна до 24 часов до визита" (PENDING_SUMMARY in the same run was right: "за 24 часа до визита"). The run stopped at step 5; the next run's cleanup removed its booking |
| 11 es | PASS | usted in every message; step 1 disclosure by the agent itself ("asistente de IA") |
| 13 de | PASS | Sie in every message; "eine Erinnerung"; step 1 disclosure by the agent itself ("KI-Assistentin") |
| 12 ru (run 2) | FAIL at step 4 | only the C brand check `ботокс`: PENDING_SUMMARY "Ботокс (30 мин)"; the duration sentence was right this time ("за 24 часа до визита") |
| 14 /start, then es (step 5c) | PASS | /start: the agent's own English disclosure ("the clinic's AI assistant"); the Spanish message: the reply starts with the fixed Spanish sentence "Soy el asistente de IA de …", so D's fallback fired in the language-detection run, as ruled |
| 5b throwaway proof | PASS | 8/8 cases, see below |

- D (AI disclosure): in every first reply the client got a disclosure that names AI in their language; no message after
  the first reply of a run starts with the fixed sentence.
- C (translation): formal address, dates, units and reply words are right in every message of the four dialog runs.
  The two ru failures are the translator not following two prompt rules (Latin brand spelling, the duration
  preposition) in one message each; both errors also existed before C. Treated as findings, C stays live (ruling in the
  ledger).
- The runner prints each reply with whitespace collapsed, so slot lists appear on one line.

## Step 5b output (throwaway workflow, verbatim; the per-case expected/actual JSON lines omitted)

```
tmp-* workflows before: 0
Render jsCode md5 185eec2a3e130796d2b178d74d4453b1 (from /tmp/send_message.json)
stub method: 8 cases
created tmp-ai-disclosure-proof-1791880444 -> 6Es2ygn8TXrEMIZX (errorWorkflow: none; nodes: Webhook,Trigger,Settings,Client,Appointment,Services,Render,Out)
throwaway Render jsCode md5 185eec2a3e130796d2b178d74d4453b1 (same)
{"active":true}
case 1: es reply without IA ("asistente virtual", finding 1), flag true -> es sentence added [flag "true"]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
case 2: es reply with IA, flag true -> unchanged [flag "true"]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
case 3: es "FAMILIA / familia / Iago" (IA inside words, capitalised Ia), flag true -> es sentence added [flag "true"]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
case 4: ru reply without ИИ, flag true -> ru sentence added [flag "true"]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
case 5: en reply without AI, flag true -> en sentence added [flag "true"]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
case 6: tr (not in the map), flag true -> en sentence added, needs_translation true (one Haiku call live) [flag "true"]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
case 7: es reply without IA, flag "" (not the first reply) -> unchanged [flag ""]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
case 8: de, business_name "KI Beauty", no KI word besides the name, flag true -> de sentence added (name excluded) [flag "true"]
  HTTP 200
  stub==n8n EQUAL, n8n==hand EQUAL
throwaway executions:
{"id":"28777","status":"success","mode":"webhook"}
{"id":"28776","status":"success","mode":"webhook"}
{"id":"28775","status":"success","mode":"webhook"}
{"id":"28774","status":"success","mode":"webhook"}
{"id":"28773","status":"success","mode":"webhook"}
{"id":"28772","status":"success","mode":"webhook"}
{"id":"28771","status":"success","mode":"webhook"}
{"id":"28770","status":"success","mode":"webhook"}
{"deleted":"6Es2ygn8TXrEMIZX"}
tmp-* workflows left: 0
PROOF RESULT PASS
```

## Dialog runner output (verbatim; the only non-runner lines are the two `## [controller annotation]` headings)

calendar cleanup: ok DELETED 0
cleanup done
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-13T08:16:59.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 28559 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и при желании к разговору подключится сотрудник. Подскажите, пожалуйста, ваши имя и фамилию для записи?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 2 send: Меня зовут Ольга Тестова.
  exec 28563 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток (утро, день или вечер) вам удобно прийти на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 28566 success; route agent; tools ["check_availability"]
  <- reply: Есть свободные окна на ботокс: пн, 7 янв. 2030 г., 10:00 пн, 7 янв. 2030 г., 10:30 пн, 7 янв. 2030 г., 11:00 пн, 7 янв. 2030 г., 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 4 send: Первый вариант, пожалуйста.
  exec 28570 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 мин) — пн, 7 янв., 10:00. Бесплатная отмена за 24 часа до визита. Ответьте ДА для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
  ok   regex: (?-i:ДА)
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: (?<!\p{L})до\s+24\s+час
  ok   no-regex: ботокс
STEP 5 send: да
  exec 28574 success; route confirm; tools []
  <- BOOKED: Вы записаны: Botox (30 мин) — пн, 7 янв., 10:00. Мы отправим вам напоминание за день до визита. Чтобы изменить или отменить запись, просто напишите мне здесь — отмена бесплатна до 24 часов до визита.
  <- BOOKED_INTAKE: Перед Вашим первым визитом, пожалуйста, заполните нашу короткую форму регистрации и согласия (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  FAIL: no-regex: (?<!\p{L})до\s+24\s+час
  ok   no-regex: ботокс
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV6EQQFH","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MV6EROFMLEL botox 2030-01-07T10:00:00+01:00 booked event=appt412d4d563645524f464d4c454c reminder_sent_at=-
  EVENT: Botox — Ольга Тестова 2030-01-07T10:00:00+01:00 A-MV6EROFMLEL
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MV6EROFMLEL
SUMMARY: client=active/ru appts=booked events=1 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE
RESULT FAIL 12-russian-client.md tg (1 failed)
booking events: ok DELETED 1 of 1
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 11-spanish-client.md channel=tg contact=tg:9000000111 started 2026-10-13T08:19:03.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 28603 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy el asistente de IA de Glow Aesthetics Med-Spa, y si lo prefiere, un miembro del equipo puede atenderle en cualquier momento. Con mucho gusto le reservo el Botox. ¿Podría indicarme su nombre y apellido, por favor?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(tú|tus?|te|ti|contigo|tuy[oa]s?|estás|eres|quieres|prefieres|puedes|tienes|dices|escríbeme|dime)(?!\p{L})
STEP 2 send: Me llamo Lucía Pruebas.
  exec 28607 success; route agent; tools []
  <- reply: Encantado, Lucía. ¿Qué día le vendría bien y prefiere mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(tú|tus?|te|ti|contigo|tuy[oa]s?|estás|eres|quieres|prefieres|puedes|tienes|dices|escríbeme|dime)(?!\p{L})
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 28610 success; route agent; tools ["check_availability"]
  <- reply: Tengo estos horarios disponibles para Botox: lun, 7 ene 2030, 10:00 lun, 7 ene 2030, 10:30 lun, 7 ene 2030, 11:00 lun, 7 ene 2030, 11:30 ¿Cuál prefiere?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(tú|tus?|te|ti|contigo|tuy[oa]s?|estás|eres|quieres|prefieres|puedes|tienes|dices|escríbeme|dime)(?!\p{L})
STEP 4 send: La primera, por favor.
  exec 28614 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, 7 ene, 10:00. Cancelación gratuita hasta 24 horas antes. Responda SÍ para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
  ok   regex: (?-i:SÍ)
  ok   regex: 24 horas
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(tú|tus?|te|ti|contigo|tuy[oa]s?|estás|eres|quieres|prefieres|puedes|tienes|dices|escríbeme|dime)(?!\p{L})
STEP 5 send: sí
  exec 28618 success; route confirm; tools []
  <- BOOKED: Está reservado: Botox (30 min) — lun, 7 ene, 10:00. Le enviaremos un recordatorio el día anterior. Para cambiar o cancelar, simplemente envíeme un mensaje aquí — la cancelación es gratuita hasta 24 horas antes de su cita.
  <- BOOKED_INTAKE: Antes de su primera cita, por favor complete nuestro breve formulario de admisión y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 horas
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(tú|tus?|te|ti|contigo|tuy[oa]s?|estás|eres|quieres|prefieres|puedes|tienes|dices|escríbeme|dime)(?!\p{L})
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
STEP 6 send: Quiero cancelar mi cita, por favor.
  exec 28635 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: ¿Cancelar su Botox el lun, 7 ene, 10:00? Responda SÍ para cancelar.
  ok   templates: CANCEL_PENDING
  ok   lang: es
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: (?-i:SÍ)
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(tú|tus?|te|ti|contigo|tuy[oa]s?|estás|eres|quieres|prefieres|puedes|tienes|dices|escríbeme|dime)(?!\p{L})
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
STEP 7 send: sí
  exec 28652 success; route cancel; tools []
  <- CANCELLED: Su Botox el lun, 7 ene, 10:00 ha sido cancelado. Comuníquese conmigo en cualquier momento para reservar nuevamente.
  ok   templates: CANCELLED
  ok   lang: es
  ok   node: Cancel Visit
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(tú|tus?|te|ti|contigo|tuy[oa]s?|estás|eres|quieres|prefieres|puedes|tienes|dices|escríbeme|dime)(?!\p{L})
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV6ETEAL","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MV6EUC968MU botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Lucía Pruebas (tg:9000000111) — Botox — Mon, Jan 7, 10:00 AM — A-MV6EUC968MU
  OWNER: ℹ️ Cancelled: Lucía Pruebas (tg:9000000111) — botox — Mon, Jan 7, 10:00 AM — A-MV6EUC968MU
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "es"
  ok   state: .client.status == "active"
  ok   state: (.client.name // "") | test("Luc[ií]a"; "i")
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 0
  ok   state: (.client.cancel_ask_appt_id // "") == ""
  ok   state: [.outbox[] | .template_key] | index("PENDING_SUMMARY") != null and index("BOOKED") != null and index("CANCEL_PENDING") != null and index("CANCELLED") != null
SUMMARY: client=active/es appts=cancelled events=0 sent=reply,reply,reply,PENDING_SUMMARY,BOOKED,BOOKED_INTAKE,CANCEL_PENDING,CANCELLED
RESULT PASS 11-spanish-client.md tg
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 13-german-client.md channel=tg contact=tg:9000000113 started 2026-10-13T08:21:43.000Z (clean start checked)
STEP 1 send: Hallo! Ich möchte einen Termin für Botox buchen.
  exec 28674 success; route agent; tools ["find_client"]
  <- reply: Hallo und willkommen bei Glow Aesthetics Med-Spa! Ich bin die KI-Assistentin der Klinik – auf Wunsch übernimmt gerne ein Teammitglied. Darf ich zunächst Ihren Vor- und Nachnamen erfahren?
  ok   templates: reply
  ok   lang: de
  ok   regex: \bKI\b|künstliche Intelligenz
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 2 send: Ich heiße Jonas Testmann.
  exec 28678 success; route agent; tools []
  <- reply: Danke, Herr Testmann! An welchem Tag und zu welcher Tageszeit (vormittags, nachmittags oder abends) würde es Ihnen passen?
  ok   templates: reply
  ok   lang: de
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 3 send: Am Montag, 7. Januar 2030, vormittags, bitte.
  exec 28681 success; route agent; tools ["check_availability"]
  <- reply: Gerne, folgende Zeiten sind frei: Mo., 7. Jan. 2030, 10:00 Mo., 7. Jan. 2030, 10:30 Mo., 7. Jan. 2030, 11:00 Mo., 7. Jan. 2030, 11:30 Welche Uhrzeit darf ich für Sie vormerken?
  ok   templates: reply
  ok   lang: de
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),? (den )?7\. Jan|\b(Di|Mi|Do|Fr|Sa|So)\., 7\. Jan
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 4 send: Den ersten, bitte.
  exec 28685 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 Min.) — Mo., 7. Jan., 10:00. Kostenlose Stornierung bis 24 Stunden vor dem Termin. Antworten Sie mit JA zur Bestätigung.
  ok   templates: PENDING_SUMMARY
  ok   lang: de
  ok   regex: (?-i:\bJA\b)
  ok   regex: 24 Stunden
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
STEP 5 send: ja
  exec 28689 success; route confirm; tools []
  <- BOOKED: Sie sind gebucht: Botox (30 Min.) — Mo., 7. Jan., 10:00. Wir senden Ihnen eine Erinnerung am Tag vor Ihrem Termin. Um zu ändern oder abzusagen, schreiben Sie mir einfach hier – die Stornierung ist bis 24 Stunden vor Ihrem Besuch kostenlos.
  <- BOOKED_INTAKE: Bitte füllen Sie vor Ihrem ersten Besuch unser kurzes Aufnahme- und Zustimmungsformular aus (etwa 5 Minuten): https://example.com/intake-form-demo
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
  exec 28706 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: Möchten Sie Ihren Botox-Termin am Mo., 7. Jan., 10:00 absagen? Antworten Sie mit JA, um abzusagen.
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
  exec 28723 success; route cancel; tools []
  <- CANCELLED: Ihre Botox-Behandlung am Mo., 7. Jan., 10:00 wurde storniert. Schreiben Sie mir jederzeit, um einen neuen Termin zu vereinbaren.
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
  CLIENT: {"client_id":"C-test-MV6EWTSS","name":"Jonas Testmann","language":"de","status":"active","intake_completed":null}
  APPT: A-MV6EXRRRSJ6 botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Jonas Testmann (tg:9000000113) — Botox — Mon, Jan 7, 10:00 AM — A-MV6EXRRRSJ6
  OWNER: ℹ️ Cancelled: Jonas Testmann (tg:9000000113) — botox — Mon, Jan 7, 10:00 AM — A-MV6EXRRRSJ6
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
## [controller annotation] Dialog 12 re-run (run 1 above failed only the 'до 24 час' check at step 5)
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-13T08:24:26.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 28745 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, при желании я передам разговор сотруднику. Подскажите, пожалуйста, ваши имя и фамилию для записи?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 2 send: Меня зовут Ольга Тестова.
  exec 28749 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток (утро, день или вечер) вам удобно записаться на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 28752 success; route agent; tools ["check_availability"]
  <- reply: На ботокс свободны такие времена: пн, 7 янв. 2030 г., 10:00 пн, 7 янв. 2030 г., 10:30 пн, 7 янв. 2030 г., 11:00 пн, 7 янв. 2030 г., 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
STEP 4 send: Первый вариант, пожалуйста.
  exec 28756 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 мин) — пн, 7 янв., 10:00. Бесплатная отмена за 24 часа до визита. Ответьте ДА для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
  ok   regex: (?-i:ДА)
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   no-regex: (?<!\p{L})(ты|тебя|тебе|тобой|тво[йяеёюи]\p{L}*)(?!\p{L})
  ok   no-regex: (?<!\p{L})до\s+24\s+час
  FAIL: no-regex: ботокс
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV6F0BVF","name":"Ольга Тестова","language":"ru","status":"new","intake_completed":null}
  APPT: A-MV6F19SCL91 botox 2030-01-07T10:00:00+01:00 pending event=- reminder_sent_at=-
SUMMARY: client=new/ru appts=pending events=0 sent=reply,reply,reply,PENDING_SUMMARY
RESULT FAIL 12-russian-client.md tg (1 failed)
calendar cleanup: ok DELETED 0
cleanup done
## [controller annotation] Step 5c: dialog 14 (/start, then Spanish), run from /tmp
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 14-start-then-spanish.md channel=tg contact=tg:9000000114 started 2026-10-13T08:34:40.000Z (clean start checked)
STEP 1 send: /start
  exec 28780 success; route agent; tools ["find_client"]
  <- reply: Hello and welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over at any time if you'd like. How can I help you today — would you like to book a treatment or ask a question?
  ok   templates: reply
  ok   lang: en
  ok   regex: \bAI\b|artificial intelligence
  ok   node: Create Client
  ok   no-node: Language
  ok   state: (.client.language // "") == ""
  ok   state: ((.appts // []) | length) == 0
STEP 2 send: Hola, me gustaría reservar Botox.
  exec 28784 success; route agent; tools []
  <- reply: Soy el asistente de IA de Glow Aesthetics Med-Spa; si lo prefiere, un miembro del equipo puede atenderle en cualquier momento. ¡Con gusto le ayudo a reservar su cita de Botox! ¿Me puede indicar su nombre y apellido, por favor?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
  ok   no-regex: \bAI assistant\b|artificial intelligence
  ok   node: Language
  ok   no-node: Create Client
  ok   no-node: Confirm
  ok   state: .client.language == "es"
  ok   state: ((.appts // []) | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV6FDH41","name":null,"language":"es","status":"new","intake_completed":null}
  ok   state: (.client.client_id // "") | startswith("C-test-")
  ok   state: .client.language == "es"
  ok   state: ((.appts // []) | length) == 0
  ok   state: (.events | length) == 0
  ok   state: (.owner | length) == 0
  ok   state: [.outbox[] | .template_key] == ["", ""]
SUMMARY: client=new/es appts=- events=0 sent=reply,reply
RESULT PASS 14-start-then-spanish.md tg
calendar cleanup: ok DELETED 0
cleanup done
