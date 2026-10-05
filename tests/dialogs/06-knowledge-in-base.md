# 06 — Questions the knowledge base answers

Plan Task 20, row 06: "Do you have parking?" and "How much is filler and is there a deposit?" are answered from the
knowledge base (`kb-location`, `kb-filler`), not from the model's own knowledge. Played in both channels
(`tg:9000000106`, `wa:+15550000106`).

**Preconditions.** `tests/cleanup.sh` has run (the contact is unknown). The Knowledge table holds the seed passages:
kb-location (free client parking in the courtyard), kb-filler ($550 per syringe, $100 deposit).

| # | Client writes | Expected reaction | Expected state |
|---|---|---|---|
| 1 | Hi, do you have parking? | agent reply in English with the parking fact (courtyard / free), `search_knowledge` in the Agent's tools_used | Clients row `status=new` |
| 2 | How much is filler and is there a deposit? | agent reply with `$550` and `$100`, `search_knowledge` in tools_used | — |

**Final state.** No appointments, client still `new`, no owner notification about this contact (nothing escalated).

**Check.** On the VPS: `tests/dialogs.sh 06`.

```dialog
profile: Kim Testlund
send: Hi, do you have parking?
expect templates: reply
expect lang: en
expect tool: search_knowledge
expect regex: courtyard|free
send: How much is filler and is there a deposit?
expect templates: reply
expect lang: en
expect tool: search_knowledge
expect regex: \$\s?550|550\s?(\$|USD|dollars)
expect regex: \$\s?100|100\s?(\$|USD|dollars)
state: (.appts | length) == 0
state: .client.status == "new"
state: (.owner | length) == 0
```
