/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import type { State, Mutation, Diagnostic } from '../types.ts';
import { todo } from '../todo.ts';

export type Applied = { state: State; diagnostics: Diagnostic[] };

/**
 * Apply one mutation and return the new state plus what validate() says about it.
 * Pure: the caller (cli) decides whether to write it back.
 *
 * Steps:
 *   1. copy state
 *   2. perform the op (see Mutation in types.ts for the whole vocabulary)
 *   3. set state.last: type from the op (entity/relation → architecture, scope → policy,
 *      anchors → implementation), address, and a one-line what
 *   4. validate; an error diagnostic means the caller must not persist
 * TODO: one small function per op.
 */
export function apply(state: State, mutation: Mutation): Applied {
  return todo(`apply ${mutation.op}`);
}

/** Write state back to .addone/architecture.json. The only writer. Refuses on any error diagnostic. */
export function persist(root: string, applied: Applied): void {
  return todo(`persist to ${root}`);
}
