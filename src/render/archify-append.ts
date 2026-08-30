/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { Layer } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * Paint the second layer onto a delivered Archify HTML ([P]). Proven by POC-3:
 * prototypes/poc-append/append.mjs, 28/28, `archify check` unchanged at 9/9.
 *   status ring     own <rect data-addone-layer=ring> beside the c-<kind> rect, colour by phase
 *   anchor badge    own <circle data-addone-layer=anchor data-addone-anchor-state=match|drift>
 *   event bridge    dblclick on g[data-node-id] → postMessage({type:'node-open', id}) to the shell
 *   links           into the Semantic Passport when open directly; into our overlay panel under ?embed=1
 * Rules that bind it: every SVG element via createElementNS, never a literal "<svg" in the
 * payload (Archify's single_svg check counts raw text); runs as a separate step after every
 * `deliver`, output is a build product ([U]); exports never come from the appended page.
 * Pure: string in, string out. The shell decides what to do with events.
 * TODO: port append.mjs; take the runtime from prototypes/poc-append/runtime/.
 */
export function append(html: string, layer: Layer): string {
  return todo(`append layer with ${Object.keys(layer.phases).length} nodes`);
}
