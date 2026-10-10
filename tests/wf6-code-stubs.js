// Stub test for WF-6 (workflows/wf6-error-handler.json): the Compose Code node that builds the owner's failure alert
// (the provider's own error text, bounded, never throwing, deduped) and the wiring Error Trigger -> Compose -> Notify.
// Runs inside the n8n container's Node (see tests/wf6-code-stubs.sh), which prepends:
//   const WF = <the workflow JSON>;
// No network, no n8n runtime: $input and $getWorkflowStaticData are stubbed.

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};
const node = (n) => WF.nodes.find((x) => x.name === n) || {};
const targets = (n) => (((WF.connections[n] || {}).main || [[]])[0] || []).map((c) => c.node);

// Compose with a fresh static data object (or a given one, or none: sd === null makes $getWorkflowStaticData throw).
const compose = (payload, sd = {}) => {
  const items = payload === undefined ? [] : [{ json: payload }];
  const $getWorkflowStaticData = (t) => { if (sd === null) throw new Error('static data unavailable'); return sd; };
  return new Function('$input', '$getWorkflowStaticData', node('Compose').parameters.jsCode)({ first: () => items[0], all: () => items }, $getWorkflowStaticData);
};
// The Error Trigger payload n8n 2.41.5 hands WF-6 for a failed run; `err` is the stored error object.
const payload = (err, over = {}) => ({ workflow: { id: 'vp7Se1Yr7Iaiwh09', name: 'wf2-agent' }, execution: { id: '27315', url: 'https://x.example/workflow/vp7Se1Yr7Iaiwh09/executions/27315', mode: 'integrated', lastNodeExecuted: 'Agent', error: err }, ...over });
const textOf = (r) => (r && r[0] && r[0].json && r[0].json.text) || '';

// The Agent error exactly as execution 27315 (2026-10-09) stored it: fields, and what each holds.
const GENERIC = 'Bad request - please check your parameters';
const CREDIT = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';
const stored = () => ({
  level: 'warning', shouldReport: true, tags: { reWrapped: true }, timestamp: 1791548536051, context: {}, functionality: 'regular', name: 'NodeOperationError',
  node: { id: 'a9e20002-0005-4c00-8000-000000000005', name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent', parameters: { options: {} } },
  messages: ['400 {"type":"error","error":{"type":"invalid_request_error","message":"' + CREDIT + '"},"request_id":"req_011CfrexPB9GpWc2C9sc5f9J"}'],
  message: GENERIC, description: CREDIT,
  stack: 'NodeOperationError: ' + GENERIC + '\n    at /usr/local/lib/node_modules/n8n/node_modules/.pnpm/@n8n+n8n-nodes-langchain/nodes/agents/Agent.node.js:1:1',
});
const err = (over) => ({ ...stored(), ...over });
const T = (name, fn) => { try { const x = fn(); check(name, x === true, x); } catch (e) { check(name, false, String(e.message)); } };

// ---- the headline case: Anthropic credit exhausted, as stored ----
let t = textOf(compose(payload(stored())));
T('credit error as stored: the alert names the workflow, the node, the generic message AND the real cause', () =>
  t.startsWith('⚠️ wf2-agent failed at Agent: ' + GENERIC + ' — ' + CREDIT) || t);
T('credit error as stored: the execution link is kept', () => t.includes('execution: https://x.example/workflow/vp7Se1Yr7Iaiwh09/executions/27315') || t);
T('credit error as stored: no stack, no raw request body, no request id, no JSON', () =>
  !/node_modules|request_id|req_01|invalid_request_error|\{|"type"/.test(t) || t);

// ---- the cause is shown only when it exists and differs ----
T('description equal to the message: shown once', () => textOf(compose(payload(err({ message: 'Boom', description: 'Boom' })))).split('Boom').length === 2);
T('description equal to the message apart from case and spacing: shown once', () => textOf(compose(payload(err({ message: 'Boom here', description: '  boom   HERE ' })))).toLowerCase().split('boom here').length === 2);
T('description already contained in the message: shown once', () => textOf(compose(payload(err({ message: 'Failed: Your credit is low', description: 'your credit is low' })))).toLowerCase().split('your credit is low').length === 2);
for (const [label, desc] of [['missing', undefined], ['null', null], ['empty', ''], ['blank', '   \n '], ['a number', 42], ['an object', { message: 'x' }], ['an array', ['x']], ['true', true]]) {
  T('description ' + label + ': degrades to the message alone, no "undefined", no throw', () => {
    const e = err({ message: GENERIC }); if (desc === undefined) delete e.description; else e.description = desc;
    const x = textOf(compose(payload(e)));
    return x.startsWith('⚠️ wf2-agent failed at Agent: ' + GENERIC) && !x.includes(' — ') && !/undefined|null|\[object/.test(x) || x;
  });
}

// ---- a JSON-string description: its human message, never the JSON ----
const anth = '{"type":"error","error":{"type":"invalid_request_error","message":"' + CREDIT + '"},"request_id":"req_1"}';
T('JSON description (Anthropic body): error.message is extracted', () => { const x = textOf(compose(payload(err({ description: anth })))); return x.includes(GENERIC + ' — ' + CREDIT) && !/[{}]|request_id|invalid_request/.test(x.split('\nexecution:')[0]) || x; });
T('JSON description behind a status code ("400 {...}"): error.message is extracted', () => { const x = textOf(compose(payload(err({ description: '400 ' + anth })))); return x.includes(GENERIC + ' — ' + CREDIT) && !/[{}]|request_id/.test(x.split('\nexecution:')[0]) || x; });
T('JSON description with a top-level message: message is extracted', () => textOf(compose(payload(err({ description: '{"message":"Rate limit hit"}' })))).includes(GENERIC + ' — Rate limit hit') || 'no');
T('JSON description with a string error: that string is extracted', () => textOf(compose(payload(err({ description: '{"error":"quota used up"}' })))).includes(GENERIC + ' — quota used up') || 'no');
for (const [label, desc] of [['no human message', '{"foo":{"bar":1},"request":{"body":"SECRET-BODY"}}'], ['unparsable (truncated)', '{"error":{"message":"cut off hal'], ['null', 'null'], ['a status code and unparsable JSON', '500 {not json at all, "body": "SECRET-BODY"']]) {
  T('JSON description with ' + label + ': degrades to the message, the JSON is never pasted', () => { const x = textOf(compose(payload(err({ description: desc })))); return x.startsWith('⚠️ wf2-agent failed at Agent: ' + GENERIC) && !x.includes(' — ') && !/SECRET-BODY|\{|"/.test(x.split('\nexecution:')[0]) || x; });
}

// ---- bounded, single-line, no secrets ----
T('over-long description: the cause is cut to about 300 characters', () => { const x = textOf(compose(payload(err({ description: 'word '.repeat(400) })))); const cause = x.split('\nexecution:')[0].split(GENERIC + ' — ')[1] || ''; return cause.length > 0 && cause.length <= 300 || cause.length; });
T('over-long message and description together stay under 1000 characters (500 + 300 + the frame)', () => { const x = textOf(compose(payload(err({ message: 'm'.repeat(2000), description: 'd'.repeat(2000) })))); return x.length < 1000 || x.length; });
T('multi-line description: collapsed to one line', () => { const x = textOf(compose(payload(err({ description: 'Line one\n\nLine two\r\n\tLine three' })))); return x.includes(GENERIC + ' — Line one Line two Line three') || x; });
T('a description with an API key, a bearer token, an x-api-key header and a bot token: those parts are redacted', () => {
  const d = 'Call failed with sk-ant-api03-AbCdEf123456789 and Authorization: Bearer abc.def.ghi, x-api-key: topsecret99 bot 123456789:AAAbbbCCCdddEEEfffGGGhhhIIIjjjKKK';
  const x = textOf(compose(payload(err({ description: d }))));
  return !/sk-ant|abc\.def|topsecret|AAAbbb/.test(x) && x.includes('[redacted]') || x;
});

// ---- the handler must not be able to lose the alert it reports ----
T('no execution error, error only under trigger.error: still names the cause', () => {
  const x = textOf(compose({ workflow: { name: 'wf4-knowledge-ingest' }, execution: {}, trigger: { error: { message: GENERIC, description: CREDIT } } }));
  return x.startsWith('⚠️ wf4-knowledge-ingest failed at ?: ' + GENERIC + ' — ' + CREDIT) || x;
});
T('a throwing getter on the error: the fixed fallback text, not a throw', () => {
  const e = {}; Object.defineProperty(e, 'description', { get() { throw new Error('boom'); } }); e.message = GENERIC;
  const x = textOf(compose(payload(e))); return /failed|could not be formatted/.test(x) && x.length > 0 || x;
});
T('empty input: the fixed fallback text, not a throw', () => textOf(compose(undefined)).includes('could not be formatted') || 'no fallback');
T('message missing, description present: the cause alone', () => { const e = err({}); delete e.message; return textOf(compose(payload(e))).startsWith('⚠️ wf2-agent failed at Agent: ' + CREDIT) || 'no'; });
T('no message and no description: still an alert naming the node', () => textOf(compose(payload({}))).startsWith('⚠️ wf2-agent failed at Agent:') || 'no');
T('stack and node details are never forwarded', () => { const x = textOf(compose(payload(err({ stack: 'STACK-MARKER at /usr/local/x.js', node: { name: 'Agent', parameters: { secret: 'NODE-PARAMS' } } })))); return !/STACK-MARKER|NODE-PARAMS|\/usr\/local/.test(x) || x; });

// ---- dedupe stays as it was ----
{
  const sd = {};
  const a = compose(payload(stored()), sd), b = compose(payload(stored()), sd), c = compose(payload(stored()), sd);
  T('dedupe: the second failure of the same workflow within the window is suppressed', () => a.length === 1 && b.length === 0 && c.length === 0 || [a.length, b.length, c.length]);
  sd.last['wf2-agent'] -= 11 * 60 * 1000;
  const d = compose(payload(stored()), sd);
  T('dedupe: after the window the next alert counts the suppressed ones and still names the cause', () => d.length === 1 && textOf(d).includes('(2 more failures of wf2-agent suppressed') && textOf(d).includes(CREDIT) || textOf(d));
  const other = compose(payload(stored(), { workflow: { name: 'wf1-inbound' } }), sd);
  T('dedupe: another workflow is not suppressed', () => other.length === 1 && textOf(other).startsWith('⚠️ wf1-inbound failed') || textOf(other));
  T('static data unavailable: the alert is sent anyway', () => textOf(compose(payload(stored()), null)).includes(CREDIT) || 'no');
}

// ---- wiring ----
check('wiring: Error Trigger -> Compose -> Notify (notify_owner, text from Compose)', targets('Error Trigger').join() === 'Compose' && targets('Compose').join() === 'Notify' && node('Notify').parameters.workflowId.value === 'WFID:notify_owner' && node('Notify').parameters.workflowInputs.value.text === '={{ $json.text }}');
check('WF-6 has no errorWorkflow of its own (the alert channel is not its own alarm)', !('errorWorkflow' in WF.settings));
check('Compose is a Code node, run once for all items', node('Compose').type === 'n8n-nodes-base.code' && node('Compose').parameters.mode === 'runOnceForAllItems');

console.log('\nWF6_STUBS passed ' + pass + ', failed ' + fail);
process.exit(fail ? 1 : 0);
