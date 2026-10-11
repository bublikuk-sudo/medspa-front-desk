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

Every step checks that nothing English reached the client: no English weekday or month ("Mon,", "Jan 7"), no "AM"/"PM"
after a time (case-sensitive, because German "am" means "on the"), and none of the English words a template or a leaked
planning line would carry. "Jan" alone is correct German ("7. Jan."), so only the English order "Jan 7" counts.
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
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan \d|(?-i:\d\s?[AP]M\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: Ich heiße Jonas Testmann.
expect templates: reply
expect lang: de
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan \d|(?-i:\d\s?[AP]M\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: Am Montag, 7. Januar 2030, vormittags, bitte.
expect templates: reply
expect lang: de
expect tool: check_availability
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: (Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),? (den )?7\. Jan|\b(Di|Mi|Do|Fr|Sa|So)\., 7\. Jan
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan \d|(?-i:\d\s?[AP]M\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: Den ersten, bitte.
expect templates: PENDING_SUMMARY
expect lang: de
expect regex: (?-i:\bJA\b)
expect regex: 24 Stunden
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan \d|(?-i:\d\s?[AP]M\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
send: ja
expect templates: BOOKED, BOOKED_INTAKE
expect lang: de
expect node: Confirm
expect no-node: LLM Affirmative
expect no-node: Agent
expect regex: 24 Stunden
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan \d|(?-i:\d\s?[AP]M\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
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
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan \d|(?-i:\d\s?[AP]M\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
expect state: [.appts[].status] == ["booked"]
expect state: (.events | length) == 1
expect state: (.client.cancel_ask_appt_id // "") == .appts[0].appt_id
send: ja
expect templates: CANCELLED
expect lang: de
expect node: Cancel Visit
expect no-node: LLM Affirmative
expect no-node: Agent
expect no-regex: \b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\bJan \d|(?-i:\d\s?[AP]M\b)|\b(hours?|minutes|days?|reply|yes|cancel|booked|your|you|the|would|which)\b
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
