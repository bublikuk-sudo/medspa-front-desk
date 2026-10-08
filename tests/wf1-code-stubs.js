// Stub test for the WF-1 Code nodes that decide who a message is from (Normalize, Client Formula), the Create Client
// expressions that turn contact_id into telegram_chat_id / phone, and the cancel confirmation (two-step cancel): WF-2's
// Guardrail/Result hand WF-1 the visit request_cancel recorded, WF-1 asks the client, and Gate routes the client's YES.
// Runs in a Node (see tests/wf1-code-stubs.sh), which prepends:
//   const WF = <workflows/wf1-inbound.json>;  const WF2 = <workflows/wf2-agent.json>;  const SM = <workflows/shared/send_message.json>;
// No network, no n8n runtime: $input / $ / $now are stubbed. No jq and no luxon needed, so it also runs offline.

const nodeIn = (wf, n) => wf.nodes.find((x) => x.name === n) || {};
const node = (n) => nodeIn(WF, n);
const P = (n) => node(n).parameters || {};
const outsIn = (wf, n, i = 0) => ((((wf.connections[n] || {}).main || [])[i]) || []).map((x) => x.node);
const outs = (n, i = 0) => outsIn(WF, n, i);
const target = (n, i = 0) => outs(n, i)[0] || 'none';
const CODE = {
  normalize: P('Normalize').jsCode,
  formula: P('Client Formula').jsCode,
  phoneExpr: ((P('Create Client').columns || {}).value || {}).phone,
  idExpr: ((P('Create Client').columns || {}).value || {}).client_id,
  chatExpr: ((P('Create Client').columns || {}).value || {}).telegram_chat_id,
  hasSenderExpr: (((P('Has Sender?').conditions || {}).conditions || [])[0] || {}).leftValue,
  droppedExpr: (((P('Dropped?').conditions || {}).conditions || [])[0] || {}).leftValue,
  notifyTextExpr: ((P('Notify Dropped').workflowInputs || {}).value || {}).text,
  normalizeTargets: outs('Normalize'),
  hasSenderTarget: target('Has Sender?'),
  droppedTarget: target('Dropped?'),
  afterNotify: WF.connections['Notify Dropped'] == null ? 'none' : 'wired',
  testInbound: { method: P('Test Inbound').httpMethod, path: P('Test Inbound').path, auth: P('Test Inbound').authentication, mode: P('Test Inbound').responseMode, cred: (((node('Test Inbound').credentials || {}).httpHeaderAuth) || {}).name },
  testTarget: target('Test Inbound'),
};

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};

const runCode = (code, input, nodes = {}) => {
  const items = (Array.isArray(input) ? input : [input]).map((json) => ({ json }));
  const $input = { first: () => items[0], all: () => items };
  const $ = (name) => ({ first: () => ({ json: nodes[name] }), isExecuted: name in nodes });
  return new Function('$input', '$', code)($input, $);
};
const normalize = (j) => runCode(CODE.normalize, j);
const expr = (e, nodes) => {
  const body = e.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
  return new Function('$', 'return (' + body + ');')((name) => ({ first: () => ({ json: nodes[name] }) }));
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- Telegram (regression) ----
const tgBase = { update_id: 1, message: { message_id: 5, from: { first_name: 'Anna', last_name: 'K' }, chat: { id: 4242, type: 'private' }, text: '  hello ' } };
let r = normalize(tgBase);
check('tg private text', same(r, [{ json: { channel: 'tg', contact_id: 'tg:4242', text: 'hello', raw_name: 'Anna K' } }]), r);
r = normalize({ update_id: 2, message: { chat: { id: 4242, type: 'private' }, sticker: { emoji: 'x' } } });
check('tg sticker -> text empty, still tg:4242', r.length === 1 && r[0].json.text === '' && r[0].json.contact_id === 'tg:4242', r);
check('tg group -> []', same(normalize({ message: { chat: { id: -100, type: 'group' }, text: 'hi' } }), []));
check('tg supergroup -> []', same(normalize({ message: { chat: { id: -100, type: 'supergroup' }, text: 'hi' } }), []));
check('tg message without chat -> []', same(normalize({ message: { text: 'hi' } }), []));
check('tg edited_message (unhandled update) -> []', same(normalize({ update_id: 9, edited_message: { chat: { id: 1, type: 'private' }, text: 'x' } }), []));
check('unknown body {} -> []', same(normalize({}), []));

// ---- WhatsApp: the item shape WhatsApp Trigger emits is { ...change.value, field } (read from the installed node source) ----
const waValue = (over = {}) => ({
  messaging_product: 'whatsapp',
  metadata: { display_phone_number: '15550000000', phone_number_id: 'PNID' },
  contacts: [{ profile: { name: 'Marta Perez' }, wa_id: '491701234567' }],
  messages: [{ from: '491701234567', id: 'wamid.X', timestamp: '1', type: 'text', text: { body: '  Hola, quiero una cita  ' } }],
  field: 'messages',
  ...over,
});
r = normalize(waValue());
check('wa text message', same(r, [{ json: { channel: 'wa', contact_id: 'wa:+491701234567', text: 'Hola, quiero una cita', raw_name: 'Marta Perez', dropped_senders: [], alert_text: '' } }]), r);
r = normalize(waValue({ contacts: undefined }));
check('wa text without contacts -> raw_name empty', r.length === 1 && r[0].json.raw_name === '' && r[0].json.text.startsWith('Hola'), r);
r = normalize(waValue({ messages: undefined, statuses: [{ id: 'wamid.X', status: 'delivered', recipient_id: '491701234567' }] }));
check('wa status callback (delivered) -> []', same(r, []), r);
r = normalize(waValue({ messages: undefined, statuses: [{ status: 'read' }] }));
check('wa status callback (read) -> []', same(r, []), r);
r = normalize(waValue({ messages: [{ from: '491701234567', id: 'wamid.Y', type: 'image', image: { id: 'MEDIA', mime_type: 'image/jpeg', caption: 'look' } }] }));
check('wa image -> text empty (same path as the tg sticker), contact kept', r.length === 1 && r[0].json.text === '' && r[0].json.contact_id === 'wa:+491701234567' && r[0].json.channel === 'wa', r);
for (const t of ['sticker', 'audio', 'video', 'document', 'location', 'contacts', 'interactive', 'button', 'order']) {
  r = normalize(waValue({ messages: [{ from: '491701234567', type: t, [t]: {} }] }));
  check('wa ' + t + ' -> text empty', r.length === 1 && r[0].json.text === '', r);
}
r = normalize(waValue({ field: 'message_template_status_update', messages: undefined }));
check('wa field other than messages -> []', same(r, []), r);
r = normalize(waValue({ field: 'account_update' }));
check('wa other field even with a messages array -> []', same(r, []), r);
r = normalize(waValue({ field: undefined }));
check('wa value without field and without entry -> [] (not Telegram, not trusted)', same(r, []), r);
for (const bad of ['', 'abc', '+491701234567', '49 170 1234567', '12345', '1234567890123456', "49170';DROP", undefined, null, 4917012345]) {
  r = normalize(waValue({ messages: [{ from: bad, type: 'text', text: { body: 'hi' } }] }));
  // M2: a malformed sender never becomes a contact_id and never starts the main path, but it is not silent: an alert-only item
  check('wa from ' + JSON.stringify(bad) + ' fails the contact pattern -> alert-only item (empty contact_id, owner alert)',
    r.length === 1 && r[0].json.contact_id === '' && r[0].json.text === '' && /unreadable sender/.test(r[0].json.alert_text || ''), r);
}

// ---- M1: reactions, unsupported, system are not something the client said to the bot ----
for (const t of ['reaction', 'unsupported', 'system']) {
  r = normalize(waValue({ messages: [{ from: '491701234567', type: t, [t]: { emoji: '\u{1F44D}' } }] }));
  check('M1 wa ' + t + ' -> [] (no reply, no alert)', same(r, []), r);
}
r = normalize(waValue({ messages: [{ from: 'junk', type: 'reaction', reaction: {} }] }));
check('M1 a reaction with a malformed from is ignored too, no alert', same(r, []), r);

// ---- I1: Meta batches ----
const wm = (from, ts, body, extra = {}) => ({ from, id: 'wamid.' + from + ts, timestamp: String(ts), type: 'text', text: { body }, ...extra });
const T = (name, fn) => { try { const x = fn(); check(name, x === true, x); } catch (e) { check(name, false, String(e.message)); } };
const A = '491701234567', B = '380501234567';
// several messages from one sender in one change: joined with \n in timestamp order (input order is deliberately shuffled)
r = normalize(waValue({ messages: [wm(A, 30, 'third'), wm(A, 10, 'first'), wm(A, 20, 'second')] }));
T('I1 one sender, three messages -> joined in timestamp order', () => r.length === 1 && r[0].json.text === 'first\nsecond\nthird' && r[0].json.contact_id === 'wa:+' + A && same(r[0].json.dropped_senders, []) && r[0].json.alert_text === '' || r);
r = normalize(waValue({ messages: [wm(A, 10, 'one'), wm(A, 10, 'two'), wm(A, 10, 'three')] }));
T('I1 equal timestamps keep input order', () => r[0].json.text === 'one\ntwo\nthree' || r);
r = normalize(waValue({ messages: [wm(A, 10, 'see this', { type: 'image', image: {} }), wm(A, 11, 'and this'), wm(A, 12, '   ')] }));
T('I1 text mixed with an image and a blank text: only the real texts, no empty lines', () => r[0].json.text === 'and this' || r);
r = normalize(waValue({ messages: [wm(A, 10, '', { type: 'image', image: {} }), wm(A, 11, '', { type: 'audio', audio: {} })] }));
T('I1 only non-text from the sender -> text empty (Send Non-Text path), contact kept', () => r.length === 1 && r[0].json.text === '' && r[0].json.contact_id === 'wa:+' + A || r);
// several trigger items (several changes / entries in one POST)
r = normalize([waValue({ messages: [wm(A, 20, 'second')] }), waValue({ messages: [wm(A, 10, 'first')] }), waValue({ messages: undefined, statuses: [{ status: 'read' }] }), waValue({ field: 'account_update' })]);
T('I1 multi-item batch: every item read, statuses and other fields skipped', () => r.length === 1 && r[0].json.text === 'first\nsecond' && same(r[0].json.dropped_senders, []) || r);
r = normalize([waValue({ messages: [wm(A, 10, 'hello')], contacts: undefined }), waValue({ messages: [wm(A, 11, 'again')], contacts: [{ profile: { name: 'Marta' }, wa_id: A }] })]);
T('I1 multi-item batch: name taken from whichever item has it', () => r[0].json.raw_name === 'Marta' || r);
// two senders: the earliest message decides, the other sender is reported
const two = waValue({
  contacts: [{ profile: { name: 'Bea' }, wa_id: B }, { profile: { name: 'Ann' }, wa_id: A }],
  messages: [wm(B, 50, 'b late'), wm(A, 40, 'a early'), wm(B, 60, 'b later'), wm(A, 45, 'a second')],
});
r = normalize(two);
T('I1 two senders: the earliest sender is processed with all of their texts', () => r.length === 1 && r[0].json.contact_id === 'wa:+' + A && r[0].json.text === 'a early\na second' && r[0].json.raw_name === 'Ann' || r);
T('I1 two senders: the other one is in dropped_senders with a count', () => same(r[0].json.dropped_senders, [{ contact_id: 'wa:+' + B, count: 2 }]) || r);
T('I1 two senders: alert text names the sender and the count', () => r[0].json.alert_text === '⚠️ WhatsApp batch: 2 message(s) from wa:+' + B + ' were not processed — ask them to resend' || r);
r = normalize([waValue({ messages: [wm(B, 5, 'b first')] }), waValue({ messages: [wm(A, 9, 'a')] })]);
T('I1 two senders across items: the earlier timestamp wins regardless of item order', () => r[0].json.contact_id === 'wa:+' + B && r[0].json.dropped_senders[0].contact_id === 'wa:+' + A || r);
// the processed sender plus a malformed one: one alert for the batch
r = normalize(waValue({ messages: [wm(A, 10, 'ok'), { from: 'x', type: 'text', text: { body: 'y' } }, { type: 'text', text: { body: 'z' } }] }));
T('I1/M2 valid sender plus two malformed senders -> processed, ONE alert line with the count', () => r[0].json.contact_id === 'wa:+' + A && r[0].json.alert_text === '⚠️ WhatsApp batch: 2 message(s) with an unreadable sender number were not processed' || r);
// empty / odd messages
r = normalize(waValue({ messages: [] }));
T('I1 messages: [] -> []', () => same(r, []) || r);
r = normalize(waValue({ messages: [{ from: A, type: 'text' }] }));
T('I1 type text without text.body -> text empty, contact kept', () => r.length === 1 && r[0].json.text === '' && r[0].json.contact_id === 'wa:+' + A || r);
r = normalize(waValue({ messages: [{ from: A, type: 'text', text: { body: 42 } }] }));
T('I1 text.body not a string -> text empty', () => r[0].json.text === '' || r);
r = normalize(waValue({ messages: [null, 'str', 7, wm(A, 1, 'ok')] }));
T('I1 non-object entries in messages[] are skipped', () => r.length === 1 && r[0].json.text === 'ok' || r);
// M3: profile.name that is not a string
for (const nm of [{ a: 1 }, 42, null, ['x'], true]) {
  r = normalize(waValue({ contacts: [{ profile: { name: nm }, wa_id: A }] }));
  T('M3 profile.name ' + JSON.stringify(nm) + ' -> raw_name empty', () => r.length === 1 && r[0].json.raw_name === '' || r);
}
r = normalize(waValue({ contacts: [{ wa_id: A }] }));
T('M3 contact without a profile -> raw_name empty', () => r[0].json.raw_name === '' || r);
r = normalize(waValue({ contacts: 'nope' }));
T('M3 contacts not an array -> raw_name empty', () => r[0].json.raw_name === '' || r);
// the two side-branch nodes read these fields
T('Telegram output carries no alert_text (Dropped? false)', () => normalize(tgBase)[0].json.alert_text === undefined || 'has alert_text');
// Meta sends wa_id without a plus, digits only, up to 15 digits
r = normalize(waValue({ messages: [{ from: '380501234567', type: 'text', text: { body: 'hi' } }] }));
check('wa Ukrainian number', r.length === 1 && r[0].json.contact_id === 'wa:+380501234567', r);

// ---- Task 20: Test Inbound (the webhook item's body is unwrapped; only the test contact ranges pass) ----
const viaTest = (body) => runCode(CODE.normalize, { headers: { 'x-test-key': 'redacted' }, params: {}, query: {}, body, webhookUrl: 'https://h/webhook/wf1-test', executionMode: 'production' }, { 'Test Inbound': {} });
const marked = (items) => items.map((i) => ({ json: { ...i.json, test: true } }));
const tgT = (id) => ({ update_id: 7, message: { message_id: 1, from: { id, is_bot: false, first_name: 'Dana', last_name: 'Test' }, chat: { id, first_name: 'Dana', type: 'private' }, date: 1, text: ' hi ' } });
r = viaTest(tgT(9000000101));
check('T20 test tg in range -> exactly what the Telegram Trigger item gives, plus test: true', same(r, marked(normalize(tgT(9000000101)))) && r[0].json.contact_id === 'tg:9000000101', r);
for (const id of [4242, 900000010, 90000001011, 9000001101, '9000000101x', -9000000101, null]) {
  r = viaTest(tgT(id));
  check('T20 test tg chat ' + JSON.stringify(id) + ' out of range -> []', same(r, []), r);
}
r = viaTest({ ...tgT(9000000101), message: { ...tgT(9000000101).message, chat: { id: 9000000101, type: 'group' } } });
check('T20 test tg group chat in range -> [] (same rule as the trigger)', same(r, []), r);
const waT = (from, over = {}) => waValue({ contacts: [{ profile: { name: 'Dana Test' }, wa_id: from }], messages: [{ from, id: 'wamid.T', timestamp: '1', type: 'text', text: { body: ' hola ' } }], ...over });
r = viaTest(waT('15550000101'));
check('T20 test wa in range -> exactly what the WhatsApp Trigger item gives, plus test: true', same(r, marked(normalize(waT("15550000101")))) && r[0].json.contact_id === 'wa:+15550000101' && r[0].json.text === 'hola', r);
r = viaTest([waT('15550000101'), waT('15550000101', { messages: [wm('15550000101', 5, 'second')] })]);
check('T20 test wa body as an array of items (a batch) -> same as the trigger batch', same(r, marked(normalize([waT('15550000101'), waT('15550000101', { messages: [wm('15550000101', 5, 'second')] })]))) && r[0].json.text === 'hola\nsecond', r);
for (const f of ['491701234567', '1555000010', '155500001011', '25550000101', '+15550000101', 15550000101, '']) {
  r = viaTest(waT(f));
  check('T20 test wa from ' + JSON.stringify(f) + ' out of range -> [] (no reply, no alert)', same(r, []), r);
}
r = viaTest(waT('15550000101', { messages: [wm('15550000101', 1, 'a'), wm('491701234567', 2, 'b')] }));
check('T20 test batch with one real sender -> [] (no owner alert naming a real number)', same(r, []), r);
r = viaTest([waT('15550000101'), waT('491701234567')]);
check('T20 test array with one real item -> []', same(r, []), r);
r = viaTest(waT('15550000101', { messages: undefined, statuses: [{ status: 'read' }] }));
check('T20 test status callback -> []', same(r, []), r);
for (const b of [undefined, null, {}, [], 'str', 42, [[tgT(9000000101)]]]) {
  r = viaTest(b);
  check('T20 test body ' + JSON.stringify(b) + ' -> []', same(r, []), r);
}
r = normalize({ headers: {}, body: tgT(9000000101), webhookUrl: 'x' });
check('T20 a webhook-shaped item NOT started by Test Inbound is not unwrapped -> []', same(r, []), r);
// fix round 1 (I1): only a test run is marked; a real user whose id falls in the test range is an ordinary client
r = normalize(tgT(9000000101));
check('T20 real Telegram item in the test range -> no test field', r.length === 1 && !('test' in r[0].json), r);
r = normalize(waT('15550000101'));
check('T20 real WhatsApp item in the test range -> no test field', r.length === 1 && !('test' in r[0].json), r);
check('T20 real Telegram item outside the range -> no test field', !('test' in normalize(tgBase)[0].json));
const idOf = (nj) => expr(CODE.idExpr, { Normalize: nj });
T('T20 Create Client id for a test run starts with C-test-', () => /^C-test-[0-9A-Z]+$/.test(idOf(viaTest(tgT(9000000101))[0].json)) && /^C-test-[0-9A-Z]+$/.test(idOf(viaTest(waT('15550000101'))[0].json)) || [idOf(viaTest(tgT(9000000101))[0].json)]);
T('T20 Create Client id for a real item (in range or not) is C-<base36>, never C-test', () =>
  [normalize(tgT(9000000101)), normalize(waT('15550000101')), normalize(tgBase), normalize(waValue())].every((x) => /^C-[0-9A-Z]+$/.test(idOf(x[0].json))) || 'wrong');
T('T20 Test Inbound: POST wf1-test, header auth with the MedSpa Test Key, answers on receipt, feeds Normalize', () =>
  CODE.testInbound.method === 'POST' && CODE.testInbound.path === 'wf1-test' && CODE.testInbound.auth === 'headerAuth' &&
  CODE.testInbound.cred === 'MedSpa Test Key' && CODE.testInbound.mode === 'onReceived' && CODE.testTarget === 'Normalize' || [CODE.testInbound, CODE.testTarget]);

// ---- Client Formula with what Normalize produced ----
const formulaOf = (nj) => runCode(CODE.formula, {}, { Normalize: nj })[0].json.formula;
check('formula tg', formulaOf({ contact_id: 'tg:4242' }) === "{telegram_chat_id}='4242'");
check('formula wa (E.164 with plus, matches the phone column)', formulaOf({ contact_id: 'wa:+491701234567' }) === "{phone}='+491701234567'");
check('formula wa end to end from a trigger item', formulaOf(normalize(waValue())[0].json) === "{phone}='+491701234567'");
const none = "{client_id}='__no_such_client__'";
check('formula empty', formulaOf({ contact_id: '' }) === none);
check('formula wa without plus', formulaOf({ contact_id: 'wa:491701234567' }) === none);
check('formula injection attempt', formulaOf({ contact_id: "wa:+1'} OR {a}='" }) === none);

// ---- Create Client expressions ----
const waN = normalize(waValue())[0].json, tgN = normalize(tgBase)[0].json;
check('Create Client phone for wa = +digits', expr(CODE.phoneExpr, { Normalize: waN }) === '+491701234567');
check('Create Client telegram_chat_id for wa = empty', expr(CODE.chatExpr, { Normalize: waN }) === '');
check('Create Client phone for tg = empty', expr(CODE.phoneExpr, { Normalize: tgN }) === '');
check('Create Client telegram_chat_id for tg', expr(CODE.chatExpr, { Normalize: tgN }) === '4242');

// ---- Side branch wiring and expressions (I1) ----
const jsonExpr = (e, json) => {
  const body = e.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
  return new Function('$json', 'return (' + body + ');')(json);
};
T('Has Sender? is true for a normal item, false for an alert-only item and for nothing else', () =>
  jsonExpr(CODE.hasSenderExpr, waN) === true && jsonExpr(CODE.hasSenderExpr, tgN) === true &&
  jsonExpr(CODE.hasSenderExpr, normalize(waValue({ messages: [{ from: 'x', type: 'text' }] }))[0].json) === false || 'wrong');
T('Dropped? is true only when there is an alert text', () =>
  jsonExpr(CODE.droppedExpr, waN) === false && jsonExpr(CODE.droppedExpr, tgN) === false &&
  jsonExpr(CODE.droppedExpr, normalize(two)[0].json) === true || 'wrong');
T('Notify Dropped sends exactly alert_text', () => jsonExpr(CODE.notifyTextExpr, normalize(two)[0].json) === normalize(two)[0].json.alert_text || 'wrong');
T('Normalize feeds both Has Sender? and Dropped?; Has Sender? feeds Has Text?; Dropped? feeds Notify Dropped; nothing follows Notify Dropped',
  () => same((CODE.normalizeTargets || []).slice().sort(), ['Dropped?', 'Has Sender?']) && CODE.hasSenderTarget === 'Has Text?' && CODE.droppedTarget === 'Notify Dropped' && CODE.afterNotify === 'none' || [CODE.normalizeTargets, CODE.hasSenderTarget, CODE.droppedTarget, CODE.afterNotify]);

// ==== Cancel confirmation (two-step cancel, owner decision 2026-10-08) ====================================================
// $('Name') over a map name -> json or [json, ...]; first(), all(), isExecuted like n8n.
const dollar = (nodes) => (name) => {
  const v = nodes[name];
  const arr = v === undefined ? [] : (Array.isArray(v) ? v : [v]);
  return { first: () => ({ json: arr[0] }), all: () => arr.map((json) => ({ json })), isExecuted: name in nodes };
};
const NOW = Date.now();
const $nowStub = { toUTC: () => ({ toISO: () => new Date().toISOString() }), toMillis: () => Date.now() };
// luxon as the expressions use it: DateTime.fromISO(s).toMillis() is NaN for an unreadable value, like an invalid luxon DateTime
const DateTimeStub = { fromISO: (s) => ({ toMillis: () => (/^\d{4}-\d\d-\d\dT/.test(String(s)) ? Date.parse(s) : NaN) }) };
const strip = (e) => String(e).replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
// "={{ expr }}" against $json and named nodes
const ev = (e, json, nodes = {}) => new Function('$json', '$', '$now', 'DateTime', 'return (' + strip(e) + ');')(json, dollar(nodes), $nowStub, DateTimeStub);
// "=text {{ expr }} text": every {{ }} evaluated (an n8n text template)
const tpl = (t, json, nodes = {}) => String(t).replace(/^=/, '').replace(/\{\{([\s\S]+?)\}\}/g, (_, x) => String(new Function('$json', '$', '$now', 'DateTime', 'return (' + x + ');')(json, dollar(nodes), $nowStub, DateTimeStub)));
const iso = (msFromNow) => new Date(NOW + msFromNow).toISOString();
const MIN = 60000;
const leftOf = (n) => (((P(n).conditions || {}).conditions || [])[0] || {}).leftValue;
const inputsOf = (n) => (P(n).workflowInputs || {}).value || {};

// ---- WF-2: the agent-facing tool is request_cancel; cancel_booking is internal ----
const w2node = (n) => nodeIn(WF2, n);
const tools2 = WF2.nodes.filter((x) => x.type === '@n8n/n8n-nodes-langchain.toolWorkflow').map((x) => x.name).sort();
T('WF-2 tools: request_cancel replaces cancel_booking (no agent tool reaches cancel_booking)', () =>
  same(tools2, ['check_availability', 'escalate', 'find_client', 'propose_booking', 'request_cancel', 'search_knowledge']) &&
  !JSON.stringify(WF2.nodes).includes('WFID:cancel_booking') || tools2);
const rc = w2node('request_cancel').parameters || {};
T('WF-2 request_cancel calls WFID:request_cancel; contact_id from the Trigger, appt_id from the model, nothing else', () =>
  (rc.workflowId || {}).value === 'WFID:request_cancel' &&
  ((rc.workflowInputs || {}).value || {}).contact_id === "={{ $('Trigger').first().json.contact_id }}" &&
  /\$fromAI\('appt_id'/.test(((rc.workflowInputs || {}).value || {}).appt_id || '') &&
  same(Object.keys((rc.workflowInputs || {}).value || {}).sort(), ['appt_id', 'contact_id']) || rc.workflowInputs);
T('WF-2 request_cancel is wired to the Agent as a tool', () =>
  same(((WF2.connections.request_cancel || {}).ai_tool || [[]])[0].map((x) => x.node), ['Agent']) && !WF2.connections.cancel_booking || WF2.connections.request_cancel);
const sys = String((((w2node('Agent').parameters || {}).options) || {}).systemMessage || '');
T('WF-2 system prompt: step 4 names request_cancel, never cancel_booking, and says only the client\'s YES cancels', () =>
  /4\. To cancel:[^\n]*request_cancel/.test(sys) && !/cancel_booking/.test(sys) && /CANCEL_PENDING/.test(sys) && /LATE_CANCEL_PENDING/.test(sys) && /never say[^\n]*cancelled/i.test(sys) || 'step 4 not rewritten');

// Guardrail: the last request_cancel that recorded a pending cancellation in this turn (a tool observation, not model text)
const guard = (steps, output = 'ok') => new Function('$input', w2node('Guardrail').parameters.jsCode)({ first: () => ({ json: { output, intermediateSteps: steps } }) })[0].json;
const obs = (verdict, appt = '') => JSON.stringify([{ verdict, appt_id: appt }]);
const step = (tool, observation) => ({ action: { tool }, observation });
let g = guard([step('find_client', obs('KNOWN name="A"')), step('request_cancel', obs('CANCEL_PENDING A-TEST-1', 'A-TEST-1'))]);
T('Guardrail: CANCEL_PENDING -> cancel_appt_id + cancel_verdict', () => g.cancel_appt_id === 'A-TEST-1' && g.cancel_verdict === 'CANCEL_PENDING' || g);
g = guard([step('request_cancel', '[{"verdict" : "CANCEL_PENDING A-TEST-SP", "appt_id": "A-TEST-SP"}]')]);
T('Guardrail: whitespace around the colon of the observation JSON is allowed (as for FOUND / ESCALATED)', () => g.cancel_appt_id === 'A-TEST-SP' && g.cancel_verdict === 'CANCEL_PENDING' || g);
g = guard([step('request_cancel', '[{"verdicts:"CANCEL_PENDING A-TEST-SS"}]')]);
T('Guardrail: only a "verdict" key counts', () => g.cancel_appt_id === '' || g);
g = guard([step('request_cancel', obs('LATE_CANCEL_PENDING A-TEST-LATE', 'A-TEST-LATE'))]);
T('Guardrail: LATE_CANCEL_PENDING -> the late verdict', () => g.cancel_appt_id === 'A-TEST-LATE' && g.cancel_verdict === 'LATE_CANCEL_PENDING' || g);
for (const v of ['NOT_FOUND', 'NOT_YOURS']) {
  g = guard([step('request_cancel', obs(v))]);
  T('Guardrail: ' + v + ' -> no cancel question', () => g.cancel_appt_id === '' && g.cancel_verdict === '' || g);
}
g = guard([step('request_cancel', 'There was an error: "CANCEL_PENDING A-TEST-1"')]);
T('Guardrail: a tool error that quotes a verdict is not a recorded request', () => g.cancel_appt_id === '' || g);
g = guard([step('search_knowledge', obs('CANCEL_PENDING A-TEST-1')), step('escalate', obs('CANCEL_PENDING A-TEST-2'))]);
T('Guardrail: only request_cancel observations count', () => g.cancel_appt_id === '' || g);
g = guard([step('request_cancel', obs('CANCEL_PENDING A-TEST-1', 'A-TEST-1')), step('request_cancel', obs('LATE_CANCEL_PENDING A-TEST-2', 'A-TEST-2'))]);
T('Guardrail: two recorded requests in one turn -> the last one', () => g.cancel_appt_id === 'A-TEST-2' && g.cancel_verdict === 'LATE_CANCEL_PENDING' || g);
g = guard([step('request_cancel', obs("CANCEL_PENDING A-TEST-1'}", ''))]);
T('Guardrail: a malformed appt_id is not taken', () => g.cancel_appt_id === '' || g);
g = guard([]);
T('Guardrail: no tool call -> empty cancel fields, the old fields unchanged', () => g.cancel_appt_id === '' && g.cancel_verdict === '' && g.reply === 'ok' && g.violation === false && same(g.tools_used, []) || g);
const res2 = (n, field) => ((((w2node(n).parameters || {}).assignments || {}).assignments) || []).find((a) => a.name === field) || {};
T('WF-2 Result passes cancel_appt_id / cancel_verdict, blanked when the turn escalated', () =>
  ev(res2('Result', 'cancel_appt_id').value, { escalated: false, cancel_appt_id: 'A-TEST-1' }) === 'A-TEST-1' &&
  ev(res2('Result', 'cancel_verdict').value, { escalated: false, cancel_verdict: 'CANCEL_PENDING' }) === 'CANCEL_PENDING' &&
  ev(res2('Result', 'cancel_appt_id').value, { escalated: true, cancel_appt_id: 'A-TEST-1' }) === '' &&
  ev(res2('Result', 'cancel_verdict').value, { escalated: true, cancel_verdict: 'CANCEL_PENDING' }) === '' || 'wrong');
T('WF-2 Result Escalated never asks to cancel', () => res2('Result Escalated', 'cancel_appt_id').value === '' && res2('Result Escalated', 'cancel_verdict').value === '' || 'wrong');

// ---- Fix 1 (I1): the open cancel question lives on the client row, Clients.cancel_ask_appt_id ----
// WF-1's Mark Cancel Asked sets it BEFORE the question goes out; send_message clears it before ANY other message to the client
// goes out (its Clear Ask? / Clear Ask nodes; tests/send-message-stubs.sh checks them, SM is used here end to end). So while it
// is set, the cancel question IS the bot's last message, whatever path (WF-1, WF-5 reminder or revisit, error) sent the others.
const smLeft = ((((nodeIn(SM, 'Clear Ask?').parameters || {}).conditions || {}).conditions || [])[0] || {}).leftValue;
const smClears = (template_key, cf) => ev(smLeft, {}, { Trigger: { template_key }, Client: { id: 'recC', fields: cf } }) === true;
// one message through send_message: the client fields afterwards
const sendVia = (template_key, cf) => (smClears(template_key, cf) ? { ...cf, cancel_ask_appt_id: '' } : cf);

// Client Data passes the marker on (Gate and the Pending formula read it there)
const clientData = (fields) => new Function('$input', '$', P('Client Data').jsCode)({}, dollar({ Normalize: { contact_id: 'tg:1', channel: 'tg', text: 'yes' }, Client: { id: 'recC', fields } }))[0].json;
T('Client Data passes cancel_ask_appt_id on ("" when absent)', () => clientData({ client_id: 'C-1', cancel_ask_appt_id: 'A-C' }).cancel_ask_appt_id === 'A-C' && clientData({ client_id: 'C-1' }).cancel_ask_appt_id === '' || clientData({ client_id: 'C-1', cancel_ask_appt_id: 'A-C' }));

// ---- WF-1 Pending search: the pending proposal and the visit of the open cancel question, one search ----
const pf = (json) => ev(P('Pending').filterByFormula, json);
T('Pending: one search, returnAll; the pending row and the open question\'s visit', () => P('Pending').returnAll === true && P('Pending').limit === undefined &&
  pf({ client_id: 'C-1', cancel_ask_appt_id: 'A-C' }) === "AND({client_id}='C-1',OR({status}='pending',{appt_id}='A-C'))" &&
  pf({ client_id: 'C-1', cancel_ask_appt_id: '' }) === "AND({client_id}='C-1',OR({status}='pending',{appt_id}='__no_such_appt__'))" || pf({ client_id: 'C-1', cancel_ask_appt_id: 'A-C' }));
T('Pending: hostile client_id / appt id match nothing', () => pf({ client_id: "C-1'", cancel_ask_appt_id: 'A-C' }).startsWith("AND({client_id}='__no_such_client__',") &&
  pf({ client_id: 'C-1', cancel_ask_appt_id: "A-C')" }).includes("{appt_id}='__no_such_appt__'") || 'wrong');

// ---- WF-1 Gate: routing of a short reply ----
const gate = (kind, is_short, rows, askId = '') => new Function('$input', '$', P('Gate').jsCode)({}, dollar({ Classify: { kind, is_short }, 'Client Data': { cancel_ask_appt_id: askId, last_agent_reply_at: iso(-1 * MIN) }, Pending: rows.length ? rows.map((f, i) => ({ id: 'rec' + i, createdTime: '', fields: f })) : [{}] }))[0].json;
const pend = { appt_id: 'A-P', status: 'pending', summary_sent_at: iso(-10 * MIN), pending_expires_at: iso(5 * MIN) };
const visit = (over = {}) => ({ appt_id: 'A-C', status: 'confirmed', cancel_expires_at: iso(13 * MIN), ...over });
let gr = gate('yes', true, [pend]);
T('Gate: YES with a pending booking and no open cancel question -> confirm', () => gr.route === 'confirm' && gr.cancel_appt_id === '' || gr);
gr = gate('yes', true, [visit()], 'A-C');
T('Gate: YES while the cancel question is open -> cancel that visit', () => gr.route === 'cancel' && gr.cancel_appt_id === 'A-C' || gr);
gr = gate('yes', true, [pend, visit()], 'A-C');
T('Gate: pending booking + open cancel question (asked last) -> cancel', () => gr.route === 'cancel' && gr.cancel_appt_id === 'A-C' || gr);
for (const st of ['booked', 'reminded']) {
  gr = gate('yes', true, [visit({ status: st })], 'A-C');
  T('Gate: open question on a ' + st + ' visit -> cancel', () => gr.route === 'cancel' || gr);
}
gr = gate('yes', true, [visit({ cancel_expires_at: iso(-1 * MIN) })], 'A-C');
T('Gate: YES to an expired cancel question -> agent, the visit stays', () => gr.route === 'agent' && gr.cancel_appt_id === '' || gr);
gr = gate('yes', true, [pend, visit({ cancel_expires_at: iso(-1 * MIN) })], 'A-C');
T('Gate: expired cancel question that is still the last message, with a pending booking -> agent (neither cancel nor booking)', () => gr.route === 'agent' || gr);
gr = gate('yes', true, [visit({ cancel_expires_at: undefined })], 'A-C');
T('Gate: a visit without cancel_expires_at is never cancelled', () => gr.route === 'agent' || gr);
gr = gate('yes', true, [pend], 'A-C');
T('Gate: open question but its visit is no longer live (not returned) -> agent, not the booking', () => gr.route === 'agent' && gr.cancel_appt_id === '' || gr);
gr = gate('yes', true, [visit({ status: 'cancelled' })], 'A-C');
T('Gate: open question on a cancelled visit -> agent', () => gr.route === 'agent' || gr);
gr = gate('yes', true, [visit({ appt_id: 'A-OTHER' })], 'A-C');
T('Gate: only the visit the question names counts', () => gr.route === 'agent' || gr);
// M1: a bare cancel word (Classify's NO list) answering the cancel question goes to Haiku, which decides
gr = gate('no', true, [visit()], 'A-C');
T('Gate (M1): a short NO-list reply ("cancel", "no", "отмена") to the open question -> llm, yes_target cancel', () => gr.route === 'llm' && gr.yes_target === 'cancel' && gr.cancel_appt_id === 'A-C' || gr);
gr = gate('no', true, [visit({ cancel_expires_at: iso(-1 * MIN) })], 'A-C');
T('Gate (M1): a NO-list reply to an expired question -> agent', () => gr.route === 'agent' || gr);
gr = gate('other', true, [visit()], 'A-C');
T('Gate: a short other reply to the open question -> llm, yes_target cancel', () => gr.route === 'llm' && gr.yes_target === 'cancel' && gr.cancel_appt_id === 'A-C' || gr);
gr = gate('other', false, [visit()], 'A-C');
T('Gate: a long message after the cancel question -> agent', () => gr.route === 'agent' || gr);
gr = gate('other', true, [pend]);
T('Gate: a short other reply with a pending booking -> llm, yes_target confirm', () => gr.route === 'llm' && gr.yes_target === 'confirm' && gr.cancel_appt_id === '' || gr);
gr = gate('yes', true, []);
T('Gate: YES with nothing pending -> reminder route (unchanged)', () => gr.route === 'reminder' || gr);
gr = gate('no', true, []);
T('Gate: NO with nothing pending -> reminder route (unchanged)', () => gr.route === 'reminder' || gr);
gr = gate('no', true, [pend]);
T('Gate: NO with a pending booking only -> reminder route (unchanged)', () => gr.route === 'reminder' || gr);
gr = gate('other', false, [pend]);
T('Gate: a long message with a pending booking -> agent (unchanged)', () => gr.route === 'agent' || gr);

// ---- I1: every other message to the client closes the cancel question ----
// Each WF-1 send node with the template key it really sends; only Send Cancel Ask keeps the question open.
const sendNodes = WF.nodes.filter((x) => ((x.parameters || {}).workflowId || {}).value === 'WFID:send_message').map((x) => x.name).sort();
const keyCtx = {
  'Send Reminder Result': [{ verdict: 'CONFIRMED' }, {}], 'Send Template': [{}, { Agent: { template_key: 'ESCALATED_REPLY' } }],
  'Send Cancel Result': [{}, { 'Cancel Visit': { verdict: 'LATE_CANCEL', appt_id: 'A-C' } }], 'Send Cancel Ask': [{}, { Agent: { cancel_verdict: 'CANCEL_PENDING' } }],
};
const keyOf = (n) => { const k = inputsOf(n).template_key || ''; return k.startsWith('=') ? ev(k, ...(keyCtx[n] || [{}, {}])) : k; };
const open = { client_id: 'C-1', cancel_ask_appt_id: 'A-C' };
const keep = sendNodes.filter((n) => !smClears(keyOf(n), open));
T('every WF-1 send to the client except Send Cancel Ask closes the question (' + sendNodes.length + ' send nodes)', () =>
  same(keep, ['Send Cancel Ask']) && sendNodes.length >= 16 || { keep, sendNodes: sendNodes.map((n) => n + '=' + keyOf(n)) });
T('Send Reminder Result closes it for CONFIRMED and for CANCELLED', () => smClears(ev(inputsOf('Send Reminder Result').template_key, { verdict: 'CONFIRMED' }), open) &&
  smClears(ev(inputsOf('Send Reminder Result').template_key, { verdict: 'CANCELLED' }), open) || 'wrong');
// Owner addition: BOOKED needs cancellation_hours, which send_message fills from Settings unless a caller overrides it in vars_json.
const bookedSenders = sendNodes.filter((n) => keyOf(n) === 'BOOKED');
T('BOOKED is sent only by Send Booked, with no vars_json (send_message fills cancellation_hours from Settings, as for PENDING_SUMMARY)', () =>
  same(bookedSenders, ['Send Booked']) && inputsOf('Send Booked').vars_json === '' && inputsOf('Send Summary').vars_json === '' || bookedSenders.map((n) => n + ' vars_json=' + inputsOf(n).vars_json));
T('WF-1 sends to the client only through send_message (no Telegram / WhatsApp send node)', () =>
  WF.nodes.filter((x) => ['n8n-nodes-base.telegram', 'n8n-nodes-base.whatsApp'].includes(x.type)).length === 0 || 'direct send node');
T('WF-5\'s REMINDER and REVISIT (sent through send_message) close it too', () => smClears('REMINDER', open) && smClears('REVISIT', open) || 'wrong');

// Sequences (the reviewer's reproduction and its relatives): state = the client row; the visit A stays booked and unexpired.
const VA = visit({ appt_id: 'A-A', status: 'booked' });
const VB = { appt_id: 'A-B', status: 'reminded', reminder_sent_at: iso(-1 * MIN) };
const markAsked = (cf) => ({ ...cf, cancel_ask_appt_id: ev(((P('Mark Cancel Asked').columns || {}).value || {}).cancel_ask_appt_id, {}, { 'Cancel Row': { id: 'recA', fields: { appt_id: 'A-A' } }, 'Client Data': { client_rec: 'recC' } }) });
const rowsFor = (cf, extra = []) => (cf.cancel_ask_appt_id === 'A-A' ? [VA, ...extra] : extra);   // what Pending returns
for (const verdict of ['CONFIRMED', 'CANCELLED']) {
  let cf = markAsked({ client_id: 'C-1' });
  cf = sendVia(keyOf('Send Cancel Ask'), cf);                                     // the question goes out
  T('sequence ' + verdict + ': after the question the marker is A', () => cf.cancel_ask_appt_id === 'A-A' || cf);
  cf = sendVia('REMINDER', cf);                                                  // WF-5 reminds B
  let g1 = gate('yes', true, rowsFor(cf), cf.cancel_ask_appt_id);
  T('sequence ' + verdict + ': YES after the reminder for B goes to the reminder route, not cancel', () => g1.route === 'reminder' || g1);
  cf = sendVia(ev(inputsOf('Send Reminder Result').template_key, { verdict }), cf);   // reminder_reply answered B
  g1 = gate('yes', true, rowsFor(cf), cf.cancel_ask_appt_id);
  const g2 = gate('other', true, rowsFor(cf), cf.cancel_ask_appt_id);
  T('sequence ' + verdict + ': reminder answered for B, then a bare YES / "ok" does not cancel A', () => g1.route !== 'cancel' && g2.yes_target !== 'cancel' && g1.cancel_appt_id === '' || [g1, g2]);
}
{
  // the reminder send alone failing to clear would still be caught by Send Reminder Result: check each step on its own
  let cf = markAsked({ client_id: 'C-1' });
  cf = sendVia(ev(inputsOf('Send Reminder Result').template_key, { verdict: 'CONFIRMED' }), cf);
  const g = gate('yes', true, rowsFor(cf, [VB]), cf.cancel_ask_appt_id);
  T('sequence: Send Reminder Result alone closes the question', () => g.route !== 'cancel' || g);
}
{
  let cf = markAsked({ client_id: 'C-1' });
  cf = sendVia(keyOf('Send Cancel Ask'), cf);
  cf = sendVia('PENDING_SUMMARY', cf);                                           // a later agent turn proposed a booking
  let g = gate('yes', true, rowsFor(cf, [pend]), cf.cancel_ask_appt_id);
  T('sequence: summary sent after the cancel question -> YES confirms the booking, not cancel', () => g.route === 'confirm' || g);
  cf = sendVia('BOOKED', cf); cf = sendVia('BOOKED_INTAKE', cf);
  g = gate('other', true, rowsFor(cf), cf.cancel_ask_appt_id);
  const g2 = gate('yes', true, rowsFor(cf), cf.cancel_ask_appt_id);
  T('sequence: booked summary confirmed, then "ok" / "yes" -> never cancel', () => g.route !== 'cancel' && g.yes_target !== 'cancel' && g2.route !== 'cancel' || [g, g2]);
}
for (const k of ['', 'ERROR', 'ESCALATED_HOLD', 'NON_TEXT', 'RATE_LIMIT', 'SLOT_TAKEN', 'EXPIRED', 'ALREADY_BOOKED', 'CANCELLED', 'LATE_CANCEL', 'REVISIT']) {
  let cf = sendVia(keyOf('Send Cancel Ask'), markAsked({ client_id: 'C-1' }));
  cf = sendVia(k, cf);
  const g = gate('yes', true, rowsFor(cf), cf.cancel_ask_appt_id);
  T('sequence: cancel question, then ' + (k || 'an agent reply') + ', then YES -> not cancel', () => g.route !== 'cancel' || g);
}
{
  let cf = sendVia(keyOf('Send Cancel Ask'), markAsked({ client_id: 'C-1' }));
  cf = sendVia('LATE_CANCEL_PENDING', cf);
  const g = gate('yes', true, rowsFor(cf), cf.cancel_ask_appt_id);
  T('sequence: the question repeated is still the question -> YES cancels', () => g.route === 'cancel' && g.cancel_appt_id === 'A-A' || g);
}

// ---- WF-1 Route and the YES-to-cancel path ----
const routeKeys = ((P('Route').rules || {}).values || []).map((r) => r.outputKey);
T('Route outputs: confirm, llm, reminder, agent, cancel (tests/dialog.sh log_execs maps them by index)', () => same(routeKeys, ['confirm', 'llm', 'reminder', 'agent', 'cancel']) || routeKeys);
T('Route cancel -> Cancel Visit; agent -> Agent', () => target('Route', 4) === 'Cancel Visit' && target('Route', 3) === 'Agent' || [target('Route', 3), target('Route', 4)]);
const lt = (yt) => tpl(P('LLM Affirmative').text, {}, { Gate: { yes_target: yt }, 'Client Data': { text: 'sure thing' } });
T('LLM Affirmative for a booking is the old prompt, unchanged', () => lt('confirm') === 'The assistant asked the user to reply YES to confirm a booking. Does the following user message mean agreement or confirmation? Reply with exactly YES or NO.\n\nMessage: sure thing' || lt('confirm'));
T('LLM Affirmative for the cancel question (M1): "cancel" / "yes cancel" mean YES, "no" / "don\'t" mean NO', () =>
  /cancel/i.test(lt('cancel')) && !/booking/.test(lt('cancel')) && /"cancel"/.test(lt('cancel')) && /"yes,? cancel/i.test(lt('cancel')) && /"no"/.test(lt('cancel')) && /"don'?t/i.test(lt('cancel')) &&
  /exactly YES or NO/.test(lt('cancel')) && /Message: sure thing$/.test(lt('cancel')) || lt('cancel'));
T('Affirmative? true -> Cancel Target?; false -> Agent', () => target('Affirmative?', 0) === 'Cancel Target?' && target('Affirmative?', 1) === 'Agent' || [target('Affirmative?', 0), target('Affirmative?', 1)]);
T('Cancel Target? true -> Cancel Visit, false -> Confirm', () => ev(leftOf('Cancel Target?'), {}, { Gate: { yes_target: 'cancel' } }) === true &&
  ev(leftOf('Cancel Target?'), {}, { Gate: { yes_target: 'confirm' } }) === false && target('Cancel Target?', 0) === 'Cancel Visit' && target('Cancel Target?', 1) === 'Confirm' || 'wrong');
const cv = node('Cancel Visit');
T('Cancel Visit calls cancel_booking with the client\'s contact_id and the visit Gate chose, reason empty (never reschedule)', () =>
  cv.type === 'n8n-nodes-base.executeWorkflow' && (P('Cancel Visit').workflowId || {}).value === 'WFID:cancel_booking' &&
  ev(inputsOf('Cancel Visit').contact_id, {}, { 'Client Data': { contact_id: 'tg:1' } }) === 'tg:1' &&
  ev(inputsOf('Cancel Visit').appt_id, {}, { Gate: { cancel_appt_id: 'A-C' } }) === 'A-C' && inputsOf('Cancel Visit').reason === '' &&
  cv.onError === 'continueErrorOutput' && target('Cancel Visit', 0) === 'Cancelled?' && target('Cancel Visit', 1) === 'Notify Failure' || [cv.type, inputsOf('Cancel Visit')]);
T('Cancelled? true for CANCELLED / LATE_CANCEL only; true -> Send Cancel Result, false -> Agent', () =>
  ev(leftOf('Cancelled?'), { verdict: 'CANCELLED' }) === true && ev(leftOf('Cancelled?'), { verdict: 'LATE_CANCEL' }) === true &&
  ev(leftOf('Cancelled?'), { verdict: 'NOT_FOUND' }) === false && ev(leftOf('Cancelled?'), { verdict: 'NOT_YOURS' }) === false && ev(leftOf('Cancelled?'), {}) === false &&
  target('Cancelled?', 0) === 'Send Cancel Result' && target('Cancelled?', 1) === 'Agent' || 'wrong');
const scr = inputsOf('Send Cancel Result');
T('Send Cancel Result: template = cancel_booking verdict (CANCELLED / LATE_CANCEL), the cancelled appt_id, errors -> Notify Send Failure', () =>
  (P('Send Cancel Result').workflowId || {}).value === 'WFID:send_message' &&
  ev(scr.template_key, {}, { 'Cancel Visit': { verdict: 'LATE_CANCEL', appt_id: 'A-C' } }) === 'LATE_CANCEL' &&
  ev(scr.appt_id, {}, { 'Cancel Visit': { verdict: 'LATE_CANCEL', appt_id: 'A-C' } }) === 'A-C' && scr.text === '' &&
  ev(scr.contact_id, {}, { Normalize: { contact_id: 'tg:1' } }) === 'tg:1' &&
  target('Send Cancel Result', 1) === 'Notify Send Failure' && outs('Send Cancel Result', 0).length === 0 || scr);

// ---- WF-1 after the agent: the cancel question replaces the agent's text ----
T('Summary? false -> Cancel Ask?', () => target('Summary?', 1) === 'Cancel Ask?' || target('Summary?', 1));
const agentOut = (id, v) => ({ Agent: { cancel_appt_id: id, cancel_verdict: v, reply: 'x', template_key: '' } });
T('Cancel Ask? only for a recorded request (CANCEL_PENDING / LATE_CANCEL_PENDING with an appt_id)', () =>
  ev(leftOf('Cancel Ask?'), {}, agentOut('A-C', 'CANCEL_PENDING')) === true && ev(leftOf('Cancel Ask?'), {}, agentOut('A-C', 'LATE_CANCEL_PENDING')) === true &&
  ev(leftOf('Cancel Ask?'), {}, agentOut('', '')) === false && ev(leftOf('Cancel Ask?'), {}, agentOut('A-C', 'NOT_FOUND')) === false &&
  ev(leftOf('Cancel Ask?'), {}, { Agent: { reply: 'x' } }) === false || 'wrong');
T('Cancel Ask? true -> Cancel Row, false -> Template?', () => target('Cancel Ask?', 0) === 'Cancel Row' && target('Cancel Ask?', 1) === 'Template?' || [target('Cancel Ask?', 0), target('Cancel Ask?', 1)]);
const crf = (id, cid) => ev(P('Cancel Row').filterByFormula, {}, { Agent: { cancel_appt_id: id }, 'Client Data': { client_id: cid } });
T('Cancel Row: that visit of THIS client, live; hostile ids match nothing', () =>
  crf('A-C', 'C-1') === "AND({appt_id}='A-C',{client_id}='C-1',OR({status}='booked',{status}='reminded',{status}='confirmed'))" &&
  crf("A-C'", 'C-1').startsWith("AND({appt_id}='__no_such_appt__',") && crf('A-C', "C-1'").includes("{client_id}='__no_such_client__'") &&
  node('Cancel Row').alwaysOutputData === true && target('Cancel Row', 0) === 'Ask Row?' && target('Cancel Row', 1) === 'Notify Failure' || crf('A-C', 'C-1'));
const ar = (fields) => ev(leftOf('Ask Row?'), { id: 'rec1', fields }, agentOut('A-C', 'CANCEL_PENDING'));
T('Ask Row? true only for the requested visit with an unexpired request', () =>
  ar({ appt_id: 'A-C', cancel_expires_at: iso(10 * MIN) }) === true && ar({ appt_id: 'A-C', cancel_expires_at: iso(-1 * MIN) }) === false &&
  ar({ appt_id: 'A-C' }) === false && ar({ appt_id: 'A-X', cancel_expires_at: iso(10 * MIN) }) === false && ev(leftOf('Ask Row?'), {}, agentOut('A-C', 'CANCEL_PENDING')) === false || 'wrong');
// M3: the marker is written BEFORE the question goes out, so the client never sees a question WF-1 does not know about
T('M3: Ask Row? true -> Mark Cancel Asked -> Send Cancel Ask (marker first); false -> Template?', () =>
  target('Ask Row?', 0) === 'Mark Cancel Asked' && target('Ask Row?', 1) === 'Template?' && target('Mark Cancel Asked', 0) === 'Send Cancel Ask' || [target('Ask Row?', 0), target('Mark Cancel Asked', 0)]);
T('M3: Mark Cancel Asked failing -> Notify Failure -> ERROR, the question is never sent', () =>
  node('Mark Cancel Asked').onError === 'continueErrorOutput' && target('Mark Cancel Asked', 1) === 'Notify Failure' && !outs('Mark Cancel Asked', 1).includes('Send Cancel Ask') || 'wrong');
T('Mark Cancel Replied is gone (one Clients update does both)', () => !WF.nodes.some((x) => x.name === 'Mark Cancel Replied') || 'still there');
const mca = (P('Mark Cancel Asked').columns || {}).value || {};
T('Mark Cancel Asked: Clients row, cancel_ask_appt_id = the requested visit, last_agent_reply_at = now', () =>
  (P('Mark Cancel Asked').table || {}).value === 'ATTBL:Clients' && P('Mark Cancel Asked').operation === 'update' &&
  ev(mca.id, {}, { 'Client Data': { client_rec: 'recC' } }) === 'recC' &&
  ev(mca.cancel_ask_appt_id, {}, { 'Cancel Row': { id: 'rec1', fields: { appt_id: 'A-C' } } }) === 'A-C' &&
  /^\d{4}-\d\d-\d\dT/.test(ev(mca.last_agent_reply_at, {})) && same(Object.keys(mca).sort(), ['cancel_ask_appt_id', 'id', 'last_agent_reply_at']) || mca);
const sca = inputsOf('Send Cancel Ask');
T('Send Cancel Ask: template = request_cancel verdict, appt_id from the row; success ends, errors -> Notify Send Failure', () =>
  ev(sca.template_key, {}, agentOut('A-C', 'LATE_CANCEL_PENDING')) === 'LATE_CANCEL_PENDING' &&
  ev(sca.appt_id, {}, { 'Cancel Row': { id: 'rec1', fields: { appt_id: 'A-C' } } }) === 'A-C' && sca.text === '' &&
  outs('Send Cancel Ask', 0).length === 0 && target('Send Cancel Ask', 1) === 'Notify Send Failure' || sca);
// End to end: what Mark Cancel Asked writes, after Send Cancel Ask went through send_message, makes the next bare YES a cancel.
{
  const cf = sendVia(keyOf('Send Cancel Ask'), markAsked({ client_id: 'C-1' }));
  const g = gate('yes', true, rowsFor(cf), cf.cancel_ask_appt_id);
  T('the marker the ask path writes makes the next bare YES cancel that visit', () => g.route === 'cancel' && g.cancel_appt_id === 'A-A' || g);
}
T('Notify Failure is reached from Cancel Visit, Cancel Row and Mark Cancel Asked errors (the client gets ERROR)', () =>
  outs('Cancel Visit', 1).includes('Notify Failure') && outs('Cancel Row', 1).includes('Notify Failure') && outs('Mark Cancel Asked', 1).includes('Notify Failure') || 'wrong');

console.log('\nWF1_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
