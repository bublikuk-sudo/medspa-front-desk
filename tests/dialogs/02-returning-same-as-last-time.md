# 02 — Returning client: "the same as last time, next week"

Plan Task 20, row 02: a known client whose last visit was a HydraFacial asks for "the same as last time next week". The
agent does not ask for the name, offers HydraFacial slots, and the client's pick becomes a `pending` HydraFacial.
Played in both channels (`tg:9000000102`, `wa:+15550000102`).

**Preconditions (setup).** Clients row `C-test-D<contact digits>` "Rita Returntest", `active`, `en`, with one `done`
HydraFacial appointment `A-TEST-D02DONE` on 2026-08-04 (`next_visit_in` 0, so WF-5 never invites it).

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi! I'd like the same as last time, next week - Tuesday morning if possible. | agent reply in English with HydraFacial slot times; `find_client` and `check_availability` used; no question about the name | — |
| 2 | The first one, please. | `PENDING_SUMMARY` for HydraFacial | a `pending` HydraFacial next to the `done` one |

**Final state.** Two appointments: `A-TEST-D02DONE` still `done`, one `pending` with `service_id=hydrafacial`; the name is
unchanged; no owner notification about this contact.

**Check.** On the VPS: `tests/dialogs.sh 02`. The slots are next week's real availability (the plan's wording); nothing
is written to the calendar (pending only).

```dialog
profile: Rita Returntest
setup: seed_client "$CID" "Rita Returntest" active en
setup: seed_appt "$CID" '{"appt_id":"A-TEST-D02DONE","service_id":"hydrafacial","start_iso":"2026-08-04T10:00:00+02:00","end_iso":"2026-08-04T11:00:00+02:00","start_dt":"2026-08-04T08:00:00.000Z","status":"done","next_visit_in":0,"created_via":"test"}'
send: Hi! I'd like the same as last time, next week - Tuesday morning if possible.
expect templates: reply
expect lang: en
expect tool: find_client
expect tool: check_availability
expect regex: hydra ?facial
expect regex: \b\d{1,2}:\d{2}\b
expect no-regex: \b(Mon|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?,? Oct(ober)?\.? 13\b
expect no-regex: \b(your|the) (first and last |full )?name\b|\bwhat.{0,20}\bname\b|\bwho am i speaking
send: The first one, please.
expect templates: PENDING_SUMMARY
expect regex: HydraFacial
expect tool: propose_booking
state: (.client.client_id // "") | startswith("C-test-")
state: [.appts[] | select(.status == "pending") | .service_id] == ["hydrafacial"]
state: [.appts[] | select(.status == "done") | .appt_id] == ["A-TEST-D02DONE"]
state: (.appts | length) == 2
state: .client.name == "Rita Returntest"
state: (.owner | length) == 0
```
