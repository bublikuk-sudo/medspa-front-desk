# Client language (B): phase 2 deploy and live proof (2026-10-11/12)

Owner's go-ahead in chat: "да, заливай язык клиента (B) на живой бот" (deploy, 2026-10-11) and "да, запускай живую
проверку языка клиента (диалоги 12, 11, 13) на тестовых контактах" (live proof, 2026-10-12; the permission classifier
refused the proof under the deploy phrase alone). Run by the controller.

## Deploy (2026-10-11, 14:06-14:08Z)

- Drift check before the push: live `confirm_booking`, `check_availability`, `wf2-agent` jq -S identical to `29615b1`
  (the pre-B version); live `send_message` identical after normalising the push-time substitutions (`webhookId`,
  `phoneNumberId` placeholder).
- Pushed one at a time with `--activate`, each pulled back and compared with jq -S against the repo:
  `send_message` (normalised as above), `confirm_booking`, `check_availability`, `wf2-agent`: CONTENT-IDENTICAL x4.
- Stubs on the pushed state: `SEND_MESSAGE_STUBS passed 143, failed 0`, `WF1_STUBS passed 291, failed 0`,
  `CHECK_AVAILABILITY_STUBS passed 23, failed 0`.

## Live proof (2026-10-12, 19:05-19:15Z, Telegram format, test contacts, replies in test_outbox)

| dialog | result | note |
|---|---|---|
| 12 ru | PASS | all 7 steps, no Latin fragment beyond the brand list |
| 11 es (run 1) | FAIL at step 1 | only the AI-disclosure regex: the agent itself wrote "Soy la asistente virtual de ..." (wf2-agent exec 28404 output equals the sent text; send_message Render `needs_translation:false`, unchanged). Not caused by B; B's checks on that step passed |
| 11 es (run 2) | PASS | all 7 steps |
| 13 de | PASS | all 7 steps |

- `Intl` inside n8n's expression sandbox is proven live: `check_availability` returned `slots_local` as
  "lun, 7 ene 2030, 10:00" (es) and "Mo., 7. Jan. 2030, 10:00" (de).
- Translated reply words reached WF-1 and routed: `да`, `sí`, `ja` -> BOOKED and CANCELLED with no agent call.
- The runner prints each reply with whitespace collapsed (`gsub("\\s+"; " ")`), so the slot lists below appear on
  one line.
- Cleanup after the last dialog: `calendar cleanup: ok DELETED 0`, `cleanup done`. Owner notifications (English,
  owner-facing) went to the owner's Telegram: one booking and one cancellation per passing run.

## Findings (not B failures)

1. AI disclosure wording is the model's choice: "asistente virtual" does not say AI. The prompt opens with
   "You are the virtual front desk" next to the rule "say you are the clinic's AI assistant".
2. The register varies between templates, because each one is translated on its own: de CANCELLED uses "Dein /
   Schreib" (du) while the others use Sie; es CANCELLED uses "Su / Comuníquese" (usted) and PENDING_SUMMARY uses
   "Responda" while BOOKED and CANCEL_PENDING use tú.
3. Grammar: de BOOKED "einen Erinnerung" (should be "eine Erinnerung").
4. ru: the service name is declined/translated differently: CANCEL_PENDING "вашу Ботокс", CANCELLED "Ваш Botox".

## Raw output

calendar cleanup: ok DELETED 0
cleanup done
DIALOG 12-russian-client.md channel=tg contact=tg:9000000112 started 2026-10-12T19:05:42.000Z (clean start checked)
STEP 1 send: Здравствуйте! Хочу записаться на ботокс.
  exec 28332 success; route agent; tools ["find_client"]
  <- reply: Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, при желании могу подключить сотрудника. Подскажите, пожалуйста, ваши имя и фамилию для записи на ботокс?
  ok   templates: reply
  ok   lang: ru
  ok   regex: ИИ|искусственн
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
STEP 2 send: Меня зовут Ольга Тестова.
  exec 28336 success; route agent; tools []
  <- reply: Приятно познакомиться, Ольга! На какой день и время суток вам удобно записаться?
  ok   templates: reply
  ok   lang: ru
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
STEP 3 send: В понедельник, 7 января 2030 года, утром, пожалуйста.
  exec 28339 success; route agent; tools ["check_availability"]
  <- reply: Есть свободные места на ботокс: пн, 7 янв. 2030 г., 10:00 пн, 7 янв. 2030 г., 10:30 пн, 7 янв. 2030 г., 11:00 пн, 7 янв. 2030 г., 11:30 Какое время вам подходит?
  ok   templates: reply
  ok   lang: ru
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]),? 7 января
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
STEP 4 send: Первый вариант, пожалуйста.
  exec 28343 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Ботокс (30 мин) — пн, 7 янв., 10:00. Бесплатная отмена до 24 часа до процедуры. Ответьте ДА для подтверждения.
  ok   templates: PENDING_SUMMARY
  ok   lang: ru
  ok   regex: (?-i:ДА)
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
STEP 5 send: да
  exec 28347 success; route confirm; tools []
  <- BOOKED: Вы забронированы: Ботокс (30 мин) — пн, 7 янв., 10:00. Мы отправим вам напоминание за день до визита. Чтобы изменить или отменить, просто напишите мне здесь — отмена бесплатна до 24 часа до вашего визита.
  <- BOOKED_INTAKE: Перед вашим первым визитом, пожалуйста, заполните нашу короткую форму опроса и согласия (примерно 5 минут): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: ru
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 час
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
STEP 6 send: Хочу отменить запись.
  exec 28364 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: Отменить вашу Ботокс на пн, 7 янв., 10:00? Ответьте ДА для отмены.
  ok   templates: CANCEL_PENDING
  ok   lang: ru
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: (?-i:ДА)
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
STEP 7 send: да
  exec 28381 success; route cancel; tools []
  <- CANCELLED: Ваш Botox на пн, 7 янв., 10:00 был отменён. Напишите мне в любое время, чтобы забронировать снова.
  ok   templates: CANCELLED
  ok   lang: ru
  ok   node: Cancel Visit
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   no-regex: (?<![/.\-&])\b(?!(?:Glow|Aesthetics|Med|Spa|HydraFacial|Botox)\b)[a-z]{3,}\b(?!://|\.\w|/|-\w)|\d\s?[ap]m\b
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV5MH5BH","name":"Ольга Тестова","language":"ru","status":"active","intake_completed":null}
  APPT: A-MV5MI3Y2AZR botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Ольга Тестова (tg:9000000112) — Botox — Mon, Jan 7, 10:00 AM — A-MV5MI3Y2AZR
  OWNER: ℹ️ Cancelled: Ольга Тестова (tg:9000000112) — botox — Mon, Jan 7, 10:00 AM — A-MV5MI3Y2AZR
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
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 11-spanish-client.md channel=tg contact=tg:9000000111 started 2026-10-12T19:08:27.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 28403 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy la asistente virtual de Glow Aesthetics Med-Spa; si lo prefiere, un miembro del equipo puede atenderle. Con gusto le reservo el Botox: ¿me indica su nombre y apellido?
  ok   templates: reply
  ok   lang: es
  FAIL: regex: \bIA\b|inteligencia artificial
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  (aborted: remaining steps skipped)
STATE
  CLIENT: {"client_id":"C-test-MV5MKOH1","name":null,"language":"es","status":"new","intake_completed":null}
SUMMARY: client=new/es appts=- events=0 sent=reply
RESULT FAIL 11-spanish-client.md tg (1 failed)
## Dialog 11 re-run (step-1 failure above was the agent's own AI-disclosure wording, not B; see ledger ruling)
calendar cleanup: ok DELETED 0
cleanup done
DIALOG 11-spanish-client.md channel=tg contact=tg:9000000111 started 2026-10-12T19:10:00.000Z (clean start checked)
STEP 1 send: ¡Hola! Me gustaría reservar Botox.
  exec 28409 success; route agent; tools ["find_client"]
  <- reply: ¡Hola! Soy el asistente virtual (IA) de Glow Aesthetics Med-Spa, y si lo prefieres puedo pasarte con una persona del equipo en cualquier momento. Con mucho gusto te reservo el Botox: ¿me dices tu nombre y apellido, por favor?
  ok   templates: reply
  ok   lang: es
  ok   regex: \bIA\b|inteligencia artificial
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 2 send: Me llamo Lucía Pruebas.
  exec 28413 success; route agent; tools []
  <- reply: Encantado, Lucía. ¿Qué día te vendría bien y prefieres mañana, tarde o noche?
  ok   templates: reply
  ok   lang: es
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 3 send: El lunes 7 de enero de 2030 por la mañana, por favor.
  exec 28416 success; route agent; tools ["check_availability"]
  <- reply: Tengo estos horarios disponibles para Botox: lun, 7 ene 2030, 10:00 lun, 7 ene 2030, 10:30 lun, 7 ene 2030, 11:00 lun, 7 ene 2030, 11:30 ¿Cuál prefieres?
  ok   templates: reply
  ok   lang: es
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: \b(martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),? (el )?7 de enero
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 4 send: La primera, por favor.
  exec 28420 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 min) — lun, 7 ene, 10:00. Cancelación gratuita hasta 24 horas antes. Responda SÍ para confirmar.
  ok   templates: PENDING_SUMMARY
  ok   lang: es
  ok   regex: (?-i:SÍ)
  ok   regex: 24 horas
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 5 send: sí
  exec 28424 success; route confirm; tools []
  <- BOOKED: Estás reservado: Botox (30 min) — lun, 7 ene, 10:00. Te enviaremos un recordatorio el día anterior. Para cambiar o cancelar, simplemente escríbeme aquí — la cancelación es gratuita hasta 24 horas antes de tu visita.
  <- BOOKED_INTAKE: Antes de tu primera visita, por favor completa nuestro breve formulario de admisión y consentimiento (aproximadamente 5 minutos): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: es
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 horas
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
STEP 6 send: Quiero cancelar mi cita, por favor.
  exec 28441 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: ¿Cancelar tu Botox el lun, 7 ene, 10:00? Responde SÍ para cancelar.
  ok   templates: CANCEL_PENDING
  ok   lang: es
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: (?-i:SÍ)
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
STEP 7 send: sí
  exec 28458 success; route cancel; tools []
  <- CANCELLED: Su Botox en lun, 7 ene, 10:00 ha sido cancelado. Comuníquese conmigo en cualquier momento para reservar nuevamente.
  ok   templates: CANCELLED
  ok   lang: es
  ok   node: Cancel Visit
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV5MMO5B","name":"Lucía Pruebas","language":"es","status":"active","intake_completed":null}
  APPT: A-MV5MNM8PRQX botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Lucía Pruebas (tg:9000000111) — Botox — Mon, Jan 7, 10:00 AM — A-MV5MNM8PRQX
  OWNER: ℹ️ Cancelled: Lucía Pruebas (tg:9000000111) — botox — Mon, Jan 7, 10:00 AM — A-MV5MNM8PRQX
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
DIALOG 13-german-client.md channel=tg contact=tg:9000000113 started 2026-10-12T19:12:43.000Z (clean start checked)
STEP 1 send: Hallo! Ich möchte einen Termin für Botox buchen.
  exec 28480 success; route agent; tools ["find_client"]
  <- reply: Hallo und willkommen bei Glow Aesthetics Med-Spa! Ich bin die KI-Assistentin der Klinik – auf Wunsch übernimmt jederzeit gerne ein Teammitglied. Dürfte ich zuerst Ihren Vor- und Nachnamen haben?
  ok   templates: reply
  ok   lang: de
  ok   regex: \bKI\b|künstliche Intelligenz
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 2 send: Ich heiße Jonas Testmann.
  exec 28484 success; route agent; tools []
  <- reply: Danke, Herr Testmann! An welchem Tag und zu welcher Tageszeit hätten Sie gern Ihren Botox-Termin?
  ok   templates: reply
  ok   lang: de
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 3 send: Am Montag, 7. Januar 2030, vormittags, bitte.
  exec 28487 success; route agent; tools ["check_availability"]
  <- reply: Gerne, folgende Zeiten sind frei: Mo., 7. Jan. 2030, 10:00 Mo., 7. Jan. 2030, 10:30 Mo., 7. Jan. 2030, 11:00 Mo., 7. Jan. 2030, 11:30 Welche Uhrzeit passt Ihnen am besten?
  ok   templates: reply
  ok   lang: de
  ok   tool: check_availability
  ok   regex: \b\d{1,2}:\d{2}\b
  ok   no-regex: (Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),? (den )?7\. Jan|\b(Di|Mi|Do|Fr|Sa|So)\., 7\. Jan
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 4 send: Den ersten, bitte.
  exec 28491 success; route agent; tools ["propose_booking"]
  <- PENDING_SUMMARY: Botox (30 Min.) — Mo., 7. Jan., 10:00. Kostenlose Stornierung bis 24 Stunden vorher. Antworten Sie mit JA zur Bestätigung.
  ok   templates: PENDING_SUMMARY
  ok   lang: de
  ok   regex: (?-i:\bJA\b)
  ok   regex: 24 Stunden
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
STEP 5 send: ja
  exec 28495 success; route confirm; tools []
  <- BOOKED: Sie sind gebucht: Botox (30 Min.) — Mo., 7. Jan., 10:00. Wir senden Ihnen einen Erinnerung am Tag vorher. Um zu ändern oder abzubrechen, schreiben Sie mir einfach hier — die Stornierung ist kostenlos bis zu 24 Stunden vor Ihrem Besuch.
  <- BOOKED_INTAKE: Vor Ihrem ersten Besuch füllen Sie bitte unser kurzes Aufnahme- und Einwilligungsformular aus (etwa 5 Minuten): https://example.com/intake-form-demo
  ok   templates: BOOKED, BOOKED_INTAKE
  ok   lang: de
  ok   node: Confirm
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   regex: 24 Stunden
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   state: [.appts[].status] == ["booked"]
  ok   state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
  ok   state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
STEP 6 send: Ich möchte meinen Termin bitte absagen.
  exec 28512 success; route agent; tools ["find_client","request_cancel"]
  <- CANCEL_PENDING: Möchten Sie Ihren Botox am Mo., 7. Jan., 10:00 absagen? Antworten Sie mit JA, um abzusagen.
  ok   templates: CANCEL_PENDING
  ok   lang: de
  ok   tool: request_cancel
  ok   node: Send Cancel Ask
  ok   no-node: Cancel Visit
  ok   regex: (?-i:\bJA\b)
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   state: [.appts[].status] == ["booked"]
  ok   state: (.events | length) == 1
  ok   state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
STEP 7 send: ja
  exec 28529 success; route cancel; tools []
  <- CANCELLED: Dein Botox am Mo., 7. Jan., 10:00 wurde storniert. Schreib mir jederzeit, um erneut zu buchen.
  ok   templates: CANCELLED
  ok   lang: de
  ok   node: Cancel Visit
  ok   no-node: LLM Affirmative
  ok   no-node: Agent
  ok   no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
  ok   state: [.appts[].status] == ["cancelled"]
  ok   state: (.events | length) == 0
STATE
  CLIENT: {"client_id":"C-test-MV5MQ5X4","name":"Jonas Testmann","language":"de","status":"active","intake_completed":null}
  APPT: A-MV5MR5YYN1V botox 2030-01-07T10:00:00+01:00 cancelled event=- reminder_sent_at=-
  OWNER: ✅ New booking: Jonas Testmann (tg:9000000113) — Botox — Mon, Jan 7, 10:00 AM — A-MV5MR5YYN1V
  OWNER: ℹ️ Cancelled: Jonas Testmann (tg:9000000113) — botox — Mon, Jan 7, 10:00 AM — A-MV5MR5YYN1V
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
calendar cleanup: ok DELETED 0
cleanup done
