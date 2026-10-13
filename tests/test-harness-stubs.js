// Stub test for the test harness (workflows/test-harness.json), final review I3. The harness is active in production
// (the live test suites need it), behind the MedSpa Test Key. Unpack refuses:
//   - a workflow that is not in the Allow List node (the tool workflows the test scripts call; n8n-push.sh resolves each
//     "WFID:<name>" value to the live id, so only ids of those workflows match);
//   - a contact_id that names a contact outside the test ranges (tg:9000000NN tool cases, tg:9000000NNN and
//     wa:+1555000NNNN dialogs, the ranges tests/cleanup.sh treats as test contacts). A contact_id that is not a contact at
//     all ("", "xyz", "tg:1'--", 21 digits) passes: no tool resolves it to a person, and the tool cases send exactly those
//     to test the tools' own validation.
// Runs inside the n8n container's Node (see tests/test-harness-stubs.sh), which prepends WF, TSV (tests/tool-cases.tsv),
// CALLERS (tests/*.sh + tests/lib/*.sh) and PUSH_ALL (scripts/push-all.sh). No network, no n8n runtime: $ is stubbed.

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

// The Allow List as the repo has it (name -> "WFID:<name>") and as n8n-push.sh makes it (name -> id).
const allowRaw = {};
for (const a of (((P('Allow List').assignments || {}).assignments) || [])) allowRaw[a.name] = a.value;
const idOf = (name) => 'ID' + Buffer.from(name).toString('hex').slice(0, 14).toUpperCase();
const allowPushed = Object.fromEntries(Object.entries(allowRaw).map(([k, v]) => [k, String(v).startsWith('WFID:') ? idOf(String(v).slice(5)) : v]));

const unpack = (body, allow = allowPushed) => {
  const $ = (name) => {
    const v = { Webhook: { headers: {}, body }, 'Allow List': allow }[name];
    if (v === undefined) throw new Error('node "' + name + '" has not been executed');
    return { first: () => ({ json: v }), all: () => [{ json: v }] };
  };
  const $input = { first: () => ({ json: allow }), all: () => [{ json: allow }] };
  return new Function('$input', '$', P('Unpack').jsCode)($input, $);
};
const tryUnpack = (body, allow) => { try { return { ok: true, out: unpack(body, allow) }; } catch (e) { return { ok: false, err: String(e.message) }; } };

// ---- what the test scripts call through the harness ----
const tsvRows = TSV.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));
const caseTools = [...new Set(tsvRows.map((r) => r[1]).filter(Boolean))].sort();
const scriptTools = [...new Set([...CALLERS.matchAll(/run-case\.sh ([A-Za-z0-9_-]+)/g)].map((m) => m[1]))].sort();
const called = [...new Set([...caseTools, ...scriptTools])].sort();
const allowNames = Object.keys(allowRaw).sort();
T('Allow List: every value is "WFID:<its own name>" (resolved by n8n-push.sh, read back by n8n-pull.sh)', () =>
  allowNames.length > 0 && allowNames.every((k) => allowRaw[k] === 'WFID:' + k) || allowRaw);
T('Allow List = exactly the workflows tests/tool-cases.tsv and the test scripts call through tests/run-case.sh (' + called.join(', ') + ')', () =>
  same(allowNames, called) || { allowNames, called });
T('Allow List leaves out send_message, notify_owner and the scheduled / inbound workflows', () =>
  !['send_message', 'notify_owner', 'wf1-inbound', 'wf4-knowledge-ingest', 'wf5-reminders', 'wf6-error-handler', 'test-harness'].some((n) => n in allowRaw) || allowNames);
{
  const order = [...PUSH_ALL.matchAll(/^\s+workflows\/(?:[a-z0-9-]+\/)?([A-Za-z0-9_-]+)\.json\s*$/gm)].map((m) => m[1]);
  const late = allowNames.filter((n) => !(order.indexOf(n) >= 0 && order.indexOf(n) < order.indexOf('test-harness')));
  T('push-all.sh pushes every allow-listed workflow before test-harness (its WFID: values must resolve)', () => order.includes('test-harness') && late.length === 0 || { late, order });
}

// ---- the workflow guard ----
let r = tryUnpack({ workflow_id: idOf('find_client'), input: { contact_id: 'tg:900000001' } });
T('Unpack: an allow-listed tool with a test contact passes, input unchanged plus __workflow_id', () =>
  r.ok && same(r.out, [{ json: { contact_id: 'tg:900000001', __workflow_id: idOf('find_client') } }]) || r);
r = tryUnpack({ workflow_id: idOf('test-fixtures'), input: { action: 'list_events', start_iso: 'a', end_iso: 'b' } });
T('Unpack: test-fixtures (no contact_id) passes', () => r.ok && r.out[0].json.action === 'list_events' && r.out[0].json.__workflow_id === idOf('test-fixtures') || r);
for (const name of ['send_message', 'notify_owner', 'wf5-reminders', 'wf1-inbound']) {
  r = tryUnpack({ workflow_id: idOf(name), input: { contact_id: 'tg:900000001' } });
  T('Unpack: ' + name + ' (not allow-listed) is refused', () => !r.ok && /allow-list/.test(r.err) || r);
}
r = tryUnpack({ workflow_id: '', input: {} });
T('Unpack: no workflow_id is refused', () => !r.ok || r);
r = tryUnpack({ input: { contact_id: 'tg:900000001' } });
T('Unpack: a missing workflow_id is refused', () => !r.ok || r);
r = tryUnpack({ workflow_id: 'WFID:find_client', input: {} }, allowRaw);
T('Unpack: an unresolved "WFID:..." value (a push that did not resolve it) matches nothing', () => !r.ok || r);
r = tryUnpack({ workflow_id: idOf('find_client') });
T('Unpack: a missing input is an empty input (no contact_id)', () => r.ok && same(r.out[0].json, { __workflow_id: idOf('find_client') }) || r);

// ---- the contact guard ----
const contactOk = (cid) => tryUnpack({ workflow_id: idOf('escalate'), input: { contact_id: cid, reason: 'x' } }).ok;
const testContacts = ['tg:900000001', 'tg:900000009', 'tg:9000000101', 'tg:9000000115', 'wa:+15550000101', 'wa:+15550009001'];
T('contact guard: the test ranges pass (tool cases tg:9000000NN, dialogs tg:9000000NNN and wa:+1555000NNNN)', () =>
  testContacts.every(contactOk) || testContacts.filter((c) => !contactOk(c)));
const notContacts = ['', 'xyz', 'tg:', 'wa:', "tg:1'--", 'tg:123456789012345678901'];
T('contact guard: strings that are not a contact pass (the tools must reject them themselves; the cases test that)', () =>
  notContacts.every(contactOk) || notContacts.filter((c) => !contactOk(c)));
const real = ['tg:123456789', 'tg:4242', 'wa:+4915100000001', 'wa:+12025550123', ' tg:123456789', 'tg:123456789 ', 'TG:123456789', 'Wa:+4915100000001',
  'wa:4915100000001', 'tg:9000000', 'tg:90000001234', 'tg:8000000101', 'wa:+155500001011', 'wa:+1555000101', 'tg:\t123456789'];
T('contact guard: any other contact is refused (real-looking ids, any case, surrounding whitespace, wa: without +)', () =>
  real.every((c) => !contactOk(c)) || real.filter(contactOk));
r = tryUnpack({ workflow_id: idOf('escalate'), input: { contact_id: 'tg:123456789', reason: 'x' } });
T('contact guard: the refusal names the rule, not the key', () => !r.ok && /test contact/.test(r.err) || r);
r = tryUnpack({ workflow_id: idOf('escalate'), input: { contact_id: 123456789, reason: 'x' } });
T('contact guard: a bare number is not a contact (no tg:/wa: prefix: the tools find no client) and passes', () => r.ok || r);

// every contact_id of the tool cases (inputs and setups) and of the helpers passes
const tsvContacts = [...new Set([...TSV.matchAll(/\\?"contact_id\\?"\s*:\s*\\?"((?:[^"\\]|\\.)*)\\?"/g)].map((m) => JSON.parse('"' + m[1] + '"')))];
const helperContacts = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => 'tg:90000000' + n);
const refused = [...tsvContacts, ...helperContacts].filter((c) => !contactOk(c));
T('every contact_id in tests/tool-cases.tsv (' + tsvContacts.length + ' distinct) and of the tg:90000000<n> helpers passes the guard', () =>
  tsvContacts.length >= 10 && refused.length === 0 || refused);

// ---- wiring ----
T('wiring: Webhook -> Allow List -> Unpack -> Run Tool; Unpack error output -> Respond Error; Run Tool unchanged', () =>
  same(outs('Webhook'), ['Allow List']) && same(outs('Allow List'), ['Unpack']) && same(outs('Unpack'), ['Run Tool']) && same(outs('Unpack', 1), ['Respond Error']) &&
  node('Unpack').onError === 'continueErrorOutput' && same(outs('Run Tool'), ['Respond']) && same(outs('Run Tool', 1), ['Respond Error']) || WF.connections);
T('Allow List is a Set node that outputs only the list (no webhook fields)', () =>
  node('Allow List').type === 'n8n-nodes-base.set' && P('Allow List').includeOtherFields !== true && (P('Allow List').assignments || {}).assignments.every((a) => a.type === 'string') || P('Allow List'));
T('Run Tool runs the id Unpack approved', () => /\$json\.__workflow_id/.test(P('Run Tool').workflowId.value) || P('Run Tool').workflowId);
T('the webhook still needs the MedSpa Test Key', () => P('Webhook').authentication === 'headerAuth' && node('Webhook').credentials.httpHeaderAuth.name === 'MedSpa Test Key' || P('Webhook'));

console.log('\nTEST_HARNESS_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
