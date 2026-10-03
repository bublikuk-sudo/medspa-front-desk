// Stub test for WF-5 (workflows/wf5-reminders.json): the Code nodes Contact, Contact 2, Orphan Alert, every non-trivial
// expression (Airtable formulas, record ids, report texts, send inputs) and the wiring.
// Runs inside the n8n container's Node (see tests/wf5-code-stubs.sh), which prepends:
//   const WF = <the workflow JSON>;
// No network, no n8n runtime: $json / $ / $now are stubbed.

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const node = (n) => WF.nodes.find((x) => x.name === n) || {};
const stripExpr = (e) => String(e).replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');

// $('Name') -> { item: {json}, first(): {json}, all(): [...] } from a map of node name -> items (array of json).
const dollar = (nodes) => (name) => {
  const items = nodes[name];
  if (items === undefined) throw new Error('node "' + name + '" has not run');
  const arr = Array.isArray(items) ? items : [items];
  return { item: { json: arr[0] }, first: () => ({ json: arr[0] }), all: () => arr.map((json) => ({ json })) };
};
const $now = { toUTC: () => ({ toISO: () => new Date().toISOString() }) };

// Code node, run once for each item: $json is the item, the code returns one { json }.
const runEach = (nodeName, json, nodes) => new Function('$json', '$', node(nodeName).parameters.jsCode)(json, dollar(nodes));
// Code node, run once for all items.
const runAll = (nodeName, items) => {
  const arr = items.map((json) => ({ json }));
  return new Function('$input', '$', node(nodeName).parameters.jsCode)({ all: () => arr, first: () => arr[0] }, dollar({}));
};
// Expression "={{ ... }}" evaluated against $json and named nodes.
const expr = (e, json, nodes = {}) => new Function('$json', '$', '$now', 'return (' + stripExpr(e) + ');')(json, dollar(nodes), $now);
// An expression string that is a plain formula (no "={{") is used as is.
const throws = (f) => { try { f(); return false; } catch (e) { return true; } };

// ---------------------------------------------------------------- Contact / Contact 2
const rec = (fields, id = 'recAPPT1') => ({ id, createdTime: 'x', fields });
for (const [cn, src] of [['Contact', 'Due Reminders'], ['Contact 2', 'Due Revisits']]) {
  const run = (client, appt, id) => runEach(cn, client, { [src]: rec(appt, id) });
  const base = { appt_id: 'A-1', created_via: 'tg' };
  let r = run(rec({ phone: '+491701234567', telegram_chat_id: '4242' }, 'recC1'), base, 'recAPPT9');
  check(cn + ': tg visit, both ids -> tg, rec_id of the APPOINTMENT', same(r, { json: { contact_id: 'tg:4242', appt_id: 'A-1', rec_id: 'recAPPT9' } }), r);
  r = run(rec({ phone: '+491701234567', telegram_chat_id: '4242' }), { ...base, created_via: 'wa' });
  check(cn + ': wa visit, both ids -> wa', r.json.contact_id === 'wa:+491701234567', r);
  r = run(rec({ telegram_chat_id: '4242' }), { ...base, created_via: 'wa' });
  check(cn + ': wa visit but no phone -> tg fallback', r.json.contact_id === 'tg:4242', r);
  r = run(rec({ phone: '+491701234567' }), base);
  check(cn + ': tg visit but only phone -> wa fallback', r.json.contact_id === 'wa:+491701234567', r);
  r = run(rec({ phone: '+491701234567' }), { ...base, created_via: 'test' });
  check(cn + ': created_via test, only phone -> wa', r.json.contact_id === 'wa:+491701234567', r);
  r = run(rec({ telegram_chat_id: 4242 }), { ...base, created_via: 'owner' });
  check(cn + ': numeric chat id', r.json.contact_id === 'tg:4242', r);
  r = run(rec({}), base);
  check(cn + ': client without any id -> empty contact_id (send_message throws, owner is told), no "undefined"', r.json.contact_id === '' && !JSON.stringify(r).includes('undefined'), r);
  r = run({ id: 'recC1' }, base);
  check(cn + ': client without fields -> empty contact_id, no throw', r.json.contact_id === '', r);
  r = run(rec({ phone: '  +49170  ', telegram_chat_id: ' 4242 ' }), { ...base, created_via: 'wa' });
  check(cn + ': ids are trimmed', r.json.contact_id === 'wa:+49170', r);
  check(cn + ': reads the visit from "' + src + '" (a stale name would throw)', throws(() => runEach(cn, rec({}), {})), 'did not throw');
  check(cn + ': mode runOnceForEachItem', node(cn).parameters.mode === 'runOnceForEachItem');
}

// ---------------------------------------------------------------- Orphan Alert
let r = runAll('Orphan Alert', [{}]);
check('Orphan Alert: only the empty item from Always Output Data -> no item', same(r, []), r);
r = runAll('Orphan Alert', []);
check('Orphan Alert: no items -> no item', same(r, []), r);
r = runAll('Orphan Alert', [rec({ appt_id: 'A-1' }), rec({ appt_id: 'A-2' }), {}, rec({})]);
check('Orphan Alert: two ids -> one message listing both', r.length === 1 && r[0].json.text.includes('2 expired') && r[0].json.text.includes('A-1, A-2') && !r[0].json.text.includes('undefined'), r);
r = runAll('Orphan Alert', Array.from({ length: 25 }, (_, i) => rec({ appt_id: 'A-' + i })));
check('Orphan Alert: 25 ids -> first 20 and "5 more"', r.length === 1 && r[0].json.text.includes('25 expired') && r[0].json.text.includes('A-19') && !r[0].json.text.includes('A-20,') && r[0].json.text.includes('5 more'), r);

// ---------------------------------------------------------------- Airtable formulas
const dr = node('Due Reminders').parameters.filterByFormula;
const f24 = expr(dr, { fields: { reminder_hours_before: 24 } });
check('Due Reminders formula (24)', f24 === "AND({status}='booked',IS_AFTER({start_dt},NOW()),IS_BEFORE({start_dt},DATEADD(NOW(),24,'hours')))", f24);
check('Due Reminders formula: Airtable number as string "24" gives the same', expr(dr, { fields: { reminder_hours_before: '24' } }) === f24);
check('Due Reminders formula: Settings row missing -> throws (run fails loudly -> WF-6)', throws(() => expr(dr, {})));
check('Due Reminders formula: hours missing -> NaN, which Airtable rejects (not a silent empty window)', expr(dr, { fields: {} }).includes('NaN'));
check('Expired Pending formula', node('Expired Pending').parameters.filterByFormula === "AND({status}='pending',IS_BEFORE({pending_expires_at},NOW()),{calendar_event_id}=BLANK())");
check('Orphan Pending formula', node('Orphan Pending').parameters.filterByFormula === "AND({status}='pending',IS_BEFORE({pending_expires_at},NOW()),NOT({calendar_event_id}=BLANK()))");
check('Due Revisits formula', node('Due Revisits').parameters.filterByFormula === "AND({status}='done',{next_visit_in}>0,{revisit_invited_at}=BLANK(),IS_BEFORE(DATEADD({start_dt},{next_visit_in},'days'),NOW()))");
check('Expired Pending and Orphan Pending are exact complements on calendar_event_id', node('Expired Pending').parameters.filterByFormula.replace('{calendar_event_id}=BLANK()', 'X') === node('Orphan Pending').parameters.filterByFormula.replace('NOT({calendar_event_id}=BLANK())', 'X'));

// ---------------------------------------------------------------- If nodes, record ids, marks
for (const n of ['Has Appt?', 'Has Appt? 2', 'Has Appt? 3']) {
  const e = node(n).parameters.conditions.conditions[0].leftValue;
  check(n + ': record with appt_id -> true', expr(e, rec({ appt_id: 'A-1' })) === true);
  check(n + ': empty item (Always Output Data) -> false', expr(e, {}) === false);
  check(n + ': record without appt_id -> false', expr(e, rec({ status: 'booked' })) === false);
}
for (const n of ['Client', 'Client 2']) {
  const p = node(n).parameters;
  check(n + ': Get Clients by the first linked record id', p.operation === 'get' && expr(p.id, rec({ client: ['recCLIENT1'] })) === 'recCLIENT1');
  check(n + ': visit without client link -> throws inside the node (error output), not a wrong lookup', throws(() => expr(p.id, rec({}))));
}
const mr = node('Mark Reminded').parameters.columns.value;
check('Mark Reminded: id from Contact, status reminded', expr(mr.id, {}, { Contact: { rec_id: 'recAPPT1' } }) === 'recAPPT1' && mr.status === 'reminded');
const ts = expr(mr.reminder_sent_at, {});
check('Mark Reminded: reminder_sent_at is ISO UTC (WF-1 reminder gate compares it)', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(ts), ts);
const me = node('Mark Expired').parameters.columns.value;
check('Mark Expired: id from the row, status cancelled, nothing else', expr(me.id, { id: 'recP1' }) === 'recP1' && me.status === 'cancelled' && same(Object.keys(me), ['id', 'status']));
const mi = node('Mark Invited').parameters.columns.value;
check('Mark Invited: id from Contact 2, revisit_invited_at ISO', expr(mi.id, {}, { 'Contact 2': { rec_id: 'recAPPT2' } }) === 'recAPPT2' && /Z$/.test(expr(mi.revisit_invited_at, {})));
check('Mark Invited: does not touch status', !('status' in mi));

// ---------------------------------------------------------------- send_message inputs
for (const [n, key] of [['Send Reminder', 'REMINDER'], ['Send Revisit', 'REVISIT']]) {
  const p = node(n).parameters, v = p.workflowInputs.value;
  const ctx = { contact_id: 'tg:4242', appt_id: 'A-1', rec_id: 'recX' };
  check(n + ': calls send_message, once per item', p.workflowId.value === 'WFID:send_message' && p.mode === 'each');
  check(n + ': inputs', expr(v.contact_id, ctx) === 'tg:4242' && expr(v.appt_id, ctx) === 'A-1' && v.template_key === key && v.outside_window === 'true' && v.text === '' && v.vars_json === '', v);
  check(n + ': error output on', node(n).onError === 'continueErrorOutput');
}

// ---------------------------------------------------------------- report texts
const reports = [
  ['Report Reminder Failure', { Contact: { appt_id: 'A-7' } }, 'Reminder failed for A-7: '],
  ['Report Revisit Failure', { 'Contact 2': { appt_id: 'A-8' } }, 'Revisit invite failed for A-8: '],
  ['Report Client Failure', {}, 'client lookup failed ('],
];
for (const [n, nodes, head] of reports) {
  const t = node(n).parameters.workflowInputs.value.text;
  let x = expr(t, { error: 'Not found' }, nodes);
  check(n + ': string error (what the nodes emit)', x.includes(head) && x.includes('Not found'), x);
  x = expr(t, { error: { message: 'boom' } }, nodes);
  check(n + ': object error', x.includes('boom'), x);
  x = expr(t, {}, nodes);
  check(n + ': no error text -> "see WF-6"', x.includes('see WF-6'), x);
  x = expr(t, { error: 'e'.repeat(1000) }, nodes);
  check(n + ': long error is cut to 300', x.length < 400, x.length);
}
check('Report Orphans: sends the Orphan Alert text', expr(node('Report Orphans').parameters.workflowInputs.value.text, { text: 'hello' }) === 'hello');

// ---------------------------------------------------------------- wiring
const names = new Set(WF.nodes.map((n) => n.name));
const targets = (from, out = 0) => (((WF.connections[from] || {}).main || [])[out] || []).map((c) => c.node);
let bad = [];
for (const [from, c] of Object.entries(WF.connections)) {
  if (!names.has(from)) bad.push('unknown source ' + from);
  for (const outs of c.main) for (const t of outs) if (!names.has(t.node)) bad.push('unknown target ' + t.node);
}
check('every connection joins existing nodes', bad.length === 0, bad);
check('Hourly and Run Now -> Settings', same(targets('Hourly'), ['Settings']) && same(targets('Run Now'), ['Settings']));
check('Settings -> the four searches', same(targets('Settings'), ['Due Reminders', 'Expired Pending', 'Orphan Pending', 'Due Revisits']));
check('reminder chain', same(targets('Due Reminders'), ['Has Appt?']) && same(targets('Has Appt?'), ['Client']) && same(targets('Client'), ['Contact']) && same(targets('Contact'), ['Send Reminder']));
check('Send Reminder: success -> Mark Reminded, error -> Report Reminder Failure', same(targets('Send Reminder', 0), ['Mark Reminded']) && same(targets('Send Reminder', 1), ['Report Reminder Failure']));
check('Client / Client 2 error outputs -> Report Client Failure', same(targets('Client', 1), ['Report Client Failure']) && same(targets('Client 2', 1), ['Report Client Failure']));
check('expiry chain', same(targets('Expired Pending'), ['Has Appt? 2']) && same(targets('Has Appt? 2'), ['Mark Expired']));
check('orphan chain', same(targets('Orphan Pending'), ['Orphan Alert']) && same(targets('Orphan Alert'), ['Report Orphans']));
check('revisit chain', same(targets('Due Revisits'), ['Has Appt? 3']) && same(targets('Has Appt? 3'), ['Client 2']) && same(targets('Client 2'), ['Contact 2']) && same(targets('Contact 2'), ['Send Revisit']));
check('Send Revisit: success -> Mark Invited, error -> Report Revisit Failure', same(targets('Send Revisit', 0), ['Mark Invited']) && same(targets('Send Revisit', 1), ['Report Revisit Failure']));
check('If false outputs go nowhere (an empty item ends the branch)', ['Has Appt?', 'Has Appt? 2', 'Has Appt? 3'].every((n) => targets(n, 1).length === 0));
check('the Mark / Report nodes are terminal', ['Mark Reminded', 'Mark Expired', 'Mark Invited', 'Report Reminder Failure', 'Report Revisit Failure', 'Report Client Failure', 'Report Orphans'].every((n) => !WF.connections[n]));
const unreachable = WF.nodes.map((n) => n.name).filter((n) => !['Hourly', 'Run Now'].includes(n) && !Object.values(WF.connections).some((c) => c.main.some((o) => o.some((t) => t.node === n))));
check('no unreachable node', unreachable.length === 0, unreachable);

// ---------------------------------------------------------------- settings of every node
check('errorWorkflow is WF-6', WF.settings.errorWorkflow === 'WFID:wf6-error-handler');
check('Hourly: every hour at minute 5', same(node('Hourly').parameters.rule.interval, [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 5 }]));
check('Run Now: POST, Header Auth with MedSpa Test Key, path = workflow name, waits for the run', node('Run Now').parameters.httpMethod === 'POST' && node('Run Now').parameters.path === 'wf5-reminders' && node('Run Now').parameters.authentication === 'headerAuth' && node('Run Now').credentials.httpHeaderAuth.name === 'MedSpa Test Key' && node('Run Now').parameters.responseMode === 'lastNode');
const noRetry = WF.nodes.filter((n) => n.type === 'n8n-nodes-base.airtable' && !(n.retryOnFail === true && n.maxTries === 2 && n.waitBetweenTries === 5000)).map((n) => n.name);
check('every Airtable node: retryOnFail, maxTries 2, wait 5000', noRetry.length === 0, noRetry);
const noErr = WF.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow' && n.onError !== 'continueErrorOutput').map((n) => n.name);
check('every Execute Workflow node has an error output', noErr.length === 0, noErr);
const noAo = ['Settings', 'Due Reminders', 'Expired Pending', 'Orphan Pending', 'Due Revisits'].filter((n) => node(n).alwaysOutputData !== true);
check('searches have Always Output Data', noAo.length === 0, noAo);
const ret = ['Due Reminders', 'Expired Pending', 'Orphan Pending', 'Due Revisits'].filter((n) => node(n).parameters.returnAll !== true);
check('searches return all', ret.length === 0, ret);
const ids = WF.nodes.map((n) => n.id);
check('node ids and names are unique', new Set(ids).size === ids.length && names.size === WF.nodes.length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
