/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { SubState } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * Fixed fields, fixed order, so an agent can rely on where each fact sits (section 16):
 *   ADDRESS · Intent · Parent · Children · Reads · Forbidden · Anchors · Scope · Status · Last
 * Absent facts are stated absent ("Anchors: none yet"), never omitted.
 * TODO: format SubState; keep under one screen at depth 1.
 */
export function agent(sub: SubState): string {
  return todo(`agent context for ${sub.focus}`);
}
