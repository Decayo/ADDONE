/**
 * @arch.id     addone.core.init
 * @arch.parent addone.core
 * @arch.role   module
 */
// Install ADDONE into a repo: walk the slots, write .addone/, place the skill and hooks.
import { todo } from '../todo.ts';

/**
 * `addone init [--yes]` in the repo at `cwd`, with the `install` slot set to project:
 *   1. walk the slots top-down; `--yes` takes every default; write .addone/config.json
 *   2. write .addone/architecture.json with one root entity named after the repo, and an
 *      empty map view for it under .addone/views/
 *   3. copy skill/ into .claude/skills/addone and .agents/skills/addone
 *   4. merge hooks/claude.settings.json into .claude/settings.json without clobbering
 *      existing hooks; write hooks/codex.hooks.json as .codex/hooks.json
 *   5. print what it did, and the one-line symlink command that puts `addone` on PATH;
 *      never write outside `cwd`
 * Idempotent: a second run changes nothing and says so. Returns the exit code.
 * TODO: ticket #3.
 */
export function init(args: string[], cwd: string): number {
  return todo(`init in ${cwd} (${args.length} args)`);
}
