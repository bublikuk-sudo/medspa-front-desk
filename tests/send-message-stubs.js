// Stub test for send_message's capture decision (Task 20): the Format Code node's `test` field and the Test Contact? IF.
// Runs inside the n8n container's Node (see tests/send-message-stubs.sh), which prepends:
//   const CODE = { format, testExpr, formatTarget, trueTarget, falseTarget, captureTarget, captureQuery };
// No network, no n8n runtime: $ and $json are stubbed.
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
console.log('\nSEND_MESSAGE_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
