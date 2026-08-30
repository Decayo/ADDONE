import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { loadWorkspace } from '../src/state/load.ts';
import { select } from '../src/state/select.ts';
import { agent } from '../src/render/agent.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const CLI = join(REPO, 'src/cli.ts');
const GOLDEN = join(HERE, 'fixtures/context.addone.core.scope.1.txt');

/** Run the cli the way a host would, on this repo's own .addone/. */
function run(...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO, encoding: 'utf8' });
}

test('addone context addone.core.scope 1 matches the golden block', () => {
  const out = run('context', 'addone.core.scope', '1');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stderr, '', 'the live model has nothing wrong with it');
  assert.equal(out.stdout, readFileSync(GOLDEN, 'utf8'));
});

test('the golden is what render.agent makes of the committed state, with no cli in the way', () => {
  const block = agent(select(loadWorkspace(REPO), 'addone.core.scope', 1));
  assert.equal(block, readFileSync(GOLDEN, 'utf8'));
});

test('the block keeps its fields in the order an agent can rely on', () => {
  const labels = readFileSync(GOLDEN, 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z]/.test(line))
    .map((line) => line.slice(0, line.indexOf(':')));
  assert.deepEqual(labels, [
    'ADDRESS',
    'Intent',
    'Parent',
    'Children',
    'Reads',
    'Read by',
    'Forbidden',
    'Anchors',
    'Docs',
    'Views',
    'Open',
    'Scope',
    'Status',
    'Last',
  ]);
});

test('an absent fact is stated absent, never left out', () => {
  const block = run('context', 'addone.core.scope', '1').stdout;
  assert.match(block, /^Children: none$/m, 'a leaf still has a Children line');
  assert.match(block, /^Docs: none$/m);
  assert.match(block, /^Views: none$/m);
  assert.match(block, /^Open: none$/m);
});

test('depth decides how much of the subtree the block shows', () => {
  const zero = run('context', 'addone.core', '0').stdout;
  assert.match(zero, /^Children: none$/m, 'depth 0 is the node on its own');

  const one = run('context', 'addone.core', '1').stdout;
  assert.match(one, /^Children:\n {2}addone\.core\.cli \(surface, skeleton\)$/m);
  assert.ok(one.includes('addone.core.state (store, skeleton)'));
  assert.ok(!one.includes('addone.host.skill'), 'a sibling branch stays out');

  const deep = run('context', 'addone', '2').stdout;
  assert.match(deep, /^ {2}addone\.core \(system, no phase\)$/m);
  assert.match(deep, /^ {4}addone\.core\.cli \(surface, skeleton\)$/m, 'a grandchild indents one more step');
});

test('Reads is outgoing only, and an inbound edge is Read by', () => {
  const leaf = run('context', 'addone.core.scope', '1').stdout;
  assert.match(leaf, /^Reads: addone\.core\.scope → addone\.core\.state \(reads\)$/m);
  assert.match(leaf, /^Read by: addone\.host\.hooks → addone\.core\.scope \(PreToolUse\)$/m);

  const branch = run('context', 'addone.core', '1').stdout;
  const reads = branch.slice(branch.indexOf('Reads:'), branch.indexOf('Read by:'));
  assert.ok(reads.includes('addone.core.cli → addone.core.state (apply)'), 'an edge inside the subtree is a read');
  assert.ok(reads.includes('addone.core.watch → addone.core.render (triggers)'));
  const readBy = branch.slice(branch.indexOf('Read by:'), branch.indexOf('Forbidden:'));
  assert.ok(readBy.includes('addone.host.hosts → addone.core.cli (runs)'), 'an edge from outside is inbound');
  assert.ok(!reads.includes('addone.host.hosts'), 'and never appears as one the subtree owns');
});

test('the world map view and its title reach the block that owns it', () => {
  const root = run('context', 'addone', '1').stdout;
  assert.match(root, /^Views: addone\.map \(map architecture\) — ADDONE · world map$/m);
  assert.match(root, /^Docs:\n {2}docs\/archive\/ADDONE\.md$/m);
  assert.match(root, /^Parent: none \(the root\)$/m);
});

test('the scope a node inherits is the nearest one up the chain', () => {
  const block = run('context', 'addone.core.render', '1').stdout;
  assert.match(block, /^Scope:\n {2}write: src\/\*\*, hooks\/\*\*, skill\/\*\*, \.addone\/\*\*$/m);
});

test('context refuses an address the model does not have', () => {
  const out = run('context', 'addone.nope');
  assert.equal(out.status, 1);
  assert.equal(out.stdout, '');
  assert.match(out.stderr, /addone\.nope is not in the model/);
});

test('context needs an address, and a depth that is a whole number', () => {
  assert.equal(run('context').status, 1);
  assert.match(run('context').stderr, /addone context <address> \[depth\]/);
  assert.match(run('context', 'addone', 'deep').stderr, /whole number/);
});

test('no command prints the usage, and an unwired one still says TODO', () => {
  const usage = run();
  assert.equal(usage.status, 0);
  assert.match(usage.stdout, /^addone <command>/);

  const later = run('watch');
  assert.notEqual(later.status, 0);
  assert.match(later.stderr, /TODO: dispatch watch/);
});

test('importing the cli runs nothing: main is guarded by the entry point', () => {
  const imported = spawnSync(
    process.execPath,
    ['-e', `await import(${JSON.stringify(CLI)});`],
    { cwd: REPO, encoding: 'utf8' },
  );
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, '', 'no usage block leaks out of an import');
  assert.equal(imported.stderr, '');
});

test('a broken entity does not stop the block from printing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'addone-broken-'));
  cpSync(join(REPO, '.addone'), join(dir, '.addone'), { recursive: true });
  const file = join(dir, '.addone/architecture.json');
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  raw.entities['addone.core.nul'] = null;
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);

  const out = spawnSync(process.execPath, [CLI, 'context', 'addone.core', '1'], { cwd: dir, encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /^ADDRESS: addone\.core$/m, 'the block still prints');
  assert.match(out.stdout, /^ {2}addone\.core\.state \(store, skeleton\)$/m, 'and the sound children are all there');
  assert.ok(!out.stdout.includes('addone.core.nul'), 'the broken record is not drawn as a child');
  assert.match(out.stderr, /error: entity\.shape on addone\.core\.nul/, 'and the reason is on stderr');
  rmSync(dir, { recursive: true, force: true });
});

test('dispatch is a table: wired, planned, and unknown each have one answer', () => {
  const unknown = run('bogus');
  assert.equal(unknown.status, 1);
  assert.equal(unknown.stdout, '', 'an error keeps stdout clean');
  assert.match(unknown.stderr, /^addone: no command bogus$/m);
  assert.match(unknown.stderr, /addone <command>/, 'and the usage follows');

  for (const planned of ['init', 'render', 'export', 'watch', 'scope', 'check']) {
    const out = run(planned);
    assert.notEqual(out.status, 0, planned);
    assert.match(out.stderr, new RegExp(`TODO: dispatch ${planned}`), planned);
  }

  for (const member of ['constructor', 'toString', 'hasOwnProperty']) {
    const out = run(member);
    assert.equal(out.status, 1, member);
    assert.match(out.stderr, new RegExp(`no command ${member}`), `${member} is a word, not a function to call`);
  }
});
