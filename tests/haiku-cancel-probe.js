// Live probe of WF-1's LLM Affirmative prompt for the cancel question (two-step cancel, M1), without a dialog.
// Builds the prompt exactly from the deployed workflow JSON (the node's text template, yes_target = cancel) and sends it the way
// the node does: Anthropic Messages API, the node's model, temperature 0, max 3 tokens, the prompt as the one user message.
// Runs ON THE VPS in the n8n container's Node (network: api.anthropic.com only); the key comes from the environment, never printed:
//   scripts/remote.sh 'tests/haiku-cancel-probe.sh'
// Prepended by the .sh: const WF = <workflows/wf1-inbound.json>;
const node = (n) => WF.nodes.find((x) => x.name === n) || {};
const text = node('LLM Affirmative').parameters.text;
const model = node('Haiku YES').parameters.model.value;
const opts = node('Haiku YES').parameters.options || {};
const render = (message, yes_target) => {
  const $ = (n) => ({ first: () => ({ json: n === 'Gate' ? { yes_target } : { text: message } }) });
  return String(text).replace(/^=/, '').replace(/\{\{([\s\S]+?)\}\}/g, (_, x) => String(new Function('$', 'return (' + x + ');')($)));
};
const cases = [['нет', 'NO'], ['nein', 'NO'], ['no', 'NO'], ['отмена', 'YES'], ['cancel', 'YES'], ['yes cancel', 'YES']];
(async () => {
  let ok = 0;
  for (const [msg, want] of cases) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.K || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: opts.maxTokensToSample || 3, temperature: opts.temperature ?? 0, messages: [{ role: 'user', content: render(msg, 'cancel') }] }),
    });
    const j = await r.json();
    const out = r.ok ? ((j.content || [])[0] || {}).text || '' : 'HTTP ' + r.status + ' ' + ((j.error || {}).type || '');
    // the node's Affirmative? test: String(text).trim().toUpperCase().startsWith('YES')
    const yes = String(out).trim().toUpperCase().startsWith('YES');
    const pass = yes === (want === 'YES');
    if (pass) ok++;
    console.log((pass ? 'PASS ' : 'FAIL ') + JSON.stringify(msg) + ' -> ' + JSON.stringify(out) + ' (Affirmative? ' + yes + ', want ' + want + ')');
  }
  console.log('model ' + model + ', temperature ' + (opts.temperature ?? 0) + ', max_tokens ' + (opts.maxTokensToSample || 3));
  console.log('HAIKU_CANCEL_PROBE passed ' + ok + ' of ' + cases.length);
  process.exit(ok === cases.length ? 0 : 1);
})();
