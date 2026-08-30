/**
 * @arch.id     addone.core.scope
 * @arch.parent addone.core
 * @arch.role   guard
 */
// Turn a session's scope into allow or deny for one path. The hook entry point.
import type { Scope, Verdict } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * Decide one path against one scope.
 *   in write            → allow
 *   in requires_approval → deny, reason names the address and asks for expansion
 *   otherwise           → deny, reason names the active address
 * Globs are repo-relative; a path outside the repo is always deny.
 * No file IO here. The hook reads files; this decides.
 * TODO: minimal glob (** and *), no dependency.
 */
export function check(scope: Scope, path: string): Verdict {
  return todo(`check ${path} against ${scope.write.length} write globs`);
}
