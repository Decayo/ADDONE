/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
// Read, validate, select, and apply. The only module that touches .addone/.
import type { State, SubState, Address, Workspace, View, ViewId, Entity, Anchor, DocRef, Scope } from '../types.ts';

/**
 * Whether one value survived JSON.parse as something an entity could be. `null`, a scalar
 * and an array are not entities: validate reports them once, and every walk skips them so
 * one broken record cannot crash a rule that runs later.
 */
export function isEntityRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Direct children of an address, sorted. Shared by select, render, and validate. */
export function childrenOf(state: State, parent: Address | null): Address[] {
  return Object.keys(state.entities)
    .filter((id) => isEntityRecord(state.entities[id]) && state.entities[id].parent === parent)
    .sort();
}

/** The focus and everything under it, stopping after `levels` steps down. */
function subtreeOf(state: State, focus: Address, levels: number): Address[] {
  const out: Address[] = [focus];
  let frontier = [focus];
  for (let step = 0; step < levels && frontier.length > 0; step++) {
    const next: Address[] = [];
    for (const id of frontier) next.push(...childrenOf(state, id));
    out.push(...next);
    frontier = next;
  }
  return out;
}

/** Root down to the focus, inclusive. Stops on a cycle instead of spinning. */
function breadcrumbOf(state: State, focus: Address): Address[] {
  const chain: Address[] = [];
  const seen = new Set<Address>();
  let at: Address | null = focus;
  while (at !== null && isEntityRecord(state.entities[at]) && !seen.has(at)) {
    seen.add(at);
    chain.unshift(at);
    at = state.entities[at].parent;
  }
  return chain;
}

/**
 * The views that hang on a shown node, in id order, then the ones they point at through
 * `related`. A related view is worth a jump even though it is not a child.
 */
function viewsOn(all: Record<ViewId, View>, shown: Set<Address>): View[] {
  const views: View[] = [];
  const taken = new Set<ViewId>();
  for (const id of Object.keys(all).sort()) {
    if (!shown.has(all[id].address)) continue;
    views.push(all[id]);
    taken.add(id);
  }
  for (const view of [...views]) {
    for (const id of view.related ?? []) {
      if (taken.has(id) || !all[id]) continue;
      views.push(all[id]);
      taken.add(id);
    }
  }
  return views;
}

/** The scope that applies: the focus's own, else the closest one above it. */
function nearestScope(state: State, breadcrumb: Address[]): Scope | undefined {
  for (let i = breadcrumb.length - 1; i >= 0; i--) {
    const scope = state.scopes[breadcrumb[i]];
    if (scope) return scope;
  }
  return undefined;
}

/**
 * Cut the slice one task needs: the focus node, its breadcrumb to the root, children to
 * `depth`, every relation and forbidden edge touching that set, their anchors, the scope
 * that applies (nearest ancestor with one), and last.
 *
 * depth 1 is the map a human sees; depth 3 is what an agent working inside gets.
 *
 * Two spans, on purpose. `depth` bounds what is shown: entities, edges, anchors, docs and
 * views. The open-decision count is the whole subtree whatever the depth, because the wait
 * list cascades, and a count that shrank with depth would hide an open question.
 * `entities` also carries the breadcrumb ancestors, so the block can name a parent without
 * a second read.
 */
export function select(workspace: Workspace, focus: Address, depth = 1): SubState {
  const { state, views: allViews, decisions } = workspace;
  if (!Object.hasOwn(state.entities, focus) || !isEntityRecord(state.entities[focus])) {
    throw new Error(`${focus} is not in the model`);
  }

  const breadcrumb = breadcrumbOf(state, focus);
  const shown = subtreeOf(state, focus, depth);
  const inScope = new Set(shown);
  const whole = new Set(subtreeOf(state, focus, Number.MAX_SAFE_INTEGER));

  const entities: Record<Address, Entity> = {};
  for (const id of [...breadcrumb, ...shown].sort()) entities[id] = state.entities[id];

  const anchors: Record<Address, Anchor[]> = {};
  const docs: Record<Address, DocRef[]> = {};
  for (const id of shown.slice().sort()) {
    if (state.anchors[id]?.length) anchors[id] = state.anchors[id];
    if (state.docs[id]?.length) docs[id] = state.docs[id];
  }

  const touches = (from: Address, to: Address): boolean => inScope.has(from) || inScope.has(to);

  const views = viewsOn(allViews, inScope);
  const scope = nearestScope(state, breadcrumb);

  return {
    focus,
    breadcrumb,
    depth,
    entities,
    relations: state.relations.filter((r) => touches(r.from, r.to)),
    forbidden: state.forbidden.filter((f) => touches(f.from, f.to)),
    anchors,
    docs,
    views,
    open: decisions.filter((d) => d.status === 'open' && d.address !== undefined && whole.has(d.address)).length,
    ...(scope === undefined ? {} : { scope }),
    ...(state.last === undefined ? {} : { last: state.last }),
  };
}
