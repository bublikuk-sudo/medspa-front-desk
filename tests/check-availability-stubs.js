// Stub test of check_availability's slots_local (mini-task B fix round 1, I-3) and of the agent's instructions about it.
// Runs in the n8n container's Node (see tests/check-availability-stubs.sh), which prepends:
//   const WF = <workflows/wf3-tools/check_availability.json>;  const WF2 = <workflows/wf2-agent.json>;
//   const PROMPT = <prompts/agent-system-prompt.md, as a string>;
// No network, no n8n runtime: $ is stubbed; Intl is the real one, and the expected strings are the wording of that Node's
// ICU (78.3).
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};
const node = (w, n) => w.nodes.find((x) => x.name === n) || {};
const body = (e) => String(e || '').replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
const assign = (n, name) => ((((node(WF, n).parameters || {}).assignments || {}).assignments || []).find((a) => a.name === name) || {}).value;
const slotsExpr = assign('Result', 'slots_local');

// The Result node's slots_local, given the Client search result (one item; {} when no row: alwaysOutputData) and the slots
// Compute saved as the offer.
const slotsLocal = (client, slots, tz = 'Europe/Berlin') => {
  const nodes = {
    Settings: { id: 'recS', fields: { timezone: tz } },
    Client: client,
    Compute: { verdict: 'FREE ' + slots.join(', '), slots_local: 'COMPUTE', offered_json: JSON.stringify({ service_id: 'consult', slots }), offered_at: '2026-10-11T08:00:00.000Z' },
  };
  const $ = (n) => ({ first: () => ({ json: nodes[n] }) });
  try { return new Function('$', 'return (' + body(slotsExpr) + ');')($); } catch (e) { return 'THROW ' + e.message; }
};
const row = (language) => ({ id: 'recC', fields: { client_id: 'C-test-1', language } });
const OCT = ['2026-10-12T10:30:00+02:00', '2026-10-12T11:00:00+02:00'];
const S = (name, client, want, slots = OCT, tz) => { const got = slotsLocal(client, slots, tz); check(name, got === want, got); };

check('Result.slots_local is computed in Result from Compute.offered_json (not Compute\'s English label)', /offered_json/.test(slotsExpr || '') && !/Compute'\)\.first\(\)\.json\.slots_local/.test(slotsExpr || ''), slotsExpr);
S('en client: English, 12-hour clock, year', row('en'), 'Mon, Oct 12, 2026, 10:30 AM; Mon, Oct 12, 2026, 11:00 AM');
S('de client: German, 24-hour clock', row('de'), 'Mo., 12. Okt. 2026, 10:30; Mo., 12. Okt. 2026, 11:00');
S('es client: Spanish', row('es'), 'lun, 12 oct 2026, 10:30; lun, 12 oct 2026, 11:00');
S('ru client: Russian (the owner\'s case)', row('ru'), 'пн, 12 окт. 2026 г., 10:30; пн, 12 окт. 2026 г., 11:00');
S('pl client: ICU alone, no special handling', row('pl'), 'pon., 12 paź 2026, 10:30; pon., 12 paź 2026, 11:00');
S('upper-case language code (RU) is read as ru', row('RU'), 'пн, 12 окт. 2026 г., 10:30; пн, 12 окт. 2026 г., 11:00');
S('xx (unknown to ICU) falls back to English', row('xx'), 'Mon, Oct 12, 2026, 10:30 AM; Mon, Oct 12, 2026, 11:00 AM');
S('malformed language "e n!" falls back to English, no throw', row('e n!'), 'Mon, Oct 12, 2026, 10:30 AM; Mon, Oct 12, 2026, 11:00 AM');
S('client with no language yet falls back to English', row(''), 'Mon, Oct 12, 2026, 10:30 AM; Mon, Oct 12, 2026, 11:00 AM');
S('no Clients row (Client gives {} with alwaysOutputData) falls back to English', {}, 'Mon, Oct 12, 2026, 10:30 AM; Mon, Oct 12, 2026, 11:00 AM');
S('Task 20 regression: the weekday is computed, 2030-01-07 is a Monday (de)', row('de'), 'Mo., 7. Jan. 2030, 14:00', ['2030-01-07T14:00:00+01:00']);
S('Settings.timezone decides the local time (UTC slot shown at 10:30 Berlin)', row('ru'), 'пн, 12 окт. 2026 г., 10:30', ['2026-10-12T08:30:00Z']);
S('Settings.timezone decides the local time (America/New_York, en)', row('en'), 'Mon, Oct 12, 2026, 4:30 AM', ['2026-10-12T08:30:00Z'], 'America/New_York');
S('no slots offered -> empty', row('ru'), '', []);
check('no U+202F / U+00A0 in slots_local (en, de, es, ru, fr, it)', ['en', 'de', 'es', 'ru', 'fr', 'it'].every((l) => !/[  ]/.test(slotsLocal(row(l), OCT))), 'a no-break space found');
const verdictExpr = assign('Result', 'verdict');
check('Result.verdict is unchanged: the machine interface stays ISO (Compute\'s verdict)', verdictExpr === "={{ $('Compute').first().json.verdict }}", verdictExpr);
const names = WF.nodes.map((x) => x.name).sort().join(',');
check('no node added: 0 new Airtable calls (slots_local reads the Client search that already runs)',
  names === 'Check Settings,Client,Client Formula,Compute,FreeBusy,Has Client?,Result,Save Offer,Services,Settings,Trigger' && node(WF, 'Client').alwaysOutputData === true, names);

// ---- the agent shows slots_local as written ----
const sys = String((((node(WF2, 'Agent').parameters || {}).options) || {}).systemMessage || '');
check('wf2 system prompt: no English time example ("Tue, Sep 22 at 2:00 PM") any more', !/Tue, Sep 22 at 2:00 PM/.test(sys), sys.slice(-1200));
check('wf2 system prompt: days and times are copied from slots_local exactly as written', /slots_local[^\n]*exactly as written/.test(sys), sys.slice(-1200));
// Mini-task C (2026-10-12): the agent writes in the same formal register as send_message's translated templates (Render's
// form-of-address map); the live proof of B had es agent replies in tú ("¿me dices tu nombre") and templates in usted.
check('wf2 system prompt (C): one line tells the agent to use the formal form of address, never the informal one',
  /\nWrite to the client in the formal form of address of their language \(Sie, usted, vous, вы, …\), never the informal one\.\n/.test(sys), sys.slice(0, 900));
// Mini-task C, requirement 9 (owner 2026-10-12): the AI disclosure names AI. Dialog 11 run 1 (log 2026-10-12, finding 1): the
// agent wrote "Soy la asistente virtual de …" with no word for AI; the prompt's first line called it "the virtual front desk".
check('wf2 system prompt (C-9): the first line no longer calls the agent "virtual" ("virtual front desk" is gone)',
  /^=You are the AI front-desk assistant of a medical aesthetics clinic\./.test(sys) && !/virtual front desk/.test(sys), sys.slice(0, 200));
// Mini-task D ride-along (C review minor): "Do not repeat it" -> "Do not repeat the disclosure" (the pronoun's referent was unclear).
check('wf2 system prompt (C-9, D): rule 1\'s disclosure needs the word for AI in the client\'s language; "virtual assistant" alone does not count',
  /saying that you are the clinic's AI assistant and that a team member can take over on request; that sentence must contain the word for AI in the client's language \(AI, ИИ, IA, KI, …\), and "virtual assistant" alone does not count\. Do not repeat the disclosure in later replies, and do not volunteer it to a KNOWN client\./.test(sys), sys.slice(0, 2600));
check('wf2 system prompt (C-9): "Never claim to be a human" keeps its meaning (line unchanged)',
  /\n- If a client asks whether they are talking to a bot, an AI or a human, answer truthfully that you are the clinic's AI assistant and offer to connect a team member\. Never claim to be a human\.\n/.test(sys), 'line changed');
// Final review I1: WF-1 confirms only a summary that is still the bot's last message, so after a change of mind the agent must
// propose the new slot (propose_booking cancels the client's earlier pending row in Cancel Old).
check('wf2 system prompt (final review I1): step 3 tells the agent to call propose_booking again when the client agrees to a different slot after a summary',
  /\n3\. [^\n]*If, after the summary, the client asks for a different time and agrees to a new slot, call propose_booking for that slot: it replaces the earlier proposal and a new summary is sent, because a yes to your question never confirms the earlier summary\./.test(sys), sys.slice(0, 200));
check('wf2 system prompt equals prompts/agent-system-prompt.md (sync-assets.sh contract: "=" + the file)', sys === '=' + PROMPT.replace(/\r/g, '').replace(/\n$/, ''), sys.length + ' vs ' + PROMPT.length);
const desc = String((node(WF2, 'check_availability').parameters || {}).description || '');
check('wf2 check_availability tool: slots_local is already in the client\'s language, shown exactly as written (no "translated if needed")',
  /client's language/.test(desc) && /exactly as written/.test(desc) && !/translated if needed/.test(desc), desc);
const ca = ((node(WF2, 'check_availability').parameters || {}).workflowInputs || {}).value || {};
check('wf2 check_availability tool inputs unchanged: date stays YYYY-MM-DD (machine interface)', /\$fromAI\('date', 'YYYY-MM-DD in the clinic timezone'/.test(ca.date || ''), ca.date);

console.log('\nCHECK_AVAILABILITY_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
