// Stub test for WF-4 ingest (workflows/wf4-knowledge-ingest.json): the triggers (no Airtable polling, a daily self-repair,
// a key-protected Run Now webhook for scripts/n8n-run.sh), the Plan Code node and the safety checks it must keep.
// Runs in Node with the workflow prepended (see tests/wf4-code-stubs.sh):
//   const WF = <the workflow JSON>;
// No network, no n8n runtime: $ is stubbed.

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const node = (n) => WF.nodes.find((x) => x.name === n) || {};
const targets = (from, out = 0) => (((WF.connections[from] || {}).main || [])[out] || []).map((c) => c.node);

// $('Name') -> { all(), first(), isExecuted } from { name: { items: [json...], executed: bool } }
const dollar = (nodes) => (name) => {
  const n = nodes[name];
  if (n === undefined) throw new Error('node "' + name + '" is not stubbed');
  const arr = (n.items || []).map((json) => ({ json }));
  return { all: () => arr, first: () => arr[0], isExecuted: n.executed === true };
};
// Plan: runOnceForAllItems. trigger = the name of the trigger that started the run.
const plan = (trigger, knowledge, oldIndex) => {
  const nodes = {
    Manual: { executed: trigger === 'Manual' }, 'Run Now': { executed: trigger === 'Run Now' }, Daily: { executed: trigger === 'Daily' },
    Knowledge: { items: knowledge, executed: true }, 'Old Index': { items: oldIndex, executed: true },
  };
  try { return new Function('$', '$input', node('Plan').parameters.jsCode)(dollar(nodes), { all: () => [] })[0].json; }
  catch (e) { return { threw: String(e.message) }; }
};
const kb = [{ id: 'r1', fields: { kb_id: 'kb-1', topic: 'Hours', text: 'Open 10-19.' } }, { id: 'r2', fields: { kb_id: 'kb-2', topic: 'Parking', text: 'Free parking.' } }];
const indexOf = (rows) => rows.map((r) => ({ kb_id: r.fields.kb_id, text: r.fields.topic + '\n' + r.fields.text }));

// ---------------------------------------------------------------- Plan
let p = plan('Daily', kb, indexOf(kb));
check('Plan: daily run on a healthy index -> no rebuild (costs nothing)', p.upToDate === true && p.rebuild === false && p.manual === false, p);
p = plan('Daily', kb, indexOf(kb.slice(0, 1)));
check('Plan: daily run on a stale index (a Knowledge edit nobody re-indexed) -> rebuild (self-repair)', p.upToDate === false && p.rebuild === true, p);
p = plan('Run Now', kb, indexOf(kb));
check('Plan: Run Now (scripts/n8n-run.sh wf4-knowledge-ingest) -> manual, always rebuilds and reports', p.manual === true && p.rebuild === true, p);
p = plan('Manual', kb, indexOf(kb));
check('Plan: the editor Manual trigger still forces a rebuild', p.manual === true && p.rebuild === true, p);
p = plan('Run Now', [{ id: 'r1', fields: { kb_id: 'kb-1', topic: 'x', text: '  ' } }], []);
check('Plan: KB_NO_DOCUMENTS is kept (thrown BEFORE anything is truncated), also for Run Now', /KB_NO_DOCUMENTS/.test(p.threw || ''), p);
check('Plan: does not read the removed Airtable trigger', !node('Plan').parameters.jsCode.includes('Knowledge Changed'));

// ---------------------------------------------------------------- triggers
check('no Airtable Trigger left (it polled Knowledge every 15 minutes: 2,880 API calls a month)', !WF.nodes.some((n) => n.type === 'n8n-nodes-base.airtableTrigger') && !('Knowledge Changed' in WF.connections), WF.nodes.map((n) => n.type));
const triggers = WF.nodes.filter((n) => /Trigger$|\.webhook$/.test(n.type)).map((n) => n.name).sort();
check('triggers are exactly Daily, Manual, Run Now', same(triggers, ['Daily', 'Manual', 'Run Now']), triggers);
check('Daily: once a day at 06:35 UTC', same(((node('Daily').parameters || {}).rule || {}).interval, [{ field: 'days', daysInterval: 1, triggerAtHour: 6, triggerAtMinute: 35 }]), (node('Daily').parameters || {}).rule);
const rn = node('Run Now'), rp = rn.parameters || {};
check('Run Now: POST webhook, path = workflow name (scripts/n8n-run.sh calls /webhook/<name>)', rn.type === 'n8n-nodes-base.webhook' && rp.httpMethod === 'POST' && rp.path === WF.name && WF.name === 'wf4-knowledge-ingest', rp);
check('Run Now: Header Auth with the MedSpa Test Key credential, as WF-5', rp.authentication === 'headerAuth' && ((rn.credentials || {}).httpHeaderAuth || {}).name === 'MedSpa Test Key');
check('Run Now: answers at once (onReceived), n8n-run.sh then waits for the execution', rp.responseMode === 'onReceived');
check('Run Now: its own webhookId (not WF-5\'s)', typeof rn.webhookId === 'string' && rn.webhookId.length > 0 && rn.webhookId !== '5a0e0017-aaaa-4c00-8000-00000000f005', rn.webhookId);
for (const t of ['Manual', 'Daily', 'Run Now']) check(t + ' -> Knowledge', same(targets(t), ['Knowledge']), targets(t));

// ---------------------------------------------------------------- safety checks kept, settings
check('Verify still throws KB_INDEX_EMPTY / KB_INDEX_DUPLICATED / KB_INDEX_INCOMPLETE', ['KB_INDEX_EMPTY', 'KB_INDEX_DUPLICATED', 'KB_INDEX_INCOMPLETE'].every((k) => node('Verify').parameters.jsCode.includes(k)));
check('chain unchanged: Knowledge -> Index State -> Old Index -> Plan -> Rebuild? -> Clear Index -> Documents -> Insert -> Count -> Verify -> Notify?',
  same(targets('Knowledge'), ['Index State']) && same(targets('Index State'), ['Old Index']) && same(targets('Old Index'), ['Plan']) && same(targets('Plan'), ['Rebuild?']) &&
  same(targets('Rebuild?'), ['Clear Index']) && same(targets('Rebuild?', 1), []) && same(targets('Clear Index'), ['Documents']) && same(targets('Documents'), ['Insert']) &&
  same(targets('Insert'), ['Count']) && same(targets('Count'), ['Verify']) && same(targets('Verify'), ['Notify?']));
check('Knowledge: one search per run (executeOnce, all pages)', node('Knowledge').executeOnce === true && node('Knowledge').parameters.returnAll === true);
const noRetry = WF.nodes.filter((n) => n.type === 'n8n-nodes-base.airtable' && !(n.retryOnFail === true && n.maxTries === 2 && n.waitBetweenTries === 5000)).map((n) => n.name);
check('every Airtable node: retryOnFail, maxTries 2, wait 5000', noRetry.length === 0, noRetry);
check('errorWorkflow is WF-6', WF.settings.errorWorkflow === 'WFID:wf6-error-handler');
const names = new Set(WF.nodes.map((n) => n.name));
let bad = [];
for (const [from, c] of Object.entries(WF.connections)) {
  if (!names.has(from)) bad.push('unknown source ' + from);
  for (const outs of Object.values(c)) for (const o of outs) for (const t of o || []) if (!names.has(t.node)) bad.push('unknown target ' + t.node);
}
check('every connection joins existing nodes', bad.length === 0, bad);
check('node ids and names are unique', new Set(WF.nodes.map((n) => n.id)).size === WF.nodes.length && names.size === WF.nodes.length);
check('no note still says hourly or polling', !/hourly|every hour|poll/i.test(JSON.stringify(WF)), (JSON.stringify(WF).match(/.{60}(hourly|every hour|poll).{20}/i) || [])[0]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
