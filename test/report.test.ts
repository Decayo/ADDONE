import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Findings } from '../src/types.ts';
import { render, exitCode, worst } from '../src/report.ts';

/** One fixture covering all four row states, a row fix, and a group fix. */
const mixed: Findings = {
  root: '/repo',
  groups: [
    {
      title: 'machine',
      rows: [
        { label: 'node', detail: 'v26.5.0', state: 'ok' },
        {
          label: 'git',
          detail: 'not a repo',
          state: 'warn',
          degraded: 'branch and history are unavailable',
          fix: 'git init',
        },
      ],
    },
    {
      title: 'agent hosts',
      summary: '1 installed',
      rows: [
        { label: 'claude', detail: '2.1.251', state: 'ok' },
        { label: 'goose', detail: 'not installed', state: 'unknown' },
      ],
      fix: 'run the doctor skill to establish a hook field',
    },
    {
      title: 'editor',
      rows: [{ label: 'code', detail: 'crashed on --status', state: 'fail', fix: 'reinstall VS Code' }],
    },
  ],
  can: [{ label: 'doctor', detail: 'this report', state: 'ok' }],
};

const clean: Findings = {
  root: '/repo',
  groups: [{ title: 'machine', rows: [{ label: 'node', detail: 'v26.5.0', state: 'ok' }] }],
  can: [{ label: 'doctor', detail: 'this report', state: 'ok' }],
};

test('a group is as bad as its worst row, and unknown never fails one', () => {
  assert.equal(worst([]), 'ok');
  assert.equal(worst([{ label: 'a', state: 'ok' }]), 'ok');
  assert.equal(worst([{ label: 'a', state: 'ok' }, { label: 'b', state: 'unknown' }]), 'unknown');
  assert.equal(worst([{ label: 'a', state: 'unknown' }, { label: 'b', state: 'warn' }]), 'warn');
  assert.equal(worst([{ label: 'a', state: 'warn' }, { label: 'b', state: 'fail' }]), 'fail');
  assert.equal(worst([{ label: 'a', state: 'fail' }, { label: 'b', state: 'ok' }]), 'fail');
});

test('the report renders every state, both fix positions, and one padded column', () => {
  assert.equal(
    render(mixed),
    [
      'addone doctor · /repo',
      '',
      '[!] machine',
      '    ✓ node      v26.5.0',
      '    ! git       not a repo · branch and history are unavailable',
      '      → git init',
      '',
      '[?] agent hosts 1 installed',
      '    ✓ claude    2.1.251',
      '    ? goose     not installed',
      '    → run the doctor skill to establish a hook field',
      '',
      '[✗] editor',
      '    ✗ code      crashed on --status',
      '      → reinstall VS Code',
      '',
      'addone can do here',
      '    ✓ doctor    this report',
      '',
    ].join('\n'),
  );
});

test('a clean machine renders without any fix line', () => {
  assert.equal(
    render(clean),
    ['addone doctor · /repo', '', '[✓] machine', '    ✓ node      v26.5.0', '', 'addone can do here', '    ✓ doctor    this report', ''].join('\n'),
  );
});

test('colour marks each state and leaves the text alone, and off means no escape at all', () => {
  const painted = render(mixed, true);
  assert.ok(painted.includes('\x1b[32m✓\x1b[0m'), 'ok is green');
  assert.ok(painted.includes('\x1b[33m!\x1b[0m'), 'warn is yellow');
  assert.ok(painted.includes('\x1b[31m✗\x1b[0m'), 'fail is red');
  assert.ok(painted.includes('\x1b[90m?\x1b[0m'), 'unknown is grey, because nobody looked');
  assert.ok(painted.includes('\x1b[90m→ git init\x1b[0m'), 'a fix line is dim');
  assert.ok(painted.includes('v26.5.0'), 'the measured value is never painted');
  assert.ok(!render(mixed).includes('\x1b['), 'plain output carries no escape sequence');
});

test('colour changes nothing but the escapes', () => {
  // eslint-disable-next-line no-control-regex
  assert.equal(render(mixed, true).replace(/\x1b\[[0-9]+m/g, ''), render(mixed));
});

test('exit is 1 only when something is broken, never when something is merely absent or unknown', () => {
  assert.equal(exitCode(mixed), 1);
  assert.equal(exitCode(clean), 0);
  assert.equal(
    exitCode({ root: '/r', groups: [{ title: 'g', rows: [{ label: 'a', state: 'warn' }] }], can: [] }),
    0,
    'an absent capability is a warning, and a warning is not a failed run',
  );
  assert.equal(
    exitCode({ root: '/r', groups: [{ title: 'g', rows: [{ label: 'a', state: 'unknown' }] }], can: [] }),
    0,
    'nobody having looked is not a failure',
  );
  assert.equal(
    exitCode({ root: '/r', groups: [], can: [{ label: 'ascii', state: 'fail' }] }),
    1,
    'the closing block counts too',
  );
});
