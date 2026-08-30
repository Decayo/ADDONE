/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import type { Workspace, Mutation, Diagnostic, Address, Last, Decision } from '../types.ts';
import { PATHS, carrySources } from './load.ts';
import { validate, isId, ID_SHAPE } from './validate.ts';

/** One file this mutation changes. `content: null` is a delete. Repo-relative, posix separators. */
export interface Write {
  path: string;
  content: string | null;
}

/**
 * What one mutation produced. It carries the whole workspace, not just the model, because
 * four ops (`set-view`, `remove-view`, `open-decision`, `settle-decision`) change an SSOT
 * that lives beside `architecture.json`, its own SSOT. `writes` holds the exact bytes, so the pure
 * half decides what a file should say and `persist` only does the IO.
 */
export type Applied = { workspace: Workspace; diagnostics: Diagnostic[]; writes: Write[] };

/** Section 42 change types, one per op. Topology is architecture, guards and decisions are policy. */
const CHANGE_TYPE: Record<Mutation['op'], Last['type']> = {
  'add-entity': 'architecture',
  'move-entity': 'architecture',
  'remove-entity': 'architecture',
  'add-relation': 'architecture',
  'remove-relation': 'architecture',
  'add-forbidden': 'architecture',
  'set-view': 'architecture',
  'remove-view': 'architecture',
  'set-scope': 'policy',
  'open-decision': 'policy',
  'settle-decision': 'policy',
  'set-phase': 'implementation',
  'set-anchors': 'implementation',
  'add-doc': 'implementation',
};

/** The shape persist writes: two-space indent, one trailing newline. */
function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function refuse(code: string, subject: Address | string, message: string): Diagnostic[] {
  return [{ code, severity: 'error', subject, message }];
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** What one op did, before `at` turns it into the LAST record. */
type Note = { address?: Address; what: string };
type Step = { workspace: Workspace; note: Note } | Diagnostic[];

// ── Shared preconditions ──────────────────────────────────────────────────────

function has(ws: Workspace, id: Address): boolean {
  return Object.hasOwn(ws.state.entities, id);
}

function requireEntity(ws: Workspace, id: Address): Diagnostic[] | null {
  return has(ws, id) ? null : refuse('mutation.entity-missing', id, `${id} is not in the model`);
}

/** An id becomes a file name under .addone/, so it is checked before any path is built. */
function requireViewId(id: string): Diagnostic[] | null {
  return isId(id) ? null : refuse('view.id-shape', id, `a view id looks like ${ID_SHAPE}, so it can be a file name`);
}

function requireDecisionId(id: string): Diagnostic[] | null {
  return isId(id)
    ? null
    : refuse('decision.id-shape', id, `a decision id looks like ${ID_SHAPE}, so it can be a file name`);
}

// ── Entities ──────────────────────────────────────────────────────────────────

/**
 * Re-address one entity and everything under it. A move is a rename: the address carries
 * the parent chain, so a node that changes parent changes address, and every reference to
 * it has to follow or the model stops being referentially sound.
 */
function readdressAll(workspace: Workspace, from: Address, to: Address): void {
  const next = (a: Address): Address =>
    a === from ? to : a.startsWith(`${from}.`) ? to + a.slice(from.length) : a;
  const rekey = <T>(record: Record<Address, T>): Record<Address, T> => {
    const out: Record<Address, T> = {};
    for (const key of Object.keys(record)) out[next(key)] = record[key];
    return out;
  };

  const state = workspace.state;
  const entities = rekey(state.entities);
  for (const id of Object.keys(entities)) {
    const parent = entities[id].parent;
    if (parent !== null) entities[id].parent = next(parent);
  }
  state.entities = entities;
  state.anchors = rekey(state.anchors);
  state.scopes = rekey(state.scopes);
  state.docs = rekey(state.docs);
  for (const relation of state.relations) {
    relation.from = next(relation.from);
    relation.to = next(relation.to);
  }
  for (const rule of state.forbidden) {
    rule.from = next(rule.from);
    rule.to = next(rule.to);
  }
  if (state.last?.address) state.last.address = next(state.last.address);

  for (const view of Object.values(workspace.views)) {
    view.address = next(view.address);
    if (view.nodes) view.nodes = rekey(view.nodes);
  }
  for (const decision of workspace.decisions) {
    if (decision.address) decision.address = next(decision.address);
  }
}

// ── One handler per op ────────────────────────────────────────────────────────

type Handler<K extends Mutation['op']> = (ws: Workspace, m: Extract<Mutation, { op: K }>) => Step;

/** Every op in the vocabulary has an entry here; the type makes leaving one out an error. */
const HANDLERS: { [K in Mutation['op']]: Handler<K> } = {
  // Entities
  'add-entity': (ws, { id, entity }) => {
    if (has(ws, id)) return refuse('mutation.entity-exists', id, `${id} is already in the model`);
    if (entity.parent !== null && !has(ws, entity.parent)) {
      return refuse('mutation.parent-missing', id, `parent ${entity.parent} is not in the model`);
    }
    ws.state.entities[id] = entity;
    const where = entity.parent === null ? 'as the root' : `under ${entity.parent}`;
    return { workspace: ws, note: { address: id, what: `add-entity ${id} (${entity.kind}) ${where}` } };
  },

  'move-entity': (ws, { id, parent }) => {
    const absent = requireEntity(ws, id);
    if (absent) return absent;
    if (!has(ws, parent)) return refuse('mutation.parent-missing', id, `parent ${parent} is not in the model`);
    if (parent === id || parent.startsWith(`${id}.`)) {
      return refuse('mutation.move-into-own-subtree', id, `${parent} is inside ${id}`);
    }
    if (ws.state.entities[id].parent === parent) {
      return refuse('mutation.no-op', id, `${id} already hangs on ${parent}`);
    }
    const to = `${parent}.${id.split('.').pop()}`;
    if (has(ws, to)) return refuse('mutation.entity-exists', to, `${to} is already in the model`);
    readdressAll(ws, id, to);
    ws.state.entities[to].parent = parent;
    return { workspace: ws, note: { address: to, what: `move-entity ${id} → ${to}` } };
  },

  'remove-entity': (ws, { id }) => {
    const absent = requireEntity(ws, id);
    if (absent) return absent;
    delete ws.state.entities[id];
    delete ws.state.anchors[id];
    delete ws.state.scopes[id];
    delete ws.state.docs[id];
    return { workspace: ws, note: { address: id, what: `remove-entity ${id}` } };
  },

  // Relations and forbidden edges: one object each, reviewed on its own (invariant 6)
  'add-relation': (ws, { relation }) => {
    const same = ws.state.relations.some(
      (r) => r.from === relation.from && r.to === relation.to && r.kind === relation.kind,
    );
    if (same) {
      return refuse(
        'mutation.relation-exists',
        relation.from,
        `${relation.from} → ${relation.to} (${relation.kind}) is already there`,
      );
    }
    ws.state.relations.push(relation);
    return {
      workspace: ws,
      note: { address: relation.from, what: `add-relation ${relation.from} → ${relation.to} (${relation.kind})` },
    };
  },

  'remove-relation': (ws, { relation }) => {
    const { from, to, kind } = relation;
    const matches = ws.state.relations.filter(
      (r) => r.from === from && r.to === to && (kind === undefined || r.kind === kind),
    );
    const named = kind === undefined ? '' : ` (${kind})`;
    if (matches.length === 0) return refuse('mutation.relation-missing', from, `no relation ${from} → ${to}${named}`);
    if (matches.length > 1) {
      const kinds = matches.map((r) => r.kind).join(', ');
      return refuse('mutation.relation-ambiguous', from, `${from} → ${to} carries ${kinds}: name the kind to remove`);
    }
    const gone = matches[0];
    ws.state.relations = ws.state.relations.filter((r) => r !== gone);
    return { workspace: ws, note: { address: from, what: `remove-relation ${from} → ${to} (${gone.kind})` } };
  },

  'add-forbidden': (ws, { forbidden }) => {
    const same = ws.state.forbidden.some(
      (f) => f.from === forbidden.from && f.to === forbidden.to && f.reason === forbidden.reason,
    );
    if (same) {
      return refuse('mutation.forbidden-exists', forbidden.from, `${forbidden.from} ✗ ${forbidden.to} is already there`);
    }
    ws.state.forbidden.push(forbidden);
    return {
      workspace: ws,
      note: { address: forbidden.from, what: `add-forbidden ${forbidden.from} ✗ ${forbidden.to}` },
    };
  },

  // Bookkeeping the agent maintains
  'set-phase': (ws, { id, phase }) => {
    const absent = requireEntity(ws, id);
    if (absent) return absent;
    const was = ws.state.entities[id].phase ?? 'none';
    ws.state.entities[id].phase = phase;
    return { workspace: ws, note: { address: id, what: `set-phase ${id} ${was} → ${phase}` } };
  },

  'set-scope': (ws, { id, scope }) => {
    const absent = requireEntity(ws, id);
    if (absent) return absent;
    ws.state.scopes[id] = scope;
    return { workspace: ws, note: { address: id, what: `set-scope ${id} (${plural(scope.write.length, 'write glob')})` } };
  },

  'set-anchors': (ws, { id, anchors }) => {
    const absent = requireEntity(ws, id);
    if (absent) return absent;
    ws.state.anchors[id] = anchors;
    return { workspace: ws, note: { address: id, what: `set-anchors ${id} (${plural(anchors.length, 'file')})` } };
  },

  'add-doc': (ws, { id, doc }) => {
    const absent = requireEntity(ws, id);
    if (absent) return absent;
    const here = ws.state.docs[id] ?? [];
    if (here.some((d) => serialize(d) === serialize(doc))) {
      return refuse('mutation.doc-exists', id, `${id} already points at ${doc.file}`);
    }
    ws.state.docs[id] = [...here, doc];
    return { workspace: ws, note: { address: id, what: `add-doc ${id} → ${doc.file}` } };
  },

  // Views: the diagram SSOT, never the model
  'set-view': (ws, { view }) => {
    const bad = requireViewId(view.id);
    if (bad) return bad;
    ws.views[view.id] = view;
    return {
      workspace: ws,
      note: { address: view.address, what: `set-view ${view.id} (${view.kind} ${view.type}) on ${view.address}` },
    };
  },

  // A view whose id on disk breaks ID_SHAPE cannot be removed through apply: delete the
  // file by hand, which the cli-only write path allows as a repair edit.
  'remove-view': (ws, { id }) => {
    const bad = requireViewId(id);
    if (bad) return bad;
    const view = ws.views[id];
    if (!view) return refuse('mutation.view-missing', id, `no view ${id}`);
    delete ws.views[id];
    return { workspace: ws, note: { address: view.address, what: `remove-view ${id}` } };
  },

  // Decisions: the wait list
  'open-decision': (ws, { decision }) => {
    const bad = requireDecisionId(decision.id);
    if (bad) return bad;
    if (ws.decisions.some((d) => d.id === decision.id)) {
      return refuse('mutation.decision-exists', decision.id, `decision ${decision.id} is already open`);
    }
    ws.decisions.push(decision);
    const on = decision.address ? ` on ${decision.address}` : '';
    return {
      workspace: ws,
      note: {
        ...(decision.address === undefined ? {} : { address: decision.address }),
        what: `open-decision ${decision.id}${on}: ${decision.question}`,
      },
    };
  },

  'settle-decision': (ws, { id, chosen, reason }) => {
    const bad = requireDecisionId(id);
    if (bad) return bad;
    const decision = ws.decisions.find((d) => d.id === id);
    if (!decision) return refuse('mutation.decision-missing', id, `no decision ${id}`);
    decision.status = 'settled';
    decision.chosen = chosen;
    decision.reason = reason;
    return {
      workspace: ws,
      note: {
        ...(decision.address === undefined ? {} : { address: decision.address }),
        what: `settle-decision ${id}: ${chosen}`,
      },
    };
  },
};

/**
 * Look the op up and run it on a copy. `Object.hasOwn` keeps the lookup off the prototype
 * chain, so `constructor` and `toString` are unknown ops like any other word, not a
 * function that throws once it runs.
 */
function step(workspace: Workspace, mutation: Mutation): Step {
  const op = (mutation as { op?: unknown })?.op;
  if (typeof op !== 'string' || !Object.hasOwn(HANDLERS, op)) {
    return refuse('mutation.unknown-op', String(op), `${String(op)} is not in the mutation vocabulary`);
  }
  const handler = HANDLERS[op as Mutation['op']] as Handler<Mutation['op']>;
  const next = structuredClone(workspace);
  carrySources(workspace, next);
  return handler(next, mutation);
}

// ── What reaches the disk ─────────────────────────────────────────────────────

/** Every file under .addone/ that says something different after the mutation. */
function changes(before: Workspace, after: Workspace): Write[] {
  const writes: Write[] = [];

  const model = serialize(after.state);
  if (model !== serialize(before.state)) writes.push({ path: PATHS.architecture, content: model });

  const viewPath = (id: string): string => `${PATHS.views}/${id}.json`;
  for (const id of Object.keys(after.views).sort()) {
    const text = serialize(after.views[id]);
    const was = before.views[id];
    if (!was || serialize(was) !== text) writes.push({ path: viewPath(id), content: text });
  }
  for (const id of Object.keys(before.views).sort()) {
    if (!after.views[id]) writes.push({ path: viewPath(id), content: null });
  }

  const index = (list: Decision[]): Map<string, Decision> => new Map(list.map((d) => [d.id, d]));
  const wasDecisions = index(before.decisions);
  const nowDecisions = index(after.decisions);
  const decisionPath = (id: string): string => `${PATHS.decisions}/${id}.json`;
  for (const [id, decision] of [...nowDecisions].sort(([a], [b]) => a.localeCompare(b))) {
    const text = serialize(decision);
    const was = wasDecisions.get(id);
    if (!was || serialize(was) !== text) writes.push({ path: decisionPath(id), content: text });
  }
  for (const id of [...wasDecisions.keys()].sort()) {
    if (!nowDecisions.has(id)) writes.push({ path: decisionPath(id), content: null });
  }

  return writes;
}

/**
 * Apply one mutation and return the new workspace plus what validate() says about it.
 * Pure: the caller (cli) decides whether to write it back.
 *
 * Steps:
 *   1. copy the workspace
 *   2. perform the op, through the handler table above
 *   3. set state.last: type from the op, address, and a one-line what
 *   4. validate; an error means the mutation is refused, the workspace comes back
 *      unchanged, and `writes` is empty, so nothing downstream can persist half of it
 *
 * `at` is injectable so a test can pin the timestamp; it defaults to now. `root` is passed
 * on to validate, so the rules that ask the filesystem (a doc must exist) also guard the
 * write path.
 */
export function apply(
  workspace: Workspace,
  mutation: Mutation,
  at: string = new Date().toISOString(),
  root?: string,
): Applied {
  const outcome = step(workspace, mutation);
  if (Array.isArray(outcome)) return { workspace, diagnostics: outcome, writes: [] };

  const { workspace: next, note } = outcome;
  next.state.last = { at, type: CHANGE_TYPE[mutation.op], ...note };

  const diagnostics = validate(next, root);
  if (diagnostics.some((d) => d.severity === 'error')) return { workspace, diagnostics, writes: [] };
  return { workspace: next, diagnostics, writes: changes(workspace, next) };
}

/**
 * Write the applied mutation into .addone/. The only writer. Refuses on any error
 * diagnostic, and refuses any path that resolves outside `<root>/.addone/`, so neither a
 * state that does not validate nor a crafted id can reach the disk.
 */
export function persist(root: string, applied: Applied): void {
  const errors = applied.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    const said = errors.map((e) => `${e.code} on ${e.subject}: ${e.message}`).join('; ');
    throw new Error(`refused, state would not validate: ${said}`);
  }

  // resolve() is textual: it does not follow symlinks. A symlinked .addone/ is written
  // through by design, and this gate guards crafted ids, not a hostile filesystem.
  const home = resolve(root, '.addone');
  for (const write of applied.writes) {
    const file = resolve(root, write.path);
    if (file !== home && !file.startsWith(home + sep)) {
      throw new Error(`refused, ${write.path} resolves outside ${home}`);
    }
    if (write.content === null) {
      rmSync(file, { force: true });
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, write.content);
  }
}
