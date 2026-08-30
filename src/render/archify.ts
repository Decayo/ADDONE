/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { View, SubState, Kind } from '../types.ts';
import { todo } from '../todo.ts';

/** Archify component types. Our kinds map onto them; nothing else is invented. */
const TYPE: Record<Kind, string> = {
  system: 'external', actor: 'external', module: 'backend', store: 'database',
  guard: 'security', surface: 'frontend', document: 'external',
};

/**
 * Emits Archify IR (schema_version 1) for one `map` view. JSON only: the HTML comes from
 * the Archify CLI (`deliver`), called by cli.ts, then `archify-append.ts` paints the second
 * layer. That keeps this module pure (invariant 2). Archify is an adapter ([R]).
 * Mapping, all one-to-one:
 *   view.nodes          → components  (label, sublabel = intent, tag = phase, row/col from the view)
 *   their parents       → boundaries  (kind region, wraps the nodes that share a parent)
 *   relations in scope  → connections (label = kind)
 *   anchors             → sources     (path + line; meta.repository pinned to HEAD, GitHub URL only)
 *   forbidden           → a FORBIDDEN card (Archify has no forbidden edge)
 * A view node missing from `sub.entities` is a diagnostic (dirty view), never a guess.
 * TODO: build the object; validate happens in the Archify CLI, not here.
 */
export function archify(view: View, sub: SubState): unknown {
  return todo(`archify IR for view ${view.id} (${Object.keys(TYPE).length} kinds)`);
}
