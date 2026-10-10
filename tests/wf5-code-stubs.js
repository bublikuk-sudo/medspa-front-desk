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
  const want = { contact_id: 'tg:4242', appt_id: 'A-1', rec_id: 'recAPPT9' };
  check(cn + ': tg visit, both ids -> tg, rec_id of the APPOINTMENT', same(r, { json: cn === 'Contact' ? want : { ...want, marks: [{ rec_id: 'recAPPT9', appt_id: 'A-1' }] } }), r);
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
  check('Contact 2: only the visit whose client is in the consent search is sent; the other is skipped (no item, so not sent and not marked)', same(x, [{ contact_id: 'tg:421', appt_id: 'A-1', rec_id: 'r-A-1', marks: [{ rec_id: 'r-A-1', appt_id: 'A-1' }] }]), x);
  x = c2([rec({ telegram_chat_id: '4242' }, 'recC1'), rec({ marketing_consent: false, telegram_chat_id: '4243' }, 'recC2')], [due('A-1', 'recC1'), due('A-2', 'recC2')]);
  check('Contact 2: a client record WITHOUT marketing_consent true is not sent even if the search returned it (defence in depth)', same(x, []), x);
  x = c2([rec({ marketing_consent: 'true', telegram_chat_id: '4242' }, 'recC1')], [due('A-1', 'recC1')]);
  check('Contact 2: consent must be the checkbox value true, not a truthy string', same(x, []), x);
  x = c2([{}], [due('A-1', 'recC1'), {}]);
  check('Contact 2: nobody consented (the empty item from Always Output Data) -> nothing sent, no alert', same(x, []), x);
  x = c2([yes('recC1')], [due('A-1', 'recC1'), {}, rec({ status: 'done' }, 'r-x')]);
  check('Contact 2: rows without appt_id are ignored', x.length === 1 && x[0].appt_id === 'A-1', x);
  // Fix 1 / I2 (ruling 2026-10-08): a client whose consent is ticked late has a backlog of due visits. At most ONE REVISIT
  // per client per run, built from the NEWEST due visit (latest start_dt); every due visit of that client is in `marks`,
  // so after a successful send Invite Marks -> Mark Invited marks them all and the older ones never send later.
  x = c2([yes('recC1'), yes('recC3')], [due('A-1', 'recC1', { start_dt: '2026-03-01T10:00:00.000Z' }), due('A-2', 'recC2'), due('A-3', 'recC1', { start_dt: '2026-06-01T10:00:00.000Z' }), due('A-5', 'recC1', { start_dt: '2026-04-01T10:00:00.000Z' }), due('A-4', 'recC3', { start_dt: '2026-05-01T10:00:00.000Z' })]);
  check('I2: three due visits of one consenting client -> ONE item, for the newest (A-3), with all three in marks newest first; one item for the other client',
    same(x, [
      { contact_id: 'tg:421', appt_id: 'A-3', rec_id: 'r-A-3', marks: [{ rec_id: 'r-A-3', appt_id: 'A-3' }, { rec_id: 'r-A-5', appt_id: 'A-5' }, { rec_id: 'r-A-1', appt_id: 'A-1' }] },
      { contact_id: 'tg:423', appt_id: 'A-4', rec_id: 'r-A-4', marks: [{ rec_id: 'r-A-4', appt_id: 'A-4' }] },
    ]), x);
  x = c2([yes('recC1')], [due('A-7', 'recC1', { start_dt: '2026-06-01T10:00:00.000Z' }), due('A-6', 'recC1', { start_iso: '2026-07-01T12:00:00+02:00' })]);
  check('I2: start_dt missing -> start_iso decides "newest"; the contact rule uses the newest visit', x.length === 1 && x[0].appt_id === 'A-6' && x[0].marks.length === 2, x);
  x = c2([yes('recC1')], [due('A-8', 'recC1', { start_dt: '2026-06-01T10:00:00.000Z', created_via: 'wa' }), due('A-9', 'recC1', { start_dt: '2026-05-01T10:00:00.000Z' })]);
  check('I2: the channel comes from the newest visit (wa there, but the client has no phone -> tg fallback as before)', x.length === 1 && x[0].appt_id === 'A-8' && x[0].contact_id === 'tg:421', x);
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
// Fix 1 / I1 (ruling 2026-10-08): "the day before" by the clinic's calendar, not a time window. Due = booked, start ahead,
// (start's local date in Settings.timezone = tomorrow's local date OR start within reminder_hours_before), booked at least
// reminder_hours_before ahead (M2). Every visit on day D is reminded by D-1's run; one booked later but still H ahead on
// the morning of D. The earlier window (now, now + H + 24 h] reminded early-morning visits two days ahead.
const BER = 'Europe/Berlin';
const S = (h, tz = BER) => ({ fields: { reminder_hours_before: h, timezone: tz } });
const due24 = (tz) => "AND({status}='booked',IS_AFTER({start_dt},NOW()),OR(DATETIME_FORMAT(SET_TIMEZONE({start_dt},'" + tz + "'),'YYYY-MM-DD')=DATETIME_FORMAT(SET_TIMEZONE(DATEADD(NOW(),1,'days'),'" + tz + "'),'YYYY-MM-DD'),NOT(IS_AFTER({start_dt},DATEADD(NOW(),24,'hours')))),DATETIME_DIFF({start_dt},CREATED_TIME(),'hours')>=24)";
const f24 = (() => { try { return expr(dr, S(24)); } catch (e) { return 'threw: ' + e.message; } })();
check('Due Reminders formula (24, Europe/Berlin), string for string', f24 === due24(BER), f24);
check('Due Reminders formula takes the zone from Settings.timezone (no literal Berlin)', (() => { try { return expr(dr, S(24, 'America/New_York')) === due24('America/New_York'); } catch (e) { return false; } })() && !dr.includes('Berlin'));
check('Due Reminders formula: Airtable number as string "24" gives the same', (() => { try { return expr(dr, S('24')) === f24; } catch (e) { return false; } })());
check('Due Reminders formula: Settings row missing -> throws (run fails loudly -> WF-6)', throws(() => expr(dr, {})));
check('Due Reminders formula: timezone missing -> throws, not an empty or Berlin default', throws(() => expr(dr, { fields: { reminder_hours_before: 24 } })));
check('Due Reminders formula: a timezone that is not a plain IANA name (a quote, a formula) -> throws', throws(() => expr(dr, S(24, "Europe/Berlin'),TRUE(),('"))) && throws(() => expr(dr, S(24, 'Europe Berlin'))));
check('Due Reminders formula: hours missing -> NaN, which Airtable rejects (not a silent empty window)', (() => { try { return expr(dr, { fields: { timezone: BER } }).includes('NaN'); } catch (e) { return false; } })());
// A model of the Airtable formula functions this formula uses (times as UTC ms; SET_TIMEZONE + DATETIME_FORMAT via Intl,
// so DST is real; DATEADD(NOW(),1,'days') = + 24 h, as for any GMT datetime; DATETIME_DIFF truncates). It evaluates the
// formula the workflow actually builds against a record, so the cases below test behaviour, not only the string.
const atEval = (formula, rec, nowMs) => {
  const U = { hours: 3600e3, days: 86400e3 };
  const ms = (v) => (v && typeof v === 'object' ? v.ms : typeof v === 'number' ? v : Date.parse(v));
  const fn = {
    AND: (...a) => a.every(Boolean), OR: (...a) => a.some(Boolean), NOT: (a) => !a, NOW: () => nowMs,
    CREATED_TIME: () => Date.parse(rec.createdTime), IS_AFTER: (a, b) => ms(a) > ms(b), IS_BEFORE: (a, b) => ms(a) < ms(b),
    DATEADD: (d, n, u) => ms(d) + n * U[u], DATETIME_DIFF: (a, b, u) => Math.trunc((ms(a) - ms(b)) / U[u]),
    SET_TIMEZONE: (d, tz) => ({ ms: ms(d), tz }),
    DATETIME_FORMAT: (d, f) => { if (f !== 'YYYY-MM-DD') throw new Error('format ' + f); const o = d && typeof d === 'object' ? d : { ms: ms(d), tz: 'UTC' }; return new Intl.DateTimeFormat('en-CA', { timeZone: o.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(o.ms)); },
  };
  const js = formula.replace(/\{(\w+)\}/g, (_, n) => 'F(' + JSON.stringify(n) + ')').replace(/([^<>!=])=(?!=)/g, '$1==');
  return new Function(...Object.keys(fn), 'F', 'return (' + js + ');')(...Object.values(fn), (n) => rec.fields[n]);
};
const dueAt = (nowIso, startIso, { created = '2026-01-01T00:00:00.000Z', status = 'booked', h = 24, tz = BER } = {}) => {
  try { return atEval(expr(dr, S(h, tz)), { createdTime: created, fields: { status, start_dt: startIso } }, Date.parse(nowIso)); } catch (e) { return 'threw: ' + e.message; }
};
{
  const RUN = '2026-10-08T07:05:00.000Z'; // Thursday's daily run: 09:05 Berlin (CEST); tomorrow = Fri 2026-10-09
  check('I1: a visit two days ahead at 07:00 UTC (Sat 09:00 Berlin) is NOT due (the H + 24 window sent it two days early)', dueAt(RUN, '2026-10-10T07:00:00.000Z') === false, dueAt(RUN, '2026-10-10T07:00:00.000Z'));
  check('I1: a visit two days ahead at 06:30 UTC (Sat 08:30 Berlin, before the run hour) is NOT due', dueAt(RUN, '2026-10-10T06:30:00.000Z') === false);
  check('I1: tomorrow 19:30 Berlin (17:30 UTC) is due', dueAt(RUN, '2026-10-09T17:30:00.000Z') === true);
  check('I1: tomorrow 06:30 Berlin (an early clinic, 04:30 UTC) is due', dueAt(RUN, '2026-10-09T04:30:00.000Z') === true);
  check('I1: tomorrow 00:30 Berlin (22:30 UTC today) is due: the local date decides, not the UTC date', dueAt(RUN, '2026-10-08T22:30:00.000Z') === true);
  check('I1: the day after tomorrow 00:30 Berlin (22:30 UTC tomorrow) is NOT due', dueAt(RUN, '2026-10-09T22:30:00.000Z') === false);
  check('I1: later today (15:00 Berlin), booked after yesterday\'s run but >= 24 h ahead, is due (the morning of the visit)', dueAt(RUN, '2026-10-08T13:00:00.000Z', { created: '2026-10-07T12:00:00.000Z' }) === true);
  check('I1: tomorrow 07:00 Berlin booked 23 h ahead -> NOT due (booking-lead rule M2)', dueAt(RUN, '2026-10-09T05:00:00.000Z', { created: '2026-10-08T06:00:00.000Z' }) === false);
  check('I1: a visit that already started is NOT due', dueAt(RUN, '2026-10-08T07:00:00.000Z') === false);
  check('I1: status reminded is NOT due again', dueAt(RUN, '2026-10-09T17:30:00.000Z', { status: 'reminded' }) === false);
  // DST: Berlin leaves summer time on Sun 2026-10-25 (03:00 CEST -> 02:00 CET) and enters it on Sun 2027-03-28.
  const AUT = '2026-10-24T07:05:00.000Z'; // Saturday's run, 09:05 CEST
  check('DST (autumn): tomorrow = the 25-hour Sunday; 19:30 CET (18:30 UTC) is due', dueAt(AUT, '2026-10-25T18:30:00.000Z') === true);
  check('DST (autumn): 00:30 CEST on that Sunday (22:30 UTC Saturday) is due', dueAt(AUT, '2026-10-24T22:30:00.000Z') === true);
  check('DST (autumn): Monday 00:30 CET (23:30 UTC Sunday) is NOT due', dueAt(AUT, '2026-10-25T23:30:00.000Z') === false);
  const SPR = '2027-03-27T07:05:00.000Z'; // Saturday's run, 08:05 CET
  check('DST (spring): tomorrow = the 23-hour Sunday; 19:30 CEST (17:30 UTC) is due', dueAt(SPR, '2027-03-28T17:30:00.000Z') === true);
  check('DST (spring): Monday 07:00 CEST (05:00 UTC) is NOT due', dueAt(SPR, '2027-03-29T05:00:00.000Z') === false);
  check('Settings.timezone decides: 23:30 UTC Fri is Fri 19:30 in New York (tomorrow there, due) but Sat 01:30 in Berlin (not due)', dueAt(RUN, '2026-10-09T23:30:00.000Z', { tz: 'America/New_York' }) === true && dueAt(RUN, '2026-10-09T23:30:00.000Z') === false);
  // The live tests' trick: reminder_hours_before = 1 and a visit TOMORROW at a clinic hour, created a moment ago.
  check('live-test seed: H = 1, a visit tomorrow 11:00 Berlin created just now is due at once', dueAt('2026-10-08T14:00:00.000Z', '2026-10-09T09:00:00.000Z', { h: 1, created: '2026-10-08T13:59:00.000Z' }) === true);
  check('live-test seed: with H = 24 the same new visit is NOT due (booked under 24 h ahead): the trick needs H = 1', dueAt('2026-10-08T14:00:00.000Z', '2026-10-09T09:00:00.000Z', { h: 24, created: '2026-10-08T13:59:00.000Z' }) === false);
}
check('Due Reminders note describes the local-date rule and Daily\'s note the run-hour condition', /tomorrow/i.test(node('Due Reminders').notes || '') && /timezone/i.test(node('Due Reminders').notes || '') && /before the clinic/i.test(node('Daily').notes || '') && !/\+ ?24/.test((node('Due Reminders').notes || '') + (node('Daily').notes || '')), [node('Daily').notes, node('Due Reminders').notes]);
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
check('Mark Invited: id from its own item (one per visit from Invite Marks), revisit_invited_at ISO', (() => { try { return expr(mi.id, { rec_id: 'recAPPT2', appt_id: 'A-2' }) === 'recAPPT2'; } catch (e) { return false; } })() && /Z$/.test(expr(mi.revisit_invited_at, {})));
block('Invite Marks', () => {
  // Send Revisit success items -> one item per due visit of that client (Contact 2's marks), paired to the send item.
  const c2items = [
    { contact_id: 'tg:1', appt_id: 'A-3', rec_id: 'r3', marks: [{ rec_id: 'r3', appt_id: 'A-3' }, { rec_id: 'r1', appt_id: 'A-1' }] },
    { contact_id: 'tg:2', appt_id: 'A-4', rec_id: 'r4', marks: [{ rec_id: 'r4', appt_id: 'A-4' }] },
  ];
  const out = runAll('Invite Marks', [{ verdict: 'SENT tg' }, { verdict: 'SENT tg' }], { 'Contact 2': c2items });
  check('Invite Marks: every due visit of each invited client -> one item {rec_id, appt_id}, newest first', same(out.map((o) => o.json), [{ rec_id: 'r3', appt_id: 'A-3' }, { rec_id: 'r1', appt_id: 'A-1' }, { rec_id: 'r4', appt_id: 'A-4' }]), out);
  check('Invite Marks: each item is paired to its send item (Alert Revisit Mark can name the row)', same(out.map((o) => o.pairedItem), [{ item: 0 }, { item: 0 }, { item: 1 }]), out.map((o) => o.pairedItem));
  check('Invite Marks: an item without marks (older shape) still marks its own row', same(runAll('Invite Marks', [{}], { 'Contact 2': [{ appt_id: 'A-9', rec_id: 'r9' }] }).map((o) => o.json), [{ rec_id: 'r9', appt_id: 'A-9' }]));
  check('Invite Marks: a lost pairing throws (the run fails -> WF-6) rather than guess which rows to mark', throws(() => runAll('Invite Marks', [{}, {}], { 'Contact 2': [c2items[0]] })));
  check('Invite Marks: all-items Code node', node('Invite Marks').parameters.mode === 'runOnceForAllItems');
});
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
  ['Alert Revisit Mark', 'Invite Marks', 'revisit-mark:', 'SENT'],
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
check('Alert Reminder Mark / Alert Revisit Mark: say the client may get the message again', ['Alert Reminder Mark', 'Alert Revisit Mark'].every((n) => /again/.test(shapeOf(n, [{ error: 'x' }], { Contact: [{ appt_id: 'A' }], 'Contact 2': [{ appt_id: 'A' }], 'Invite Marks': [{ appt_id: 'A' }] })[0].text)));
check('Alert Reminder Mark / Alert Revisit Mark: the repeat comes with the next daily run, not "every hour"', ['Alert Reminder Mark', 'Alert Revisit Mark'].every((n) => { const t = shapeOf(n, [{ error: 'x' }], { Contact: [{ appt_id: 'A' }], 'Contact 2': [{ appt_id: 'A' }], 'Invite Marks': [{ appt_id: 'A' }] })[0].text; return !/hour/.test(t) && /daily/.test(t); }));
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

// The owner alert carries the provider's own error text: message AND cause (description) when the error item is an object
// that has one. An Execute Workflow node hands a plain string (nothing more to carry). Bounded, one line, no secrets, never throws.
block('owner alerts: the error item\'s description is the cause', () => {
  const GENERIC = 'Bad request - please check your parameters';
  const CREDIT = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';
  const anth = '{"type":"error","error":{"type":"invalid_request_error","message":"' + CREDIT + '"},"request_id":"req_1"}';
  const two = [{ appt_id: 'A-1', rec_id: 'r1' }, { appt_id: 'A-2', rec_id: 'r2' }];
  const rows = [rec({ appt_id: 'A-1', client: ['recC1'] }, 'a1'), rec({ appt_id: 'A-2', client: ['recC2'] }, 'a2'), {}];
  const ctx = {
    'Alert Reminder Send': { Contact: two }, 'Alert Revisit Send': { 'Contact 2': two }, 'Alert Reminder Mark': { Contact: two }, 'Alert Revisit Mark': { 'Invite Marks': two },
    'Alert Expiry Mark': { 'Has Appt? 2': [rec({ appt_id: 'A-5' }), rec({ appt_id: 'A-6' })] },
    'Alert Client': { Client: [{ id: 'recC1', fields: { name: 'X' } }], 'Has Appt?': rows },
    'Alert Client 2': { 'Has Appt? 3': rows },
  };
  for (const n of Object.keys(ctx)) {
    const one = (item) => (shapeOf(n, [item], ctx[n])[0] || {}).text || '';
    const obj = (over) => ({ message: GENERIC, description: CREDIT, name: 'NodeOperationError', stack: 'at /usr/local/lib/node_modules/n8n/x.js:1:1', messages: ['400 ' + anth], ...over });
    check(n + ': object error with the credit shape as stored -> generic message AND the real cause', one({ error: obj() }).includes(GENERIC + ' — ' + CREDIT), one({ error: obj() }));
    check(n + ': item {message, description} (Airtable-style) -> message AND cause', one(obj()).includes(GENERIC + ' — ' + CREDIT), one(obj()));
    check(n + ': no stack, no raw body, no request id', !/node_modules|request_id|invalid_request/.test(one({ error: obj() })), one({ error: obj() }));
    check(n + ': string error (Execute Workflow) -> as before', one({ error: 'Not found' }).includes('Not found') && !one({ error: 'Not found' }).includes(' — Not found'), one({ error: 'Not found' }));
    check(n + ': description equal to the message -> shown once', one({ error: obj({ message: 'Boom', description: 'Boom' }) }).split('Boom').length === 2, one({ error: obj({ message: 'Boom', description: 'Boom' }) }));
    for (const [label, d] of [['missing', undefined], ['null', null], ['empty', ''], ['a number', 7], ['an object', { a: 1 }], ['the text "null"', 'null']]) {
      const e = obj(); if (d === undefined) delete e.description; else e.description = d;
      const x = one({ error: e });
      check(n + ': description ' + label + ' -> the message alone', x.includes(GENERIC) && !x.includes(' — ' + 'Your') && !/undefined|\[object/.test(x), x);
    }
    check(n + ': JSON-string description -> its error.message, not the JSON', one({ error: obj({ description: anth }) }).includes(GENERIC + ' — ' + CREDIT) && !/request_id|invalid_request/.test(one({ error: obj({ description: anth }) })), one({ error: obj({ description: anth }) }));
    check(n + ': unparsable JSON description -> the message alone', (() => { const x = one({ error: obj({ description: '{"error":{"message":"cut' }) }); return x.includes(GENERIC) && !x.includes('cut'); })());
    check(n + ': over-long description -> the cause is cut to 300 characters', (() => { const x = one({ error: obj({ description: 'word\n'.repeat(400) }) }); const k = (x.match(/word/g) || []).length; return x.includes(GENERIC + ' — word word') && k >= 50 && k <= 60 && x.length < 900; })(), one({ error: obj({ description: 'word\n'.repeat(400) }) }).length);
    check(n + ': secrets in a description are redacted', (() => { const x = one({ error: obj({ description: 'sk-ant-api03-AbCdEf123456789 Authorization: Bearer abc.def.ghi' }) }); return !/sk-ant|abc\.def/.test(x) && x.includes('[redacted]'); })());
  }
});

const dd = (items, sd) => runAll('Dedupe Alerts', items, {}, sd);
{
  const sd = {};
  let x = dd([{ key: 'k1', text: 't1' }, { key: 'k2', text: 't2' }, { key: 'k1', text: 't1 again' }], sd).map((i) => i.json);
  check('Dedupe Alerts: two keys pass, the repeat of k1 in the same run is dropped', same(x, [{ text: 't1', key: 'k1' }, { text: 't2', key: 'k2' }]), x);
  check('Dedupe Alerts: keys are remembered in the workflow static data', Object.keys(sd.alertSeen || {}).sort().join() === 'k1,k2', sd);
  x = dd([{ key: 'k1', text: 't1' }, { key: 'k3', text: 't3' }], sd).map((i) => i.json);
  // P2 (ruling 2026-10-08): the window is 20 h, shorter than the 24 h between two daily runs, so every daily run alerts
  // once for a lasting failure; repeated Run Nows on the same day stay deduplicated.
  check('Dedupe Alerts: a later run inside 20 h (e.g. a Run Now) - k1 is throttled, new k3 passes', same(x, [{ text: 't3', key: 'k3' }]), x);
  sd.alertSeen.k1 = Date.now() - 21 * 3600 * 1000;
  sd.alertSeen.old = Date.now() - 48 * 3600 * 1000;
  x = dd([{ key: 'k1', text: 't1' }], sd).map((i) => i.json);
  check('Dedupe Alerts: after 20 h the same key alerts again (21 h)', same(x, [{ text: 't1', key: 'k1' }]), x);
  check('Dedupe Alerts: keys older than 20 h are pruned, the fresh ones kept', !('old' in sd.alertSeen) && 'k1' in sd.alertSeen && 'k3' in sd.alertSeen, Object.keys(sd.alertSeen));
  sd.alertSeen.k2 = Date.now() - 19 * 3600 * 1000;
  check('Dedupe Alerts: 19 h is still inside the window', same(dd([{ key: 'k2', text: 't2' }], sd), []));
  sd.alertSeen.k4 = Date.now() - (24 * 3600 * 1000 - 50);
  check('Dedupe Alerts: the next daily run, a few ms short of 24 h later, alerts again (the 24 h window dropped it)', same(dd([{ key: 'k4', text: 't4' }], sd).map((i) => i.json), [{ text: 't4', key: 'k4' }]));
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
check('Send Revisit: success -> Invite Marks -> Mark Invited, error -> Alert Revisit Send', same(targets('Send Revisit', 0), ['Invite Marks']) && same(targets('Invite Marks'), ['Mark Invited']) && same(targets('Send Revisit', 1), ['Alert Revisit Send']));
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

// ---------------------------------------------------------------- P3: the live scripts' safety guard mirrors WF-5
// tests/lib/airtable.sh wf5_guard (used by tests/dialog.sh reminder_leg, tests/wf5-live*.sh) must ask Airtable exactly
// what WF-5's searches ask, or a manual run could act on a real row the guard did not see. LIB = that file's text.
block('wf5_guard mirrors WF-5', () => {
  if (typeof LIB === 'undefined') throw new Error('LIB (tests/lib/airtable.sh) was not prepended');
  const m = /\nwf5_guard\(\) \{([\s\S]*?)\n\}/.exec(LIB);
  check('wf5_guard exists in tests/lib/airtable.sh', !!m);
  const body = m ? m[1] : '';
  const quoted = [...body.matchAll(/at_all (\w+) "([^"]+)"/g)].map((x) => ({ table: x[1], f: x[2] }));
  // wf5_due_formula <hours> <timezone> [margin]: the reminder formula the guard and the live scripts' seeds use
  const fm = /\nwf5_due_formula\(\) \{\n  printf '%s' "([^"]+)"\n\}/.exec(LIB);
  check('wf5_due_formula exists in tests/lib/airtable.sh', !!fm);
  const tpl = fm ? fm[1] : '';
  const sh = (H, tz, margin = 0) => tpl.split('$(($1 + ${3:-0}))').join(String(H + margin)).split("'$2'").join("'" + tz + "'").split('$1').join(String(H));
  for (const [H, tz] of [[1, BER], [24, BER], [24, 'America/New_York']]) {
    let w; try { w = expr(dr, S(H, tz)); } catch (e) { w = 'threw'; }
    check('wf5_due_formula ' + H + ' ' + tz + ' == Due Reminders at reminder_hours_before=' + H + ', timezone ' + tz + ' (string for string)', sh(H, tz) === w, sh(H, tz));
  }
  check('wf5_due_formula: the margin widens only the "start within <hours>" branch', sh(1, BER, 1).replace("DATEADD(NOW(),2,'hours')", "DATEADD(NOW(),1,'hours')") === sh(1, BER) && sh(1, BER, 1) !== sh(1, BER));
  check('wf5_guard asks the reminder rows with wf5_due_formula and Settings.timezone', /at_all Appointments "\$\(wf5_due_formula "\$h" "\$tz" "\$m"\)"/.test(body) && /tz=\$\(at_timezone\)/.test(body));
  check('at_timezone accepts exactly what the WF-5 expression accepts', LIB.includes('^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$') && dr.includes('^[A-Za-z_]+(?:[/][A-Za-z0-9_+-]+){0,2}$'));
  const pend = (quoted.find((q) => q.f.includes("{status}='pending'")) || {}).f;
  check('wf5_guard expired-pending formula == Expired Pending and Orphan Pending without their calendar_event_id clause (both block)',
    !!pend && node('Expired Pending').parameters.filterByFormula === pend.replace(/\)$/, ',{calendar_event_id}=BLANK())') && node('Orphan Pending').parameters.filterByFormula === pend.replace(/\)$/, ',NOT({calendar_event_id}=BLANK()))'), pend);
  check('wf5_guard revisit formula == Due Revisits', (quoted.find((q) => q.f.includes("{status}='done'")) || {}).f === node('Due Revisits').parameters.filterByFormula);
  check('wf5_guard consent formula == Consenting Clients (a real client without consent never blocks)', quoted.some((q) => q.table === 'Clients' && q.f === node('Consenting Clients').parameters.filterByFormula));
  check('wf5_guard counts a revisit only when its client is among the consenting ones', /\$yes \| index\(\$c\)\) != null/.test(body));
  check('M3: wf5_guard also blocks on a real due revisit without a client link (the run alerts the owner about it)', /if \$c == null then/.test(body) && /without a client link - the run would alert the owner/.test(body));
  check('wf5_guard treats as test rows only A-TEST-* appointments and C-test* clients', body.includes('startswith("A-TEST-")') && body.includes('startswith("C-test")'));
  check('wf5_guard names the row and the reason for each refusal', /would send its reminder/.test(body) && /would " \+ \(if/.test(body) && /cancel it/.test(body) && /revisit invitation/.test(body));
});

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
