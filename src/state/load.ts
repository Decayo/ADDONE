/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { State, Config, Workspace, View, Decision, SlotName, Slot } from '../types.ts';

/** Repo-relative locations. Decision [E]: one architecture file; [M]: config beside it. */
export const PATHS = {
  architecture: '.addone/architecture.json',
  config: '.addone/config.json',
  views: '.addone/views',
  decisions: '.addone/decisions',
  session: '.addone/.cache/session.json',
  render: '.addone/.cache/render/',
} as const;

/** Invariant 1: the model has these keys and no others. An unknown key is not architecture. */
const MODEL_KEYS = [
  'version',
  'project',
  'entities',
  'relations',
  'forbidden',
  'anchors',
  'scopes',
  'docs',
  'last',
] as const;

const SLOT_NAMES: SlotName[] = [
  'host',
  'install',
  'stateMode',
  'writePath',
  'render',
  'watch',
  'enforce',
  'evidence',
  'open',
];

/**
 * The one place a parsed file becomes a shaped value. It proves the file holds an object
 * and nothing more: field types are validate()'s job, not the parser's.
 */
function asObject(value: unknown, file: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file} must hold one object`);
  }
  return value as Record<string, unknown>;
}

function readJson(file: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`cannot read ${file}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`);
  }
}

/**
 * Read architecture.json and return it typed. Does not validate; validate() does.
 * Unknown top-level keys are rejected here: what the model does not define is not
 * architecture (invariant 1). Missing collections default to empty so a trimmed file
 * still loads and validate can say what is wrong with it.
 *
 * Nothing this module returns is trusted. The types are a promise the parser makes and
 * `validate()` keeps: entity, relation, view and decision shape rules check every field
 * the cast below assumes. Call validate() before you believe a loaded workspace.
 */
export function load(root: string): State {
  const file = join(root, PATHS.architecture);
  const raw = asObject(readJson(file), file);
  const unknown = Object.keys(raw).filter((key) => !(MODEL_KEYS as readonly string[]).includes(key));
  if (unknown.length > 0) {
    throw new Error(`${file} has keys the model does not define: ${unknown.join(', ')}`);
  }
  // The one cast in this function, and it is a promise, not a check. validate() keeps it.
  const state = raw as unknown as State;
  return {
    version: state.version ?? 0,
    project: state.project,
    entities: state.entities ?? {},
    relations: state.relations ?? [],
    forbidden: state.forbidden ?? [],
    anchors: state.anchors ?? {},
    scopes: state.scopes ?? {},
    docs: state.docs ?? {},
    ...(state.last === undefined ? {} : { last: state.last }),
  };
}

/** Read config.json. Missing file means init has not run: every slot unchosen. */
export function loadConfig(root: string): Config {
  const file = join(root, PATHS.config);
  if (!existsSync(file)) {
    const slots = {} as Record<SlotName, Slot>;
    for (const name of SLOT_NAMES) slots[name] = { choice: '', options: [], progress: 'unchosen' };
    return { version: 0, slots };
  }
  // One cast at the boundary; the slot fields are read where they are used.
  return asObject(readJson(file), file) as unknown as Config;
}

/** Every `*.json` in one directory, in name order, with the file it came from. */
function readDir(dir: string): Array<{ file: string; value: unknown }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name: string) => name.endsWith('.json'))
    .sort()
    .map((file: string) => ({ file, value: readJson(join(dir, file)) }));
}

/** Which file each view and decision was read from, keyed by the id inside it. */
export interface Sources {
  views: Record<string, string>;
  decisions: Record<string, string>;
}

/**
 * The file names behind one loaded workspace. Kept beside the workspace instead of inside
 * it, so the model type stays the model and nothing serializes a path by accident. Only a
 * workspace that came from `loadWorkspace` has one: a copy made by `apply` has no files
 * yet, and the rule that reads this skips it.
 */
const SOURCES = new WeakMap<Workspace, Sources>();

export function sourcesOf(workspace: Workspace): Sources | undefined {
  return SOURCES.get(workspace);
}

/**
 * Hand the file names to a copy. `structuredClone` makes a new object, which no WeakMap
 * knows, so without this the rules that read file names would go quiet on the write path
 * and `apply` would see less than `context` does.
 */
export function carrySources(from: Workspace, to: Workspace): void {
  const sources = SOURCES.get(from);
  if (sources !== undefined) SOURCES.set(to, sources);
}

/**
 * The whole workspace: the model plus the SSOTs that own themselves ([O]).
 * A view keyed by its own `id`; decisions in file order. Missing `views/` or
 * `decisions/` means the project has none yet, not that the workspace is broken.
 */
export function loadWorkspace(root: string): Workspace {
  const sources: Sources = { views: {}, decisions: {} };

  const views: Record<string, View> = {};
  for (const { file, value } of readDir(join(root, PATHS.views))) {
    // One cast per collection. validate()'s viewShapes rule is what makes it good.
    const view = asObject(value, file) as unknown as View;
    views[view.id] = view;
    sources.views[view.id] = file;
  }

  const decisions: Decision[] = [];
  for (const { file, value } of readDir(join(root, PATHS.decisions))) {
    const decision = asObject(value, file) as unknown as Decision;
    decisions.push(decision);
    sources.decisions[decision.id] = file;
  }

  const workspace: Workspace = { state: load(root), views, decisions, config: loadConfig(root) };
  SOURCES.set(workspace, sources);
  return workspace;
}
