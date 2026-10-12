// Stub test for send_message's capture decision (Task 20): the Format Code node's `test` field and the Test Contact? IF;
// and for the Render Code node (templates, REQ map, cancellation policy, cancel templates).
// and for the client's language (mini-task B): dates, times and units in the client's language, the agent-reply English
// guard, the Translate prompt, and confirm_booking's SLOT_TAKEN alternatives;
// and for the translation quality (mini-task C): one formal register from Render's map, grammar around the inserted
// values, service names.
// Runs in a Node (see tests/send-message-stubs.sh), which prepends:
//   const WF = <workflows/shared/send_message.json>;  const TEMPLATES = <templates/messages.en.json>;
//   const CONFIRM = <workflows/wf3-tools/confirm_booking.json>;  const WF1 = <workflows/wf1-inbound.json>;
// No network, no n8n runtime: $, $json and DateTime are stubbed; Intl is the real one (the language checks expect the n8n
// container's full ICU).
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

// ---- Client language (mini-task B, 2026-10-11): the bot speaks only the client's language ----
// Owner acceptance 2026-10-11 (ru client): templates went out as "Консультация (20 min) — пн, Oct 12, 10:30 AM" because Render
// wrote the date and the units in English and the Translate prompt said to keep dates, times and numbers exactly as written.
// Render now writes weekday, day, month, time and the units in the client's language itself (Intl, full ICU in the n8n
// container), so the translation only has words left to translate. The expected strings are ICU 78.3 / CLDR output of the
// n8n 2.41.5 container (node v26.7.0); a Node with another ICU may word them differently.
// The real Intl is used (no DateTime stub): run these in the container's Node.
const run = (o = {}) => {
  const nodes = {
    // ai_disclosure: a caller that does not map it gets null from the Execute Workflow Trigger (FALLBACK_DEFAULT_VALUE, n8n 2.41.5)
    Trigger: { contact_id: o.contact_id || 'tg:9000000104', text: o.text || '', template_key: o.key || '', appt_id: 'A-1', vars_json: o.vars_json || '', outside_window: o.outside_window || '', ai_disclosure: o.ai_disclosure === undefined ? null : o.ai_disclosure },
    Settings: { id: 'recS', fields: { ...SETTINGS, business_name: 'Glow Aesthetics Med-Spa', ...(o.settings || {}) } },
    Client: { id: 'recC', fields: { client_id: 'C-test-1', language: o.language === undefined ? 'en' : o.language, name: 'Carl' } },
    Appointment: { id: 'recA', fields: { appt_id: 'A-1', client_id: 'C-test-1', service_id: 'consult', start_iso: o.start_iso || '2026-10-12T10:30:00+02:00', next_visit_in: 30 } },
    Services: [{ id: 'recV', fields: { service_id: 'consult', name: 'Consultation', duration_min: 20 } }],
  };
  const $ = (n) => { const v = nodes[n]; const arr = Array.isArray(v) ? v : [v]; return { first: () => ({ json: arr[0] }), all: () => arr.map((json) => ({ json })) }; };
  return new Function('$', 'DateTime', CODE.render)($, DateTimeStub)[0].json;
};
const L = (name, o, want, wantTr) => {
  try {
    const j = run(o);
    check(name, j.text === want && (wantTr === undefined || j.needs_translation === wantTr), { text: j.text, needs_translation: j.needs_translation });
  } catch (e) { check(name, false, String(e.message)); }
};
// The owner's booking (2026-10-12 10:30 Berlin, a 20-minute consultation, 24-hour free cancellation) in each language.
L('lang en: PENDING_SUMMARY unchanged for an English client (12-hour clock), not translated', { key: 'PENDING_SUMMARY', language: 'en' },
  'Consultation (20 min) — Mon, Oct 12, 10:30 AM. Free cancellation up to 24 hours before. Reply YES to confirm.', false);
L('lang de: PENDING_SUMMARY date, time (24h) and units in German before translation', { key: 'PENDING_SUMMARY', language: 'de' },
  'Consultation (20 Min.) — Mo., 12. Okt., 10:30. Free cancellation up to 24 Stunden before. Reply JA to confirm.', true);
L('lang es: PENDING_SUMMARY in Spanish', { key: 'PENDING_SUMMARY', language: 'es' },
  'Consultation (20 min) — lun, 12 oct, 10:30. Free cancellation up to 24 horas before. Reply SÍ to confirm.', true);
L('lang ru: PENDING_SUMMARY in Russian (the owner\'s case: no "Oct", "AM", "min", "hours" left for the translator to keep)', { key: 'PENDING_SUMMARY', language: 'ru' },
  'Consultation (20 мин) — пн, 12 окт., 10:30. Free cancellation up to 24 часа before. Reply ДА to confirm.', true);
L('lang pl (no special handling anywhere in the code, ICU alone): Polish date and plural', { key: 'PENDING_SUMMARY', language: 'pl' },
  'Consultation (20 min) — pon., 12 paź, 10:30. Free cancellation up to 24 godziny before. Reply TAK to confirm.', true);
L('lang xx (unknown to ICU): falls back to English formatting, no throw (still sent for translation)', { key: 'PENDING_SUMMARY', language: 'xx' },
  'Consultation (20 min) — Mon, Oct 12, 10:30 AM. Free cancellation up to 24 hours before. Reply YES to confirm.', true);
L('lang "e n!" (not a language tag): falls back to English formatting, no throw', { key: 'CANCEL_PENDING', language: 'e n!' },
  'Cancel your Consultation on Mon, Oct 12, 10:30 AM? Reply YES to cancel.');
L('lang ru: BOOKED (the owner saw "Mon, Oct 12, 10:30 AM" and "24 hours" in it)', { key: 'BOOKED', language: 'ru' },
  "You're booked: Consultation (20 мин) — пн, 12 окт., 10:30. We'll send you a reminder the day before. To change or cancel, just message me here — cancellation is free up to 24 часа before your visit.", true);
L('lang ru: CANCEL_PENDING', { key: 'CANCEL_PENDING', language: 'ru' }, 'Cancel your Consultation on пн, 12 окт., 10:30? Reply ДА to cancel.', true);
L('lang ru: CANCELLED', { key: 'CANCELLED', language: 'ru' }, 'Your Consultation on пн, 12 окт., 10:30 has been cancelled. Message me any time to book again.', true);
L('lang de: CANCELLED', { key: 'CANCELLED', language: 'de' }, 'Your Consultation on Mo., 12. Okt., 10:30 has been cancelled. Message me any time to book again.', true);
L('lang es: LATE_CANCEL_PENDING names the window in Spanish', { key: 'LATE_CANCEL_PENDING', language: 'es' },
  'Cancel your Consultation on lun, 12 oct, 10:30? This is less than 24 horas before your visit, so it will be recorded as a late cancellation. Reply SÍ to cancel.', true);
L('lang ru: LATE_CANCEL with a 1-hour window uses the singular ("1 час")', { key: 'LATE_CANCEL', language: 'ru', settings: { cancellation_hours: 1 } },
  'Your Consultation on пн, 12 окт., 10:30 has been cancelled. It was less than 1 час before the visit, so it is recorded as a late cancellation. Message me any time to book again.', true);
L('lang en: LATE_CANCEL with a 1-hour window says "1 hour"', { key: 'LATE_CANCEL', language: 'en', settings: { cancellation_hours: 1 } },
  'Your Consultation on Mon, Oct 12, 10:30 AM has been cancelled. It was less than 1 hour before the visit, so it is recorded as a late cancellation. Message me any time to book again.', false);
L('lang ru: EXPIRED states the hold time in Russian', { key: 'EXPIRED', language: 'ru' },
  "That offer has expired (we hold offers for 15 минут). Tell me the service and day again and I'll check availability.", true);
L('lang en: EXPIRED unchanged', { key: 'EXPIRED', language: 'en' },
  "That offer has expired (we hold offers for 15 minutes). Tell me the service and day again and I'll check availability.", false);
L('lang ru: BOOKED_INTAKE states the form time in Russian', { key: 'BOOKED_INTAKE', language: 'ru' },
  'Before your first visit, please complete our short intake and consent form (about 5 минут): https://f', true);
L('lang de: REVISIT on Telegram (outside_window=true, not WhatsApp) counts the days in German', { key: 'REVISIT', language: 'de', outside_window: 'true' },
  'Hi Carl, it has been 30 Tage since your Consultation at Glow Aesthetics Med-Spa. Would you like to book your next visit?', true);
L('lang de: 24-hour clock (14:00, not 2:00 PM)', { key: 'CANCEL_PENDING', language: 'de', start_iso: '2026-10-12T14:00:00+02:00' },
  'Cancel your Consultation on Mo., 12. Okt., 14:00? Reply JA to cancel.');
L('lang en: 12-hour clock kept (2:00 PM)', { key: 'CANCEL_PENDING', language: 'en', start_iso: '2026-10-12T14:00:00+02:00' },
  'Cancel your Consultation on Mon, Oct 12, 2:00 PM? Reply YES to cancel.');
L('Settings.timezone decides the local time (a UTC start_iso shows as 10:30 Berlin)', { key: 'CANCEL_PENDING', language: 'ru', start_iso: '2026-10-12T08:30:00.000Z' },
  'Cancel your Consultation on пн, 12 окт., 10:30? Reply ДА to cancel.');
L('Settings.timezone decides the local time (America/New_York shows 4:30 AM)', { key: 'CANCEL_PENDING', language: 'en', start_iso: '2026-10-12T08:30:00.000Z', settings: { timezone: 'America/New_York' } },
  'Cancel your Consultation on Mon, Oct 12, 4:30 AM? Reply YES to cancel.');
L('lang ru: Telegram REMINDER (WF-5, outside_window=true on tg) is localized and translated', { key: 'REMINDER', language: 'ru', outside_window: 'true' },
  'Reminder: Consultation — пн, 12 окт., 10:30 at Glow Aesthetics Med-Spa. Reply ДА to confirm or НЕТ to cancel.', true);
L('lang ru: WhatsApp inside the 24-hour window (outside_window empty) is localized and translated', { key: 'CANCELLED', language: 'ru', contact_id: 'wa:+15550000104' },
  'Your Consultation on пн, 12 окт., 10:30 has been cancelled. Message me any time to book again.', true);
try {
  const j = run({ key: 'REMINDER', language: 'ru', contact_id: 'wa:+15550000104', outside_window: 'true' });
  check('lang ru: WhatsApp REMINDER outside the window stays English (owner decision: Meta templates are English only): when is English, not translated',
    j.vars.when === 'Mon, Oct 12, 10:30 AM' && j.needs_translation === false && j.text === 'Reminder: Consultation — Mon, Oct 12, 10:30 AM at Glow Aesthetics Med-Spa. Reply YES to confirm or NO to cancel.', j);
  const r = run({ key: 'REVISIT', language: 'de', contact_id: 'wa:+15550000104', outside_window: 'true' });
  check('lang de: WhatsApp REVISIT outside the window keeps the raw day count for the Meta parameter (vars.days = 30) and English text',
    String(r.vars.days) === '30' && r.needs_translation === false && /it has been 30 days since/.test(r.text), r);
} catch (e) { check('WhatsApp templates outside the window stay English', false, String(e.message)); }
try {
  const j = run({ key: 'PENDING_SUMMARY', language: 'ru' });
  check('raw vars stay numbers for REQ and the WhatsApp parameters (duration 20, cancellation_hours 24); the localized ones are separate',
    String(j.vars.duration) === '20' && String(j.vars.cancellation_hours) === '24' && j.vars.duration_text === '20 мин' && j.vars.cancellation_window === '24 часа', j.vars);
  check('Render passes the clinic name to the translation (brand stays as written)', j.brand === 'Glow Aesthetics Med-Spa', j.brand);
} catch (e) { check('raw vars', false, String(e.message)); }
// ICU 72+ puts U+202F (narrow no-break space) before AM/PM and CLDR uses U+00A0 in some formats: replaced by a plain space.
check('no U+202F / U+00A0 in any rendered template (en, de, es, ru, fr, it)', ['en', 'de', 'es', 'ru', 'fr', 'it'].every((language) =>
  ['PENDING_SUMMARY', 'BOOKED', 'EXPIRED', 'LATE_CANCEL', 'BOOKED_INTAKE'].every((key) => { try { return !/[  ]/.test(run({ key, language }).text); } catch (e) { return false; } })), 'a no-break space found');
THROWS('an unparseable start_iso is not sent as "Invalid DateTime": REQ "when" throws', 'CANCEL_PENDING', /CANCEL_PENDING needs "when"/,
  { appt: { id: 'recA', fields: { appt_id: 'A-1', client_id: 'C-test-1', service_id: 'botox', start_iso: 'not-a-date' } } });
// SLOT_TAKEN: confirm_booking's Result Taken now hands over ISO timestamps; Render writes them in the client's language.
L('lang ru: SLOT_TAKEN alternatives given as ISO timestamps are localized', { key: 'SLOT_TAKEN', language: 'ru', vars_json: JSON.stringify({ alternatives: '2026-10-12T11:00:00+02:00, 2026-10-12T11:30:00+02:00' }) },
  'Sorry — that time was just taken by another booking. Nearby options: пн, 12 окт., 11:00; пн, 12 окт., 11:30. Which one works for you?', true);
L('lang en: SLOT_TAKEN alternatives as ISO -> the English format the template always had', { key: 'SLOT_TAKEN', language: 'en', vars_json: JSON.stringify({ alternatives: '2026-10-12T11:00:00+02:00, 2026-10-12T11:30:00+02:00' }) },
  'Sorry — that time was just taken by another booking. Nearby options: Mon, Oct 12, 11:00 AM; Mon, Oct 12, 11:30 AM. Which one works for you?', false);
L('SLOT_TAKEN alternatives that are not ISO (WF-1\'s "none in the next days") are passed on as written (the translation takes them)', { key: 'SLOT_TAKEN', language: 'de', vars_json: JSON.stringify({ alternatives: 'none in the next days' }) },
  'Sorry — that time was just taken by another booking. Nearby options: none in the next days. Which one works for you?', true);
// confirm_booking's Result Taken (SLOT_TAKEN alternatives): ISO timestamps from check_availability's verdict, at most 3, valid ones only.
if (typeof CONFIRM !== 'undefined') {
  const rt = (CONFIRM.nodes.find((x) => x.name === 'Result Taken') || {}).parameters || {};
  const altExpr = (((rt.assignments || {}).assignments || []).find((a) => a.name === 'alternatives') || {}).value || '';
  const DT = { fromISO: (x) => ({ isValid: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x) && !isNaN(Date.parse(x)) }) };
  const alt = (verdict) => { try { return new Function('$json', '$', 'DateTime', 'return (' + body(altExpr) + ');')({ verdict }, () => ({ first: () => ({ json: { fields: { timezone: 'Europe/Berlin' } } }) }), DT); } catch (e) { return 'THROW ' + e.message; } };
  const a1 = alt('FREE 2026-10-12T11:00:00+02:00, 2026-10-12T11:30:00+02:00, 2026-10-12T12:00:00+02:00, 2026-10-12T12:30:00+02:00');
  check('confirm_booking Result Taken: alternatives = the first 3 ISO timestamps of the FREE verdict, comma-separated', a1 === '2026-10-12T11:00:00+02:00, 2026-10-12T11:30:00+02:00, 2026-10-12T12:00:00+02:00', a1);
  const a2 = alt('NONE nearest: 2026-10-13T09:00:00+02:00, garbage');
  check('confirm_booking Result Taken: NONE nearest list, invalid entries dropped', a2 === '2026-10-13T09:00:00+02:00', a2);
  check('confirm_booking Result Taken: no list -> empty (WF-1 then sends "none in the next days")', alt('UNKNOWN_SERVICE x') === '' && alt('') === '', [alt('UNKNOWN_SERVICE x')]);
  L('end to end: confirm_booking alternatives -> SLOT_TAKEN in German', { key: 'SLOT_TAKEN', language: 'de', vars_json: JSON.stringify({ alternatives: a1 }) },
    'Sorry — that time was just taken by another booking. Nearby options: Mo., 12. Okt., 11:00; Mo., 12. Okt., 11:30; Mo., 12. Okt., 12:00. Which one works for you?', true);
} else check('confirm_booking.json piped in as CONFIRM (tests/send-message-stubs.sh third file)', false, 'CONFIRM undefined');

// ---- The agent's reply (free text) for a non-English client: an English line is never sent ----
// Evidence (wf2-agent execution 28237, send_message 28238, 2026-10-11T08:17:29Z, ru client): Claude's single text block was
// "On which day would they like it?\n\nКакой день вам удобен для консультации?" - a planning line the model wrote in English,
// third person, before the Russian question. Render drops a line that reads as English only when a kept line has a letter
// outside the Latin script (the answer in Russian, Greek, Arabic ... is there), and then sends the reply through the
// translation (one Haiku call, only when an English line was found). Otherwise nothing is dropped and the whole reply is
// translated. A line with any non-Latin letter is never English (fix round 1, I-1 ruling).
const LEAK = 'On which day would they like it?\n\nКакой день вам удобен для консультации?';
L('agent reply regression (execution 28237): the English planning line is dropped, the Russian question is sent (and translated)', { language: 'ru', text: LEAK },
  'Какой день вам удобен для консультации?', true);
L('agent reply wholly in English for a German client: kept and translated whole (nothing is lost)', { language: 'de', text: 'Which day would you like to come in for your consultation?' },
  'Which day would you like to come in for your consultation?', true);
L('agent reply: English and Russian on ONE line -> the line has Cyrillic, so it is never English: sent as is (a known limit)', { language: 'ru', text: 'On which day would they like it? Какой день вам удобен?' },
  'On which day would they like it? Какой день вам удобен?', false);
// Review fix round 1 (I-1): a wholly English multi-line reply must not be cut to fragments, and real lines must not be dropped.
const EN_LIST = 'Here are our services:\n**HydraFacial** — 60 min — $200\n**Botox** — 30 min — $350\nWhich one would you like to book?';
L('I-1: wholly English multi-line services list for a ru client: nothing dropped (no Cyrillic line), translated whole', { language: 'ru', text: EN_LIST }, EN_LIST, true);
const EN_FORM = 'Please complete the intake form before your visit, it only takes a few minutes:\nhttps://example.com/intake-form-demo';
L('I-1: English intake sentence + URL line for a ru client: not cut to a bare URL, translated whole', { language: 'ru', text: EN_FORM }, EN_FORM, true);
const EN_HI = 'Hi Carl,\nWhat day would you like to come in?';
L('I-1: English greeting + question for a ru client: not cut to "Hi Carl,", translated whole', { language: 'ru', text: EN_HI }, EN_HI, true);
L('I-1: Dutch line with we / of / is (shared with English) is not English: sent as is, no Haiku call', { language: 'nl', text: 'We kunnen 10:30 of 11:00 doen, is dat goed?' },
  'We kunnen 10:30 of 11:00 doen, is dat goed?', false);
const RU_SVC = 'Вот что у нас есть:\n**Laser Hair Removal for the face and neck** — 30 мин — 120 €\nКакое время вам удобно?';
L('I-1: ru service line with an English service name (for / the / and) keeps its line: it has Cyrillic, never English', { language: 'ru', text: RU_SVC }, RU_SVC, false);
L('I-1: an English planning line inside a longer Russian reply is still dropped', { language: 'ru', text: 'They want a consultation, so I should ask which day they would like.\nКакой день вам удобен?\nУ нас есть время в понедельник.' },
  'Какой день вам удобен?\nУ нас есть время в понедельник.', true);
const SERVICES_RU = 'Конечно, вот наши услуги:\n\n**Консультация** — 20 мин — $0\n**Лазерная эпиляция (малая зона)** — 30 мин — $120\n**HydraFacial** — 60 мин — $200\n\nЧто из этого вас интересует?';
L('agent reply in Russian with Latin brand / service names (execution 28181) is sent as is, no Haiku call', { language: 'ru', text: SERVICES_RU }, SERVICES_RU, false);
for (const [language, t] of [
  ['ru', 'Здравствуйте! Я ИИ-ассистент клиники Glow Aesthetics Med-Spa, и при желании я могу передать разговор сотруднику.'],
  ['ru', 'Ближайшие свободные времена на консультацию — завтра, понедельник, 12 октября:\n10:00\n10:30\n11:00\n11:30\n\nКакое время вам подходит?'],
  ['de', 'Möchten Sie die Laser Hair Removal (small area) am Montag um 10:30? Die HydraFacial dauert 60 Minuten.'],
  ['de', 'Ich habe am Montag um 10:30 Zeit für Sie. Was möchten Sie buchen? Ich will Ihnen gern helfen.'],
  ['es', '¿Qué día le viene bien para la consulta? Si no has elegido todavía, tenemos HydraFacial y Botox.'],
  ['fr', 'On peut le faire lundi à 10:30, ça vous va ? Le Botox dure 30 minutes.'],
  ['it', 'Che giorno preferisce per la consulenza? Abbiamo posto lunedì alle 10:30.'],
  ['nl', 'Is het goed om op maandag om 10:30 te komen, of wil je een andere dag?'],
  ['pl', 'To jest wolny termin: poniedziałek 10:30. Czy pasuje?'],
  ['pt', 'Se for possível, venha na segunda às 10:30. Do que precisa?'],
  ['ru', 'Форма для заполнения: https://example.com/how-to-book-your-appointment-with-us'],
]) L('agent reply (' + language + ') in the client\'s language is sent as is, no Haiku call: ' + t.slice(0, 40), { language, text: t }, t, false);
L('agent reply for an English client: never touched', { language: 'en', text: 'On which day would you like it? Here are the slots for the day.' }, 'On which day would you like it? Here are the slots for the day.', false);

// ---- Translate: everything into the client's language except names, links, ids and the clinic's name; English fallback on failure ----
const tr = node('Translate'); const trText = String((tr.parameters || {}).text || '');
check('Translate prompt: target language, the text and the clinic name come from Render', /\{\{ \$json\.language \}\}/.test(trText) && /\{\{ \$json\.text \}\}/.test(trText) && /\{\{ \$json\.brand \}\}/.test(trText), trText);
check('Translate prompt no longer tells the model to keep dates, times and numbers "exactly as written" (the cause of "пн, Oct 12, 10:30 AM")', !/Keep names, dates, times, numbers/.test(trText), trText);
check('Translate prompt keeps the reply words Render chose exactly as written (I-2: the translation never picks them)',
  /Leave exactly as written: the reply words \{\{ \$json\.yes_word \}\} and \{\{ \$json\.no_word \}\}/.test(trText) && !/one-word/.test(trText), trText);

// ---- Fix round 1 (I-2): the reply words are only words WF-1's Classify takes as yes / no ----
// Classify is run as it is in wf1-inbound.json (read from WF1, not copied): a Telegram REMINDER whose YES / NO word Classify
// did not know would reach the agent, which has no reminder_reply, and the client's answer would be lost.
const yesnoMap = (() => { const m = /const YESNO = (\{.*?\});/.exec(CODE.render || ''); try { return m ? new Function('return ' + m[1])() : null; } catch (e) { return null; } })();
const classifyCode = (((typeof WF1 !== 'undefined' ? WF1.nodes : []).find((x) => x.name === 'Classify') || {}).parameters || {}).jsCode;
const classify = (word) => { try { return new Function('$', classifyCode)(() => ({ first: () => ({ json: { text: word } }) }))[0].json.kind; } catch (e) { return 'THROW ' + e.message; } };
check('YESNO map found in Render and Classify found in wf1-inbound.json (WF1 piped in)', !!yesnoMap && !!classifyCode && classify('yes') === 'yes' && classify('no') === 'no', [!!yesnoMap, !!classifyCode]);
for (const [lang, [y, n]] of Object.entries(yesnoMap || {})) {
  check('I-2 ' + lang + ': "' + y + '" and "' + n + '" as the client types them (as shown, lower case, with punctuation) are yes / no for WF-1 Classify',
    [y, y.toLowerCase(), y + '!'].every((w) => classify(w) === 'yes') && [n, n.toLowerCase(), n + '.'].every((w) => classify(w) === 'no'), [classify(y), classify(n)]);
}
try {
  const r = run({ key: 'REMINDER', language: 'it', outside_window: 'true' });
  check('I-2 REMINDER path (Telegram, it): the question names SI / NO, which Classify takes as yes / no, so the answer reaches Reminder Reply',
    /Reply SI to confirm or NO to cancel\.$/.test(r.text) && classify('si') === 'yes' && classify('no') === 'no' && r.yes_word === 'SI' && r.no_word === 'NO', r.text);
  const t = run({ key: 'REMINDER', language: 'tr', outside_window: 'true' });
  check('I-2 a language with no safe pair (tr: HAYIR lower-cases to "hayir", not Classify\'s "hayır") keeps YES / NO, which Classify accepts',
    /Reply YES to confirm or NO to cancel\.$/.test(t.text) && t.yes_word === 'YES' && t.no_word === 'NO' && classify('HAYIR') !== 'no', [t.text, classify('HAYIR')]);
  const w = run({ key: 'REMINDER', language: 'ru', contact_id: 'wa:+15550000104', outside_window: 'true' });
  check('I-2 WhatsApp template outside the window: YES / NO (English template)', w.yes_word === 'YES' && w.no_word === 'NO', [w.yes_word, w.no_word]);
} catch (e) { check('I-2 REMINDER path', false, String(e.message)); }
check('Translate prompt: every word is translated, including any sentence in another language (B\'s goal: no English reaches a non-English client)',
  /Translate every word into that language/.test(trText) && /any sentence that is in another language/.test(trText), trText);
check('translation failure keeps the English text: Translate continues on error and Merge Text falls back to Render\'s text',
  tr.onError === 'continueRegularOutput' && /\$\('Render'\)\.first\(\)\.json\.text/.test(String((((node('Merge Text').parameters || {}).assignments || {}).assignments || [])[0].value)), [tr.onError]);

// ---- Translation quality (mini-task C, 2026-10-12): one register, grammar around the inserted values, service names ----
// Live proof of B (tests/dialog-runs/2026-10-12-client-language-tg.md, findings 2-6): every template is translated by its own
// Haiku call, and each call chose its own register (de CANCELLED "Dein … Schreib mir" while the others used Sie; es "Estás
// reservado" next to "Responda SÍ"), wrote "einen Erinnerung", and "до 24 часа до" (the prompt kept the duration exactly as
// written), and declined the service name differently per message ("вашу Ботокс" / "Ваш Botox"). Render now names the form
// of address from a per-language map (formal for every language: the clinic's default), and the Translate prompt uses it.
const FORMAL = 'the polite formal form of address';
for (const [language, want] of [['de', 'Sie'], ['es', 'usted'], ['fr', 'vous'], ['it', 'Lei'], ['pt', 'o senhor / a senhora'], ['nl', 'u'], ['pl', 'Pan / Pani'], ['ru', 'вы'], ['uk', 'ви'], ['pt-br', 'o senhor / a senhora'], ['tr', FORMAL], ['en', FORMAL]]) {
  try {
    const j = run({ key: 'CANCELLED', language });
    check('C register ' + language + ': Render names the form of address "' + want + '"', j.address === want, j.address);
  } catch (e) { check('C register ' + language, false, String(e.message)); }
}
try {
  const j = run({ language: 'es', text: 'Which day would you like to come in for your consultation?' });
  check('C register: an agent reply sent for translation (English-line guard) carries the same form of address (es usted)', j.needs_translation === true && j.address === 'usted', [j.needs_translation, j.address]);
} catch (e) { check('C register on the agent-reply path', false, String(e.message)); }
check('C register: the Translate prompt addresses the client throughout with Render\'s form of address, never the informal one',
  /Address the client throughout with this form of address: \{\{ \$json\.address \}\}/.test(trText) && /never use the informal form/.test(trText), trText);
check('C grammar: natural, grammatical text a native-speaking receptionist would write; the English sentence structure may be rearranged',
  /natural, grammatical text that a native-speaking clinic receptionist would write/.test(trText) && /rearrange the English sentence structure/.test(trText), trText);
check('C grammar: dates and times keep exactly the values and formatting Render wrote',
  /Dates and times that are already written in that language keep their values and formatting exactly as they are\./.test(trText), trText);
check('C grammar: durations keep their number, but the unit word\'s form and the words around it may change ("за 24 часа до визита")',
  /Durations that are already written in that language keep their number, but you may change the form of the unit word and the words around it \(prepositions, case\) so that the sentence is grammatical/.test(trText) && /за 24 часа до визита/.test(trText), trText);
check('C grammar: the old rule that froze durations ("Dates, times and durations ... stay exactly as they are") is gone',
  !/Dates, times and durations/.test(trText), trText);
check('C service names: generic treatment names as a clinic in that language names them, brand names keep their spelling, the sentence agrees',
  /Generic treatment names are translated the way a clinic in that language names them/.test(trText) &&
  /proper brand and trademark names \(for example Botox, HydraFacial\) keep their original spelling/.test(trText) &&
  /the sentence around the name must agree with it grammatically/.test(trText) && !/including service names/.test(trText), trText);
check('C unchanged: the reply words, people\'s names, the clinic name, links, ids and the **double asterisks** stay exactly as written',
  /Leave exactly as written: the reply words \{\{ \$json\.yes_word \}\} and \{\{ \$json\.no_word \}\} \(the client answers with them\), people's names, the clinic name "\{\{ \$json\.brand \}\}", links, ids and codes, and the \*\*double asterisks\*\* around words\./.test(trText), trText);
const hk = ((node('Haiku').parameters || {}).model || {}).value;
check('C the translation model stays claude-haiku-4-5 (controller ruling: a model change is out of scope)', hk === 'claude-haiku-4-5', hk);

// ---- AI disclosure (mini-task D, owner 2026-10-12): checked in the reply, a fixed sentence added only when it is missing ----
// Live es dialog 11 run 1 (tests/dialog-runs/2026-10-12-client-language-tg.md, finding 1): the agent's first reply to a new client
// said "Soy la asistente virtual de …", no word for AI. WF-1 passes ai_disclosure = 'true' only in the run that created the
// client's Clients row or the run that first detects the client's language (tests/wf1-code-stubs.js); Render checks the reply as it will be sent and, when the word for AI in the
// client's language is missing (or the language is not in its map), puts one fixed sentence before the reply, same message.
// The word lists below are this test's own (the brief's), not read from Render, so a weaker map in Render fails here.
const BRAND = 'Glow Aesthetics Med-Spa';
const EN_SENTENCE = "I am Glow Aesthetics Med-Spa's AI assistant; a team member can take over at any time if you prefer.";
const AI_RE = {
  en: [/(?<!\p{L})AI(?!\p{L})/u, /artificial intelligence/i], de: [/(?<!\p{L})KI(?!\p{L})/u, /künstlich\p{L}*\s+Intelligenz/iu],
  es: [/(?<!\p{L})IA(?!\p{L})/u, /inteligencia artificial/i], fr: [/(?<!\p{L})IA(?!\p{L})/u, /intelligence artificielle/i],
  it: [/(?<!\p{L})IA(?!\p{L})/u, /intelligenza artificiale/i], pt: [/(?<!\p{L})IA(?!\p{L})/u, /inteligência artificial/iu],
  nl: [/(?<!\p{L})(AI|KI)(?!\p{L})/u, /kunstmatige intelligentie/i], pl: [/(?<!\p{L})(AI|SI)(?!\p{L})/u, /sztuczn\p{L}*\s+inteligencj/iu],
  ru: [/(?<!\p{L})ИИ(?!\p{L})/u, /искусственн\p{L}*\s+интеллект/iu], uk: [/(?<!\p{L})ШІ(?!\p{L})/u, /штучн\p{L}*\s+інтелект/iu],
};
const hasAI = (lang, t) => AI_RE[lang].some((re) => re.test(t));
// A first reply in each mapped language WITHOUT the word for AI (es: the live finding's wording) ...
const NO_AI = {
  en: 'Hello! Which treatment would you like to book?', de: 'Guten Tag! Welche Behandlung möchten Sie buchen?',
  es: 'Soy la asistente virtual de Glow Aesthetics Med-Spa. ¿Qué tratamiento le gustaría reservar?', fr: 'Bonjour ! Quel soin souhaitez-vous réserver ?',
  it: 'Buongiorno! Quale trattamento desidera prenotare?', pt: 'Olá! Que tratamento deseja marcar?', nl: 'Goedendag! Welke behandeling wilt u boeken?',
  pl: 'Dzień dobry! Jaki zabieg chciałby Pan zarezerwować?', ru: 'Здравствуйте! Какую процедуру вы хотели бы забронировать?',
  uk: 'Добрий день! Яку процедуру ви бажаєте забронювати?',
};
// ... and WITH it, in the forms an agent writes (acronym, hyphenated compound, the inflected phrase).
const WITH_AI = {
  en: ["Hello! I'm the AI assistant of Glow Aesthetics Med-Spa; a team member can take over on request. Which treatment would you like?", 'I am an artificial intelligence assistant.'],
  de: ['Guten Tag! Ich bin der KI-Assistent der Klinik; auf Wunsch übernimmt ein Teammitglied. Welche Behandlung möchten Sie?', 'Ich bin ein Assistent mit künstlicher Intelligenz.'],
  es: ['¡Hola! Soy la asistente de IA de la clínica; si lo prefiere, le atiende una persona del equipo.', 'Soy un asistente de inteligencia artificial.'],
  fr: ["Bonjour ! Je suis l'assistant IA de la clinique.", "Je suis un assistant d'intelligence artificielle."],
  it: ["Buongiorno! Sono l'assistente IA della clinica.", "Sono un assistente di intelligenza artificiale."],
  pt: ['Olá! Sou o assistente de IA da clínica.', 'Sou um assistente de inteligência artificial.'],
  nl: ['Goedendag! Ik ben de AI-assistent van de kliniek.', 'Ik ben de KI-assistent.', 'Ik ben een assistent op basis van kunstmatige intelligentie.'],
  pl: ['Dzień dobry! Jestem asystentem AI kliniki.', 'Jestem asystentem SI.', 'Jestem asystentem opartym na sztucznej inteligencji.'],
  ru: ['Здравствуйте! Я ИИ-ассистент клиники.', 'Я виртуальный помощник на основе искусственного интеллекта.'],
  uk: ['Добрий день! Я ШІ-асистент клініки.', 'Я помічник на основі штучного інтелекту.'],
};
const D = (name, o, f) => { try { const j = run(o); const r = f(j); check(name, r === true, r === false ? { text: j.text, needs_translation: j.needs_translation, ai_fallback: j.ai_fallback } : r); } catch (e) { check(name, false, String(e.message)); } };
const firstPara = (t) => String(t).split('\n\n')[0];
for (const lang of Object.keys(NO_AI)) {
  // missing -> one sentence in the client's language before the reply, same message, no extra translation call
  D('D ' + lang + ': reply without the word for AI -> the fixed sentence in ' + lang + ' + blank line + the reply, no Haiku call', { language: lang, text: NO_AI[lang], ai_disclosure: 'true' },
    (j) => j.text === firstPara(j.text) + '\n\n' + NO_AI[lang] && hasAI(lang, firstPara(j.text)) && firstPara(j.text).includes(BRAND) &&
      (lang === 'en' ? firstPara(j.text) === EN_SENTENCE : firstPara(j.text) !== EN_SENTENCE) && j.needs_translation === false && j.ai_fallback === true);
  // the sentence itself passes Render's check: a reply that already starts with it gets nothing added (never twice)
  D('D ' + lang + ': the fixed sentence passes Render\'s own check (a reply carrying it is left as it is)', { language: lang, text: NO_AI[lang], ai_disclosure: 'true' },
    (j) => { const k = run({ language: lang, text: j.text, ai_disclosure: 'true' }); return (k.text === j.text && k.ai_fallback === false) || { again: k.text }; });
  for (const t of WITH_AI[lang]) {
    D('D ' + lang + ': reply with the word for AI is sent as it is, no sentence, no Haiku call: ' + t.slice(0, 45), { language: lang, text: t, ai_disclosure: 'true' },
      (j) => hasAI(lang, t) && j.text === t && j.ai_fallback === false && j.needs_translation === false);
  }
  // not the first reply to a new client: WF-1 passes '' (or the caller does not map the input: null) -> nothing is checked or added
  for (const flag of ['', null, 'false']) {
    D('D ' + lang + ': ai_disclosure ' + JSON.stringify(flag) + ' (KNOWN client / not the first reply) -> unchanged even without the word for AI', { language: lang, text: NO_AI[lang], ai_disclosure: flag },
      (j) => j.text === NO_AI[lang] && j.ai_fallback === false && j.needs_translation === false);
  }
}
check('D en: the English sentence is the brief\'s wording with the clinic name', run({ language: 'en', text: 'Hi!', ai_disclosure: 'true' }).text === EN_SENTENCE + '\n\nHi!', run({ language: 'en', text: 'Hi!', ai_disclosure: 'true' }).text);
check('D: each mapped language has its own sentence (10 different sentences)', new Set(Object.keys(NO_AI).map((l) => firstPara(run({ language: l, text: 'x', ai_disclosure: 'true' }).text))).size === 10, 'duplicates');
// Whole words only, acronyms case-sensitive: "IA" inside a word, or the pt verb "ia" ("eu ia" = I was going), is not the word for AI.
for (const [lang, t] of [
  ['es', '¿Es para usted o para su familia? Me llamo Iago.'], ['es', 'LA FAMILIA PUEDE VENIR.'], ['it', 'La sua famiglia è la benvenuta? Ia.'],
  ['pt', 'Eu ia sugerir uma consulta.'], ['pt', 'Ia sugerir uma consulta.'], ['fr', 'Votre RIAD ? Non, notre clinique.'],
  ['en', 'Our AIM is your comfort. Your deposit is PAID.'], ['en', "I'm the clinic's virtual assistant."], ['de', 'Ist es für Ihr KIND? Kiel ist schön.'],
  ['ru', 'Мы наращиваем искусственные ресницы.'], ['uk', 'Ми нарощуємо штучні вії.'], ['pl', 'Mamy sztuczne rzęsy. SIŁA spokoju.'],
  ['nl', 'Wilt u een KIP? Nee, AIR.'],
]) {
  D('D ' + lang + ': not the word for AI -> the sentence is added: ' + t, { language: lang, text: t, ai_disclosure: 'true' },
    (j) => j.text === firstPara(j.text) + '\n\n' + t && hasAI(lang, firstPara(j.text)) && j.ai_fallback === true);
}
// A language not in the map: cannot check -> the English sentence is added and the reply goes through Translate (one Haiku call,
// only because the fallback fired), so it reaches the client in their language.
D('D tr (not in the map): sentence added in English, the message is translated (one Haiku call)', { language: 'tr', text: 'Merhaba! Hangi tedaviyi ayırtmak istersiniz?', ai_disclosure: 'true' },
  (j) => j.text === EN_SENTENCE + '\n\nMerhaba! Hangi tedaviyi ayırtmak istersiniz?' && j.needs_translation === true && j.ai_fallback === true);
D('D tr: even a reply that names AI ("yapay zeka") gets the sentence: an unmapped language cannot be checked', { language: 'tr', text: 'Ben yapay zeka asistanıyım.', ai_disclosure: 'true' },
  (j) => firstPara(j.text) === EN_SENTENCE && j.needs_translation === true);
D('D ar (non-Latin, not in the map): the English sentence is not dropped by the English-line guard', { language: 'ar', text: 'مرحبا! ما العلاج الذي تريده؟', ai_disclosure: 'true' },
  (j) => j.text === EN_SENTENCE + '\n\nمرحبا! ما العلاج الذي تريده؟' && j.needs_translation === true);
D('D tr without the flag: unchanged, no Haiku call (B/C behaviour)', { language: 'tr', text: 'Merhaba! Hangi tedaviyi ayırtmak istersiniz?', ai_disclosure: '' },
  (j) => j.text === 'Merhaba! Hangi tedaviyi ayırtmak istersiniz?' && j.needs_translation === false && j.ai_fallback === false);
D('D pt-br (region tag): the pt map entry applies, no Haiku call', { language: 'pt-br', text: NO_AI.pt, ai_disclosure: 'true' },
  (j) => hasAI('pt', firstPara(j.text)) && j.text.endsWith('\n\n' + NO_AI.pt) && j.needs_translation === false);
D('D upper-case language code (ES) uses the es entry', { language: 'ES', text: NO_AI.es, ai_disclosure: 'true' },
  (j) => hasAI('es', firstPara(j.text)) && j.needs_translation === false);
// B's English-line guard runs first, on the agent's text; the sentence is added after it, so it is never dropped.
D('D ru + the English planning line (execution 28237): the line is dropped, the sentence goes before the kept Russian text', { language: 'ru', text: LEAK, ai_disclosure: 'true' },
  (j) => j.text === firstPara(j.text) + '\n\nКакой день вам удобен для консультации?' && hasAI('ru', firstPara(j.text)) && j.needs_translation === true);
// The first reply can be a template (the agent proposed at once: PENDING_SUMMARY; or escalated: ESCALATED_REPLY; or ERROR):
// a template never names AI, so the sentence goes before it; it is translated anyway, no extra call.
D('D es PENDING_SUMMARY as the first reply: sentence + summary, translated as every es template is', { key: 'PENDING_SUMMARY', language: 'es', ai_disclosure: 'true' },
  (j) => j.text === firstPara(j.text) + '\n\nConsultation (20 min) — lun, 12 oct, 10:30. Free cancellation up to 24 horas before. Reply SÍ to confirm.' && hasAI('es', firstPara(j.text)) && j.needs_translation === true);
D('D en ESCALATED_REPLY as the first reply: sentence + template, not translated', { key: 'ESCALATED_REPLY', language: 'en', ai_disclosure: 'true' },
  (j) => j.text === EN_SENTENCE + "\n\nI've passed this to our team — a team member will contact you shortly." && j.needs_translation === false);
D('D the clinic\'s own name does not count ("KI Beauty" for a de client): the sentence is added', { language: 'de', text: 'Willkommen bei KI Beauty! Welche Behandlung möchten Sie?', ai_disclosure: 'true', settings: { business_name: 'KI Beauty' } },
  (j) => j.text === 'Ich bin der KI-Assistent von KI Beauty; wenn Sie möchten, übernimmt jederzeit ein Mitglied unseres Teams.\n\nWillkommen bei KI Beauty! Welche Behandlung möchten Sie?' && j.ai_fallback === true);
D('D a name that contains AI does not hide a real disclosure ("AI Skin", en: "I\'m the AI assistant of AI Skin")', { language: 'en', text: "I'm the AI assistant of AI Skin.", ai_disclosure: 'true', settings: { business_name: 'AI Skin' } },
  (j) => j.text === "I'm the AI assistant of AI Skin." && j.ai_fallback === false);
D('D an empty reply stays empty (Format still refuses to send nothing; the sentence is not sent alone)', { language: 'es', text: '', ai_disclosure: 'true' },
  (j) => j.text === '' && j.ai_fallback === false);
check('D: send_message\'s Trigger declares the input ai_disclosure (string)', ((((node('Trigger').parameters || {}).workflowInputs || {}).values) || []).some((v) => v.name === 'ai_disclosure' && v.type === 'string'), 'missing');
console.log('\nSEND_MESSAGE_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
