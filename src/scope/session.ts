/**
 * @arch.id     addone.core.scope
 * @arch.parent addone.core
 * @arch.role   guard
 */
// Turn a session's scope into allow or deny for one path. The hook entry point.
import type { Session, Address } from '../types.ts';
import { todo } from '../todo.ts';

/** Start guarding: write .addone/.cache/session.json with the address and a timestamp. */
export function on(root: string, address: Address): Session {
  return todo(`session on ${address}`);
}

/** Stop guarding: remove the session file. A discussion session never has one. */
export function off(root: string): void {
  return todo('session off');
}

/** Read the current session, or null. The hook calls this first and allows everything on null. */
export function current(root: string): Session | null {
  return todo('session current');
}
