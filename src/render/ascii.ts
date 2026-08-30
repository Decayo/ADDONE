/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { SubState } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * Section 53: ASCII is a first-class projection.
 * Tree of the focus and its children with phase, relations as arrows, forbidden as ✗,
 * last change on the final line. Same facts as the HUD (invariant 4), fewer of them.
 * TODO: box drawing, one map per parent, never wider than 78.
 */
export function ascii(sub: SubState): string {
  return todo(`ascii for ${sub.focus}`);
}
