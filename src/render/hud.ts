/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { SubState, Layer } from '../types.ts';
import { todo } from '../todo.ts';

/**
 * The window shell. It holds no state of its own; every panel is a parse of JSON.
 *   left    the tree of views: an address appears when it has a map or attached views; leaf
 *           boxes never appear; each row carries its subtree's open-decision count
 *   centre  tabs, one per opened view or doc: Map · Diagrams · Doc; a map is the appended
 *           Archify HTML in an iframe with ?embed=1, driven by #focus=<id>
 *   right   the second layer of the focused node: intent, phase, in / out, anchors with
 *           their colour and open link, docs, related views, commit and PR links; below
 *           it the changes column: wait list on top with a modal for detail, history below
 *   top     breadcrumb, the loop with the current phase marked, last change
 * Colours: last change green, todo yellow, open decision grey and semi-transparent.
 * Read-only, invariant 3. The only script is the postMessage bridge and tab switching.
 * TODO: template from prototypes/home-window/index.html and prototypes/poc-append/shell.html.
 */
export function hud(sub: SubState, layer: Layer, mapHref: string): string {
  return todo(`hud for ${sub.focus} embedding ${mapHref}`);
}
