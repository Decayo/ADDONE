import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/doctor.ts';
import { SILENT } from '../src/progress.ts';

/**
 * A shell script whose real work is a child of its own. Killing the script alone leaves
 * that child holding the pipes, which kept the whole command alive long after the report
 * was printed. This test hangs the runner if that regression comes back.
 */
function hangingProbe(): string {
  const dir = mkdtempSync(join(tmpdir(), 'addone-probe-'));
  const script = join(dir, 'hang');
  writeFileSync(script, '#!/bin/sh\n/usr/bin/sleep 60\n');
  chmodSync(script, 0o755);
  return script;
}

test('a probe that hangs is broken, not fatal, and its whole process group goes', async () => {
  const started = Date.now();
  const { outcome } = await run(SILENT, hangingProbe(), [], 300);
  assert.equal(outcome, 'broken', 'a probe that never answers is broken, not absent');
  assert.ok(Date.now() - started < 5_000, `took ${Date.now() - started} ms, so the deadline did not hold`);
});

test('a binary that is not there is absent, and one that fails is broken', async () => {
  assert.equal((await run(SILENT, 'addone-definitely-not-a-real-binary', ['--version'])).outcome, 'absent');
  assert.equal((await run(SILENT, 'sh', ['-c', 'exit 3'])).outcome, 'broken');
  assert.equal((await run(SILENT, 'sh', ['-c', 'echo hello'])).outcome, 'ok');
  assert.equal((await run(SILENT, 'sh', ['-c', 'exit 0'])).outcome, 'broken', 'exit 0 with no output answered nothing');
});
