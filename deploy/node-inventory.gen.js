// Run INSIDE the n8n container (see README-node-inventory.md). Prints JSON to stdout.
// Reads the compiled node packages shipped with the installed n8n and, for each
// node type the project needs, reports the exact `type` string, the highest
// declared version (= typeVersion to use), and the top-level parameter names.
const path = require('path');
const root = '/usr/local/lib/node_modules/n8n/node_modules';

const wanted = [
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.executeWorkflowTrigger',
  'n8n-nodes-base.telegramTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.errorTrigger',
  'n8n-nodes-base.airtableTrigger',
  'n8n-nodes-base.code',
  'n8n-nodes-base.if',
  'n8n-nodes-base.switch',
  'n8n-nodes-base.set',
  'n8n-nodes-base.executeWorkflow',
  'n8n-nodes-base.respondToWebhook',
  'n8n-nodes-base.wait',
  'n8n-nodes-base.noOp',
  'n8n-nodes-base.airtable',
  'n8n-nodes-base.googleCalendar',
  'n8n-nodes-base.telegram',
  'n8n-nodes-base.whatsApp',
  'n8n-nodes-base.whatsAppTrigger',
  'n8n-nodes-base.postgres',
  '@n8n/n8n-nodes-langchain.agent',
  '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  '@n8n/n8n-nodes-langchain.toolWorkflow',
  '@n8n/n8n-nodes-langchain.chainLlm',
  '@n8n/n8n-nodes-langchain.vectorStorePGVector',
  '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  '@n8n/n8n-nodes-langchain.documentDefaultDataLoader',
  '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter',
];

const packages = [
  { prefix: 'n8n-nodes-base', dir: path.join(root, 'n8n-nodes-base') },
  { prefix: '@n8n/n8n-nodes-langchain', dir: path.join(root, '@n8n/n8n-nodes-langchain') },
];

const found = {}; // short type -> record
const loadErrors = [];

function describeNode(inst) {
  // VersionedNodeType keeps one instance per version in nodeVersions.
  if (inst.nodeVersions) {
    const versions = Object.keys(inst.nodeVersions).map(Number).sort((a, b) => a - b);
    const top = versions[versions.length - 1];
    return {
      description: inst.nodeVersions[top].description,
      versions,
      defaultVersion: inst.description.defaultVersion,
    };
  }
  const v = inst.description.version;
  const versions = (Array.isArray(v) ? v : [v]).map(Number).sort((a, b) => a - b);
  return { description: inst.description, versions, defaultVersion: inst.description.defaultVersion };
}

function values(props, name) {
  const out = new Set();
  for (const p of props) {
    if (p.name === name && Array.isArray(p.options)) for (const o of p.options) out.add(o.value);
  }
  return [...out];
}

for (const pkg of packages) {
  const pj = require(path.join(pkg.dir, 'package.json'));
  for (const rel of pj.n8n.nodes) {
    const file = path.join(pkg.dir, rel);
    let mod;
    try { mod = require(file); } catch (e) { loadErrors.push(rel + ': ' + e.message.split('\n')[0]); continue; }
    const cls = mod[path.basename(rel).replace('.node.js', '')] || Object.values(mod)[0];
    let inst;
    try { inst = new cls(); } catch (e) { loadErrors.push(rel + ': ' + e.message.split('\n')[0]); continue; }
    const { description, versions, defaultVersion } = describeNode(inst);
    const type = pkg.prefix + '.' + (inst.description.name);
    if (!wanted.includes(type)) continue;
    const props = description.properties || [];
    const rec = {
      type,
      displayName: inst.description.displayName,
      typeVersion: versions[versions.length - 1],
      allVersions: versions,
      parameters: [...new Set(props.map((p) => p.name))],
    };
    if (defaultVersion !== undefined) rec.defaultVersion = defaultVersion;
    const res = values(props, 'resource');
    const op = values(props, 'operation');
    if (res.length) rec.resources = res;
    if (op.length) rec.operations = op;
    if (description.credentials) rec.credentials = description.credentials.map((c) => c.name);
    if (typeof description.inputs === 'string' || Array.isArray(description.inputs)) rec.inputs = description.inputs;
    if (typeof description.outputs === 'string' || Array.isArray(description.outputs)) rec.outputs = description.outputs;
    found[type] = rec;
  }
}

const missing = wanted.filter((t) => !found[t]);
const n8nVersion = require(path.join(root, '..', 'package.json')).version;
console.log(JSON.stringify({
  generatedFor: 'n8n ' + n8nVersion,
  nodes: wanted.filter((t) => found[t]).map((t) => found[t]),
  missing,
  loadErrors,
}, null, 2));
