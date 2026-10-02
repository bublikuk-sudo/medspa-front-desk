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
  const $input = { first: () => ({ json: input }), all: () => [{ json: input }] };
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
check('wa text message', same(r, [{ json: { channel: 'wa', contact_id: 'wa:+491701234567', text: 'Hola, quiero una cita', raw_name: 'Marta Perez' } }]), r);
r = normalize(waValue({ contacts: undefined }));
check('wa text without contacts -> raw_name empty', r.length === 1 && r[0].json.raw_name === '' && r[0].json.text.startsWith('Hola'), r);
r = normalize(waValue({ messages: undefined, statuses: [{ id: 'wamid.X', status: 'delivered', recipient_id: '491701234567' }] }));
check('wa status callback (delivered) -> []', same(r, []), r);
r = normalize(waValue({ messages: undefined, statuses: [{ status: 'read' }] }));
check('wa status callback (read) -> []', same(r, []), r);
r = normalize(waValue({ messages: [{ from: '491701234567', id: 'wamid.Y', type: 'image', image: { id: 'MEDIA', mime_type: 'image/jpeg', caption: 'look' } }] }));
check('wa image -> text empty (same path as the tg sticker), contact kept', r.length === 1 && r[0].json.text === '' && r[0].json.contact_id === 'wa:+491701234567' && r[0].json.channel === 'wa', r);
for (const t of ['sticker', 'audio', 'video', 'document', 'location', 'contacts', 'reaction', 'interactive', 'button', 'unsupported']) {
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
  check('wa from ' + JSON.stringify(bad) + ' fails the contact pattern -> []', same(r, []), r);
}
// Meta sends wa_id without a plus, digits only, up to 15 digits
r = normalize(waValue({ messages: [{ from: '380501234567', type: 'text', text: { body: 'hi' } }] }));
check('wa Ukrainian number', r.length === 1 && r[0].json.contact_id === 'wa:+380501234567', r);

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

console.log('\nWF1_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
