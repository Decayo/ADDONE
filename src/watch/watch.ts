/**
 * @arch.id     addone.core.watch
 * @arch.parent addone.core
 * @arch.role   module
 */
// Change under .addone/ triggers render and a browser reload. Glue, no logic.
import { todo } from '../todo.ts';

/**
 * INTERFACE.md section 5: the minimum loop.
 * fs.watch on .addone/ → debounce → cli render for every target → write .addone/.cache/render/
 * → tell the open browser to reload.
 * Slot options: this module, or Archify's `preview` (last-good live loop,
 * loopback only), or none. Only this module writes into .cache/render/.
 * TODO: fs.watch with a 200 ms debounce; reload by a tiny loopback server that the hud page polls.
 */
export function watch(root: string): void {
  return todo(`watch ${root}/.addone`);
}
