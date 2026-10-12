// Stub test for the WF-1 Code nodes that decide who a message is from (Normalize, Client Formula), the Create Client
// expressions that turn contact_id into telegram_chat_id / phone, and the cancel confirmation (two-step cancel): WF-2's
// Guardrail/Result hand WF-1 the visit request_cancel recorded, WF-1 asks the client, and Gate routes the client's YES.
// Runs in a Node (see tests/wf1-code-stubs.sh), which prepends:
//   const WF = <workflows/wf1-inbound.json>;  const WF2 = <workflows/wf2-agent.json>;  const SM = <workflows/shared/send_message.json>;
//   const ESC = <workflows/wf3-tools/escalate.json>;
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

// ---- owner failure alerts built from an error item: Notify Failure and Notify Send Failure carry the provider's own error text ----
// Evidence (wf1-inbound execution 27314, wf2-agent 27315, 2026-10-09): an Execute Workflow node (Agent, Confirm, send_message, ...) hands its
// error output a plain STRING in `error` (the sub-workflow's message only), so the description cannot reach these two nodes on that path - WF-6
// carries it. A node that hands an object (`{message, description}`, as a Postgres/Airtable/HTTP node error does) gets message + cause.
{
  const GENERIC = 'Bad request - please check your parameters';
  const CREDIT = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';
  const anth = '{"type":"error","error":{"type":"invalid_request_error","message":"' + CREDIT + '"},"request_id":"req_1"}';
  const stored = (over = {}) => ({ message: GENERIC, description: CREDIT, name: 'NodeOperationError', stack: 'NodeOperationError: x\n    at /usr/local/lib/node_modules/n8n/x.js:1:1', messages: ['400 ' + anth], node: { name: 'Agent' }, ...over });
  const alertOf = (nodeName, json, prev = 'Agent') => {
    const body = P(nodeName).workflowInputs.value.text.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
    return new Function('$json', '$', '$prevNode', 'return (' + body + ');')(json, () => ({ first: () => ({ json: { contact_id: 'tg:4242', text: 'I want a facial' } }) }), { name: prev });
  };
  for (const [nodeName, head, tail] of [
    ['Notify Failure', '❌ Reply failed for tg:4242: ', ' (step: Agent; the client got the ERROR message)'],
    ['Notify Send Failure', '❌ Could not send a message to tg:4242 (step: Agent): ', '. Their message: I want a facial'],
  ]) {
    const al = (error, prev) => alertOf(nodeName, error === undefined ? {} : { error }, prev);
    const body = (s) => (s.startsWith(head) && s.endsWith(tail) ? s.slice(head.length, s.length - tail.length) : 'WRONG-FRAME:' + s);
    T(nodeName + ': string error (an Execute Workflow node) -> the text as before, nothing else', () => al(GENERIC, 'Confirm') === (head + GENERIC + tail).replace('step: Agent', 'step: Confirm') || al(GENERIC, 'Confirm'));
    T(nodeName + ': the step is named from the previous node', () => al(GENERIC, 'Confirm').includes('(step: Confirm') || al(GENERIC, 'Confirm'));
    T(nodeName + ': error missing -> "see WF-6"', () => body(al(undefined)) === 'see WF-6' || al(undefined));
    T(nodeName + ': error item with message only (object) -> the message, as before', () => body(al({ message: 'Record not found' })) === 'Record not found' || al({ message: 'Record not found' }));
    T(nodeName + ': object error with the credit shape as stored -> generic message AND the real cause', () => body(al(stored())) === GENERIC + ' — ' + CREDIT || al(stored()));
    T(nodeName + ': object error -> no stack, no raw body, no request id, no JSON', () => !/node_modules|request_id|invalid_request|[{}]/.test(al(stored())) || al(stored()));
    T(nodeName + ': description equal to the message -> shown once', () => body(al(stored({ message: 'Boom', description: 'Boom' }))) === 'Boom' || al(stored({ message: 'Boom', description: 'Boom' })));
    for (const [label, d] of [['missing', undefined], ['null', null], ['empty', ''], ['a number', 7], ['an object', { a: 1 }], ['the text "null"', 'null']]) {
      T(nodeName + ': description ' + label + ' -> the message alone', () => { const e = stored(); if (d === undefined) delete e.description; else e.description = d; return body(al(e)) === GENERIC || al(e); });
    }
    T(nodeName + ': JSON-string description -> its error.message, not the JSON', () => body(al(stored({ description: anth }))) === GENERIC + ' — ' + CREDIT || al(stored({ description: anth })));
    T(nodeName + ': "400 {json}" description -> its error.message', () => body(al(stored({ description: '400 ' + anth }))) === GENERIC + ' — ' + CREDIT || al(stored({ description: '400 ' + anth })));
    T(nodeName + ': JSON description without a human message, or unparsable -> the message alone', () =>
      body(al(stored({ description: '{"a":{"b":1},"body":"RAW"}' }))) === GENERIC && body(al(stored({ description: '{"error":{"message":"cut' }))) === GENERIC || [al(stored({ description: '{"a":1}' })), al(stored({ description: '{"error":{"message":"cut' }))]);
    T(nodeName + ': over-long description -> the cause is cut to 300 characters, one line', () => { const b = body(al(stored({ description: 'word\n'.repeat(400) }))); const c = b.slice((GENERIC + ' — ').length); return b.startsWith(GENERIC + ' — word word') && c.length === 300 && !/\n/.test(b) || b.length; });
    T(nodeName + ': over-long message -> cut to 300 characters', () => body(al('e'.repeat(1000), 'Confirm').replace('step: Confirm', 'step: Agent')).length === 300 || al('e'.repeat(1000), 'Confirm').length);
    T(nodeName + ': secrets in a description are redacted', () => { const b = al(stored({ description: 'key sk-ant-api03-AbCdEf123456789 and Authorization: Bearer abc.def.ghi and x-api-key: topsecret99' })); return !/sk-ant|abc\.def|topsecret/.test(b) && b.includes('[redacted]') || b; });
    T(nodeName + ': a getter that throws on the error -> does not throw out of the expression', () => { const e = { message: GENERIC }; Object.defineProperty(e, 'description', { get() { throw new Error('boom'); } }); return body(al(e)) === GENERIC || al(e); });
  }
  // Ruling 2026-10-10 (option b): the Agent step's error is a plain string (Execute Workflow), so its description cannot reach WF-1; Notify Failure points the owner
  // at the WF-6 alert for wf2-agent, for that step and that shape only.
  const PTR = ' (cause: see the ⚠️ wf2-agent alert)';
  const NF = (error, prev) => alertOf('Notify Failure', error === undefined ? {} : { error }, prev);
  const NFH = '❌ Reply failed for tg:4242: ', NFT = ' (step: Agent; the client got the ERROR message)';
  T('Notify Failure: Agent step + string error -> the message, the pointer to the wf2-agent alert, then the step', () => NF(GENERIC, 'Agent') === NFH + GENERIC + PTR + NFT || NF(GENERIC, 'Agent'));
  T('Notify Failure: Agent step + object error with a description -> message — cause, no pointer', () => NF(stored(), 'Agent') === NFH + GENERIC + ' — ' + CREDIT + NFT || NF(stored(), 'Agent'));
  T('Notify Failure: Agent step + object error without a description -> the message, no pointer', () => NF({ message: GENERIC }, 'Agent') === NFH + GENERIC + NFT || NF({ message: GENERIC }, 'Agent'));
  T('Notify Failure: Agent step + no error at all -> "see WF-6", no pointer', () => NF(undefined, 'Agent') === NFH + 'see WF-6' + NFT || NF(undefined, 'Agent'));
  for (const step of ['Confirm', 'Cancel Visit', 'Reminder Reply', 'Client', 'Gate', 'Rate Limit']) {
    T('Notify Failure: ' + step + ' step + string error -> no pointer', () => NF(GENERIC, step) === NFH + GENERIC + NFT.replace('Agent', step) || NF(GENERIC, step));
  }
  T('Notify Send Failure: string error from the Agent-named step -> no pointer (only Notify Failure has it)', () => !alertOf('Notify Send Failure', { error: GENERIC }, 'Agent').includes('cause:') || 'pointer present');
}

// ==== Escalation reset (owner decision 2026-10-11: "да, делай сброс памяти при снятии эскалации") ==========================
// escalate stamps Clients.escalated_at in the same write that sets status = escalated. When the owner later changes the
// status away from escalated, the next message of that client deletes exactly that session's rows from the agent's chat
// memory, then clears the marker, then takes the normal path. A failed delete never drops the message: the owner is alerted
// and the marker stays, so the next message retries.
{
  const ESC_NODES = ['Escalation Resolved?', 'Reset Memory', 'Clear Marker', 'Marker Cleared?', 'Notify Reset Failure'];
  const ESC_FLAG = nodeIn(ESC, 'Flag Escalated');
  const flagCols = (((ESC_FLAG.parameters || {}).columns) || {});
  const flagVal = flagCols.value || {};
  T('escalate: Flag Escalated writes status = escalated AND escalated_at = now, in the same update', () =>
    flagVal.status === 'escalated' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(String(ev(flagVal.escalated_at || '""', {}))) &&
    same(Object.keys(flagVal).sort(), ['escalated_at', 'id', 'status']) || flagVal);
  T('escalate: escalated_at is in the Flag Escalated schema as a dateTime column', () =>
    ((flagCols.schema || []).find((s) => s.id === 'escalated_at') || {}).type === 'dateTime' || flagCols.schema);
  T('escalate: Flag Escalated is the only Airtable write in escalate (no other path sets the status)', () =>
    ESC.nodes.filter((x) => x.type === 'n8n-nodes-base.airtable' && (x.parameters || {}).operation !== 'search').map((x) => x.name).join() === 'Flag Escalated' || 'other writes');

  const NJ = { contact_id: 'tg:9000000101', channel: 'tg', text: 'Хочу записаться' };
  const cdOf = (fields, nj = NJ) => new Function('$input', '$', P('Client Data').jsCode)({}, dollar({ Normalize: nj, Client: { id: 'recC', createdTime: '', fields } }))[0].json;
  const MARK = '2026-10-11T08:00:00.000Z';
  T('Client Data passes escalated_at on ("" when absent)', () => cdOf({ client_id: 'C-test-1', status: 'active', escalated_at: MARK }).escalated_at === MARK &&
    cdOf({ client_id: 'C-test-1', status: 'active' }).escalated_at === '' || cdOf({ client_id: 'C-test-1', status: 'active', escalated_at: MARK }));

  // Walk the graph from Client Data the way n8n would: an IF node takes output 0 when its condition is true; any other node
  // takes output 0, or its error output 1 when the scenario makes it fail. Stops at Classify (the normal path) or Send Hold.
  const evPrev = (e, json, nodes, prev) => new Function('$json', '$', '$prevNode', 'return (' + strip(e) + ');')(json, dollar(nodes), { name: prev });
  // fail[node]: a string -> error item { error: { message } } (a Postgres / Airtable node error); an object -> that error item
  // as is (e.g. { error: 'text' }, the plain-string shape). ok[node]: the success output (default: Clear Marker answers with
  // the updated record, which Airtable returns WITHOUT empty fields).
  const CLEARED = { id: 'recC', createdTime: '', fields: { client_id: 'C-test-1', status: 'active' } };
  const walk = (fields, fail = {}, ok = {}) => {
    const cd = cdOf(fields);
    const nodes = { Normalize: NJ, 'Client Data': cd };
    const seen = [];
    const alerts = [];
    let cur = target('Client Data', 0), prev = 'Client Data', json = cd;
    for (let i = 0; i < 12 && cur !== 'none'; i++) {
      seen.push(cur);
      if (cur === 'Classify' || cur === 'Send Hold') break;
      const nd = node(cur);
      if (cur === 'Notify Reset Failure') alerts.push(evPrev(inputsOf(cur).text, json, nodes, prev));
      let out = 0;
      if (nd.type === 'n8n-nodes-base.if') out = ev(leftOf(cur), json, nodes) === true ? 0 : 1;
      else if (fail[cur]) { out = 1; json = typeof fail[cur] === 'object' ? fail[cur] : { error: { message: fail[cur] } }; }
      else json = ok[cur] || (cur === 'Clear Marker' ? CLEARED : { ok: true });
      prev = cur;
      cur = target(cur, out);
    }
    return { seen, alerts };
  };
  const base = { client_id: 'C-test-1', name: 'Dana Test', language: 'ru' };
  const RESET = ['Escalated?', 'Escalation Resolved?', 'Reset Memory', 'Clear Marker', 'Marker Cleared?', 'Classify'];
  for (const st of ['active', 'flagged', 'new']) {
    const w = walk({ ...base, status: st, escalated_at: MARK });
    T('resolved escalation (status ' + st + ', marker set) -> delete history, then clear the marker, then the normal path, no alert', () =>
      same(w.seen, RESET) && w.alerts.length === 0 || w);
  }
  {
    const w = walk({ ...base, status: 'escalated', escalated_at: MARK });
    T('still escalated (marker set) -> the hold reply as today, no delete, no clear', () => same(w.seen, ['Escalated?', 'Send Hold']) || w);
    const w2 = walk({ ...base, status: 'escalated' });
    T('escalated without a marker (set by hand) -> the hold reply as today', () => same(w2.seen, ['Escalated?', 'Send Hold']) || w2);
  }
  for (const [label, f] of [['active, no marker', { status: 'active' }], ['new client row', { status: 'new' }], ['empty marker', { status: 'active', escalated_at: '' }], ['null marker', { status: 'active', escalated_at: null }]]) {
    const w = walk({ ...base, ...f });
    T('no marker (' + label + ') -> untouched: straight to the normal path, no delete, no clear', () =>
      w.seen[w.seen.length - 1] === 'Classify' && !w.seen.includes('Reset Memory') && !w.seen.includes('Clear Marker') && w.alerts.length === 0 || w);
  }
  {
    const w = walk({ ...base, status: 'active', escalated_at: MARK }, { 'Reset Memory': 'connection refused' });
    T('delete fails -> owner alert, the message is still handled (normal path), the marker is NOT cleared', () =>
      same(w.seen, ['Escalated?', 'Escalation Resolved?', 'Reset Memory', 'Notify Reset Failure', 'Classify']) && w.alerts.length === 1 || w);
    const a = w.alerts[0] || '';
    T('delete-failure alert names the client (contact_id and client_id), the step and the error, and says the next message retries', () =>
      a.includes('tg:9000000101') && a.includes('C-test-1') && a.includes('step: Reset Memory') && a.includes('connection refused') && /next message/i.test(a) && !a.includes('Dana') || a);
    const w2 = walk({ ...base, status: 'active', escalated_at: MARK }, { 'Reset Memory': 'boom', 'Notify Reset Failure': 'telegram down' });
    T('delete fails AND the alert fails -> the message is still handled', () => w2.seen[w2.seen.length - 1] === 'Classify' && !w2.seen.includes('Clear Marker') || w2);
    const w3 = walk({ ...base, status: 'active', escalated_at: MARK }, { 'Clear Marker': 'INVALID_VALUE_FOR_COLUMN' });
    T('clear fails after the delete -> owner alert naming the step, the message is still handled', () =>
      same(w3.seen, ['Escalated?', 'Escalation Resolved?', 'Reset Memory', 'Clear Marker', 'Notify Reset Failure', 'Classify']) &&
      (w3.alerts[0] || '').includes('step: Clear Marker') && (w3.alerts[0] || '').includes('C-test-1') && (w3.alerts[0] || '').includes('escalated_at') || w3);
    // fix round 1, Minor 3: an error item whose `error` is a plain string (the Execute Workflow shape)
    const w4 = walk({ ...base, status: 'active', escalated_at: MARK }, { 'Reset Memory': { error: 'pool exhausted (string)' } });
    T('delete fails with a plain-string error -> the alert carries that text, marker kept, message handled', () =>
      same(w4.seen, ['Escalated?', 'Escalation Resolved?', 'Reset Memory', 'Notify Reset Failure', 'Classify']) &&
      (w4.alerts[0] || '').includes('pool exhausted (string)') && (w4.alerts[0] || '').includes('step: Reset Memory') || w4);
    // fix round 1, Important 1: the update "succeeds" but the marker is still there (a silent no-op) -> alert, not silence
    const w5 = walk({ ...base, status: 'active', escalated_at: MARK }, {}, { 'Clear Marker': { id: 'recC', createdTime: '', fields: { client_id: 'C-test-1', status: 'active', escalated_at: MARK } } });
    const a5 = w5.alerts[0] || '';
    T('Clear Marker answers with escalated_at still set -> Marker Cleared? false -> alert naming Clear Marker and escalated_at -> message handled', () =>
      same(w5.seen, ['Escalated?', 'Escalation Resolved?', 'Reset Memory', 'Clear Marker', 'Marker Cleared?', 'Notify Reset Failure', 'Classify']) &&
      a5.includes('step: Clear Marker') && a5.includes('escalated_at') && a5.includes('C-test-1') && a5.includes('still set') && !/no error text/.test(a5) || w5);
    const w6 = walk({ ...base, status: 'active', escalated_at: MARK }, {}, { 'Clear Marker': {} });
    T('Clear Marker answers with no record at all -> treated as not cleared (alert)', () => w6.seen.includes('Notify Reset Failure') && w6.seen[w6.seen.length - 1] === 'Classify' || w6);
    const w7 = walk({ ...base, status: 'active', escalated_at: MARK }, {}, { 'Clear Marker': { id: 'recC', createdTime: '', fields: { client_id: 'C-test-1', escalated_at: null } } });
    T('Clear Marker answers with escalated_at null -> cleared, no alert', () => same(w7.seen, RESET) && w7.alerts.length === 0 || w7);
  }
  T('Clear Marker sends typecast (options.typecast = true): without it n8n 2.41.5 validation turns null into undefined and the field is dropped', () =>
    (P('Clear Marker').options || {}).typecast === true || P('Clear Marker').options);
  T('Marker Cleared?: true -> Classify, false -> Notify Reset Failure; Clear Marker success -> Marker Cleared?', () =>
    same(outs('Clear Marker', 0), ['Marker Cleared?']) && target('Marker Cleared?', 0) === 'Classify' && target('Marker Cleared?', 1) === 'Notify Reset Failure' || [outs('Clear Marker', 0), outs('Marker Cleared?', 0), outs('Marker Cleared?', 1)]);
  T('Notify Reset Failure: both outputs continue to Classify; it calls notify_owner and never stops the run', () =>
    target('Notify Reset Failure', 0) === 'Classify' && target('Notify Reset Failure', 1) === 'Classify' &&
    (P('Notify Reset Failure').workflowId || {}).value === 'WFID:notify_owner' && node('Notify Reset Failure').onError === 'continueErrorOutput' || 'wrong');

  // The delete: parameterised, exactly the session the agent's memory uses, never a pattern
  const rm = node('Reset Memory');
  const q = String(P('Reset Memory').query || '');
  T('Reset Memory: Postgres, one parameterised DELETE on n8n_chat_histories by session_id = $1, one count row out', () =>
    rm.type === 'n8n-nodes-base.postgres' && P('Reset Memory').operation === 'executeQuery' &&
    q === "WITH d AS (DELETE FROM n8n_chat_histories WHERE session_id = $1 AND $1 <> '' RETURNING 1) SELECT count(*)::int AS deleted FROM d" || q);
  T('Reset Memory: no LIKE / regex / interpolation in the SQL', () => !/like|~|similar|\{\{|\+/i.test(q) || q);
  T('Reset Memory: error output (not a stop), retried once', () => rm.onError === 'continueErrorOutput' && rm.retryOnFail === true && rm.maxTries === 2 && rm.alwaysOutputData !== true || rm);
  const qr = (cid) => ev(((P('Reset Memory').options || {}).queryReplacement), {}, { Normalize: { contact_id: cid } });
  T('Reset Memory parameter: the contact_id itself for tg / wa ids', () => same(qr('tg:9000000101'), ['tg:9000000101']) && same(qr('wa:+15550000101'), ['wa:+15550000101']) || [qr('tg:9000000101'), qr('wa:+15550000101')]);
  T('Reset Memory parameter: a malformed or pattern-like id becomes \'\' (deletes nothing)', () =>
    ['', 'tg:%', "tg:1' OR '1'='1", 'tg:9000000101%', 'wa:+1555_', 'xyz', undefined].every((c) => same(qr(c), [''])) || qr('tg:%'));
  const mem = (WF2.nodes.find((x) => x.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat') || {}).parameters || {};
  T('the deleted session is the agent\'s: WF-2 memory table n8n_chat_histories, key = the contact_id WF-1 hands the agent', () =>
    mem.tableName === 'n8n_chat_histories' && mem.sessionIdType === 'customKey' && mem.sessionKey === "={{ $('Trigger').first().json.contact_id }}" &&
    ev(inputsOf('Agent').contact_id, {}, { 'Client Data': cdOf({ ...base, status: 'active' }) }) === NJ.contact_id || mem);

  // Clear the marker: one Clients update, only escalated_at, after the delete
  const cm = node('Clear Marker');
  const cmCols = P('Clear Marker').columns || {};
  T('Clear Marker: Clients update of THIS row, escalated_at = null, nothing else written', () =>
    cm.type === 'n8n-nodes-base.airtable' && P('Clear Marker').operation === 'update' && (P('Clear Marker').table || {}).value === 'ATTBL:Clients' &&
    same(Object.keys(cmCols.value || {}).sort(), ['escalated_at', 'id']) && ev(cmCols.value.id, {}, { 'Client Data': { client_rec: 'recC' } }) === 'recC' &&
    ev(cmCols.value.escalated_at, {}) === null && same(cmCols.matchingColumns, ['id']) &&
    ((cmCols.schema || []).find((s) => s.id === 'escalated_at') || {}).type === 'dateTime' || cmCols);
  T('Clear Marker: error output to the alert (never stops the run), retried once', () => cm.onError === 'continueErrorOutput' && cm.retryOnFail === true && target('Clear Marker', 1) === 'Notify Reset Failure' || cm);
  T('order: only Reset Memory\'s success output leads to Clear Marker; its error output never does', () =>
    same(outs('Reset Memory', 0), ['Clear Marker']) && same(outs('Reset Memory', 1), ['Notify Reset Failure']) && !outs('Notify Reset Failure', 0).includes('Clear Marker') || [outs('Reset Memory', 0), outs('Reset Memory', 1)]);
  T('only WF-1 writes on the reset path are Clear Marker (Airtable) and Reset Memory (Postgres)', () =>
    ESC_NODES.filter((n) => ['n8n-nodes-base.airtable', 'n8n-nodes-base.postgres'].includes(node(n).type)).sort().join() === 'Clear Marker,Reset Memory' || 'wrong');

  // Classify now reads Client Data by name: on the reset path its input item is the Postgres / Airtable / notify output
  const classify = (inputJson) => runCode(P('Classify').jsCode, inputJson, { 'Client Data': { ...cdOf({ ...base, status: 'active', cancel_ask_appt_id: 'A-C' }), text: 'да' } })[0].json;
  for (const [label, inp] of [['the Client Data item (ordinary path)', null], ['the Reset Memory count row', { deleted: 4 }], ['the Clear Marker record', { id: 'recC', fields: { client_id: 'C-test-1' } }], ['a notify_owner result', { ok: true }]]) {
    const c = classify(inp || { ...cdOf({ ...base, status: 'active', cancel_ask_appt_id: 'A-C' }), text: 'да' });
    T('Classify after ' + label + ' -> the Client Data fields, kind computed from the client text', () =>
      c.client_id === 'C-test-1' && c.cancel_ask_appt_id === 'A-C' && c.kind === 'yes' && c.contact_id === NJ.contact_id && !('deleted' in c) && !('fields' in c) || c);
    T('Pending formula after ' + label + ' is the client\'s', () => pf(c) === "AND({client_id}='C-test-1',OR({status}='pending',{appt_id}='A-C'))" || pf(c));
  }
}

// ==== AI disclosure (mini-task D, owner 2026-10-12) ======================================================================
// The prompt asks the agent to say it is the clinic's AI assistant in its first reply to a NEW client; live es dialog 11 run 1
// (tests/dialog-runs/2026-10-12-client-language-tg.md, finding 1) did not. The system-side signal is "Create Client ran in
// this run": the Clients row is created once per contact, so the flag is set in one run per contact, never for a contact that
// already had a row. WF-1 passes it to send_message (input ai_disclosure) on the sends that answer the client's message in
// that run; send_message's Render checks the reply for the word for AI and adds the fixed sentence only when it is missing.
{
  const FLAGGED = ['Send Error', 'Send Reply', 'Send Summary', 'Send Template'];
  const flagOf = (n, nodes) => { const e = inputsOf(n).ai_disclosure; return e === undefined ? 'unset' : ev(e, {}, nodes); };
  const created = { 'Create Client': { id: 'recNEW', fields: { client_id: 'C-NEW' } } };
  const into = (t) => WF.nodes.filter((x) => ((WF.connections[x.name] || {}).main || []).flat().some((c) => c && c.node === t)).map((x) => x.name);
  T('D: send_message declares the input ai_disclosure (string)', () =>
    (((nodeIn(SM, 'Trigger').parameters || {}).workflowInputs || {}).values || []).some((v) => v.name === 'ai_disclosure' && v.type === 'string') || 'missing');
  for (const n of FLAGGED) {
    T('D: ' + n + ' passes ai_disclosure = "true" in the run that created the Clients row', () => flagOf(n, created) === 'true' || flagOf(n, created));
    T('D: ' + n + ' passes ai_disclosure = "" when the row already existed (KNOWN client, any later message)', () => flagOf(n, {}) === '' || flagOf(n, {}));
    T('D: ' + n + ' lists ai_disclosure in its schema as a string', () =>
      ((P(n).workflowInputs || {}).schema || []).some((s) => s.id === 'ai_disclosure' && s.type === 'string') || 'missing');
  }
  const others = sendNodes.filter((n) => !FLAGGED.includes(n) && inputsOf(n).ai_disclosure !== undefined);
  T('D: no other send sets ai_disclosure (Send Error Again, results, reminders, hold, rate limit ...: null in send_message, no sentence)', () =>
    others.length === 0 || others);
  // Concern-1 ruling (controller, 2026-10-12): Telegram clients almost always start with /start, which creates the row with no
  // language (Lang Needed? skips a /command), so the reply to /start can only be English. The flag is ALSO true in the run that
  // detects the language of the client's first real message (Lang Needed? true -> Detect Language -> Language ran), so the
  // guarantee reaches the client in their own language. Firing twice (English on /start, then in their language) is accepted;
  // a failed detection (language stays '') re-fires on the next message, also accepted. No extra state.
  const langNeeded = (clientRow, text) => ev(leftOf('Lang Needed?'), {}, { Client: clientRow, Normalize: { text } });
  const NOROW = {};
  const rowLang = (language) => ({ id: 'recC', fields: { client_id: 'C-1', language } });
  for (const n of FLAGGED) {
    T('D concern-1: ' + n + ' passes "true" in the run that detected the language (Language ran, row already there)', () =>
      flagOf(n, { Language: { language: 'es' } }) === 'true' || flagOf(n, { Language: { language: 'es' } }));
    T('D concern-1: ' + n + ' passes "true" when detection failed (Language ran with "") - accepted re-fire', () =>
      flagOf(n, { Language: { language: '' } }) === 'true' || flagOf(n, { Language: { language: '' } }));
  }
  T('D concern-1 sequence, Telegram: /start from a new contact -> no detection, row created -> flag true (the English reply to /start)', () =>
    langNeeded(NOROW, '/start') === false && flagOf('Send Reply', { 'Create Client': created['Create Client'] }) === 'true' || [langNeeded(NOROW, '/start'), flagOf('Send Reply', { 'Create Client': created['Create Client'] })]);
  T('D concern-1 sequence, Telegram: next non-command message, row with empty language -> Lang Needed? true -> flag true (their language)', () =>
    langNeeded(rowLang(''), 'Hola, quiero reservar') === true && flagOf('Send Reply', { Language: { language: 'es' } }) === 'true' || [langNeeded(rowLang(''), 'Hola, quiero reservar'), flagOf('Send Reply', { Language: { language: 'es' } })]);
  T('D concern-1 sequence, Telegram: a later message, language set -> Lang Needed? false, no row created -> flag ""', () =>
    langNeeded(rowLang('es'), 'Me llamo Lucía') === false && flagOf('Send Reply', {}) === '' || [langNeeded(rowLang('es'), 'Me llamo Lucía'), flagOf('Send Reply', {})]);
  T('D concern-1 sequence, Telegram: a later /command with the language still empty -> Lang Needed? false -> flag ""', () =>
    langNeeded(rowLang(''), '/help') === false || 'wrong');
  T('D concern-1: WhatsApp first message (no row, text) -> detection AND row creation in one run -> flag true, once (unchanged)', () =>
    langNeeded(NOROW, 'Hola') === true && flagOf('Send Reply', { Language: { language: 'es' }, 'Create Client': created['Create Client'] }) === 'true' || [langNeeded(NOROW, 'Hola'), flagOf('Send Reply', { Language: { language: 'es' }, 'Create Client': created['Create Client'] })]);
  T('D concern-1: Language runs only after Detect Language, which runs only on Lang Needed?\'s true output', () =>
    same(into('Language'), ['Detect Language']) && same(outs('Lang Needed?', 0), ['Detect Language']) && same(into('Detect Language'), ['Lang Needed?']) ||
    [into('Language'), outs('Lang Needed?', 0), into('Detect Language')]);
  T('D: Create Client runs only on New Client?\'s true output, i.e. when the Clients search found no row', () =>
    same(outs('New Client?', 0), ['Create Client']) && !outs('New Client?', 1).includes('Create Client') &&
    leftOf('New Client?') === "={{ !$('Client').first().json.id }}" && same(into('Create Client'), ['New Client?']) || [outs('New Client?', 0), into('Create Client')]);
  // At most one flagged send reaches the client in a run: Send Error is reached only from Notify Failure (a step failed before
  // any reply went out), and a failed reply send goes to Notify Send Failure -> Send Error Again, which carries no flag.
  T('D: a failed flagged send is answered by Send Error Again (no flag), never by Send Error; only Notify Failure leads to Send Error', () =>
    ['Send Reply', 'Send Template', 'Send Summary'].every((n) => same(outs(n, 1), ['Notify Send Failure'])) && !outs('Notify Send Failure', 0).includes('Send Error') &&
    same(into('Send Error'), ['Notify Failure']) || [['Send Reply', 'Send Template', 'Send Summary'].map((n) => outs(n, 1)), into('Send Error')]);
}

console.log('\nWF1_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
