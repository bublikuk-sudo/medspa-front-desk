# node-inventory.json

Source of truth for node `type` strings, `typeVersion` values and top-level
parameter names used in this project's workflow JSON. It replaces the
hand-built `reference-nodes` workflow from the original plan.

It was generated from the node packages installed in the running n8n container
(n8n 2.41.5), not from documentation, so it matches what the instance accepts.

## Contents

`nodes[]`, one entry per node type the project needs:

- `type` - full string for `nodes[].type` in workflow JSON
  (for example `n8n-nodes-base.airtable`, `@n8n/n8n-nodes-langchain.agent`)
- `typeVersion` - the highest version the node declares; use it as `typeVersion`
- `allVersions`, `defaultVersion` - what the package declares (informational)
- `parameters` - top-level parameter names of that highest version
- `resources`, `operations` - every value offered for the `resource` and
  `operation` parameters (not all combinations are valid together)
- `credentials` - credential type names the node accepts

`missing` lists wanted types not found (empty). `loadErrors` lists node files
that could not be instantiated (only `EvaluationTrigger`, which the project does not use).

## How it was generated

Run from the project root. The script is `deploy/node-inventory.gen.js`; it
is piped into `node` inside the container, which loads every node file listed in
the `n8n` field of the `n8n-nodes-base` and `@n8n/n8n-nodes-langchain` package.json
files and prints JSON for the wanted types:

```
ssh medspa 'cd /opt/medspa/deploy && docker compose exec -T n8n node -' < deploy/node-inventory.gen.js > deploy/node-inventory.json
```

Regenerate after every change of `N8N_VERSION`.

## Rule

Workflow JSON in this project must take `type`, `typeVersion` and parameter
names from this file. Do not guess them from memory or from n8n 1.x examples.
Parameter names alone do not fix the shape of nested values (for example
`resource`/`operation` combinations, resource locators, `assignments`); verify
those with a push/pull round-trip.
