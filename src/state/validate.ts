/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import type { State, Diagnostic } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * Run every rule and return the diagnostics. An empty list means the state is sound.
 *
 * Errors (invariant 6 and referential integrity):
 *   - duplicate id, id not dotted under its parent, parent missing
 *   - relation or forbidden endpoint missing
 *   - anchors or scopes keyed by a missing address
 *   - exactly one root (parent null)
 *   - a view naming a node the model lacks: the view is dirty ([O]); a map with no layout for
 *     one of its nodes; an attached view without a body
 *   - a doc reference to a missing file
 * Smells (open a GRILL, never fail):
 *   - a parent with more than 12 children   (Archify's map limit; section 49 pressure)
 *   - an entity with a phase but no anchors once phase is past skeleton
 * Policies come later with rules.json; none in the first slice.
 */
export function validate(state: State): Diagnostic[] {
  return todo(`validate ${Object.keys(state.entities).length} entities`);
}
