/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import type { State, SubState, Address } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * Cut the slice one task needs: the focus node, its breadcrumb to the root, children to
 * `depth`, every relation and forbidden edge touching that set, their anchors, the scope
 * that applies (nearest ancestor with one), and last.
 *
 * depth 1 is the map a human sees; depth 3 is what an agent working inside gets.
 * TODO: walk parents up, children down, filter edges by membership, inherit scope.
 */
export function select(state: State, focus: Address, depth = 1): SubState {
  return todo(`select ${focus} depth ${depth}`);
}

/** Direct children of an address, sorted. Shared by select, render, and validate. */
export function childrenOf(state: State, parent: Address | null): Address[] {
  return todo(`childrenOf ${parent}`);
}
