---
name: addone
description: Work a repository through its architecture state under .addone/. Use when a task names an Architecture Address, when a change needs architectural closure before code, or when the human asks for context, a skeleton, a scope, or a reconcile.
metadata:
  arch: addone.host.skill
---

# ADDONE

Read `CONTEXT.md` for the vocabulary. State under `.addone/` is the only source of truth
(invariant 1). Every write to it goes through `addone apply` (decision [H]).

The rules below are the protocol. Procedures follow them; a procedure never invents a
convention the rules do not state.

## Rules

### Addresses to paths

- `addone` is the repo root. `addone.core` is `src/`. `addone.host` is the host surface:
  `skill/` and `hooks/`.
- A module `addone.core.<name>` is `src/<name>/` when it has more than one file, else
  `src/<name>.ts`.
- A public seam is one file named after it: `select.ts` exports `select`.
- Shared types and helpers belong to the parent, not to a module: `src/types.ts` and
  `src/todo.ts` are anchored to `addone.core`.
- One file, one address (section 50). An anchor in state names the file and, for a seam,
  the symbol.

### Signals

Inline signals are compiled from state (section 12). State wins on conflict; `sync`
rewrites signals after a move or rename. They carry stable identity only, never phase.

Every file that can hold a comment starts with one block:

```ts
/**
 * @arch.id     addone.core.state
 * @arch.parent addone.core
 * @arch.role   store
 */
```

- `@arch.id` is the address the file belongs to; the symbol-level binding stays in
  `state.anchors`.
- `@arch.role` is the entity's kind.
- Markdown carries the address in frontmatter: `metadata.arch`. JSON carries nothing and
  relies on anchors alone.
- `grep -rn "@arch.id" src` lists every landmark; that is the acceleration the signals
  exist for (section 11).

### Skeleton contract

A skeleton file contains, in this order, and nothing else:

1. the signal block
2. one line: the entity's intent
3. imports from `../types.ts` and `../todo.ts` only; no dependency until a ticket says so
4. each public seam as an exported signature with a doc comment: what it does, the
   invariant it upholds, the steps as pseudo code
5. every body is `return todo('...')`

Done when: every file imports under `node` without flags, every seam throws `TODO`, every
anchor in state names an existing file whose `@arch.id` matches.

### Views

- The model (`architecture.json`) owns topology. A view (`.addone/views/<id>.json`) owns
  one diagram: which nodes, where, what colour, what links. A view never adds a node or
  edge the model lacks.
- Every node with children has a `map` view. Attached views (sequence, lifecycle,
  dataflow, workflow) hang on a node; `related` points at views that are not children.
- The tree lists views, never leaf boxes. A leaf lives inside its parent's map.
- Layout is written into the view by the layout procedure, never onto an entity.

### Docs and links

- Markdown is auxiliary: explanation and history, never structure. Attach it to a node
  through `docs`, at a heading or a line. Write it as a second pass, asking what an
  engineer needs when they dive in, not what the diagram already says.
- A link to code, a doc, a commit, or a PR is formatted through the `open` slot's
  template. State stores the anchor; nothing stores a resolved link.

### Exports

- `addone export <view> json|png|svg` reads the canonical artifact that `deliver` wrote.
  The appended page is a build product opened only inside the shell; it is never a source
  and never an export input.

### State

Validation rules live with the code that runs them: `src/state/validate.ts`. The mutation
vocabulary lives in `src/types.ts` (`Mutation`). This file does not repeat either.

## Procedures

### init

Walk the slots top-down and record each choice with `apply`: host, install, state mode,
write path, render, watch, enforce, evidence. TODO.

### context

`addone context <address> [depth]` before touching anything under that address. Read it
instead of grepping. TODO: when to raise depth.

### grill

One question at a time, each with a recommended answer and its cost. Every answer becomes
one `apply` mutation, persisted before the next question. TODO: answer to mutation op.

### skeleton

From state to files by the rules above. `apply set-phase skeleton` per module, then
`apply set-anchors`. TODO: order of modules.

### layout

When topology under an address changes: place nodes (one left-to-right spine, short
branches, at most 12), run `archify validate`, repair from `supportedFixes`, at most two
rounds, then `apply set-layout` per node. TODO: exact loop.

### reconcile

Collect observed relations with the tools you already have (grep, imports, git), write
them in the comparison format, run the comparison, and put every difference in front of
the human as a decision. Never change intent silently. TODO: the comparison format.
