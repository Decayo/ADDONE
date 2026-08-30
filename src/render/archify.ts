/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { SubState, Kind } from '../types.ts';
import { todo } from '../todo.ts';

/** Archify component types. Our kinds map onto them; nothing else is invented. */
const TYPE: Record<Kind, string> = {
  system: 'external', actor: 'external', module: 'backend', store: 'database',
  guard: 'security', surface: 'frontend', document: 'external',
};

/**
 * Emits JSON only. The HTML comes from the Archify CLI, called by cli.ts, which keeps this
 * module pure (invariant 2). Archify is an adapter, not part of the core.
 * Mapping, all one-to-one:
 *   leaf entities        → components  (label, sublabel = intent, tag = phase, row/col = layout)
 *   entities with kids   → boundaries  (kind region, wraps their leaf children)
 *   relations            → connections (label = kind)
 *   anchors              → sources     (path + line; meta.repository pinned to HEAD)
 *   forbidden            → a FORBIDDEN card (Archify has no forbidden edge)
 *   phase / open         → cards TODO · EXPLORE · LAST, and up to 5 meta.views
 * Layout is read from state (decision [N]); a leaf without layout is a diagnostic, not a guess.
 * TODO: build the object; validate happens in the Archify CLI, not here.
 */
export function archify(sub: SubState): unknown {
  return todo(`archify IR for ${sub.focus} (${Object.keys(TYPE).length} kinds)`);
}
