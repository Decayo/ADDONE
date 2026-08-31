import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wantsProgress, SILENT } from '../src/progress.ts';

/** `wantsProgress` reads the environment, so each case restores what it changed. */
function withEnv(patch: Record<string, string | undefined>, body: () => void): void {
  const before = { ...process.env };
  Object.assign(process.env, patch);
  for (const [key, value] of Object.entries(patch)) if (value === undefined) delete process.env[key];
  try {
    body();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
}

/** The test runner pipes stdout, so isTTY is false and every case below is already off. */
test('animation is off wherever nobody is watching a terminal', () => {
  withEnv({ CI: undefined, TERM: 'xterm' }, () => {
    assert.equal(wantsProgress([]), process.stdout.isTTY === true);
    assert.equal(wantsProgress(['--json']), false, 'json is for a machine');
    assert.equal(wantsProgress(['--no-progress']), false, 'the flag wins');
  });
  withEnv({ CI: '1' }, () => assert.equal(wantsProgress([]), false, 'a CI log is a file'));
  withEnv({ CI: undefined, TERM: 'dumb' }, () => assert.equal(wantsProgress([]), false, 'a dumb terminal cannot rewrite a line'));
  withEnv({ CI: '0' }, () => assert.equal(wantsProgress([]), process.stdout.isTTY === true, 'CI=0 is not CI'));
});

test('SILENT hands back a finish function and keeps no state', () => {
  const finished = SILENT.start('anything');
  assert.equal(typeof finished, 'function');
  finished();
  finished();
});
