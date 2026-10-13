// Stub test for reminder_reply (workflows/wf3-tools/reminder_reply.json), final review I2: a reminder "no" is a LATE cancel
// (late_cancel, client flagged, owner told "LATE") only inside Settings.cancellation_hours before the visit, the same rule as
// cancel_booking (hoursLeft < cancellation_hours); earlier it is a free cancel (cancelled, no flag, owner told "free").
// Runs inside the n8n container's Node (see tests/reminder-reply-stubs.sh), which prepends:
//   const WF = <the workflow JSON>;
// No network, no n8n runtime: $ is stubbed; DateTime is the real luxon.

let DateTime;
try { ({ DateTime } = require('luxon')); } catch (e) { ({ DateTime } = require('/usr/local/lib/node_modules/n8n/node_modules/luxon')); }

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};
const T = (name, fn) => { try { const x = fn(); check(name, x === true, x); } catch (e) { check(name, false, String(e.message)); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const node = (n) => WF.nodes.find((x) => x.name === n) || {};
const P = (n) => node(n).parameters || {};
const outs = (n, i = 0) => ((((WF.connections[n] || {}).main || [])[i]) || []).map((x) => x.node);
const strip = (e) => String(e).replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
// $('Name') like n8n: first() / all() of a node that has not run throws; isExecuted tells.
const dollar = (nodes) => (name) => {
  const v = nodes[name];
  const ran = v !== undefined;
  const arr = !ran ? [] : (Array.isArray(v) ? v : [v]);
  const need = () => { if (!ran) throw new Error('node "' + name + '" has not been executed'); };
  return { first: () => { need(); return { json: arr[0] }; }, all: () => { need(); return arr.map((json) => ({ json })); }, isExecuted: ran };
};
const ev = (e, nodes) => new Function('$', 'DateTime', 'return (' + strip(e) + ');')(dollar(nodes), DateTime);
const colOf = (n, c) => ((P(n).columns || {}).value || {})[c];
const leftOf = (n) => (((P(n).conditions || {}).conditions || [])[0] || {}).leftValue;

const SETTINGS = { calendar_id: 'cal@x', timezone: 'Europe/Berlin', cancellation_hours: 24 };
const CLIENT = { id: 'recC', fields: { client_id: 'C-1', name: 'Anna K', status: 'active' } };
const hoursAhead = (h) => DateTime.utc().plus({ hours: h }).set({ millisecond: 0 }).toISO();
const appt = (startIso, over = {}) => ({ id: 'recA', fields: { appt_id: 'A-1', client_id: 'C-1', status: 'reminded', service_id: 'botox', start_iso: startIso, calendar_event_id: 'appt41', ...over } });
const decide = (answer, startIso, settings = SETTINGS, over = {}) => new Function('$', 'DateTime', P('Decide').jsCode)(dollar({
  Settings: { fields: settings }, Trigger: { contact_id: 'tg:1', answer }, Client: CLIENT, Reminded: [appt(startIso, over)],
}), DateTime)[0].json;

// ---- Decide: late or free, the cancel_booking rule ----
let d = decide('no', hoursAhead(30));
T('I2 Decide: NO 30 h before the visit (the day-before reminder is 25-35 h ahead), cancellation_hours 24 -> cancel, free: new_status cancelled, late false',
  () => d.action === 'cancel' && d.new_status === 'cancelled' && d.late === false && d.cancellation_hours === 24 || d);
d = decide('no', hoursAhead(10));
T('I2 Decide: NO 10 h before the visit -> cancel, late: new_status late_cancel, late true', () => d.action === 'cancel' && d.new_status === 'late_cancel' && d.late === true || d);
d = decide('no', hoursAhead(24.01));
T('I2 Decide: NO just over 24 h before -> free', () => d.new_status === 'cancelled' || d);
d = decide('no', hoursAhead(23.99));
T('I2 Decide: NO just under 24 h before -> late', () => d.new_status === 'late_cancel' || d);
d = decide('no', '2030-01-07T13:00:00+01:00');
T('I2 Decide: NO for the tool case reminder_no visit (2030) -> free', () => d.new_status === 'cancelled' && d.appt_id === 'A-1' || d);
d = decide('no', hoursAhead(30), { ...SETTINGS, cancellation_hours: 48 });
T('I2 Decide: the window is Settings.cancellation_hours (48 -> a NO 30 h ahead is late)', () => d.new_status === 'late_cancel' && d.cancellation_hours === 48 || d);
d = decide('no', hoursAhead(30), { ...SETTINGS, cancellation_hours: 0 });
T('I2 Decide: cancellation_hours 0 -> never late', () => d.new_status === 'cancelled' || d);
for (const bad of [undefined, '', 'abc', -1]) {
  let thrown = '';
  try { decide('no', hoursAhead(30), { ...SETTINGS, cancellation_hours: bad }); } catch (e) { thrown = e.message; }
  T('I2 Decide: NO with Settings.cancellation_hours = ' + JSON.stringify(bad) + ' fails the tool (as cancel_booking does)', () => /cancellation_hours/.test(thrown) || thrown || 'no throw');
}
d = decide('yes', hoursAhead(30), { ...SETTINGS, cancellation_hours: undefined });
T('I2 Decide: YES does not need cancellation_hours (confirm, unchanged)', () => d.action === 'confirm' && d.appt_id === 'A-1' || d);
d = decide('yes', hoursAhead(10));
T('I2 Decide: YES inside the window is still a plain confirm', () => d.action === 'confirm' || d);
d = decide('no', hoursAhead(-1));
T('Decide: a visit that has started is not answered (none, unchanged)', () => d.action === 'none' || d);

// ---- the cancel branch ----
T('I2 Mark Cancelled writes Decide.new_status (cancelled or late_cancel) and clears calendar_event_id', () =>
  ev(colOf('Mark Cancelled', 'status'), { Decide: { new_status: 'late_cancel' } }) === 'late_cancel' &&
  ev(colOf('Mark Cancelled', 'status'), { Decide: { new_status: 'cancelled' } }) === 'cancelled' && colOf('Mark Cancelled', 'calendar_event_id') === '' || colOf('Mark Cancelled', 'status'));
T('I2 wiring: Mark Cancelled -> Late?; Late? true -> Flag Client, false -> Notify; Flag Client -> Notify -> Result Cancelled', () =>
  same(outs('Mark Cancelled'), ['Late?']) && same(outs('Late?', 0), ['Flag Client']) && same(outs('Late?', 1), ['Notify']) &&
  same(outs('Flag Client'), ['Notify']) && same(outs('Notify'), ['Result Cancelled']) || [outs('Mark Cancelled'), outs('Late?', 0), outs('Late?', 1)]);
T('I2 Late? is true exactly for late_cancel', () => node('Late?').type === 'n8n-nodes-base.if' &&
  ev(leftOf('Late?'), { Decide: { new_status: 'late_cancel' } }) === true && ev(leftOf('Late?'), { Decide: { new_status: 'cancelled' } }) === false || leftOf('Late?'));
T('Flag Client: flagged, an escalated client stays escalated (unchanged)', () =>
  ev(colOf('Flag Client', 'status'), { Client: CLIENT }) === 'flagged' && ev(colOf('Flag Client', 'status'), { Client: { id: 'recC', fields: { status: 'escalated' } } }) === 'escalated' || 'wrong');

const notify = (nodes) => { try { return ev((P('Notify').workflowInputs || {}).value.text, nodes); } catch (e) { return 'THROW ' + e.message; } };
const base = 'Anna K (tg:1) — botox — Tue, Jan 8, 10:00 AM — A-1';
const dec = (late) => ({ action: 'cancel', appt_id: 'A-1', service_id: 'botox', when: 'Tue, Jan 8, 10:00 AM', new_status: late ? 'late_cancel' : 'cancelled', late, cancellation_hours: 24 });
let txt = notify({ Decide: dec(false), Client: CLIENT, Trigger: { contact_id: 'tg:1' }, 'Gone Check': { event: 'deleted' } });
T('I2 Notify, free cancel (Flag Client did not run): "Cancelled (free)", outside the window, client not flagged', () =>
  txt === 'ℹ️ Cancelled (free) via reminder: ' + base + ' — outside the 24 h cancellation window, client not flagged' || txt);
txt = notify({ Decide: dec(false), Client: CLIENT, Trigger: { contact_id: 'tg:1' }, 'Gone Check': { event: 'already_gone' } });
T('I2 Notify, free cancel, event already gone -> the calendar hint is kept', () => /client not flagged — the calendar event was already gone, check the calendar by hand$/.test(txt) || txt);
txt = notify({ Decide: dec(false), Client: CLIENT, Trigger: { contact_id: 'tg:1' } });
T('I2 Notify, free cancel without an event (Gone Check did not run)', () => txt === 'ℹ️ Cancelled (free) via reminder: ' + base + ' — outside the 24 h cancellation window, client not flagged' || txt);
txt = notify({ Decide: dec(true), Client: CLIENT, Trigger: { contact_id: 'tg:1' }, 'Flag Client': { id: 'recC', fields: { status: 'flagged' } }, 'Gone Check': { event: 'deleted' } });
T('I2 Notify, late cancel: "LATE cancellation", client flagged', () => txt === '⚠️ LATE cancellation via reminder: ' + base + ' — client flagged' || txt);
txt = notify({ Decide: dec(true), Client: CLIENT, Trigger: { contact_id: 'tg:1' }, 'Flag Client': { error: 'x' } });
T('I2 Notify, late cancel, the flag failed -> flag them by hand', () => txt === '⚠️ LATE cancellation via reminder: ' + base + ' — the client could NOT be flagged automatically, flag them by hand' || txt);
txt = notify({ Decide: dec(true), Client: CLIENT, Trigger: { contact_id: 'tg:1' }, 'Flag Client': { id: 'recC', fields: { status: 'escalated' } } });
T('I2 Notify, late cancel of an escalated client -> left escalated', () => /— client is escalated, left escalated \(not flagged\)$/.test(txt) || txt);

// ---- what WF-1 gets back is unchanged ----
const rc = (((P('Result Cancelled').assignments || {}).assignments) || []);
T('Result Cancelled: verdict CANCELLED for both a free and a late cancel (WF-1 Send Reminder Result maps it to REMINDER_CANCELLED)', () =>
  (rc.find((a) => a.name === 'verdict') || {}).value === 'CANCELLED' && /Decide/.test((rc.find((a) => a.name === 'appt_id') || {}).value) || rc);
T('Route: none / confirm / cancel outputs unchanged', () => same(outs('Route', 0), ['Result None']) && same(outs('Route', 1), ['Mark Confirmed']) && same(outs('Route', 2), ['Has Event?']) || 'wrong');

console.log('\nREMINDER_REPLY_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
