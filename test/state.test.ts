import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { load, loadConfig, loadWorkspace, PATHS } from '../src/state/load.ts';
import { validate, RULES, entityShape, oneRoot } from '../src/state/validate.ts';
import { select, childrenOf } from '../src/state/select.ts';
import { apply, persist } from '../src/state/apply.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const FIXTURE = join(HERE, 'fixtures', 'workspace');

/** A throwaway copy of a workspace, so no test writes into the tree. */
function copy(from: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'addone-test-'));
  cpSync(from, dir, { recursive: true });
  return dir;
}

/** The same two-space-and-newline shape persist writes. */
function writeJson(file: string, value: unknown): void {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

/** Every file under a workspace, keyed by its repo-relative path, so a test can prove nothing moved. */
function snapshot(dir: string, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of readdirSync(join(dir, prefix)).sort()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(join(dir, rel)).isDirectory()) {
      for (const [key, value] of snapshot(dir, rel)) out.set(key, value);
    } else {
      out.set(rel, readFileSync(join(dir, rel), 'utf8'));
    }
  }
  return out;
}

function codes(list: { code: string }[]): string[] {
  return list.map((d) => d.code).sort();
}

test('load reads architecture.json and keeps every model key', () => {
  const state = load(FIXTURE);
  assert.equal(state.version, 0);
  assert.equal(state.project.name, 'Fixture');
  assert.equal(state.entities['app'].parent, null);
  assert.equal(state.entities['app.api'].kind, 'surface');
  assert.equal(state.relations.length, 1);
  assert.equal(state.forbidden.length, 1);
  assert.deepEqual(state.anchors['app.api'], [{ file: 'src/api.ts', symbol: 'api' }]);
  assert.equal(state.scopes['app'].write[0], 'src/**');
  assert.equal(state.docs['app'][0].file, 'docs/app.md');
  assert.equal(state.last?.what, 'Fixture seeded.');
});

test('load rejects a top-level key the model does not define (invariant 1)', () => {
  const dir = copy(FIXTURE);
  const file = join(dir, PATHS.architecture);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  raw.diagrams = {};
  writeJson(file, raw);
  assert.throws(() => load(dir), /diagrams/);
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig reads the slots, and a missing file means every slot unchosen', () => {
  assert.equal(loadConfig(FIXTURE).slots.host.choice, 'both');
  assert.equal(loadConfig(FIXTURE).slots.watch.progress, 'unchosen');

  const dir = copy(FIXTURE);
  rmSync(join(dir, PATHS.config));
  const config = loadConfig(dir);
  assert.equal(config.version, 0);
  for (const slot of Object.values(config.slots)) assert.equal(slot.progress, 'unchosen');
  rmSync(dir, { recursive: true, force: true });
});

test('loadWorkspace gathers state, views, decisions, and config', () => {
  const ws = loadWorkspace(FIXTURE);
  assert.equal(ws.state.project.name, 'Fixture');
  assert.deepEqual(Object.keys(ws.views).sort(), ['app.api.flow', 'app.map']);
  assert.equal(ws.views['app.map'].address, 'app');
  assert.equal(ws.decisions.length, 1);
  assert.equal(ws.decisions[0].status, 'open');
  assert.equal(ws.config.slots.writePath.choice, 'cli');
});

test('loadWorkspace treats a missing views/ or decisions/ as empty', () => {
  const dir = copy(FIXTURE);
  rmSync(join(dir, '.addone/views'), { recursive: true });
  rmSync(join(dir, '.addone/decisions'), { recursive: true });
  const ws = loadWorkspace(dir);
  assert.deepEqual(ws.views, {});
  assert.deepEqual(ws.decisions, []);
  rmSync(dir, { recursive: true, force: true });
});

test('the fixture and the live workspace both validate clean', () => {
  assert.deepEqual(validate(loadWorkspace(FIXTURE), FIXTURE), []);
  assert.deepEqual(validate(loadWorkspace(REPO), REPO), []);
});

test('validate reports referential integrity, invariant 6, and one root', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.state.entities['app.ghost'] = { kind: 'module', parent: 'app.nowhere', intent: 'Orphan.' };
  ws.state.entities['app.api.odd'] = { kind: 'module', parent: 'app.db', intent: 'Not dotted under its parent.' };
  ws.state.entities['other'] = { kind: 'system', parent: null, intent: 'A second root.' };
  ws.state.relations.push({ from: 'app.api', to: 'app.missing', kind: 'reads' });
  ws.state.forbidden.push({ from: 'app.gone', to: 'app.db', reason: 'nowhere' });
  ws.state.anchors['app.absent'] = [{ file: 'src/x.ts' }];
  ws.state.scopes['app.absent'] = { write: [], read: [], requires_approval: [] };

  assert.deepEqual(codes(validate(ws)), [
    'anchors.address-missing',
    'entity.parent-mismatch',
    'entity.parent-missing',
    'forbidden.endpoint-missing',
    'relation.endpoint-missing',
    'root.not-one',
    'scopes.address-missing',
  ]);
  assert.ok(validate(ws).every((d) => d.severity === 'error'));
});

test('validate marks a view dirty when it names a node the model lacks', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.views['app.map'].nodes!['app.vanished'] = { row: 1, col: 0 };
  const found = validate(ws).filter((d) => d.code === 'view.node-missing');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'error');
  assert.equal(found[0].subject, 'app.map');
  assert.match(found[0].message, /app\.vanished/);
});

test('validate rejects a map node without a position and an attached view without a body', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.views['app.map'].nodes!['app.api.routes'] = undefined as never;
  delete ws.views['app.api.flow'].body;
  assert.deepEqual(codes(validate(ws)), ['view.body-missing', 'view.node-unplaced']);
});

test('validate errors on a doc pointing at a file that is not there', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.state.docs['app.api'] = [{ file: 'docs/nope.md' }];
  const found = validate(ws, FIXTURE).filter((d) => d.code === 'docs.file-missing');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'error');
  // Without a root there is no filesystem to ask, so the rule stays quiet.
  assert.deepEqual(validate(ws).filter((d) => d.code === 'docs.file-missing'), []);
});

test('more than 12 children is a smell, never an error', () => {
  const ws = loadWorkspace(FIXTURE);
  for (let i = 0; i < 12; i++) {
    ws.state.entities[`app.n${i}`] = { kind: 'module', parent: 'app', intent: `Child ${i}.` };
  }
  const found = validate(ws, FIXTURE);
  assert.deepEqual(codes(found), ['entity.fan-out']);
  assert.equal(found[0].severity, 'smell');
  assert.equal(found[0].subject, 'app');
});

test('a phase past skeleton with no anchors is a smell', () => {
  const ws = loadWorkspace(FIXTURE);
  delete ws.state.anchors['app.db'];
  const found = validate(ws, FIXTURE);
  assert.deepEqual(codes(found), ['entity.anchors-missing']);
  assert.equal(found[0].severity, 'smell');
  assert.equal(found[0].subject, 'app.db');
});


test('childrenOf gives the direct children, sorted, and the roots on null', () => {
  const state = load(FIXTURE);
  assert.deepEqual(childrenOf(state, null), ['app']);
  assert.deepEqual(childrenOf(state, 'app'), ['app.api', 'app.db']);
  assert.deepEqual(childrenOf(state, 'app.api'), ['app.api.routes']);
  assert.deepEqual(childrenOf(state, 'app.db'), []);
});

test('select cuts the focus, the breadcrumb, and the subtree to depth', () => {
  const ws = loadWorkspace(FIXTURE);

  const zero = select(ws, 'app.api', 0);
  assert.deepEqual(Object.keys(zero.entities).sort(), ['app', 'app.api']);
  assert.equal(zero.depth, 0);

  const one = select(ws, 'app.api', 1);
  assert.equal(one.focus, 'app.api');
  assert.deepEqual(one.breadcrumb, ['app', 'app.api']);
  assert.deepEqual(Object.keys(one.entities).sort(), ['app', 'app.api', 'app.api.routes']);

  const deep = select(ws, 'app', 3);
  assert.deepEqual(Object.keys(deep.entities).sort(), ['app', 'app.api', 'app.api.routes', 'app.db']);
});

test('select keeps only the edges that touch the shown set', () => {
  const ws = loadWorkspace(FIXTURE);

  const api = select(ws, 'app.api', 1);
  assert.deepEqual(api.relations, [{ from: 'app.api', to: 'app.db', kind: 'reads' }]);
  assert.equal(api.forbidden.length, 1, 'the forbidden edge points at app.api');

  const routes = select(ws, 'app.api.routes', 1);
  assert.deepEqual(routes.relations, [], 'nothing touches a leaf that has no edges');
  assert.deepEqual(routes.forbidden, []);
});

test('select carries anchors, docs, and the views on the subtree plus their related', () => {
  const ws = loadWorkspace(FIXTURE);

  const api = select(ws, 'app.api', 1);
  assert.deepEqual(api.anchors, { 'app.api': [{ file: 'src/api.ts', symbol: 'api' }] });
  assert.deepEqual(api.docs, {}, 'the doc hangs on app, which is not in the shown set');
  assert.deepEqual(api.views.map((v) => v.id), ['app.api.flow']);

  const root = select(ws, 'app', 1);
  assert.deepEqual(root.docs['app'], [{ file: 'docs/app.md', section: 'Overview' }]);
  assert.deepEqual(
    root.views.map((v) => v.id),
    ['app.api.flow', 'app.map'],
    'both hang on a shown node, so both are on the subtree, in id order',
  );

  const alone = select(ws, 'app', 0);
  assert.deepEqual(
    alone.views.map((v) => v.id),
    ['app.map', 'app.api.flow'],
    'app.api.flow hangs on a node out of the shown set: it comes in only through related',
  );
});

test('select counts open decisions in the whole subtree, whatever the depth', () => {
  const ws = loadWorkspace(FIXTURE);
  assert.equal(select(ws, 'app.api', 1).open, 1);
  assert.equal(select(ws, 'app', 0).open, 1, 'the count cascades even when the node is not shown');
  assert.equal(select(ws, 'app.db', 1).open, 0);

  ws.decisions[0].status = 'settled';
  assert.equal(select(ws, 'app', 1).open, 0, 'a settled decision leaves the wait list');
});

test('select inherits the nearest scope up the chain and carries last', () => {
  const ws = loadWorkspace(FIXTURE);
  assert.deepEqual(select(ws, 'app.api.routes', 1).scope, ws.state.scopes['app']);
  assert.equal(select(ws, 'app', 1).last?.what, 'Fixture seeded.');

  ws.state.scopes['app.api'] = { write: ['src/api/**'], read: ['**'], requires_approval: [] };
  assert.deepEqual(select(ws, 'app.api.routes', 1).scope?.write, ['src/api/**'], 'the nearest one wins');

  delete ws.state.scopes['app'];
  delete ws.state.scopes['app.api'];
  assert.equal(select(ws, 'app.db', 1).scope, undefined, 'no scope anywhere up the chain');
});

test('select refuses an address the model does not have', () => {
  assert.throws(() => select(loadWorkspace(FIXTURE), 'app.nope', 1), /app\.nope/);
});

const AT = '2026-08-31T00:00:00.000Z';

/** Apply against a fresh fixture, and refuse to look at a run that produced an error. */
function ok(mutation: Parameters<typeof apply>[1], from = FIXTURE) {
  const applied = apply(loadWorkspace(from), mutation, AT, from);
  assert.deepEqual(
    applied.diagnostics.filter((d) => d.severity === 'error'),
    [],
    `${mutation.op} was expected to be clean`,
  );
  return applied;
}

test('apply is pure: the workspace it was handed is untouched', () => {
  const ws = loadWorkspace(FIXTURE);
  const before = JSON.stringify(ws);
  apply(ws, { op: 'add-entity', id: 'app.web', entity: { kind: 'surface', parent: 'app', intent: 'A page.' } }, AT);
  assert.equal(JSON.stringify(ws), before);
});

test('apply add-entity puts the entity in and records an architecture change', () => {
  const { workspace, diagnostics } = ok({
    op: 'add-entity',
    id: 'app.web',
    entity: { kind: 'surface', parent: 'app', intent: 'A page.' },
  });
  assert.deepEqual(workspace.state.entities['app.web'], { kind: 'surface', parent: 'app', intent: 'A page.' });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(workspace.state.last, {
    at: AT,
    type: 'architecture',
    address: 'app.web',
    what: 'add-entity app.web (surface) under app',
  });
});

test('apply move-entity re-addresses the entity, its subtree, and every reference', () => {
  const { workspace } = ok({ op: 'move-entity', id: 'app.api', parent: 'app.db' });
  const state = workspace.state;
  assert.equal(state.entities['app.api'], undefined);
  assert.equal(state.entities['app.db.api'].parent, 'app.db');
  assert.equal(state.entities['app.db.api.routes'].parent, 'app.db.api', 'the subtree moves with it');
  assert.deepEqual(state.relations, [{ from: 'app.db.api', to: 'app.db', kind: 'reads' }]);
  assert.deepEqual(state.forbidden[0], { from: 'app.db', to: 'app.db.api', reason: 'A store never calls its surface.' });
  assert.ok(state.anchors['app.db.api'], 'anchors follow the address');
  assert.equal(state.anchors['app.api'], undefined);
  assert.equal(workspace.views['app.api.flow'].address, 'app.db.api', 'the view follows too');
  assert.equal(workspace.decisions[0].address, 'app.db.api');
  assert.equal(state.last?.type, 'architecture');
});

test('apply move-entity refuses to move a node into its own subtree', () => {
  const applied = apply(loadWorkspace(FIXTURE), { op: 'move-entity', id: 'app.api', parent: 'app.api.routes' }, AT);
  assert.deepEqual(codes(applied.diagnostics), ['mutation.move-into-own-subtree']);
});

test('apply remove-entity drops the entity and its own bookkeeping', () => {
  const { workspace } = ok({ op: 'remove-entity', id: 'app.api.routes' });
  assert.equal(workspace.state.entities['app.api.routes'], undefined);
  assert.equal(workspace.state.last?.what, 'remove-entity app.api.routes');
  assert.equal(workspace.state.last?.type, 'architecture');
});

test('apply remove-entity is refused while an edge or a child still names it', () => {
  const still = apply(loadWorkspace(FIXTURE), { op: 'remove-entity', id: 'app.db' }, AT);
  assert.deepEqual(codes(still.diagnostics), [
    'forbidden.endpoint-missing',
    'relation.endpoint-missing',
    'view.node-missing',
  ], 'the two edges and the map that still draws it');

  const parent = apply(loadWorkspace(FIXTURE), { op: 'remove-entity', id: 'app.api' }, AT);
  assert.ok(parent.diagnostics.some((d) => d.code === 'entity.parent-missing'), 'a child would be orphaned');
});

test('apply add-relation and remove-relation, one object at a time (invariant 6)', () => {
  const added = ok({ op: 'add-relation', relation: { from: 'app.api.routes', to: 'app.db', kind: 'writes' } });
  assert.equal(added.workspace.state.relations.length, 2);
  assert.equal(added.workspace.state.last?.what, 'add-relation app.api.routes → app.db (writes)');

  const gone = apply(added.workspace, { op: 'remove-relation', relation: { from: 'app.api', to: 'app.db' } }, AT);
  assert.deepEqual(gone.workspace.state.relations, [{ from: 'app.api.routes', to: 'app.db', kind: 'writes' }]);
  assert.equal(gone.workspace.state.last?.what, 'remove-relation app.api → app.db (reads)');
});

test('apply remove-relation says so when there is no such edge', () => {
  const applied = apply(loadWorkspace(FIXTURE), { op: 'remove-relation', relation: { from: 'app.db', to: 'app.api' } }, AT);
  assert.deepEqual(codes(applied.diagnostics), ['mutation.relation-missing']);
});

test('apply add-forbidden', () => {
  const { workspace } = ok({
    op: 'add-forbidden',
    forbidden: { from: 'app.api.routes', to: 'app.db', reason: 'Routes go through the surface.' },
  });
  assert.equal(workspace.state.forbidden.length, 2);
  assert.equal(workspace.state.last?.what, 'add-forbidden app.api.routes ✗ app.db');
  assert.equal(workspace.state.last?.type, 'architecture');
});

test('apply set-phase, set-anchors, and add-doc are implementation changes', () => {
  const phase = ok({ op: 'set-phase', id: 'app.api', phase: 'implementing' });
  assert.equal(phase.workspace.state.entities['app.api'].phase, 'implementing');
  assert.equal(phase.workspace.state.last?.type, 'implementation');
  assert.equal(phase.workspace.state.last?.what, 'set-phase app.api skeleton → implementing');

  const anchors = ok({ op: 'set-anchors', id: 'app.api', anchors: [{ file: 'src/api.ts', symbol: 'serve', line: 12 }] });
  assert.deepEqual(anchors.workspace.state.anchors['app.api'], [{ file: 'src/api.ts', symbol: 'serve', line: 12 }]);
  assert.equal(anchors.workspace.state.last?.type, 'implementation');

  const doc = ok({ op: 'add-doc', id: 'app.api', doc: { file: 'docs/app.md', section: 'API' } });
  assert.deepEqual(doc.workspace.state.docs['app.api'], [{ file: 'docs/app.md', section: 'API' }]);
  assert.equal(doc.workspace.state.last?.type, 'implementation');
});

test('apply set-scope is a policy change', () => {
  const scope = { write: ['src/api/**'], read: ['**'], requires_approval: ['docs/**'] };
  const { workspace } = ok({ op: 'set-scope', id: 'app.api', scope });
  assert.deepEqual(workspace.state.scopes['app.api'], scope);
  assert.equal(workspace.state.last?.type, 'policy');
  assert.equal(workspace.state.last?.what, 'set-scope app.api (1 write glob)');
});

test('apply set-view and remove-view own the view file, never the model', () => {
  const view = {
    id: 'app.db.flow',
    kind: 'attached' as const,
    address: 'app.db',
    type: 'lifecycle' as const,
    title: 'Row lifecycle',
    body: { format: 'mermaid' as const, source: 'stateDiagram-v2\n' },
  };
  const added = ok({ op: 'set-view', view });
  assert.deepEqual(added.workspace.views['app.db.flow'], view);
  assert.equal(added.workspace.state.last?.what, 'set-view app.db.flow (attached lifecycle) on app.db');
  assert.deepEqual(
    added.writes.map((w) => w.path).sort(),
    ['.addone/architecture.json', '.addone/views/app.db.flow.json'],
  );

  const gone = apply(added.workspace, { op: 'remove-view', id: 'app.db.flow' }, AT);
  assert.equal(gone.workspace.views['app.db.flow'], undefined);
  assert.deepEqual(gone.writes.find((w) => w.path === '.addone/views/app.db.flow.json')?.content, null, 'a delete');
});

test('apply set-view is refused when the view names a node the model lacks', () => {
  const applied = apply(
    loadWorkspace(FIXTURE),
    {
      op: 'set-view',
      view: {
        id: 'app.ghost',
        kind: 'map',
        address: 'app',
        type: 'architecture',
        title: 'Ghost',
        nodes: { 'app.nowhere': { row: 0, col: 0 } },
      },
    },
    AT,
  );
  assert.deepEqual(codes(applied.diagnostics), ['view.node-missing']);
  assert.equal(applied.diagnostics[0].severity, 'error');
});

test('apply open-decision and settle-decision move the wait list', () => {
  const opened = ok({
    op: 'open-decision',
    decision: { id: 'd2', feature: 'first', address: 'app.db', status: 'open', question: 'Which store?' },
  });
  assert.equal(opened.workspace.decisions.length, 2);
  assert.equal(select(opened.workspace, 'app', 1).open, 2);
  assert.equal(opened.workspace.state.last?.type, 'policy');
  assert.equal(opened.workspace.state.last?.what, 'open-decision d2 on app.db: Which store?');

  const settled = apply(opened.workspace, { op: 'settle-decision', id: 'd2', chosen: 'sqlite', reason: 'One file.' }, AT);
  const d2 = settled.workspace.decisions.find((d) => d.id === 'd2')!;
  assert.equal(d2.status, 'settled');
  assert.equal(d2.chosen, 'sqlite');
  assert.equal(d2.reason, 'One file.');
  assert.equal(select(settled.workspace, 'app', 1).open, 1);
  assert.equal(settled.workspace.state.last?.what, 'settle-decision d2: sqlite');
});

test('apply refuses an op that names something that is not there', () => {
  const ws = loadWorkspace(FIXTURE);
  const cases: Array<[Parameters<typeof apply>[1], string]> = [
    [{ op: 'add-entity', id: 'app.api', entity: { kind: 'module', parent: 'app', intent: 'Twice.' } }, 'mutation.entity-exists'],
    [{ op: 'add-entity', id: 'x.y', entity: { kind: 'module', parent: 'x', intent: 'No parent.' } }, 'mutation.parent-missing'],
    [{ op: 'set-phase', id: 'app.nope', phase: 'skeleton' }, 'mutation.entity-missing'],
    [{ op: 'move-entity', id: 'app.api', parent: 'app.nope' }, 'mutation.parent-missing'],
    [{ op: 'remove-view', id: 'nope' }, 'mutation.view-missing'],
    [{ op: 'settle-decision', id: 'nope', chosen: 'a', reason: 'b' }, 'mutation.decision-missing'],
    [{ op: 'nonsense' } as never, 'mutation.unknown-op'],
  ];
  for (const [mutation, code] of cases) {
    const applied = apply(ws, mutation, AT);
    assert.deepEqual(codes(applied.diagnostics), [code], `${JSON.stringify(mutation)}`);
    assert.deepEqual(applied.writes, [], 'a refused mutation asks for no write');
    assert.equal(applied.workspace, ws, 'and hands back the workspace it was given');
  }
});

test('persist writes two-space JSON with a trailing newline', () => {
  const dir = copy(FIXTURE);
  const applied = ok({ op: 'set-phase', id: 'app.api', phase: 'implementing' }, dir);
  persist(dir, applied);

  const text = readFileSync(join(dir, PATHS.architecture), 'utf8');
  assert.ok(text.endsWith('}\n'), 'one trailing newline');
  assert.match(text, /\n  "version": 0,/, 'two-space indent');
  assert.equal(load(dir).entities['app.api'].phase, 'implementing', 'and it reads back');
  assert.equal(load(dir).last?.what, 'set-phase app.api skeleton → implementing');
  rmSync(dir, { recursive: true, force: true });
});

test('persist refuses an error diagnostic and leaves every file alone', () => {
  const dir = copy(FIXTURE);
  const before = snapshot(dir);

  for (const mutation of [
    { op: 'add-entity', id: 'app.api', entity: { kind: 'module', parent: 'app', intent: 'Duplicate.' } },
    { op: 'add-entity', id: 'app.x.y', entity: { kind: 'module', parent: 'app.x', intent: 'No parent.' } },
    {
      op: 'set-view',
      view: { id: 'app.map', kind: 'map', address: 'app', type: 'architecture', title: 'Dirty',
              nodes: { 'app.gone': { row: 0, col: 0 } } },
    },
  ] as Parameters<typeof apply>[1][]) {
    const applied = apply(loadWorkspace(dir), mutation, AT);
    assert.ok(applied.diagnostics.some((d) => d.severity === 'error'), `${mutation.op} must be refused`);
    assert.deepEqual(applied.writes, []);
    assert.throws(() => persist(dir, applied), /refused/);
    assert.deepEqual(snapshot(dir), before, `${mutation.op} left the workspace untouched`);
  }
  rmSync(dir, { recursive: true, force: true });
});

test('cli apply on a copy of the live .addone/ sets last.what and touches only architecture.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'addone-cli-'));
  cpSync(join(REPO, '.addone'), join(dir, '.addone'), { recursive: true });
  // The model's docs come along: apply now asks the filesystem for every file docs names.
  cpSync(join(REPO, 'docs/archive'), join(dir, 'docs/archive'), { recursive: true });
  const before = snapshot(dir);

  const run = spawnSync(
    process.execPath,
    [join(REPO, 'src/cli.ts'), 'apply', join(HERE, 'fixtures/mutation.set-phase.json')],
    { cwd: dir, encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);

  const after = snapshot(dir);
  const changed = [...after.keys()].filter((file) => after.get(file) !== before.get(file));
  assert.deepEqual(changed, ['.addone/architecture.json']);
  assert.deepEqual([...after.keys()], [...before.keys()], 'no file appears or disappears');

  const state = load(dir);
  assert.equal(state.entities['addone.core.state'].phase, 'implementing');
  assert.ok(state.last?.what, 'last.what is set');
  assert.equal(state.last?.what, 'set-phase addone.core.state skeleton → implementing');
  assert.equal(state.last?.type, 'implementation');
  rmSync(dir, { recursive: true, force: true });
});

// ── Review round 1 ────────────────────────────────────────────────────────────

test('validate rejects an entity whose fields are not single-valued (invariant 6)', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.state.entities['app.bad'] = { kind: ['module', 'store'], parent: 'app', intent: 'Two kinds.' } as never;
  const found = validate(ws).filter((d) => d.code === 'entity.shape');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'error');
  assert.equal(found[0].subject, 'app.bad');
  assert.match(found[0].message, /kind/);
});

test('validate rejects every other broken entity field', () => {
  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ['app.k', { kind: 'widget', parent: 'app', intent: 'Unknown kind.' }, /kind/],
    ['app.p', { kind: 'module', parent: 42, intent: 'Numeric parent.' }, /parent/],
    ['app.i', { kind: 'module', parent: 'app', intent: '' }, /intent/],
    ['app.i2', { kind: 'module', parent: 'app' }, /intent/],
    ['app.ph', { kind: 'module', parent: 'app', intent: 'Bad phase.', phase: 'done' }, /phase/],
    ['app.as', { kind: 'module', parent: 'app', intent: 'Bad assurance.', assurance: 'extreme' }, /assurance/],
  ];
  for (const [id, entity, message] of cases) {
    const ws = loadWorkspace(FIXTURE);
    ws.state.entities[id] = entity as never;
    const found = validate(ws).filter((d) => d.code === 'entity.shape');
    assert.equal(found.length, 1, id);
    assert.match(found[0].message, message, id);
  }
});

test('validate rejects a relation without a kind, so the block can never print (undefined)', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.state.relations.push({ from: 'app.api', to: 'app.db' } as never);
  const found = validate(ws).filter((d) => d.code === 'relation.shape');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'error');
  assert.match(found[0].message, /kind/);
});

test('apply refuses an entity whose shape is wrong, however it arrives', () => {
  const bad = apply(
    loadWorkspace(FIXTURE),
    { op: 'add-entity', id: 'app.bad', entity: { kind: ['module', 'store'], parent: 'app', intent: 'Two.' } as never },
    AT,
  );
  assert.deepEqual(codes(bad.diagnostics), ['entity.shape']);
  assert.deepEqual(bad.writes, []);

  const phase = apply(loadWorkspace(FIXTURE), { op: 'set-phase', id: 'app.api', phase: 'done' as never }, AT);
  assert.deepEqual(codes(phase.diagnostics), ['entity.shape']);
  assert.deepEqual(phase.writes, []);
});

test('a view or decision id that could escape .addone/ is refused', () => {
  const ws = loadWorkspace(FIXTURE);
  const view = { kind: 'attached' as const, address: 'app', type: 'sequence' as const, title: 'Escape',
                 body: { format: 'mermaid' as const, source: 'x' } };

  for (const id of ['../../escape', 'a/b', 'App.Map', '.hidden', 'has space']) {
    const set = apply(ws, { op: 'set-view', view: { id, ...view } }, AT);
    assert.deepEqual(codes(set.diagnostics), ['view.id-shape'], id);
    assert.deepEqual(set.writes, [], id);

    const open = apply(ws, { op: 'open-decision', decision: { id, feature: 'f', status: 'open', question: 'q?' } }, AT);
    assert.deepEqual(codes(open.diagnostics), ['decision.id-shape'], id);
    assert.deepEqual(open.writes, [], id);
  }
  assert.deepEqual(codes(apply(ws, { op: 'remove-view', id: '../../x' }, AT).diagnostics), ['view.id-shape']);
  assert.deepEqual(
    codes(apply(ws, { op: 'settle-decision', id: '../x', chosen: 'a', reason: 'b' }, AT).diagnostics),
    ['decision.id-shape'],
  );
});

test('validate catches an escaping id that is already on disk', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.views['../evil'] = { ...ws.views['app.map'], id: '../evil' };
  ws.decisions.push({ id: '../evil', feature: 'f', status: 'open', question: 'q?' });
  assert.deepEqual(codes(validate(ws)), ['decision.id-shape', 'view.id-shape']);
});

test('persist refuses any write that resolves outside .addone/', () => {
  const dir = copy(FIXTURE);
  const before = snapshot(dir);
  const ws = loadWorkspace(dir);

  for (const path of ['../evil.json', '.addone/../../evil.json', '/etc/evil.json', 'src/evil.json']) {
    assert.throws(
      () => persist(dir, { workspace: ws, diagnostics: [], writes: [{ path, content: '{}\n' }] }),
      /outside/,
      path,
    );
  }
  assert.deepEqual(snapshot(dir), before);
  rmSync(dir, { recursive: true, force: true });
});

test('apply forwards root to validate, so a doc pointing at nothing never persists', () => {
  const ghost = { op: 'add-doc' as const, id: 'app.api', doc: { file: 'docs/ghost.md' } };
  const withRoot = apply(loadWorkspace(FIXTURE), ghost, AT, FIXTURE);
  assert.deepEqual(codes(withRoot.diagnostics), ['docs.file-missing']);
  assert.deepEqual(withRoot.writes, []);

  const withoutRoot = apply(loadWorkspace(FIXTURE), ghost, AT);
  assert.deepEqual(codes(withoutRoot.diagnostics), [], 'no root means no filesystem to ask');
});

test('remove-relation needs to know which kind when a pair carries more than one', () => {
  const two = ok({ op: 'add-relation', relation: { from: 'app.api', to: 'app.db', kind: 'writes' } });

  const vague = apply(two.workspace, { op: 'remove-relation', relation: { from: 'app.api', to: 'app.db' } }, AT);
  assert.deepEqual(codes(vague.diagnostics), ['mutation.relation-ambiguous']);
  assert.deepEqual(vague.writes, []);

  const named = apply(two.workspace, { op: 'remove-relation', relation: { from: 'app.api', to: 'app.db', kind: 'writes' } }, AT);
  assert.deepEqual(named.workspace.state.relations, [{ from: 'app.api', to: 'app.db', kind: 'reads' }]);
  assert.equal(named.workspace.state.last?.what, 'remove-relation app.api → app.db (writes)');

  const wrong = apply(two.workspace, { op: 'remove-relation', relation: { from: 'app.api', to: 'app.db', kind: 'calls' } }, AT);
  assert.deepEqual(codes(wrong.diagnostics), ['mutation.relation-missing']);
});

test('add-forbidden and add-doc refuse an exact duplicate', () => {
  const dup = apply(
    loadWorkspace(FIXTURE),
    { op: 'add-forbidden', forbidden: { from: 'app.db', to: 'app.api', reason: 'A store never calls its surface.' } },
    AT,
  );
  assert.deepEqual(codes(dup.diagnostics), ['mutation.forbidden-exists']);

  const doc = apply(
    loadWorkspace(FIXTURE),
    { op: 'add-doc', id: 'app', doc: { file: 'docs/app.md', section: 'Overview' } },
    AT,
    FIXTURE,
  );
  assert.deepEqual(codes(doc.diagnostics), ['mutation.doc-exists']);
});

test('move-entity to the parent it already has is refused, not written', () => {
  const applied = apply(loadWorkspace(FIXTURE), { op: 'move-entity', id: 'app.api', parent: 'app' }, AT);
  assert.deepEqual(codes(applied.diagnostics), ['mutation.no-op']);
  assert.deepEqual(applied.writes, []);
});

test('validate reports a view or decision file whose name is not its id', () => {
  const dir = copy(FIXTURE);
  cpSync(join(dir, '.addone/views/app.map.json'), join(dir, '.addone/views/renamed.json'));
  rmSync(join(dir, '.addone/views/app.map.json'));
  cpSync(join(dir, '.addone/decisions/d1.json'), join(dir, '.addone/decisions/first.json'));
  rmSync(join(dir, '.addone/decisions/d1.json'));

  const found = validate(loadWorkspace(dir), dir);
  assert.deepEqual(codes(found), ['decision.file-mismatch', 'view.file-mismatch']);
  assert.ok(found.every((d) => d.severity === 'error'));
  assert.match(found.find((d) => d.code === 'view.file-mismatch')!.message, /app\.map\.json/);
  rmSync(dir, { recursive: true, force: true });
});

// ── Review round 1, second pass ───────────────────────────────────────────────

test('validate is a table of named rules, each one testable on its own', () => {
  assert.ok(RULES.length >= 11, `${RULES.length} rules`);
  for (const rule of RULES) {
    assert.equal(typeof rule, 'function');
    assert.ok(rule.name.length > 0, 'every rule has a name');
    assert.deepEqual(rule(loadWorkspace(FIXTURE), FIXTURE), [], `${rule.name} is quiet on a clean workspace`);
  }
  const names = RULES.map((r) => r.name);
  assert.deepEqual([...new Set(names)], names, 'no rule is registered twice');
  for (const wanted of ['oneRoot', 'parentChain', 'entityShape', 'relationShape', 'endpointsExist', 'fanOut']) {
    assert.ok(names.includes(wanted), `${wanted} is in the table`);
  }
});

test('one rule refuses one bad shape, without the rest of validate running', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.state.entities['app.two'] = { kind: ['module'], parent: 'app', intent: 'Two kinds.' } as never;
  assert.deepEqual(codes(entityShape(ws)), ['entity.shape']);
  assert.deepEqual(oneRoot(ws), [], 'a neighbouring rule stays quiet');

  const roots = loadWorkspace(FIXTURE);
  roots.state.entities['other'] = { kind: 'system', parent: null, intent: 'Second root.' };
  assert.deepEqual(codes(oneRoot(roots)), ['root.not-one']);
  assert.deepEqual(entityShape(roots), []);
});

test('validate rejects a view whose own fields are wrong', () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ kind: 'chart' }, /kind/],
    [{ type: 'nonsense' }, /type/],
    [{ title: '' }, /title/],
    [{ address: 42 }, /address/],
  ];
  for (const [patch, message] of cases) {
    const ws = loadWorkspace(FIXTURE);
    Object.assign(ws.views['app.map'], patch);
    const found = validate(ws, FIXTURE).filter((d) => d.code === 'view.shape');
    assert.equal(found.length, 1, JSON.stringify(patch));
    assert.equal(found[0].severity, 'error');
    assert.match(found[0].message, message);
  }
});

test('validate rejects a decision whose status is outside its union', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.decisions[0].status = 'maybe' as never;
  const found = validate(ws, FIXTURE).filter((d) => d.code === 'decision.shape');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /status/);

  const bare = loadWorkspace(FIXTURE);
  bare.decisions[0].question = '' as never;
  assert.match(validate(bare, FIXTURE).find((d) => d.code === 'decision.shape')!.message, /question/);
});

test('a badly shaped view or decision is reported once, not through every rule that reads it', () => {
  const ws = loadWorkspace(FIXTURE);
  Object.assign(ws.views['app.map'], { kind: 'chart', address: 'app.nowhere' });
  assert.deepEqual(codes(validate(ws, FIXTURE)), ['view.shape'], 'no view.address-missing on top');
});

test('apply refuses a view whose shape is wrong', () => {
  const bad = apply(
    loadWorkspace(FIXTURE),
    { op: 'set-view', view: { id: 'app.bad', kind: 'chart', address: 'app', type: 'architecture', title: 'B' } as never },
    AT,
  );
  assert.deepEqual(codes(bad.diagnostics), ['view.shape']);
  assert.deepEqual(bad.writes, []);
});

// ── Review round 2 ────────────────────────────────────────────────────────────

test('an op that names a prototype member is unknown, not a crash', () => {
  const ws = loadWorkspace(FIXTURE);
  for (const op of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
    const applied = apply(ws, { op } as never, AT);
    assert.deepEqual(codes(applied.diagnostics), ['mutation.unknown-op'], op);
    assert.deepEqual(applied.writes, [], op);
    assert.equal(applied.workspace, ws, op);
  }
});

test('one null entity is reported once and never crashes a later rule', () => {
  const ws = loadWorkspace(FIXTURE);
  ws.state.entities['app.nul'] = null as never;

  const found = validate(ws, FIXTURE);
  assert.deepEqual(codes(found), ['entity.shape'], 'every other rule still ran');
  assert.equal(found[0].subject, 'app.nul');

  assert.deepEqual(childrenOf(ws.state, 'app'), ['app.api', 'app.db'], 'a broken record is not a child');
  assert.deepEqual(select(ws, 'app', 1).entities['app.nul'], undefined, 'and select leaves it out');
});

test('a scalar or an array where an entity belongs is caught the same way', () => {
  for (const broken of [null, 42, 'module', [], undefined]) {
    const ws = loadWorkspace(FIXTURE);
    ws.state.entities['app.bad'] = broken as never;
    assert.deepEqual(codes(validate(ws, FIXTURE)), ['entity.shape'], JSON.stringify(broken) ?? 'undefined');
  }
});

test('apply sees the file names context sees, so a mismatched view file blocks the write', () => {
  const dir = copy(FIXTURE);
  cpSync(join(dir, '.addone/views/app.map.json'), join(dir, '.addone/views/wrongname.json'));
  rmSync(join(dir, '.addone/views/app.map.json'));
  const before = snapshot(dir);

  const ws = loadWorkspace(dir);
  const applied = apply(ws, { op: 'set-view', view: { ...ws.views['app.map'], title: 'Renamed' } }, AT, dir);
  assert.deepEqual(codes(applied.diagnostics), ['view.file-mismatch']);
  assert.deepEqual(applied.writes, [], 'nothing is written');

  assert.throws(() => persist(dir, applied), /refused/);
  assert.deepEqual(snapshot(dir), before);
  assert.deepEqual(
    readdirSync(join(dir, '.addone/views')).sort(),
    ['app.api.flow.json', 'wrongname.json'],
    'the misnamed file stands alone: no app.map.json was written beside it',
  );
  rmSync(dir, { recursive: true, force: true });
});

test('a view whose file is named after its id still applies', () => {
  const dir = copy(FIXTURE);
  const ws = loadWorkspace(dir);
  const applied = apply(ws, { op: 'set-view', view: { ...ws.views['app.map'], title: 'Renamed' } }, AT, dir);
  assert.deepEqual(applied.diagnostics, []);
  persist(dir, applied);
  assert.equal(loadWorkspace(dir).views['app.map'].title, 'Renamed');
  rmSync(dir, { recursive: true, force: true });
});
