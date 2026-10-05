// Stub test for the WF-1 Code nodes that decide who a message is from (Normalize, Client Formula)
// and for the Create Client expressions that turn contact_id into telegram_chat_id / phone.
// Runs inside the n8n container's Node (see tests/wf1-code-stubs.sh), which prepends:
//   const CODE = { normalize, formula, phoneExpr, chatExpr };   // taken from workflows/wf1-inbound.json
// No network, no n8n runtime: $input / $ are stubbed.

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

console.log('\nWF1_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
