#!/usr/bin/env node
// POC-2 (logic). Question: can ADDONE derive Archify row/col deterministically from
// state (entities + relations) without a layout engine, and does the result pass
// Archify's validator? Disposable.
//
// Rule: leaves are nodes; entities with children are regions. row = longest path from
// any source (layered DAG, back edges ignored); col = barycenter of neighbours, three
// sweeps, ties by id.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const TYPE = { system: 'external', actor: 'external', module: 'backend', store: 'database', guard: 'security', surface: 'frontend' };
const key = (id) => id.replace(/\./g, '-');

export function place(state) {
  const all = Object.keys(state.entities);
  const children = Object.fromEntries(all.map((i) => [i, all.filter((c) => state.entities[c].parent === i)]));
  const leaves = all.filter((i) => state.entities[i].parent !== null && children[i].length === 0);
  const groups = all.filter((i) => state.entities[i].parent !== null && children[i].length > 0);
  const rels = state.relations.filter((r) => leaves.includes(r.from) && leaves.includes(r.to));
  const succ = Object.fromEntries(leaves.map((i) => [i, []]));
  const pred = Object.fromEntries(leaves.map((i) => [i, []]));
  for (const r of rels) { succ[r.from].push(r.to); pred[r.to].push(r.from); }

  const row = {};
  const depth = (n, stack = new Set()) => {
    if (row[n] !== undefined) return row[n];
    if (stack.has(n)) return 0;
    stack.add(n);
    const ps = pred[n].filter((p) => !stack.has(p));
    row[n] = ps.length ? Math.max(...ps.map((p) => depth(p, stack) + 1)) : 0;
    stack.delete(n);
    return row[n];
  };
  leaves.forEach((n) => depth(n));

  const rows = {};
  leaves.slice().sort().forEach((n) => (rows[row[n]] ??= []).push(n));
  const col = {};
  Object.values(rows).forEach((r) => r.forEach((n, i) => (col[n] = i)));
  const sweep = (nbrs) => Object.keys(rows).map(Number).sort((a, b) => a - b).forEach((r) => {
    const bc = (n) => { const xs = nbrs[n].map((m) => col[m]); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : col[n]; };
    rows[r].sort((a, b) => bc(a) - bc(b) || a.localeCompare(b));
    rows[r].forEach((n, i) => (col[n] = i));
  });
  sweep(pred); sweep(succ); sweep(pred);

  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: { title: state.project.name, quality_profile: 'standard' },
    layout: { mode: 'grid', origin: [40, 90], cols: Math.max(...Object.values(rows).map((r) => r.length)), gapX: 90, gapY: 80, cellW: 140, cellH: 64 },
    components: leaves.map((n) => ({ id: key(n), type: TYPE[state.entities[n].kind] || 'backend', label: n.split('.').pop(), sublabel: state.entities[n].intent.slice(0, 26), row: row[n], col: col[n] })),
    boundaries: groups.filter((g) => children[g].filter((c) => leaves.includes(c)).length > 1)
      .map((g) => ({ kind: 'region', label: g.split('.').pop(), wraps: children[g].filter((c) => leaves.includes(c)).map(key) })),
    connections: rels.map((r) => ({ id: key(`${r.from}-${r.to}`), from: key(r.from), to: key(r.to), label: r.kind })),
    cards: [],
  };
}

const [, , input, output] = process.argv;
if (input && output) {
  const state = JSON.parse(readFileSync(input, 'utf8'));
  mkdirSync('out', { recursive: true });
  writeFileSync(output, JSON.stringify(place(state), null, 2));
  console.log(output);
}
