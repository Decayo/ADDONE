/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import type { State, Config } from '../types.ts';
import { todo } from '../todo.ts';

/** Repo-relative locations. Decision [E]: one architecture file; [M]: config beside it. */
export const PATHS = {
  architecture: '.addone/architecture.json',
  config: '.addone/config.json',
  session: '.addone/.cache/session.json',
  render: '.addone/.cache/render/',
} as const;

/**
 * Read architecture.json and return it typed. Does not validate; validate() does.
 * TODO: readFileSync + JSON.parse; reject unknown top-level keys (invariant 1).
 */
export function load(root: string): State {
  return todo(`load ${PATHS.architecture} under ${root}`);
}

/** Read config.json. Missing file means init has not run: every slot unchosen. */
export function loadConfig(root: string): Config {
  return todo(`load ${PATHS.config} under ${root}`);
}
