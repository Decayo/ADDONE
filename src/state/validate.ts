/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Workspace, Diagnostic, Address, Entity, Relation, View, Decision, State } from '../types.ts';
import { childrenOf, isEntityRecord } from './select.ts';
import { sourcesOf } from './load.ts';

/** Archify's map limit, and section 49's pressure threshold. */
const MAX_CHILDREN = 12;

/** Past these an entity is code, so it owes an anchor. */
const PAST_SKELETON = new Set(['implementing', 'reconciled']);

/** The unions in types.ts, at runtime. Invariant 6: each of these fields holds one of these. */
const KINDS = new Set(['system', 'actor', 'module', 'store', 'guard', 'surface', 'document']);
const PHASES = new Set(['architecture', 'skeleton', 'implementing', 'reconciled']);
const ASSURANCES = new Set(['low', 'standard', 'critical']);
const VIEW_KINDS = new Set(['map', 'attached']);
const DIAGRAM_TYPES = new Set(['architecture', 'sequence', 'lifecycle', 'dataflow', 'workflow']);
const DECISION_STATUS = new Set(['open', 'settled']);

/**
 * The shape a view id or a decision id must have. It becomes a file name under `.addone/`,
 * so anything that could climb out of that directory is not an id.
 */
export const ID_SHAPE = /^[a-z][a-z0-9.-]*$/;

export function isId(id: unknown): id is string {
  return typeof id === 'string' && ID_SHAPE.test(id);
}

function error(code: string, subject: Address | string, message: string): Diagnostic {
  return { code, severity: 'error', subject, message };
}

function smell(code: string, subject: Address | string, message: string): Diagnostic {
  return { code, severity: 'smell', subject, message };
}

function isText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function oneOf(value: unknown, allowed: Set<string>, field: string): string | null {
  return allowed.has(value as string) ? null : `${field} must be one of ${[...allowed].join(', ')}`;
}

// ── What each record must look like ───────────────────────────────────────────
// load() casts parsed JSON to these types without checking a single field. These four
// functions are where that cast is made good, so every rule below can read a record.

/** Every field of one entity that is not the single value invariant 6 asks for. */
export function entityProblems(entity: Entity): string[] {
  if (!isEntityRecord(entity)) return ['must be an object with kind, parent, and intent'];
  const said = [oneOf(entity?.kind, KINDS, 'kind')];
  if (!(entity?.parent === null || typeof entity?.parent === 'string')) said.push('parent must be an address or null');
  if (!isText(entity?.intent)) said.push('intent must be one sentence');
  if (entity?.phase !== undefined) said.push(oneOf(entity.phase, PHASES, 'phase'));
  if (entity?.assurance !== undefined) said.push(oneOf(entity.assurance, ASSURANCES, 'assurance'));
  return said.filter((s): s is string => s !== null);
}

/** A relation is one object with both ends and a named kind. Invariant 6. */
export function relationProblems(relation: Relation): string[] {
  const said: string[] = [];
  if (!isText(relation?.from)) said.push('from must be an address');
  if (!isText(relation?.to)) said.push('to must be an address');
  if (!isText(relation?.kind)) said.push('kind must say what the edge is');
  return said;
}

/** A view names its kind, its diagram type, the node it hangs on, and a title. */
export function viewProblems(view: View): string[] {
  const said = [oneOf(view?.kind, VIEW_KINDS, 'kind'), oneOf(view?.type, DIAGRAM_TYPES, 'type')];
  if (!isText(view?.address)) said.push('address must be the node the view hangs on');
  if (!isText(view?.title)) said.push('title must say what the diagram shows');
  return said.filter((s): s is string => s !== null);
}

/** An open decision is a question with an id, a feature, and a status. */
export function decisionProblems(decision: Decision): string[] {
  const said = [oneOf(decision?.status, DECISION_STATUS, 'status')];
  if (!isText(decision?.id)) said.push('id must name the decision');
  if (!isText(decision?.feature)) said.push('feature must say what this decision belongs to');
  if (!isText(decision?.question)) said.push('question must be the question asked');
  return said.filter((s): s is string => s !== null);
}

/** Ids whose record is sound. A broken record is reported once, then left out of the rest. */
function soundEntities(state: State): Address[] {
  return Object.keys(state.entities)
    .sort()
    .filter((id) => entityProblems(state.entities[id]).length === 0);
}

function soundViews(views: Record<string, View>): string[] {
  return Object.keys(views)
    .sort()
    .filter((id) => isId(id) && viewProblems(views[id]).length === 0);
}

// ── One rule per line of the contract ─────────────────────────────────────────

export type Rule = (workspace: Workspace, root?: string) => Diagnostic[];

export function entityShape({ state }: Workspace): Diagnostic[] {
  return Object.keys(state.entities)
    .sort()
    .flatMap((id) => {
      const said = entityProblems(state.entities[id]);
      return said.length === 0 ? [] : [error('entity.shape', id, said.join('; '))];
    });
}

export function oneRoot({ state }: Workspace): Diagnostic[] {
  const roots = soundEntities(state).filter((id) => state.entities[id].parent === null);
  if (roots.length === 1) return [];
  const found = roots.length === 0 ? '' : `: ${roots.join(', ')}`;
  return [error('root.not-one', 'entities', `the model needs exactly one root, found ${roots.length}${found}`)];
}

export function parentChain({ state }: Workspace): Diagnostic[] {
  return soundEntities(state).flatMap((id) => {
    const parent = state.entities[id].parent;
    if (parent === null) return [];
    if (!Object.hasOwn(state.entities, parent)) {
      return [error('entity.parent-missing', id, `parent ${parent} is not in the model`)];
    }
    if (!id.startsWith(`${parent}.`) || id.slice(parent.length + 1).includes('.')) {
      return [error('entity.parent-mismatch', id, `id is not one segment under its parent ${parent}`)];
    }
    return [];
  });
}

export function relationShape({ state }: Workspace): Diagnostic[] {
  return state.relations.flatMap((relation) => {
    const said = relationProblems(relation);
    return said.length === 0 ? [] : [error('relation.shape', relation?.from ?? 'relations', said.join('; '))];
  });
}

export function endpointsExist({ state }: Workspace): Diagnostic[] {
  const has = (id: Address): boolean => Object.hasOwn(state.entities, id);
  const edges = state.relations
    .filter((r) => relationProblems(r).length === 0 && !(has(r.from) && has(r.to)))
    .map((r) =>
      error('relation.endpoint-missing', r.from, `relation ${r.from} → ${r.to} (${r.kind}) names an address the model lacks`),
    );
  const rules = state.forbidden
    .filter((f) => !(has(f.from) && has(f.to)))
    .map((f) => error('forbidden.endpoint-missing', f.from, `forbidden ${f.from} ✗ ${f.to} names an address the model lacks`));
  return [...edges, ...rules];
}

export function keyedByKnownAddress({ state }: Workspace): Diagnostic[] {
  const has = (id: Address): boolean => Object.hasOwn(state.entities, id);
  const missing = (record: Record<Address, unknown>, code: string, what: string): Diagnostic[] =>
    Object.keys(record)
      .sort()
      .filter((id) => !has(id))
      .map((id) => error(code, id, `${what} is keyed by an address the model lacks`));
  return [
    ...missing(state.anchors, 'anchors.address-missing', 'anchors'),
    ...missing(state.scopes, 'scopes.address-missing', 'a scope'),
    ...missing(state.docs, 'docs.address-missing', 'a doc'),
  ];
}

/** Markdown is auxiliary, but a link that points at nothing is still an error. */
export function docFilesExist({ state }: Workspace, root?: string): Diagnostic[] {
  if (root === undefined) return [];
  return Object.keys(state.docs)
    .sort()
    .filter((id) => Object.hasOwn(state.entities, id))
    .flatMap((id) =>
      state.docs[id]
        .filter((doc) => !existsSync(join(root, doc.file)))
        .map((doc) => error('docs.file-missing', id, `doc ${doc.file} is not in the repo`)),
    );
}

export function viewShapes({ views }: Workspace): Diagnostic[] {
  return Object.keys(views)
    .sort()
    .flatMap((id) => {
      if (!isId(id)) return [error('view.id-shape', id, `a view id looks like ${ID_SHAPE}, so it can be a file name`)];
      const said = viewProblems(views[id]);
      return said.length === 0 ? [] : [error('view.shape', id, said.join('; '))];
    });
}

/** A view never adds topology. One that names a node the model lost is dirty. */
export function viewsClean({ state, views }: Workspace): Diagnostic[] {
  const has = (id: Address): boolean => Object.hasOwn(state.entities, id);
  return soundViews(views).flatMap((id) => {
    const view = views[id];
    const out: Diagnostic[] = [];
    if (!has(view.address)) {
      out.push(error('view.address-missing', id, `view hangs on ${view.address}, which the model lacks`));
    }
    for (const node of Object.keys(view.nodes ?? {})) {
      if (!has(node)) {
        out.push(error('view.node-missing', id, `view names ${node}, which the model lacks: the view is dirty`));
        continue;
      }
      const at = view.nodes?.[node];
      if (view.kind === 'map' && (!at || typeof at.row !== 'number' || typeof at.col !== 'number')) {
        out.push(error('view.node-unplaced', id, `map has no row and col for ${node}`));
      }
    }
    if (view.kind === 'attached' && !view.body) {
      out.push(error('view.body-missing', id, 'an attached view carries its own body'));
    }
    return out;
  });
}

export function decisionShapes({ decisions }: Workspace): Diagnostic[] {
  return decisions.flatMap((decision) => {
    if (!isId(decision?.id)) {
      return [error('decision.id-shape', String(decision?.id), `a decision id looks like ${ID_SHAPE}, so it can be a file name`)];
    }
    const said = decisionProblems(decision);
    return said.length === 0 ? [] : [error('decision.shape', decision.id, said.join('; '))];
  });
}

export function decisionsAddressed({ state, decisions }: Workspace): Diagnostic[] {
  return decisions
    .filter((d) => isId(d?.id) && decisionProblems(d).length === 0)
    .filter((d) => d.address !== undefined && !Object.hasOwn(state.entities, d.address))
    .map((d) => error('decision.address-missing', d.id, `decision hangs on ${d.address}, which the model lacks`));
}

/**
 * One file, one id. Only a workspace that came off the disk carries its file names, and
 * `apply` hands them to its copy, so this rule guards the write path too. An id that has
 * since left the workspace is not checked: its file is on its way out.
 */
export function filesNamedAfterIds(workspace: Workspace): Diagnostic[] {
  const sources = sourcesOf(workspace);
  if (sources === undefined) return [];
  const mismatched = (
    record: Record<string, string>,
    present: Set<string>,
    code: string,
    what: string,
  ): Diagnostic[] =>
    Object.entries(record)
      .filter(([id, file]) => present.has(id) && file !== `${id}.json`)
      .map(([id, file]) => error(code, id, `${what} ${id} was read from ${file}, not ${id}.json`));
  return [
    ...mismatched(sources.views, new Set(Object.keys(workspace.views)), 'view.file-mismatch', 'view'),
    ...mismatched(sources.decisions, new Set(workspace.decisions.map((d) => d?.id)), 'decision.file-mismatch', 'decision'),
  ];
}

/** Section 49 pressure: a signal, not a verdict. */
export function fanOut({ state }: Workspace): Diagnostic[] {
  return [null, ...soundEntities(state)]
    .map((id) => ({ id, count: childrenOf(state, id).length }))
    .filter(({ count }) => count > MAX_CHILDREN)
    .map(({ id, count }) =>
      smell('entity.fan-out', id ?? 'entities', `${count} children, more than the ${MAX_CHILDREN} a map holds`),
    );
}

export function anchorsPastSkeleton({ state }: Workspace): Diagnostic[] {
  return soundEntities(state)
    .filter((id) => {
      const phase = state.entities[id].phase;
      return phase !== undefined && PAST_SKELETON.has(phase) && (state.anchors[id] ?? []).length === 0;
    })
    .map((id) => smell('entity.anchors-missing', id, `phase is ${state.entities[id].phase} but no anchor says where the code is`));
}

/**
 * Every rule, in reporting order. Adding a rule is adding one entry; each one is a named
 * function that can be called on its own in a test.
 */
export const RULES: Rule[] = [
  entityShape,
  oneRoot,
  parentChain,
  relationShape,
  endpointsExist,
  keyedByKnownAddress,
  docFilesExist,
  viewShapes,
  viewsClean,
  decisionShapes,
  decisionsAddressed,
  filesNamedAfterIds,
  fanOut,
  anchorsPastSkeleton,
];

/**
 * Run every rule and return the diagnostics. An empty list means the state is sound.
 *
 * Takes the whole workspace because views and decisions are their own SSOTs, and
 * several rules cross the line between them and the model. `root` is the repo root: give
 * it and the rules that ask the filesystem run, leave it out and validate stays pure.
 *
 * Errors are invariant 6 and referential integrity; smells open a GRILL and never fail.
 * Policies come later with rules.json; none in the first slice. A duplicate id cannot
 * survive JSON.parse, so `apply` is where that rule runs.
 */
export function validate(workspace: Workspace, root?: string): Diagnostic[] {
  return RULES.flatMap((rule) => rule(workspace, root));
}
