/**
 * Every measurement `doctor` makes. All the IO in the command lives here, and the only
 * thing that leaves is a `Findings`, which `report.ts` turns into text.
 *
 * The rule this file exists to obey: measure, never read a config and report it as a
 * fact. A binary is present when running it succeeds, not when a lookup finds a name.
 * `command -v continue` answers `continue` on a normal shell because it is a builtin,
 * so a PATH lookup reports a coding agent that is not there.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { release } from 'node:os';
import type { Findings, Group, Row } from './types.ts';
import { SILENT, type Watch } from './progress.ts';

interface Fact {
  value?: string;
  how: 'measured' | 'read' | 'unknown';
  when?: string;
  by?: string;
}
interface Host {
  id: string;
  name: string;
  binary: Fact;
  project: Fact;
  env: Fact;
  hook: Fact;
}

const HOSTS: Host[] = JSON.parse(readFileSync(join(import.meta.dirname, 'hosts.json'), 'utf8')).hosts;

/**
 * Three outcomes, never two. A binary that is not there and one that ran and failed are
 * different facts, and the report has to keep them apart: an absent capability is a
 * warning, a broken one is an error. Collapsing them puts a yellow mark on a crashed
 * install.
 *
 * Asynchronous so the probes run at once. Serially they took 4.9s on the author's
 * machine and three of them accounted for nearly all of it, so concurrency is worth more
 * here than any amount of animation.
 *
 * stdio is never inherited. A child that writes a deprecation notice to stderr would
 * otherwise tear the progress line apart.
 *
 * Exported for the timeout test, which needs a shorter deadline than any real probe.
 */
type Outcome = 'ok' | 'absent' | 'broken';

export function run(
  watch: Watch,
  command: string,
  args: string[],
  timeout = 10_000,
): Promise<{ outcome: Outcome; out: string }> {
  const finished = watch.start(command);
  return new Promise((resolve) => {
    // `detached` puts the child in its own process group. A probe that is a shell script
    // starts children of its own, and killing only the shell leaves them holding the
    // pipes: the report prints and then the process never exits. Measured with a script
    // that sleeps, before this line existed.
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let out = '';
    let settled = false;
    const settle = (outcome: Outcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      finished();
      resolve({ outcome, out: out.trim() });
    };
    const timer = setTimeout(() => {
      // Negative pid reaches the whole group, so a grandchild goes too.
      try {
        process.kill(-(child.pid as number), 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      settle('broken');
    }, timeout);
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.resume();
    child.on('error', (error) => settle((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : 'broken'));
    child.on('close', (code) => settle(code === 0 && out.trim().length > 0 ? 'ok' : 'broken'));
  });
}

function firstLine(text: string): string {
  return text.split('\n', 1)[0].trim();
}

/** The repo this report is about: the nearest directory at or above `from` holding `.git`. */
export function findRoot(from: string = process.cwd()): string {
  let at = resolve(from);
  for (;;) {
    if (existsSync(join(at, '.git'))) return at;
    const up = dirname(at);
    if (up === at) return resolve(from);
    at = up;
  }
}

async function machine(watch: Watch): Promise<Group> {
  const branch = await run(watch, 'git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const gitRow: Row =
    branch.outcome === 'ok'
      ? { label: 'git', detail: `repo on ${firstLine(branch.out)}`, state: 'ok' }
      : branch.outcome === 'absent'
        ? {
            label: 'git',
            detail: 'not installed',
            state: 'warn',
            degraded: 'addone has no history to read and cannot scope a session',
            fix: 'install git',
          }
        : {
            label: 'git',
            detail: 'not a git repo',
            state: 'warn',
            degraded: 'addone has no history to read and cannot scope a session',
            fix: 'git init',
          };
  return {
    title: 'machine',
    rows: [
      { label: 'os', detail: `${process.platform} ${release()}`, state: 'ok' },
      { label: 'node', detail: process.version, state: 'ok' },
      gitRow,
    ],
  };
}

/**
 * Three separate questions per host, never merged: does this machine have it, is this
 * repo configured for it, and are we running inside it right now. Installed but
 * unconfigured and configured but uninstalled are different situations.
 */
interface Seen {
  host: Host;
  installed: boolean;
  version: string;
  configured: boolean;
  inside: boolean;
}

async function probeHost(watch: Watch, host: Host, root: string): Promise<Seen> {
  const found = host.binary.value
    ? await run(watch, host.binary.value, ['--version'])
    : { outcome: 'absent' as const, out: '' };
  return {
    host,
    installed: found.outcome === 'ok',
    version: found.outcome === 'ok' ? firstLine(found.out) : '',
    configured: host.project.value !== undefined && existsSync(join(root, host.project.value)),
    inside: host.env.value !== undefined && process.env[host.env.value] !== undefined,
  };
}

function hostRow({ host, installed, version, configured, inside }: Seen): Row {
  const said = [
    installed
      ? version
      : host.binary.how === 'measured'
        ? 'not installed'
        : `no binary named "${host.binary.value}" here`,
  ];
  if (configured) said.push('configured in this repo');
  if (inside) said.push('this process is inside it');
  said.push(host.hook.value === undefined ? 'hook: ?' : `hook: ${host.hook.how} ${host.hook.when ?? ''}`.trimEnd());

  // A host we have established nothing about reads as unknown even when its binary is
  // here, because what init will need from it is the hook, not the version.
  const settled = host.hook.how !== 'unknown' && host.binary.how !== 'unknown';
  return { label: host.id, detail: said.join(' · '), state: settled ? 'ok' : 'unknown' };
}

async function hosts(watch: Watch, root: string): Promise<Group> {
  const seen = await Promise.all(HOSTS.map((host) => probeHost(watch, host, root)));
  const open = seen.filter(({ host }) => host.hook.how === 'unknown').length;
  const installed = seen.filter((one) => one.installed).length;
  return {
    title: 'agent hosts',
    summary: `${installed} installed, ${open} with an unestablished hook`,
    rows: seen.map(hostRow),
    fix: open === 0 ? undefined : 'run the doctor skill to establish one, then add it to src/hosts.json',
  };
}

/**
 * `code --status` answers with the running windows. Absent means addone degrades: it can
 * still report, it just cannot put a reader on a line. Broken means the install is there
 * and does not work, which is an error the reader can act on.
 */
async function editor(watch: Watch, root: string): Promise<Group> {
  const status = await run(watch, 'code', ['--status'], 20_000);
  if (status.outcome !== 'ok') {
    return {
      title: 'editor',
      rows: [
        status.outcome === 'absent'
          ? {
              label: 'code',
              detail: 'not installed',
              state: 'warn',
              degraded: 'addone cannot open a file at a line',
              fix: 'install VS Code, or put its `code` command on PATH',
            }
          : {
              label: 'code',
              detail: 'is here but --status failed',
              state: 'fail',
              fix: 'code --status  # read the error, then repair the install',
            },
      ],
    };
  }
  const version = status.out.split('\n').find((line) => line.startsWith('Version:')) ?? 'Version: unknown';
  const holds = status.out.split('\n').some((line) => line.startsWith('Process Argv:') && line.includes(root));
  return {
    title: 'editor',
    rows: [
      { label: 'code', detail: version.replace(/^Version:\s*/, ''), state: 'ok' },
      holds
        ? { label: 'window', detail: 'one was launched on this repo', state: 'ok' }
        : {
            label: 'window',
            detail: 'none is open on this repo',
            state: 'warn',
            degraded: 'a jump would have to open one first',
            fix: `code ${root}`,
          },
    ],
  };
}

async function browser(watch: Watch): Promise<Group> {
  const [preferred, opener] = await Promise.all([
    run(watch, 'xdg-settings', ['get', 'default-web-browser']),
    run(watch, 'xdg-open', ['--version']),
  ]);
  const defaultRow: Row =
    preferred.outcome === 'ok'
      ? { label: 'default', detail: firstLine(preferred.out), state: 'ok' }
      : preferred.outcome === 'absent'
        ? {
            label: 'default',
            detail: 'xdg-settings is not installed',
            state: 'warn',
            degraded: 'addone cannot tell which browser you use',
            fix: 'install xdg-utils',
          }
        : {
            label: 'default',
            detail: 'none is set',
            state: 'warn',
            degraded: 'a commit or issue link has nowhere to open',
            fix: 'xdg-settings set default-web-browser firefox.desktop',
          };
  const openerRow: Row =
    opener.outcome === 'ok'
      ? { label: 'xdg-open', detail: firstLine(opener.out), state: 'ok' }
      : opener.outcome === 'absent'
        ? {
            label: 'xdg-open',
            detail: 'not installed',
            state: 'warn',
            degraded: 'addone cannot hand a URL to the browser',
            fix: 'install xdg-utils',
          }
        : { label: 'xdg-open', detail: 'is here but failed to run', state: 'fail', fix: 'xdg-open --version  # read the error' };
  return { title: 'browser', rows: [defaultRow, openerRow] };
}

/**
 * The model file, not the directory. `.addone/` can survive as an empty `.cache/` after
 * the state is gone, and reporting the container as the thing is how a green check ends
 * up in front of a reader who has nothing.
 */
function state(root: string): Group {
  const model = join(root, '.addone', 'architecture.json');
  return {
    title: 'state',
    rows: [
      existsSync(model)
        ? { label: '.addone/', detail: 'architecture.json is here', state: 'ok' }
        : {
            label: '.addone/',
            detail: 'no architecture.json',
            state: 'warn',
            degraded: 'this repo has no architecture state, and nothing here writes one yet',
          },
    ],
  };
}

/** Only commands that are wired. Naming one that is not built is the habit this repo deleted. */
function can(): Row[] {
  return [{ label: 'doctor', detail: 'this report', state: 'ok' }];
}

/** Every group at once. The report's order is fixed here, not by which probe wins. */
export async function doctor(root: string = findRoot(), watch: Watch = SILENT): Promise<Findings> {
  const groups = await Promise.all([machine(watch), hosts(watch, root), editor(watch, root), browser(watch), state(root)]);
  return { root, groups, can: can() };
}
