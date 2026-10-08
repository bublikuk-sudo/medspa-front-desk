// Stub test for WF-5 (workflows/wf5-reminders.json): the Code nodes Contact, Contact 2 (the marketing-consent join), Orphan Alert, every non-trivial
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
  // itemMatching(i): the node's item linked to input item i; arr[i] missing = pairing lost (the real call throws then).
  // all(branch): only branch 0 (the success output) is modelled; any other branch is an error here, like asking the wrong output.
  return {
    item: { json: arr[0] }, first: () => ({ json: arr[0] }),
    all: (branch) => { if (branch !== undefined && branch !== 0) throw new Error('only output 0 is modelled'); return arr.map((json) => ({ json })); },
    itemMatching: (i) => { if (arr[i] === undefined) throw new Error('Can\'t get data for expression: no paired item'); return { json: arr[i] }; },
  };
};
const $now = { toUTC: () => ({ toISO: () => new Date().toISOString() }) };

// Code node, run once for each item: $json is the item, the code returns one { json }.
const runEach = (nodeName, json, nodes) => new Function('$json', '$', node(nodeName).parameters.jsCode)(json, dollar(nodes));
// Code node, run once for all items.
// nodes: named upstream nodes for $('..'); sd: the workflow static data object.
const runAll = (nodeName, items, nodes = {}, sd = {}) => {
  const arr = items.map((json) => ({ json }));
  return new Function('$input', '$', '$getWorkflowStaticData', node(nodeName).parameters.jsCode)({ all: () => arr, first: () => arr[0] }, dollar(nodes), (t) => { if (t !== 'global') throw new Error('only global'); return sd; });
};
// Expression "={{ ... }}" evaluated against $json and named nodes.
const expr = (e, json, nodes = {}) => new Function('$json', '$', '$now', 'return (' + stripExpr(e) + ');')(json, dollar(nodes), $now);
// An expression string that is a plain formula (no "={{") is used as is.
const throws = (f) => { try { f(); return false; } catch (e) { return true; } };

// ---------------------------------------------------------------- Contact (reminders, one Get per row) / Contact 2 (revisits, consent join)
const rec = (fields, id = 'recAPPT1') => ({ id, createdTime: 'x', fields });
// Contact 2 runs once for all items: $input = the Consenting Clients records, $('Has Appt? 3').all(0) = the due revisit rows.
// runC2(client, appt, id): one due row whose client is the given record; the record is in the consent search result as given
// (a consenting client carries marketing_consent: true; the helper adds it unless the record says otherwise), so the
// contact rule tests below run unchanged for both Code nodes.
const runC2 = (client, appt, id) => {
  const crec = { id: client.id || 'recC1', ...client, fields: client.fields === undefined ? { marketing_consent: true } : { marketing_consent: true, ...client.fields } };
  try {
    const out = runAll('Contact 2', [crec], { 'Has Appt? 3': [rec({ ...appt, client: [crec.id] }, id)] });
    return out[0] || { json: {} };
  } catch (e) { return { json: { threw: String(e.message) } }; }
};
// block(name, fn): a group of checks that must not abort the whole suite when the workflow is not built yet (RED).
const block = (name, fn) => { try { fn(); } catch (e) { check(name + ' (the block threw)', false, String(e.message)); } };
for (const [cn, src] of [['Contact', 'Due Reminders'], ['Contact 2', 'Has Appt? 3']]) {
  const run = cn === 'Contact' ? (client, appt, id) => runEach(cn, client, { [src]: rec(appt, id) }) : runC2;
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
  if (cn === 'Contact') {
    check(cn + ': reads the visit from "' + src + '" (a stale name would throw)', throws(() => runEach(cn, rec({}), {})), 'did not throw');
    check(cn + ': mode runOnceForEachItem', node(cn).parameters.mode === 'runOnceForEachItem');
  } else {
    check(cn + ': reads the visits from "' + src + '" (a stale name would throw)', throws(() => runAll(cn, [rec({ marketing_consent: true }, 'recC1')], {})), 'did not throw');
    check(cn + ': mode runOnceForAllItems (one consent search per run, joined here)', node(cn).parameters.mode === 'runOnceForAllItems');
  }
}

// ---------------------------------------------------------------- Contact 2: marketing consent (REVISIT is MARKETING)
{
  const yes = (id, f = {}) => rec({ marketing_consent: true, telegram_chat_id: '42' + id.slice(-1), ...f }, id);
  const due = (appt_id, client, extra = {}) => rec({ appt_id, created_via: 'tg', ...(client ? { client: [client] } : {}), ...extra }, 'r-' + appt_id);
  const c2 = (clients, rows) => { try { return runAll('Contact 2', clients, { 'Has Appt? 3': rows }).map((x) => x.json); } catch (e) { return [{ threw: String(e.message) }]; } };
  let x = c2([yes('recC1')], [due('A-1', 'recC1'), due('A-2', 'recC2')]);
  check('Contact 2: only the visit whose client is in the consent search is sent; the other is skipped (no item, so not sent and not marked)', same(x, [{ contact_id: 'tg:421', appt_id: 'A-1', rec_id: 'r-A-1' }]), x);
  x = c2([rec({ telegram_chat_id: '4242' }, 'recC1'), rec({ marketing_consent: false, telegram_chat_id: '4243' }, 'recC2')], [due('A-1', 'recC1'), due('A-2', 'recC2')]);
  check('Contact 2: a client record WITHOUT marketing_consent true is not sent even if the search returned it (defence in depth)', same(x, []), x);
  x = c2([rec({ marketing_consent: 'true', telegram_chat_id: '4242' }, 'recC1')], [due('A-1', 'recC1')]);
  check('Contact 2: consent must be the checkbox value true, not a truthy string', same(x, []), x);
  x = c2([{}], [due('A-1', 'recC1'), {}]);
  check('Contact 2: nobody consented (the empty item from Always Output Data) -> nothing sent, no alert', same(x, []), x);
  x = c2([yes('recC1')], [due('A-1', 'recC1'), {}, rec({ status: 'done' }, 'r-x')]);
  check('Contact 2: rows without appt_id are ignored', x.length === 1 && x[0].appt_id === 'A-1', x);
  x = c2([yes('recC1'), yes('recC3')], [due('A-1', 'recC1'), due('A-2', 'recC2'), due('A-3', 'recC1'), due('A-4', 'recC3')]);
  check('Contact 2: two visits of the same consenting client -> two items, in row order', same(x.map((i) => i.appt_id), ['A-1', 'A-3', 'A-4']) && x.every((i) => !i.key), x);
  x = c2([yes('recC1')], [due('A-9'), due('A-1', 'recC1')]);
  check('Contact 2: a visit without a client link -> one owner alert item (key client2:<appt_id>), never a send', x.length === 2 && x[0].key === 'client2:A-9' && /A-9/.test(x[0].text) && /no client/i.test(x[0].text) && !('contact_id' in x[0]) && x[1].appt_id === 'A-1', x);
  x = c2([], [due('A-1', 'recC1')]);
  check('Contact 2: no input items at all -> no throw, nothing sent', same(x, []), x);
  check('Contact 2: does not read the old per-row Get', !node('Contact 2').parameters.jsCode.includes("$('Client 2')") && !node('Contact 2').parameters.jsCode.includes("$('Due Revisits').item"));
}

// ---------------------------------------------------------------- Consenting Clients: ONE search per run, not one Get per due row
{
  const n = node('Consenting Clients'), p = n.parameters || {};
  check('Consenting Clients: Airtable search on Clients for marketing_consent', n.type === 'n8n-nodes-base.airtable' && p.operation === 'search' && (p.table || {}).value === 'ATTBL:Clients' && p.filterByFormula === '{marketing_consent}=1', p);
  check('Consenting Clients: runs ONCE per run whatever the number of due rows (executeOnce), all pages', n.executeOnce === true && p.returnAll === true);
  check('Consenting Clients: Always Output Data (Contact 2 still runs when nobody consented, for the no-link alerts)', n.alwaysOutputData === true);
  check('Consenting Clients: error output (a failed lookup must not stop the reminder and expiry branches)', n.onError === 'continueErrorOutput');
  check('the per-row Get "Client 2" is gone from the revisit branch', !WF.nodes.some((x) => x.name === 'Client 2'));
}

// ---------------------------------------------------------------- Orphan Alert
let r = runAll('Orphan Alert', [{}]);
check('Orphan Alert: only the empty item from Always Output Data -> no item', same(r, []), r);
r = runAll('Orphan Alert', []);
check('Orphan Alert: no items -> no item', same(r, []), r);
r = runAll('Orphan Alert', [rec({ appt_id: 'A-1' }), rec({ appt_id: 'A-2' }), {}, rec({})]);
check('Orphan Alert: two ids -> one message listing both', r.length === 1 && r[0].json.text.includes('2 expired') && r[0].json.text.includes('A-1, A-2') && !r[0].json.text.includes('undefined'), r);
r = runAll('Orphan Alert', [rec({ appt_id: 'A-2' }), rec({ appt_id: 'A-1' })]);
check('Orphan Alert: dedupe key = kind + SORTED id list (same rows in another order -> same key)', r.length === 1 && r[0].json.key === 'orphan:A-1,A-2', r);
r = runAll('Orphan Alert', Array.from({ length: 25 }, (_, i) => rec({ appt_id: 'A-' + i })));
check('Orphan Alert: 25 ids -> first 20 and "5 more"', r.length === 1 && r[0].json.text.includes('25 expired') && r[0].json.text.includes('A-19') && !r[0].json.text.includes('A-20,') && r[0].json.text.includes('5 more'), r);

// ---------------------------------------------------------------- Airtable formulas
const dr = node('Due Reminders').parameters.filterByFormula;
const f24 = expr(dr, { fields: { reminder_hours_before: 24 } });
check('Due Reminders formula (24): in the window AND booked at least reminder_hours_before ahead (M2)', f24 === "AND({status}='booked',IS_AFTER({start_dt},NOW()),IS_BEFORE({start_dt},DATEADD(NOW(),24,'hours')),DATETIME_DIFF({start_dt},CREATED_TIME(),'hours')>=24)", f24);
check('Due Reminders formula (6) uses 6 in both places', expr(dr, { fields: { reminder_hours_before: 6 } }) === "AND({status}='booked',IS_AFTER({start_dt},NOW()),IS_BEFORE({start_dt},DATEADD(NOW(),6,'hours')),DATETIME_DIFF({start_dt},CREATED_TIME(),'hours')>=6)");
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
for (const n of ['Client']) {
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

// ---------------------------------------------------------------- owner alerts: shape nodes -> Dedupe Alerts -> Alert Owner
const shapeOf = (name, items, nodes) => runAll(name, items, nodes).map((x) => x.json);
const rowShapes = [
  // [shape node, upstream node that holds the row, upstream rows, key prefix, text must include, how the error item looks]
  ['Alert Reminder Send', 'Contact', 'reminder-send:', 'Reminder failed for'],
  ['Alert Revisit Send', 'Contact 2', 'revisit-send:', 'Revisit invite failed for'],
  ['Alert Reminder Mark', 'Contact', 'reminder-mark:', 'SENT'],
  ['Alert Revisit Mark', 'Contact 2', 'revisit-mark:', 'SENT'],
];
for (const [n, up, prefix, head] of rowShapes) {
  const up2 = [{ appt_id: 'A-1', rec_id: 'r1' }, { appt_id: 'A-2', rec_id: 'r2' }];
  let x = shapeOf(n, [{ error: 'Not found' }, { error: { message: 'boom' } }], { [up]: up2 });
  check(n + ': one alert per failed item, key = kind + appt_id, text names the appt_id', x.length === 2 && x[0].key === prefix + 'A-1' && x[1].key === prefix + 'A-2' && x[0].text.includes(head) && x[0].text.includes('A-1') && x[1].text.includes('A-2'), x);
  check(n + ': string error (Execute Workflow) and object error (Airtable) are both shown', x[0].text.includes('Not found') && x[1].text.includes('boom'), x);
  x = shapeOf(n, [{ message: 'Airtable said no', error: { message: 'inner' } }], { [up]: up2 });
  check(n + ': Airtable error item {message, error} shows the message', x[0].text.includes('Airtable said no'), x);
  x = shapeOf(n, [{}], { [up]: up2 });
  check(n + ': no error text -> "see WF-6"', x[0].text.includes('see WF-6'), x);
  x = shapeOf(n, [{ error: 'e'.repeat(1000) }], { [up]: up2 });
  check(n + ': long error is cut', x[0].text.length < 500, x[0].text.length);
  x = shapeOf(n, [{ error: 'x' }, { error: 'y' }, { error: 'z' }], { [up]: up2 });
  check(n + ': lost pairing (3rd item has no source row) does not throw, falls back to "?"', x.length === 3 && x[2].key === prefix + '?' && !x[2].text.includes('undefined'), x);
  check(n + ': code mode all items', node(n).parameters.mode === 'runOnceForAllItems');
}
check('Alert Reminder Mark / Alert Revisit Mark: say the client may get the message again', ['Alert Reminder Mark', 'Alert Revisit Mark'].every((n) => /again/.test(shapeOf(n, [{ error: 'x' }], { Contact: [{ appt_id: 'A' }], 'Contact 2': [{ appt_id: 'A' }] })[0].text)));
check('Alert Reminder Mark / Alert Revisit Mark: the repeat comes with the next daily run, not "every hour"', ['Alert Reminder Mark', 'Alert Revisit Mark'].every((n) => { const t = shapeOf(n, [{ error: 'x' }], { Contact: [{ appt_id: 'A' }], 'Contact 2': [{ appt_id: 'A' }] })[0].text; return !/hour/.test(t) && /daily/.test(t); }));
{
  const x = shapeOf('Alert Expiry Mark', [{ message: 'nope' }, { error: 'x' }], { 'Has Appt? 2': [rec({ appt_id: 'A-5' }), rec({ appt_id: 'A-6' })] });
  check('Alert Expiry Mark: key expiry:<appt_id>, text names it', x.length === 2 && x[0].key === 'expiry:A-5' && x[1].key === 'expiry:A-6' && x[0].text.includes('A-5') && x[0].text.includes('nope'), x);
  const y = shapeOf('Alert Expiry Mark', [{ error: 'x' }], {});
  check('Alert Expiry Mark: lost source -> "?" not a throw', y.length === 1 && y[0].key === 'expiry:?', y);
}
block('Alert Client 2 (consent lookup failed)', () => {
  // Consenting Clients error output: ONE alert for the run (no row failed on its own; the one search did), naming the
  // number of due visits that wait for the next run. Nothing is sent and nothing is marked.
  const rows = [rec({ appt_id: 'A-1', client: ['recC1'] }, 'a1'), rec({ appt_id: 'A-2' }, 'a2'), {}];
  let x = shapeOf('Alert Client 2', [{ message: 'Airtable 503', error: { message: 'inner' } }], { 'Has Appt? 3': rows });
  check('Alert Client 2: consent lookup failed -> one alert, key client2:consent, names the error and the 2 waiting visits', x.length === 1 && x[0].key === 'client2:consent' && /consent/i.test(x[0].text) && x[0].text.includes('Airtable 503') && /\b2 due/.test(x[0].text) && /not sent|no revisit/i.test(x[0].text), x);
  x = shapeOf('Alert Client 2', [{}], { 'Has Appt? 3': rows });
  check('Alert Client 2: no error text -> "see WF-6", no "undefined"', x[0].text.includes('see WF-6') && !x[0].text.includes('undefined'), x);
  x = shapeOf('Alert Client 2', [{ error: 'x' }], {});
  check('Alert Client 2: lost source rows -> still one alert, count "?" not a throw', x.length === 1 && x[0].key === 'client2:consent' && x[0].text.includes('?'), x);
  check('Alert Client 2: asks the true output of Has Appt? 3 explicitly (all(0))', node('Alert Client 2').parameters.jsCode.includes("$('Has Appt? 3').all(0)"));
  check('Alert Client 2: code mode all items', node('Alert Client 2').parameters.mode === 'runOnceForAllItems');
});
for (const [n, cl, ap, prefix, what] of [['Alert Client', 'Client', 'Has Appt?', 'client:', 'reminder']]) {
  // visits A-1 and A-3 share client recC1 (read fine), A-2 has client recC2 (lookup failed), A-4 has no client link at all
  const rows = [rec({ appt_id: 'A-1', client: ['recC1'] }, 'a1'), rec({ appt_id: 'A-2', client: ['recC2'] }, 'a2'), rec({ appt_id: 'A-3', client: ['recC1'] }, 'a3'), rec({ appt_id: 'A-4' }, 'a4'), {}];
  const nodes = { [cl]: [{ id: 'recC1', fields: { name: 'X' } }], [ap]: rows };
  let x = shapeOf(n, [{ error: 'Boom 1' }, { error: 'Boom 2' }], nodes);
  check(n + ' (I3): finds the failed visits WITHOUT pairedItem - by comparing the visits with the clients that were read', x.length === 2 && x[0].key === prefix + 'A-2' && x[1].key === prefix + 'A-4', x);
  check(n + ': text carries appt_id and the client record id (or "no link")', x[0].text.includes('A-2') && x[0].text.includes('recC2') && x[1].text.includes('A-4') && x[1].text.includes('no link'), x);
  check(n + ': text names the kind and the error', x[0].text.includes(what) && x[0].text.includes('Boom 1'), x);
  x = shapeOf(n, [{ error: 'Boom' }], { [cl]: [{ id: 'recC1' }, { id: 'recC2' }], [ap]: rows.slice(0, 3) });
  check(n + ': every client was read (no row to name) -> still one generic alert, never silence', x.length === 1 && x[0].key === prefix + '?', x);
  check(n + ': asks the success output explicitly (all(0)) for both the clients and the visits', node(n).parameters.jsCode.includes("$('" + cl + "').all(0)") && node(n).parameters.jsCode.includes("$('" + ap + "').all(0)"));
}

const dd = (items, sd) => runAll('Dedupe Alerts', items, {}, sd);
{
  const sd = {};
  let x = dd([{ key: 'k1', text: 't1' }, { key: 'k2', text: 't2' }, { key: 'k1', text: 't1 again' }], sd).map((i) => i.json);
  check('Dedupe Alerts: two keys pass, the repeat of k1 in the same run is dropped', same(x, [{ text: 't1', key: 'k1' }, { text: 't2', key: 'k2' }]), x);
  check('Dedupe Alerts: keys are remembered in the workflow static data', Object.keys(sd.alertSeen || {}).sort().join() === 'k1,k2', sd);
  x = dd([{ key: 'k1', text: 't1' }, { key: 'k3', text: 't3' }], sd).map((i) => i.json);
  check('Dedupe Alerts: a later run inside 24 h (e.g. a Run Now) - k1 is throttled, new k3 passes', same(x, [{ text: 't3', key: 'k3' }]), x);
  sd.alertSeen.k1 = Date.now() - 25 * 3600 * 1000;
  sd.alertSeen.old = Date.now() - 48 * 3600 * 1000;
  x = dd([{ key: 'k1', text: 't1' }], sd).map((i) => i.json);
  check('Dedupe Alerts: after 24 h the same key alerts again', same(x, [{ text: 't1', key: 'k1' }]), x);
  check('Dedupe Alerts: keys older than 24 h are pruned, the fresh ones kept', !('old' in sd.alertSeen) && 'k1' in sd.alertSeen && 'k3' in sd.alertSeen, Object.keys(sd.alertSeen));
  sd.alertSeen.k2 = Date.now() - 23 * 3600 * 1000;
  check('Dedupe Alerts: 23 h is still inside the window', same(dd([{ key: 'k2', text: 't2' }], sd), []));
  check('Dedupe Alerts: items without key or text are dropped, not sent', same(dd([{ text: 'x' }, { key: 'z' }, {}], sd), []));
  check('Dedupe Alerts: empty input -> nothing, no throw', same(dd([], {}), []));
  check('Dedupe Alerts: uses the global workflow static data (persisted for Daily / Run Now runs, not for editor test runs)', /\$getWorkflowStaticData\('global'\)/.test(node('Dedupe Alerts').parameters.jsCode));
}
{
  const p = node('Alert Owner').parameters;
  check('Alert Owner: notify_owner, once per surviving alert, text from the item, error output on', p.workflowId.value === 'WFID:notify_owner' && p.mode === 'each' && expr(p.workflowInputs.value.text, { text: 'hello' }) === 'hello' && node('Alert Owner').onError === 'continueErrorOutput');
}
// Alert Owner failed -> Forget Alert Keys removes the keys Dedupe Alerts stamped, so the alert is retried next hour
{
  const forget = (errItems, dedupeOut, sd) => runAll('Forget Alert Keys', errItems, { 'Dedupe Alerts': dedupeOut }, sd);
  const sd = { alertSeen: { a: 1, b: 2, c: 3 } };
  let x = forget([{ error: 'boom' }], [{ text: 'ta', key: 'a' }, { text: 'tb', key: 'b' }], sd);
  check('Forget Alert Keys: the failed alert (item 0 of the alerts) gets its key removed, the others stay stamped', same(x, []) && !('a' in sd.alertSeen) && 'b' in sd.alertSeen && 'c' in sd.alertSeen, sd);
  const sd2 = { alertSeen: { a: 1, b: 2, c: 3 } };
  forget([{ error: 'x' }, { error: 'y' }], [{ text: 'ta', key: 'a' }, { text: 'tb', key: 'b' }], sd2);
  check('Forget Alert Keys: two failures -> both keys removed', !('a' in sd2.alertSeen) && !('b' in sd2.alertSeen) && 'c' in sd2.alertSeen, sd2);
  const sd3 = { alertSeen: { a: 1, b: 2, c: 3 } };
  forget([{ error: 'x' }, { error: 'y' }, { error: 'z' }], [{ text: 'ta', key: 'a' }, { text: 'tb', key: 'b' }], sd3);
  check('Forget Alert Keys: lost pairing -> every key of this run is forgotten (a repeated alert beats a lost one), older keys stay', !('a' in sd3.alertSeen) && !('b' in sd3.alertSeen) && 'c' in sd3.alertSeen, sd3);
  const sd4 = {};
  x = forget([{ error: 'x' }], [{ text: 'ta', key: 'a' }], sd4);
  check('Forget Alert Keys: empty static data -> no throw, returns no item', same(x, []));
  check('Forget Alert Keys: Alert Owner error output -> Forget Alert Keys, and it is terminal', same((WF.connections['Alert Owner'].main[1] || []).map((c) => c.node), ['Forget Alert Keys']) && !WF.connections['Forget Alert Keys'] && WF.connections['Alert Owner'].main[0].length === 0);
  check('Forget Alert Keys: all-items Code node', node('Forget Alert Keys').parameters.mode === 'runOnceForAllItems');
  check('Client note no longer names a node that does not exist', !JSON.stringify(WF).includes('Report Client Failure'));
}
check('the old per-source Report nodes are gone (every alert goes through the dedupe)', ['Report Reminder Failure', 'Report Revisit Failure', 'Report Client Failure', 'Report Orphans'].every((n) => !(n in Object.fromEntries(WF.nodes.map((x) => [x.name, 1])))));
const execNodes = WF.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow' && n.parameters.workflowId.value === 'WFID:notify_owner').map((n) => n.name);
check('notify_owner is called from exactly one node, Alert Owner', same(execNodes, ['Alert Owner']), execNodes);

// ---------------------------------------------------------------- wiring
const names = new Set(WF.nodes.map((n) => n.name));
const targets = (from, out = 0) => (((WF.connections[from] || {}).main || [])[out] || []).map((c) => c.node);
let bad = [];
for (const [from, c] of Object.entries(WF.connections)) {
  if (!names.has(from)) bad.push('unknown source ' + from);
  for (const outs of c.main) for (const t of outs) if (!names.has(t.node)) bad.push('unknown target ' + t.node);
}
check('every connection joins existing nodes', bad.length === 0, bad);
check('Daily and Run Now -> Settings', same(targets('Daily'), ['Settings']) && same(targets('Run Now'), ['Settings']));
check('Settings -> the four searches', same(targets('Settings'), ['Due Reminders', 'Expired Pending', 'Orphan Pending', 'Due Revisits']));
check('reminder chain', same(targets('Due Reminders'), ['Has Appt?']) && same(targets('Has Appt?'), ['Client']) && same(targets('Client'), ['Contact']) && same(targets('Contact'), ['Send Reminder']));
check('expiry chain', same(targets('Expired Pending'), ['Has Appt? 2']) && same(targets('Has Appt? 2'), ['Mark Expired']));
check('revisit chain: Due Revisits -> Has Appt? 3 -> Consenting Clients -> Contact 2 -> Revisit Alert?', same(targets('Due Revisits'), ['Has Appt? 3']) && same(targets('Has Appt? 3'), ['Consenting Clients']) && same(targets('Consenting Clients'), ['Contact 2']) && same(targets('Contact 2'), ['Revisit Alert?']));
block('Revisit Alert?', () => {
  const e = node('Revisit Alert?').parameters.conditions.conditions[0].leftValue;
  check('Revisit Alert?: an alert item (key) -> true, a send item -> false', expr(e, { key: 'client2:A-1', text: 't' }) === true && expr(e, { contact_id: 'tg:1', appt_id: 'A-1', rec_id: 'r' }) === false);
  check('Revisit Alert?: true -> Dedupe Alerts, false -> Send Revisit', same(targets('Revisit Alert?', 0), ['Dedupe Alerts']) && same(targets('Revisit Alert?', 1), ['Send Revisit']));
});
check('If false outputs go nowhere (an empty item ends the branch)', ['Has Appt?', 'Has Appt? 2', 'Has Appt? 3'].every((n) => targets(n, 1).length === 0));
check('Send Reminder: success -> Mark Reminded, error -> Alert Reminder Send', same(targets('Send Reminder', 0), ['Mark Reminded']) && same(targets('Send Reminder', 1), ['Alert Reminder Send']));
check('Send Revisit: success -> Mark Invited, error -> Alert Revisit Send', same(targets('Send Revisit', 0), ['Mark Invited']) && same(targets('Send Revisit', 1), ['Alert Revisit Send']));
check('Client -> Alert Client, Consenting Clients -> Alert Client 2 (error outputs)', same(targets('Client', 1), ['Alert Client']) && same(targets('Consenting Clients', 1), ['Alert Client 2']));
check('I1: Mark Reminded and Mark Invited have an error output into their alert (the send already happened)', node('Mark Reminded').onError === 'continueErrorOutput' && node('Mark Invited').onError === 'continueErrorOutput' && same(targets('Mark Reminded', 1), ['Alert Reminder Mark']) && same(targets('Mark Invited', 1), ['Alert Revisit Mark']));
check('M1: Mark Expired has an error output into Alert Expiry Mark', node('Mark Expired').onError === 'continueErrorOutput' && same(targets('Mark Expired', 1), ['Alert Expiry Mark']));
check('Mark nodes success outputs go nowhere', ['Mark Reminded', 'Mark Invited', 'Mark Expired'].every((n) => targets(n, 0).length === 0));
check('orphan chain: Orphan Pending -> Orphan Alert -> Dedupe Alerts', same(targets('Orphan Pending'), ['Orphan Alert']) && same(targets('Orphan Alert'), ['Dedupe Alerts']));
const shapes = ['Alert Reminder Send', 'Alert Revisit Send', 'Alert Reminder Mark', 'Alert Revisit Mark', 'Alert Expiry Mark', 'Alert Client', 'Alert Client 2'];
check('every shape node -> Dedupe Alerts (the only way to the owner)', shapes.every((n) => same(targets(n), ['Dedupe Alerts'])), shapes.map((n) => targets(n)));
check('Dedupe Alerts -> Alert Owner (no success output)', same(targets('Dedupe Alerts'), ['Alert Owner']) && targets('Alert Owner', 0).length === 0);
const unreachable = WF.nodes.map((n) => n.name).filter((n) => !['Daily', 'Run Now'].includes(n) && !Object.values(WF.connections).some((c) => c.main.some((o) => o.some((t) => t.node === n))));
check('no unreachable node', unreachable.length === 0, unreachable);

// ---------------------------------------------------------------- settings of every node
check('errorWorkflow is WF-6', WF.settings.errorWorkflow === 'WFID:wf6-error-handler');
// Airtable Free plan budget: once a day. GENERIC_TIMEZONE=UTC, so 07:05 UTC = 08:05 Berlin in winter (CET), 09:05 in summer (CEST).
check('Daily: once a day at 07:05 UTC', same(((node('Daily').parameters || {}).rule || {}).interval, [{ field: 'days', daysInterval: 1, triggerAtHour: 7, triggerAtMinute: 5 }]), (node('Daily').parameters || {}).rule);
check('Daily: the only schedule trigger; no "Hourly" node left', WF.nodes.filter((n) => n.type === 'n8n-nodes-base.scheduleTrigger').map((n) => n.name).join() === 'Daily');
check('no note or text still says the run is hourly', !/every hour|next hour|hourly/i.test(JSON.stringify(WF)), (JSON.stringify(WF).match(/.{60}(every hour|next hour|hourly).{20}/i) || [])[0]);
check('Run Now: POST, Header Auth with MedSpa Test Key, path = workflow name, answers at once (lastNode gave HTTP 500 when the last node had no item)', node('Run Now').parameters.httpMethod === 'POST' && node('Run Now').parameters.path === 'wf5-reminders' && node('Run Now').parameters.authentication === 'headerAuth' && node('Run Now').credentials.httpHeaderAuth.name === 'MedSpa Test Key' && node('Run Now').parameters.responseMode === 'onReceived');
const noRetry = WF.nodes.filter((n) => n.type === 'n8n-nodes-base.airtable' && !(n.retryOnFail === true && n.maxTries === 2 && n.waitBetweenTries === 5000)).map((n) => n.name);
check('every Airtable node: retryOnFail, maxTries 2, wait 5000', noRetry.length === 0, noRetry);
const noErr = WF.nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow' && n.onError !== 'continueErrorOutput').map((n) => n.name);
check('every Execute Workflow node has an error output', noErr.length === 0, noErr);
const noAo = ['Settings', 'Due Reminders', 'Expired Pending', 'Orphan Pending', 'Due Revisits', 'Consenting Clients'].filter((n) => node(n).alwaysOutputData !== true);
check('searches have Always Output Data', noAo.length === 0, noAo);
const ret = ['Due Reminders', 'Expired Pending', 'Orphan Pending', 'Due Revisits', 'Consenting Clients'].filter((n) => (node(n).parameters || {}).returnAll !== true);
check('searches return all', ret.length === 0, ret);
const ids = WF.nodes.map((n) => n.id);
check('node ids and names are unique', new Set(ids).size === ids.length && names.size === WF.nodes.length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
