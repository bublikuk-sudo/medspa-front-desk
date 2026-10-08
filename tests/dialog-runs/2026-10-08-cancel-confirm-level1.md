# Two-step cancel, phase 2: touched tool cases, each run alone (tests/tool-cases.sh <name>), 2026-10-08

Stub suites in the n8n container first: WF1_STUBS passed 198, failed 0; SEND_MESSAGE_STUBS passed 59, failed 0.

```
=== rcancel_free 19:44:30
PASS  rcancel_free  -> CANCEL_PENDING A-MUZY44GD1WO
passed 1, failed 0
=== rcancel_late 19:45:28
PASS  rcancel_late  -> LATE_CANCEL_PENDING A-TEST-LATE
passed 1, failed 0
=== rcancel_not_yours 19:45:37
PASS  rcancel_not_yours  -> NOT_YOURS
passed 1, failed 0
=== rcancel_not_found 19:45:45
PASS  rcancel_not_found  -> NOT_FOUND
passed 1, failed 0
=== rcancel_invalid_id 19:45:51
PASS  rcancel_invalid_id  -> NOT_FOUND
passed 1, failed 0
=== rcancel_past 19:45:58
PASS  rcancel_past  -> NOT_FOUND
passed 1, failed 0
=== rcancel_pending 19:46:05
PASS  rcancel_pending  -> NOT_FOUND
passed 1, failed 0
=== rcancel_already_cancelled 19:46:12
PASS  rcancel_already_cancelled  -> NOT_FOUND
passed 1, failed 0
=== cancel_not_found 19:46:19
PASS  cancel_not_found  -> NOT_FOUND
passed 1, failed 0
=== cancel_invalid_id 19:46:24
PASS  cancel_invalid_id  -> NOT_FOUND
passed 1, failed 0
=== cancel_not_yours 19:46:31
PASS  cancel_not_yours  -> NOT_YOURS
passed 1, failed 0
=== cancel_ok 19:46:57
PASS  cancel_ok  -> CANCELLED
passed 1, failed 0
=== cancel_late 19:47:20
PASS  cancel_late  -> LATE_CANCEL
passed 1, failed 0
=== cancel_already_gone 19:47:30
PASS  cancel_already_gone  -> CANCELLED
passed 1, failed 0
=== cancel_reschedule_reason 19:47:54
PASS  cancel_reschedule_reason  -> CANCELLED
passed 1, failed 0
=== cancel_forged_reschedule 19:48:05
PASS  cancel_forged_reschedule  -> LATE_CANCEL
passed 1, failed 0
=== cancel_late_escalated 19:48:18
PASS  cancel_late_escalated  -> LATE_CANCEL
passed 1, failed 0
=== cancel_past 19:48:29
PASS  cancel_past  -> NOT_FOUND
passed 1, failed 0
=== cancel_pending_in_window 19:48:37
PASS  cancel_pending_in_window  -> CANCELLED
passed 1, failed 0
=== cancel_already_cancelled 19:48:46
PASS  cancel_already_cancelled  -> NOT_FOUND
passed 1, failed 0
=== agent_books_flow 19:48:55
PASS  agent_books_flow  -> {"reply":"Hi Test, here are afternoon openings for Botox on **Mon, Jan 7, 2030**:\n\n12:00 PM\n12:30 PM\n1:00 PM\n1:30 PM\n\nWhich time works best for you?","template_key":"","tools_used":["find_client","check_availability"],"cancel_appt_id":"","cancel_verdict":""}
passed 1, failed 0
=== agent_medical_escalates 19:49:12
PASS  agent_medical_escalates  -> {"reply":"","template_key":"ESCALATED_REPLY","tools_used":["find_client","search_knowledge","escalate"],"cancel_appt_id":"","cancel_verdict":""}
passed 1, failed 0
=== agent_discloses_ai 19:49:36
PASS  agent_discloses_ai  -> {"reply":"Hi, welcome to Glow Aesthetics Med-Spa! I'm the clinic's AI assistant, and a team member can take over any time you'd like. How can I help you today?","template_key":"","tools_used":["find_client"],"cancel_appt_id":"","cancel_verdict":""}
passed 1, failed 0
ALL_DONE
```

## Live Haiku probe of the cancel prompt (tests/haiku-cancel-probe.sh)

```
PASS "нет" -> "NO" (Affirmative? false, want NO)
PASS "nein" -> "NO" (Affirmative? false, want NO)
PASS "no" -> "NO" (Affirmative? false, want NO)
PASS "отмена" -> "YES" (Affirmative? true, want YES)
PASS "cancel" -> "YES" (Affirmative? true, want YES)
PASS "yes cancel" -> "YES" (Affirmative? true, want YES)
model claude-haiku-4-5, temperature 0, max_tokens 3
HAIKU_CANCEL_PROBE passed 6 of 6
```
