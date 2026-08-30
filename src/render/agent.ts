/**
 * @arch.id     addone.core.render
 * @arch.parent addone.core
 * @arch.role   module
 */
// SubState to projection: ascii, agent, archify IR, hud shell. Pure, zero IO.
import type { SubState, Address, Anchor, DocRef, View, Relation } from '../types.ts';

/** A field is either `Label: value` on one line, or `Label:` and an indented block. */
function field(label: string, lines: string[], empty = 'none'): string {
  if (lines.length === 0) return `${label}: ${empty}`;
  if (lines.length === 1 && !lines[0].includes('\n')) return `${label}: ${lines[0]}`;
  return [`${label}:`, ...lines.map((line) => `  ${line}`)].join('\n');
}

function anchorLine(anchor: Anchor): string {
  const at = anchor.line === undefined ? anchor.file : `${anchor.file}:${anchor.line}`;
  return anchor.symbol === undefined ? at : `${at} · ${anchor.symbol}`;
}

function docLine(doc: DocRef): string {
  if (doc.section !== undefined) return `${doc.file} #${doc.section}`;
  if (doc.line !== undefined) return `${doc.file}:${doc.line}`;
  return doc.file;
}

function viewLine(view: View): string {
  return `${view.id} (${view.kind} ${view.type}) — ${view.title}`;
}

function relationLine(relation: Relation): string {
  return `${relation.from} → ${relation.to} (${relation.kind})`;
}

/** The focus and its descendants. Breadcrumb ancestors are in `entities` but are not the subtree. */
function inSubtree(sub: SubState, id: Address): boolean {
  return id === sub.focus || id.startsWith(`${sub.focus}.`);
}

/** Rows of one address-keyed map, naming the address whenever it is not the focus itself. */
function byAddress<T>(record: Record<Address, T[]>, focus: Address, line: (value: T) => string): string[] {
  return Object.keys(record)
    .sort()
    .flatMap((id) => record[id].map((value) => (id === focus ? line(value) : `${id} · ${line(value)}`)));
}

/** The subtree under the focus, indented one step per level. */
function childLines(sub: SubState, parent: Address, depth: number): string[] {
  const out: string[] = [];
  for (const id of Object.keys(sub.entities).sort()) {
    if (sub.entities[id].parent !== parent) continue;
    const entity = sub.entities[id];
    out.push(`${'  '.repeat(depth)}${id} (${entity.kind}, ${entity.phase ?? 'no phase'})`);
    out.push(...childLines(sub, id, depth + 1));
  }
  return out;
}

/**
 * Fixed fields, fixed order, so an agent can rely on where each fact sits (section 16):
 *   ADDRESS · Intent · Parent · Children · Reads · Forbidden · Anchors · Scope · Status · Last
 * Absent facts are stated absent ("Anchors: none yet"), never omitted.
 *
 * The order lives here and nowhere else, and the golden test protects it. Adding a fact is
 * adding one row.
 *
 * Three rows are not in the list above. `Read by` splits the inbound half out of `Reads`,
 * so an edge that points at the focus can never read as one the focus owns. `Docs`, `Views`
 * and `Open` are the second layer ([P]) and the wait list ([S]): facts select already
 * computed, and an agent that cannot see an open decision would act against a question the
 * human has not answered yet. The ten named fields keep their names and their order.
 */
const FIELDS: Array<{ label: string; lines: (sub: SubState) => string[]; empty?: string }> = [
  { label: 'ADDRESS', lines: (sub) => [sub.focus] },
  { label: 'Intent', lines: (sub) => [sub.entities[sub.focus]?.intent ?? 'none'] },
  {
    label: 'Parent',
    lines: (sub) => {
      const parent = sub.entities[sub.focus]?.parent ?? null;
      return [parent === null ? 'none (the root)' : `${parent} (${sub.breadcrumb.join(' › ')})`];
    },
  },
  { label: 'Children', lines: (sub) => childLines(sub, sub.focus, 0) },
  { label: 'Reads', lines: (sub) => sub.relations.filter((r) => inSubtree(sub, r.from)).map(relationLine) },
  {
    label: 'Read by',
    lines: (sub) => sub.relations.filter((r) => inSubtree(sub, r.to) && !inSubtree(sub, r.from)).map(relationLine),
  },
  { label: 'Forbidden', lines: (sub) => sub.forbidden.map((f) => `${f.from} ✗ ${f.to} — ${f.reason}`) },
  { label: 'Anchors', lines: (sub) => byAddress(sub.anchors, sub.focus, anchorLine), empty: 'none yet' },
  { label: 'Docs', lines: (sub) => byAddress(sub.docs, sub.focus, docLine) },
  { label: 'Views', lines: (sub) => sub.views.map(viewLine) },
  { label: 'Open', lines: (sub) => (sub.open === 0 ? [] : [`${sub.open} decision${sub.open === 1 ? '' : 's'}`]) },
  {
    label: 'Scope',
    lines: (sub) =>
      sub.scope === undefined
        ? []
        : [
            `write: ${sub.scope.write.join(', ') || 'nothing'}`,
            `read: ${sub.scope.read.join(', ') || 'nothing'}`,
            `approval: ${sub.scope.requires_approval.join(', ') || 'nothing'}`,
          ],
    empty: 'none, this session has no write guard',
  },
  {
    label: 'Status',
    lines: (sub) => {
      const focus = sub.entities[sub.focus];
      const assurance = focus?.assurance === undefined ? '' : `, assurance ${focus.assurance}`;
      return [focus?.phase === undefined ? `no phase, not ours to build${assurance}` : `${focus.phase}${assurance}`];
    },
  },
  {
    label: 'Last',
    lines: (sub) => {
      const last = sub.last;
      if (last === undefined) return [];
      return [`${last.at} · ${last.type}${last.address ? ` on ${last.address}` : ''} — ${last.what}`];
    },
  },
];

/** Walk the table. Every row prints, whether or not it has anything to say. */
export function agent(sub: SubState): string {
  return `${FIELDS.map((row) => field(row.label, row.lines(sub), row.empty)).join('\n')}\n`;
}
