/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import { loadWorkspace } from '../state/load.ts';
import { select } from '../state/select.ts';
import { ascii } from './ascii.ts';
import { todo } from '../todo.ts';
import type { Workspace, Address } from '../types.ts';

// This file is the IO edge of render: it loads, selects, calls a pure projection, and
// writes or prints. The projections themselves (ascii.ts, archify.ts, hud.ts) stay pure.

/** One render target: what `addone render <target>` runs. Adding a target is one entry. */
type Target = (root: string, focus: Address, depth: number) => number;

/**
 * `addone render [target] [address] [depth]`. Targets:
 *   ascii    print the ascii block for the focus (default: root, depth 1)         ticket #6
 *   archify  IR → Archify deliver → append the second layer → .addone/.cache/render/  ticket #5
 *   hud      the shell page around the delivered map                                   ticket #5
 * No target means every target. Returns the exit code.
 */
export const TARGETS: Record<string, Target> = {
  ascii: (root, focus, depth) => {
    const workspace = loadWorkspace(root);
    process.stdout.write(ascii(select(workspace, focus, depth)));
    return 0;
  },
  archify: (root, focus, depth) => todo(`render archify for ${focus} depth ${depth} in ${root}`),
  hud: (root, focus, depth) => todo(`render hud for ${focus} depth ${depth} in ${root}`),
};

export function renderCommand(args: string[], root: string): number {
  return todo(`render ${args.join(' ')} in ${root}: dispatch over TARGETS`);
}

/**
 * `addone export <view> [json|png|svg]`: from the canonical artifact only, never the
 * appended page. json is the view file itself; png and svg come from the Archify CLI.
 * TODO: ticket #5.
 */
export function exportCommand(args: string[], root: string): number {
  return todo(`export ${args.join(' ')} in ${root}`);
}

/**
 * What `addone apply` prints after a successful persist: the ascii block of the node
 * the mutation touched, so the agent can paste it in chat. Pure: string in, string out.
 */
export function afterApply(workspace: Workspace, address: Address | undefined): string {
  if (address === undefined || !Object.hasOwn(workspace.state.entities, address)) return '';
  return ascii(select(workspace, address, 1));
}
