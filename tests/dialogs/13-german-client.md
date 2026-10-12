# 13 — German client

Mini-task B (2026-10-11, "the bot speaks only the client's language"): dialog 11's booking and cancellation, entirely in
German. It is a Latin-script language with a 24-hour clock and its own month and weekday abbreviations, so it checks
the cases where an English date or unit is easiest to miss: "Mo., 7. Jan. 2030, 10:00" against "Mon, Jan 7, 2030,
10:00 AM", "30 Min." against "30 min", "24 Stunden" against "24 hours". The confirmations are the word «ja», which the
deterministic YES list of WF-1's Classify recognises; the summary and the cancel question ask for «JA» (send_message's
reply-word map). Contacts `tg:9000000113`, `wa:+15550000113`.

The reminder leg is not repeated (see dialog 11).

**Preconditions.** None.

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hallo! Ich möchte einen Termin für Botox buchen. | German reply that says it is the clinic's AI assistant (KI) | Clients `language=de` |
| 2 | Ich heiße Jonas Testmann. | German reply | — |
| 3 | Am Montag, 7. Januar 2030, vormittags, bitte. | German reply with slot times, copied from `slots_local` (German, 24-hour) | — |
| 4 | Den ersten, bitte. | `PENDING_SUMMARY` in German with «JA» and «24 Stunden» | `pending` |
| 5 | ja | `BOOKED`, `BOOKED_INTAKE` in German; Confirm, no LLM Affirmative, no Agent | `booked`, event |
| 6 | Ich möchte meinen Termin bitte absagen. | `CANCEL_PENDING` in German, asking for «JA»; request_cancel, nothing cancelled yet | `booked`, event, cancel question open |
| 7 | ja | `CANCELLED` in German; the list YES answers the open cancel question: Cancel Visit, no LLM Affirmative, no Agent | `cancelled`, no event |

Every step checks that the client's messages contain none of these English fragments:

- a weekday abbreviation in the English "Mon," form;
- "Jan" directly followed by a day number that is not a time. "Jan" alone is correct German ("7. Jan.", "7. Jan 10:00"),
  so only the English order "Jan 7" counts.
- "AM"/"PM" after a time, matched case-sensitively, because German "am" means "on the";
- the English unit "min" after a number, lower case and without a dot ("(30 min)"). German writes "30 Min.".
- an English weekday name, or one of the months January, February, March, May, June, July, October, December, matched
  case-sensitively. April, August, September and November are spelled the same in German, so they are not checked.
- one of the words hour(s), minutes, day(s), reply, yes, cancel, booked, your, you, the, would, which.

**Translation quality (mini-task C, 2026-10-12).** Every step also checks the formal register and one grammar slip found
in the live proof of B (`tests/dialog-runs/2026-10-12-client-language-tg.md`):

- no informal form of address: du, dich, dir, dein / deine / deinen / deinem / deiner / deines, euch, euer, eure…, the
  imperative «schreib», bist, kannst, möchtest, willst (finding 2: CANCELLED went out as «Dein … Schreib mir» while the
  other messages used Sie). They are matched as whole words, so «Direkt», «Duo» or «Deinstallation» do not count; none of
  them occurs in a correct Sie text. The agent's own replies (steps 1–3) get the same check: the agent prompt now asks
  for the formal form too.
- no «einen Erinnerung» (finding 3, BOOKED).

Step 1's «KI» check is also the live check of the agent prompt's AI-disclosure wording (mini-task C, requirement 9).

`expect lang: de` was added to `tests/dialog.sh` for this dialog.

**Final state.** `language=de`, `active`, the name contains "Jonas"; one appointment, `cancelled`, `start_iso` ISO with
an offset; no event left; no cancel question open.

**Check.** On the VPS: `tests/dialogs.sh 13`.

```dialog
profile: Jonas Testmann
send: Hallo! Ich möchte einen Termin für Botox buchen.
expect templates: reply
expect lang: de
expect regex: \bKI\b|künstliche Intelligenz
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
send: Ich heiße Jonas Testmann.
expect templates: reply
expect lang: de
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
send: Am Montag, 7. Januar 2030, vormittags, bitte.
expect templates: reply
expect lang: de
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: (Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),? (den )?7\. Jan|\b(Di|Mi|Do|Fr|Sa|So)\., 7\. Jan
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
send: Den ersten, bitte.
expect templates: PENDING_SUMMARY
expect lang: de
expect regex: (?-i:\bJA\b)
expect regex: 24 Stunden
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
send: ja
expect templates: BOOKED, BOOKED_INTAKE
expect lang: de
expect node: Confirm
expect no-node: LLM Affirmative
expect no-node: Agent
expect regex: 24 Stunden
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
expect state: [.appts[].status] == ["booked"]
expect state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
expect state: (.events | length) == 1 and .events[0].summary == ("Botox — " + .client.name)
send: Ich möchte meinen Termin bitte absagen.
expect templates: CANCEL_PENDING
expect lang: de
expect tool: request_cancel
expect node: Send Cancel Ask
expect no-node: Cancel Visit
expect regex: (?-i:\bJA\b)
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
expect state: [.appts[].status] == ["booked"]
expect state: (.events | length) == 1
expect state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
send: ja
expect templates: CANCELLED
expect lang: de
expect node: Cancel Visit
expect no-node: LLM Affirmative
expect no-node: Agent
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan (?=\d{1,2}\b(?!:))|(?-i:\d\s?[AP]M\b)|(?-i:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|May|June|July|October|December)\b)|(?-i:\d\s?min\b(?!\.))|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect no-regex: (?<!\p{L})(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?|schreib|bist|kannst|möchtest|willst)(?!\p{L})|einen\s+Erinnerung
expect state: [.appts[].status] == ["cancelled"]
expect state: (.events | length) == 0
state: (.client.client_id // "") | startswith("C-test-")
state: .client.language == "de"
state: .client.status == "active"
state: (.client.name // "") | test("Jonas")
state: [.appts[].status] == ["cancelled"]
state: .appts[0].start_iso | test("^2030-01-07T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$")
state: (.events | length) == 0
state: (.client.cancel_ask_appt_id // "") == ""
state: [.outbox[] | .template_key] | index("PENDING_SUMMARY") != null and index("BOOKED") != null and index("CANCEL_PENDING") != null and index("CANCELLED") != null
```
