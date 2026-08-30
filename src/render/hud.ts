/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { SubState } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * Left: tree with depth and phase. Centre: the map, an Archify HTML in an iframe.
 * Right: change rail. Top: breadcrumb and the loop with the current phase marked.
 * Colours: last change green, todo yellow, explore grey and semi-transparent by default.
 * Returns one static HTML page. No JavaScript beyond switching the iframe hash
 * (#focus=, #view=) and no editing (invariant 3). Tier 2 of the render slot.
 * TODO: template from prototypes/home-window/index.html, data from SubState.
 */
export function hud(sub: SubState, mapHref: string): string {
  return todo(`hud for ${sub.focus} embedding ${mapHref}`);
}
