#!/usr/bin/env node
/**
 * @arch.id     addone.core.cli
 * @arch.parent addone.core
 * @arch.role   surface
 */
// Entry points. Dispatch only.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Mutation, Diagnostic } from './types.ts';
import { loadWorkspace, PATHS } from './state/load.ts';
import { validate } from './state/validate.ts';
import { select } from './state/select.ts';
import { apply, persist } from './state/apply.ts';
import { agent } from './render/agent.ts';
import { init } from './init/init.ts';
import { scopeCommand, checkCommand } from './scope/commands.ts';
import { renderCommand, exportCommand } from './render/commands.ts';
import { watch } from './watch/watch.ts';

// Run directly: `node src/cli.ts <command>`. No build step (decision [D]).
const USAGE = `addone <command>

  init                      walk the slots top-down, write .addone/config.json      (skill: init)
  context <address> [depth] print the agent CONTEXT block                           (state.select → render.agent)
  render [ascii|archify|hud] write projections to .addone/.cache/render/            (state.select → render.*; archify: deliver, then append)
  export <view> [json|png|svg] export one view from the canonical artifact          (decision [U]; never the appended page)
  watch                     re-render on change                                     (watch.watch)
  apply <mutation.json>     change state through the only write path               (state.apply → persist)
  scope on <address> | off  start or stop guarding this session                    (scope.session)
  check <path>              what the hook would say right now                       (scope.check)
`;

/**
 * The repo the command works on: `ADDONE_ROOT` when it is set, else the nearest directory
 * at or above the cwd that holds a `.addone/`. A tool run from a subdirectory still finds
 * the state, and a test can point one run at a throwaway copy.
 */
function findRoot(start: string = process.cwd()): string {
  const forced = process.env.ADDONE_ROOT;
  if (forced) return resolve(forced);
  let at = resolve(start);
  for (;;) {
    if (existsSync(join(at, PATHS.architecture))) return at;
    const up = dirname(at);
    if (up === at) throw new Error(`no ${PATHS.architecture} here or above ${start}`);
    at = up;
  }
}

function report(diagnostics: Diagnostic[]): void {
  for (const d of diagnostics) {
    process.stderr.write(`${d.severity}: ${d.code} on ${d.subject}: ${d.message}\n`);
  }
}

/** `context <address> [depth]`: the block an agent reads instead of grepping the repo. */
function context(args: string[]): number {
  const [address, rawDepth] = args;
  if (!address) {
    process.stderr.write('addone context <address> [depth]\n');
    return 1;
  }
  const depth = rawDepth === undefined ? 1 : Number(rawDepth);
  if (!Number.isInteger(depth) || depth < 0) {
    process.stderr.write(`depth must be a whole number, got ${rawDepth}\n`);
    return 1;
  }
  const root = findRoot();
  const workspace = loadWorkspace(root);
  // A read never fails on a dirty model, but it says so on stderr and leaves stdout clean.
  report(validate(workspace, root).filter((d) => d.severity === 'error'));
  process.stdout.write(agent(select(workspace, address, depth)));
  return 0;
}

/** `apply <mutation.json>`: the only write path ([H]). Validates, then persists, or refuses. */
function applyMutation(args: string[]): number {
  const [file] = args;
  if (!file) {
    process.stderr.write('addone apply <mutation.json>\n');
    return 1;
  }
  const mutation = JSON.parse(readFileSync(resolve(file), 'utf8')) as Mutation;
  const root = findRoot();
  // root reaches validate, so the rules that ask the filesystem also guard the write path.
  const applied = apply(loadWorkspace(root), mutation, undefined, root);

  if (applied.diagnostics.some((d) => d.severity === 'error')) {
    report(applied.diagnostics);
    process.stderr.write('refused: nothing was written\n');
    return 1;
  }
  persist(root, applied);
  report(applied.diagnostics);
  process.stdout.write(`${applied.workspace.state.last?.what}\n`);
  return 0;
}

/**
 * Every wired command, one entry each. A ticket that adds a command adds one line here and
 * leaves `main` alone.
 */
/** One entry per command. A ticket implements the function it points at; this table is final. */
const COMMANDS: Record<string, (args: string[]) => number> = {
  context,
  apply: applyMutation,
  init: (args) => init(args, process.cwd()),
  render: (args) => renderCommand(args, findRoot()),
  export: (args) => exportCommand(args, findRoot()),
  watch: () => {
    watch(findRoot());
    return 0;
  },
  scope: (args) => scopeCommand(args, findRoot()),
  check: (args) => checkCommand(args, findRoot()),
};

export function main(argv: string[]): number {
  const [command, ...args] = argv;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  // hasOwn, so `constructor` and `toString` are unknown words, not something to call.
  if (Object.hasOwn(COMMANDS, command)) {
    try {
      return COMMANDS[command](args);
    } catch (error) {
      process.stderr.write(`addone: ${(error as Error).message}\n`);
      return 1;
    }
  }
  process.stderr.write(`addone: no command ${command}\n${USAGE}`);
  return 1;
}

// Only when this file is what node was asked to run. Importing it (a test, a future
// embedding) defines main and does nothing else.
if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
