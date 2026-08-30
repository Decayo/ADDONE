/**
 * @arch.id     addone.core.scope
 * @arch.parent addone.core
 * @arch.role   guard
 */
// Turn a session's scope into allow or deny for one path. The hook entry point.
import { todo } from '../todo.ts';

/**
 * `addone scope on <address>` starts guarding this session with the scope that applies to
 * `address` (the nearest ancestor with one); `addone scope off` stops. Session file under
 * .addone/.cache/ (invariant 5). Returns the exit code.
 * TODO: ticket #4.
 */
export function scopeCommand(args: string[], root: string): number {
  return todo(`scope ${args.join(' ')} in ${root}`);
}

/**
 * `addone check <path>` prints what the hook would decide for `path` right now: allow, or
 * deny with the reason. Exit 0 for allow, 2 for deny, so a shell can use it like the hook.
 * TODO: ticket #4.
 */
export function checkCommand(args: string[], root: string): number {
  return todo(`check ${args.join(' ')} in ${root}`);
}
