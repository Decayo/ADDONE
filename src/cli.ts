#!/usr/bin/env node
/**
 * @arch.id     addone.core.cli
 * @arch.parent addone.core
 * @arch.role   surface
 */
// Entry points. Dispatch only.
import { todo } from './todo.ts';

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

export function main(argv: string[]): number {
  const [command] = argv;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  return todo(`dispatch ${command}`);
}

process.exitCode = main(process.argv.slice(2));
