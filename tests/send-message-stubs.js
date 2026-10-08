// Stub test for send_message's capture decision (Task 20): the Format Code node's `test` field and the Test Contact? IF;
// and for the Render Code node (templates, REQ map, cancellation policy, cancel templates).
// Runs in a Node (see tests/send-message-stubs.sh), which prepends:
//   const WF = <workflows/shared/send_message.json>;  const TEMPLATES = <templates/messages.en.json>;
// No network, no n8n runtime: $, $json and DateTime are stubbed.
const node = (n) => WF.nodes.find((x) => x.name === n) || {};
const out0 = (n, i = 0) => ((((WF.connections[n] || {}).main || [])[i] || []).map((x) => x.node)[0]) || 'none';
const CODE = {
  format: (node('Format').parameters || {}).jsCode,
  render: (node('Render').parameters || {}).jsCode,
  testExpr: ((((node('Test Contact?').parameters || {}).conditions || {}).conditions || [])[0] || {}).leftValue,
  formatTarget: out0('Format'), trueTarget: out0('Test Contact?', 0), falseTarget: out0('Test Contact?', 1),
  captureTarget: out0('Capture'), captureQuery: (node('Capture').parameters || {}).query,
};
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};
const runFormat = (contact_id, client, extra = {}) => {
  const nodes = { Trigger: { contact_id, text: 'hello', template_key: '', appt_id: '', vars_json: '', outside_window: '', ...extra }, Client: client, Render: { vars: {} } };
  const $ = (n) => ({ first: () => ({ json: nodes[n] }) });
  return new Function('$', '$json', CODE.format)($, { text: 'hello' });
};
const body = (e) => e.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
const captured = (out) => new Function('$json', 'return (' + body(CODE.testExpr) + ');')(out[0].json) === true;
const row = (client_id, extra = {}) => ({ id: 'recX', createdTime: '2026-10-05T00:00:00.000Z', fields: { ...(client_id === undefined ? {} : { client_id }), ...extra } });
const NO_ROW = {};  // the Client search with alwaysOutputData and no match gives one empty item

const cases = [
  ['in range tg + C-test row -> capture', 'tg:9000000101', row('C-test-MUSX1', { telegram_chat_id: '9000000101' }), true],
  ['in range tg + real row -> send path', 'tg:9000000101', row('C-MUSX1', { telegram_chat_id: '9000000101' }), false],
  ['in range tg + no row -> capture', 'tg:9000000101', NO_ROW, true],
  ['in range wa + C-test row -> capture', 'wa:+15550000101', row('C-test-MUSX2', { phone: '+15550000101' }), true],
  ['in range wa + real row -> send path', 'wa:+15550000101', row('C-MUSX2', { phone: '+15550000101' }), false],
  ['in range wa + no row -> capture', 'wa:+15550000101', NO_ROW, true],
  ['in range + row without client_id -> send path (a row exists, it is not C-test)', 'tg:9000000101', row(undefined), false],
  ['in range + client_id merely containing C-test -> send path', 'tg:9000000101', row('C-MUSC-test'), false],
  ['out of range tg + no row -> send path', 'tg:4242', NO_ROW, false],
  ['out of range tg + C-test row -> send path', 'tg:4242', row('C-test-1'), false],
  ['out of range wa + no row -> send path', 'wa:+491701234567', NO_ROW, false],
  ['9-digit tg:900000001 (suite C-test-1 contact) -> send path', 'tg:900000001', row('C-test-1'), false],
  ['11-digit tg:90000001011 -> send path', 'tg:90000001011', NO_ROW, false],
  ['wa +1555000 with 3 digits -> send path', 'wa:+1555000101', NO_ROW, false],
];
for (const [name, cid, client, want] of cases) {
  try {
    const out = runFormat(cid, client);
    check(name, captured(out) === want && out[0].json.test === want, out[0].json);
  } catch (e) { check(name, false, String(e.message)); }
}
let out = runFormat('tg:9000000101', NO_ROW, { template_key: 'RATE_LIMIT' });
check('capture fields: contact_id, channel, template_key passed on', out[0].json.contact_id === 'tg:9000000101' && out[0].json.channel === 'tg' && out[0].json.template_key === 'RATE_LIMIT', out[0].json);
out = runFormat('wa:+15550000101', NO_ROW, { template_key: 'REMINDER', outside_window: 'true' });
check('wa outside_window REMINDER: template path decided before the capture (wa_template set)', out[0].json.test === true && out[0].json.wa_template === 'medspa_reminder|en', out[0].json);
check('wiring: Format -> Test Contact?; true -> Capture -> Result; false -> Channel?',
  CODE.formatTarget === 'Test Contact?' && CODE.trueTarget === 'Capture' && CODE.falseTarget === 'Channel?' && CODE.captureTarget === 'Result',
  [CODE.formatTarget, CODE.trueTarget, CODE.falseTarget, CODE.captureTarget]);
check('Capture inserts into test_outbox', /^INSERT INTO test_outbox \(contact_id, channel, template_key, wa_template, text\)/.test(CODE.captureQuery || ''), CODE.captureQuery);

// ---- Render: templates, REQ map, the cancellation policy and the cancel templates (two-step cancel) ----
const embedded = (() => { const m = /\/\*TEMPLATES\*\/ const T = (.*?); \/\*END\*\//s.exec(CODE.render || ''); try { return m ? JSON.parse(m[1]) : null; } catch (e) { return null; } })();
check('Render embeds exactly templates/messages.en.json (same keys, order and text)', JSON.stringify(embedded) === JSON.stringify(TEMPLATES), embedded && Object.keys(embedded).filter((k) => embedded[k] !== TEMPLATES[k]));
const SETTINGS = { timezone: 'Europe/Berlin', business_name: 'Glow Clinic', reminder_hours_before: 24, pending_ttl_min: 15, cancellation_hours: 24, intake_form_url: 'https://f' };
// DateTime stub: only the `when` line uses it; the format string is checked, the result is fixed.
const DateTimeStub = { fromISO: (s) => ({ setZone: (z) => ({ toFormat: (f) => (f === 'ccc, LLL d, h:mm a' && z === 'Europe/Berlin' && s === '2030-01-07T12:00:00+01:00' ? 'Mon, Jan 7, 12:00 PM' : 'BAD ' + s + ' ' + z + ' ' + f) }) }) };
const render = (template_key, over = {}) => {
  const nodes = {
    Trigger: { contact_id: 'tg:9000000104', text: '', template_key, appt_id: 'A-1', vars_json: '', outside_window: '' },
    Settings: { id: 'recS', fields: over.settings || SETTINGS },
    Client: { id: 'recC', fields: { client_id: 'C-test-1', language: 'en', name: 'Carl' } },
    Appointment: over.appt || { id: 'recA', fields: { appt_id: 'A-1', client_id: 'C-test-1', service_id: 'botox', start_iso: '2030-01-07T12:00:00+01:00' } },
    Services: [{ id: 'recV', fields: { service_id: 'botox', name: 'Botox', duration_min: 30 } }],
  };
  const $ = (n) => { const v = nodes[n]; const arr = Array.isArray(v) ? v : [v]; return { first: () => ({ json: arr[0] }), all: () => arr.map((json) => ({ json })) }; };
  return new Function('$', 'DateTime', CODE.render)($, DateTimeStub)[0].json.text;
};
const R = (name, key, want, over) => { try { const t = render(key, over); check(name, t === want, t); } catch (e) { check(name, false, String(e.message)); } };
const THROWS = (name, key, re, over) => { try { const t = render(key, over); check(name, false, 'rendered: ' + t); } catch (e) { check(name, re.test(String(e.message)), String(e.message)); } };
R('PENDING_SUMMARY states the cancellation policy before "Reply YES to confirm"', 'PENDING_SUMMARY', 'Botox (30 min) — Mon, Jan 7, 12:00 PM. Free cancellation up to 24 hours before. Reply YES to confirm.');
THROWS('PENDING_SUMMARY without Settings.cancellation_hours throws (REQ)', 'PENDING_SUMMARY', /PENDING_SUMMARY needs "cancellation_hours"/, { settings: { ...SETTINGS, cancellation_hours: undefined } });
R('PENDING_SUMMARY with cancellation_hours 0 still renders (0 is a value)', 'PENDING_SUMMARY', 'Botox (30 min) — Mon, Jan 7, 12:00 PM. Free cancellation up to 0 hours before. Reply YES to confirm.', { settings: { ...SETTINGS, cancellation_hours: 0 } });
// Owner addition 2026-10-08: the booking confirmation says how to cancel AND the free-cancellation rule, in the same message.
R('BOOKED names how to cancel and the free-cancellation rule (Settings.cancellation_hours)', 'BOOKED', "You're booked: Botox (30 min) — Mon, Jan 7, 12:00 PM. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 hours before your visit.");
// P1 ruling 2026-10-08: WF-5 runs daily and reminds the day before, so BOOKED no longer quotes reminder_hours_before and
// REQ.BOOKED does not require it.
R('BOOKED renders without Settings.reminder_hours_before (REQ.BOOKED no longer needs reminder_hours)', 'BOOKED', "You're booked: Botox (30 min) — Mon, Jan 7, 12:00 PM. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 hours before your visit.", { settings: { ...SETTINGS, reminder_hours_before: undefined } });
check('BOOKED template has no {reminder_hours} placeholder', !/\{reminder_hours\}/.test(TEMPLATES.BOOKED || ''), TEMPLATES.BOOKED);
THROWS('BOOKED without Settings.cancellation_hours throws (REQ)', 'BOOKED', /BOOKED needs "cancellation_hours"/, { settings: { ...SETTINGS, cancellation_hours: undefined } });
R('CANCEL_PENDING asks for YES, built from the row', 'CANCEL_PENDING', 'Cancel your Botox on Mon, Jan 7, 12:00 PM? Reply YES to cancel.');
R('LATE_CANCEL_PENDING names the window and the late cancellation', 'LATE_CANCEL_PENDING', 'Cancel your Botox on Mon, Jan 7, 12:00 PM? This is less than 24 hours before your visit, so it will be recorded as a late cancellation. Reply YES to cancel.');
THROWS('LATE_CANCEL_PENDING without cancellation_hours throws (REQ)', 'LATE_CANCEL_PENDING', /LATE_CANCEL_PENDING needs "cancellation_hours"/, { settings: { ...SETTINGS, cancellation_hours: null } });
R('CANCELLED confirms the cancellation', 'CANCELLED', 'Your Botox on Mon, Jan 7, 12:00 PM has been cancelled. Message me any time to book again.');
R('LATE_CANCEL confirms it and says it is recorded as late', 'LATE_CANCEL', 'Your Botox on Mon, Jan 7, 12:00 PM has been cancelled. It was less than 24 hours before the visit, so it is recorded as a late cancellation. Message me any time to book again.');
THROWS('LATE_CANCEL without cancellation_hours throws (REQ)', 'LATE_CANCEL', /LATE_CANCEL needs "cancellation_hours"/, { settings: { ...SETTINGS, cancellation_hours: '' } });
for (const k of ['CANCEL_PENDING', 'LATE_CANCEL_PENDING', 'CANCELLED', 'LATE_CANCEL']) {
  THROWS(k + ' without a visit (no service, no time) throws instead of sending an empty question', k, /needs "(service|when)"/, { appt: {} });
}

// ---- Fix 1 (I1): any message to the client except the cancel question itself closes an open cancel question ----
// Clients.cancel_ask_appt_id is set by WF-1 (Mark Cancel Asked) before the question goes out. send_message is the one way out to the
// client (WF-1, WF-5 reminders and revisits, errors), so clearing it here makes the cancel question answerable only while it is
// the bot's last message.
const clearLeft = ((((node('Clear Ask?').parameters || {}).conditions || {}).conditions || [])[0] || {}).leftValue;
const clears = (template_key, fields) => { try { return new Function('$', 'return (' + String(clearLeft).replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '') + ');')((n) => ({ first: () => ({ json: n === 'Trigger' ? { template_key } : { id: 'recC', fields } }) })); } catch (e) { return 'THROW ' + e.message; } };
const OPEN = { client_id: 'C-test-1', cancel_ask_appt_id: 'A-1' };
for (const k of [...Object.keys(TEMPLATES), '']) {
  const want = !['CANCEL_PENDING', 'LATE_CANCEL_PENDING'].includes(k);
  check('Clear Ask? ' + (k || '(free text: agent reply)') + ' with an open question -> ' + want, clears(k, OPEN) === want, clears(k, OPEN));
}
check('Clear Ask? false when no question is open (no write on ordinary sends)', clears('', { client_id: 'C-test-1' }) === false && clears('BOOKED', { client_id: 'C-test-1', cancel_ask_appt_id: '' }) === false, [clears('', { client_id: 'C-test-1' })]);
check('Clear Ask? false without a Clients row', clears('ERROR', undefined) === false, clears('ERROR', undefined));
const cl = node('Clear Ask'); const clv = ((cl.parameters || {}).columns || {}).value || {};
check('Clear Ask: Clients update of the recipient row, cancel_ask_appt_id = "" only; retried; a failure fails the send (no error output)',
  (cl.parameters || {}).operation === 'update' && ((cl.parameters || {}).table || {}).value === 'ATTBL:Clients' &&
  clv.id === "={{ $('Client').first().json.id }}" && clv.cancel_ask_appt_id === '' && Object.keys(clv).sort().join() === 'cancel_ask_appt_id,id' &&
  cl.retryOnFail === true && cl.onError === undefined, [clv, cl.onError]);
check('wiring: Client -> Clear Ask?; true -> Clear Ask -> Appointment; false -> Appointment (before anything is sent)',
  out0('Client') === 'Clear Ask?' && out0('Clear Ask?', 0) === 'Clear Ask' && out0('Clear Ask?', 1) === 'Appointment' && out0('Clear Ask') === 'Appointment',
  [out0('Client'), out0('Clear Ask?', 0), out0('Clear Ask?', 1), out0('Clear Ask')]);
check('the inserted branch cannot change what is sent: Render and Appointment read named nodes only, not $json/$input',
  !/\$json|\$input/.test(CODE.render || '') && !/\$json/.test(String((node('Appointment').parameters || {}).filterByFormula || '')), 'Render or Appointment reads its input item');
console.log('\nSEND_MESSAGE_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
