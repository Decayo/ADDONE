# Change: First slice

**Status:** implementing
**Route:** large

## Outcome

CONTEXT, SCOPE, RECONCILE, and WATCH exist, with ADDONE itself as the architecture they
describe, and with a SCOPE hook that blocks an out-of-bounds write on both Claude Code and
Codex. Success is measured on the same task with the same model and budget: fewer grep and
read calls, fewer scope violations, fewer human reconstructions of what the agent did.
The slice ships as a minimal installable tool: `addone init` in a fresh repo, then the
loop runs there ([V]).

Inherited as settled: the invariants in `CONTEXT.md`.

## Settled decisions

- **[A] Two subjects, two jobs.** ADDONE is the greenfield subject and the dogfood target;
  the vision's success signal (the author still reaching for the loop after a few
  features) exists only here. `pipecat-ai/pipecat` is the read-only reconstruction subject
  for the benchmark. Its `.addone/` is produced once and graded, so only one tree evolves.
- **[B] Host-neutral core; enforcement through each host's PreToolUse hook. No MCP.**
  Verified on Codex 0.149.1: PreToolUse fires for `apply_patch`, `Edit`, `Write`, and
  denies by exit code 2 or `permissionDecision: "deny"`, the same wire shape as Claude
  Code, so one hook script serves both. MCP has no pre-write interception point.
  **Executed, not just read: POC-1 on 2026-08-29.** One 25-line script, project-scoped
  hook config on each host (`.claude/settings.json`, `.codex/hooks.json`), headless run
  on each: `allowed/ok.txt` written, `forbidden/no.txt` blocked, both hosts reported the
  deny reason back to the model. Two adapter differences to carry into scope's design:
  Claude Code passes `tool_input.file_path`; Codex passes the whole patch in
  `tool_input.command`, so paths come from `*** Add File:` / `*** Update File:` lines.
  Codex project hooks need trust (a trusted project path, or
  `--dangerously-bypass-hook-trust`). Headless Codex must call the real binary; the
  `codex-multi-auth` wrapper hung for five minutes with a manual login in progress.
- **[C] `.addone/` is tracked; only `.cache/` is ignored.** Untracked state forfeits shared
  state, CI enforcement, PR architecture diff, and persistent decisions, which are the
  thesis. Cost: schema churn shows in git log until the shape settles.
- **[D] TypeScript on Node, run directly.** Node 26 strips types natively, so there is no
  build step. A binary release is a later stage and would be Go or Rust; Bun is rejected
  as the release form, so it is not adopted as the dev form either. Cost: a user with only
  Claude Code has no Node runtime (both hosts ship compiled binaries) and must install one.
- **[E] One file, `.addone/architecture.json`, using the final key names** (`entities`,
  `relations`, `forbidden`, `anchors`, `scopes`). Splitting later is a move, not a rename.
  Opening the full tree now would leave empty files that manufacture discovery tax.
- **[E1] JSON everywhere.** Humans neither write nor read the file (invariant 3), which
  removes YAML's reasons; `intent` is one sentence, which removes the last one. JSON has no
  type coercion surprises.
- **[F] Full A/B/C benchmark on the reconstruction subject.** A is the bare repo with its
  `AGENTS.md` withheld, B is Pipecat's existing 17.7 KB `AGENTS.md`, C is ADDONE's compiled
  context. C over A tests nothing; C over B is the claim.
- **[F1] `pipecat-ai/pipecat`, graded by hand against its `AGENTS.md`.** 23 sibling
  packages under `src/pipecat/`, a named frame-pipeline architecture, active daily. No
  machine-readable dependency rule, so no automated grading in this slice; the user knows
  the codebase, so a fabricated reconstruction is visible without one.
- **[F2] The private work repo waits** until the loop has run on ADDONE and Pipecat.
- **[J] The depth-0 happy path is ten steps.** intent → GRILL one question at a time →
  apply to state → render (HUD, ascii delta in chat, agent context) → human says yes →
  SKELETON, phase becomes skeleton → SCOPE on, hook active → implement inside scope, every
  write checked, phase becomes implementing → evidence → RECONCILE, human decides:
  reconciled, or back to GRILL, or back to implement. Two non-happy branches: a scope
  violation raises an expansion request; a reconcile mismatch returns to step 2 or 8.
  Phase is a lifecycle: architecture → skeleton → implementing → reconciled. Todo derives
  from it and is never stored separately.
- **[K] The human answers in chat. The HUD is read-only for the first slice.** Agent-first;
  HUD interaction is a later stage, verified only after the other stages work.
  Confirms INTERFACE.md section 8 ordering.
- **[H] State is written through `cli apply`.** Validation at write time (ids unique,
  parents exist, single-valued fields), and the LAST record is written in the same step.
  Direct JSON edits stay possible for repair but are not the documented path. How much
  of this the skill must say is decided when SKILL.md is written.
- **[N] Layout belongs to the view, and the agent authors it. Auto-layout: a deferred
  option.** Positions live in the diagram's own JSON under `.addone/views/`, never on the
  entity: one node can sit in a parent map and in a related diagram at different places.
  The agent places nodes when topology changes, following Archify's mode rules (one
  left-to-right spine, short branches, 6 to 12 nodes), repairs from the validator's
  `supportedFixes`, and writes the positions into the view; the human adjusts in chat.
  Render is a pure read. Automatic layout (dagre / elk, as Mermaid and React Flow use)
  stays on the render slot as `layout: auto`, deferred, not rejected. POC-2's failure was
  the implementation, not the approach. Amended in round 6: layout moved from entity to
  view.
- **[O] Two SSOT layers, both JSON, never overlapping.** `architecture.json` is the model:
  what exists, who connects to whom, what is forbidden. A view file under `.addone/views/`
  is the diagram: which nodes it shows, where, in what colour, with what links. A view
  cannot add a node or edge the model lacks; validate rejects it. A view whose node left
  the model is dirty, like a stale anchor. Later SSOTs (decisions, extensions) follow the
  same rule: JSON, one owner each.
- **[R] A diagram is an independent JSON file with a renderer-neutral shape.** It can be
  referenced, pasted, exported (raw JSON, PNG, SVG) and rendered by any adapter:
  Archify plus our layer, Mermaid, others. `render/archify.ts` therefore consumes the view
  JSON, not SubState. Views are `map` (a node's children, generated from the model then
  persisted with layout) or `attached` (authored: sequence, lifecycle, dataflow), and any
  view may declare `related` links to views that are not its children.
- **[P] Two layers of information, no third.** Layer one is the diagram. Layer two opens
  on a node: every anchor with its sync colour (green: recorded line still matches;
  yellow: the file changed since the last sync), the markdown doc link, related views,
  and, for a finished node, its commit and PR links. Markdown is the auxiliary form: it
  holds explanation and history, never structure, and the agent writes it as a second
  pass on how to present with the least load. An engineer dives only when interested or
  when something is wrong. A third layer exists only as an extension's modal (error
  style, complexity, smell scores), and an extension's output is its own JSON under
  `.addone/`.
- **[Q] Opening a link is a configurable template.** The `open` slot holds one template
  such as `vscode://file{abs}:{line}` (`{abs}` starts with a slash) or `https://host/open?p={path}&l={line}`; the shell,
  the ascii renderer, and the skill all format links through it. State stores only the
  anchor, never the resolved link.
- **[S] The wait list is state and cascades.** An open decision is a JSON record under
  `.addone/decisions/` with a `status` and an `address`; every tree row shows the count of
  open decisions in its subtree, like unread counts. This is the surface an engineer
  interacts with most, so it moves out of the map into the changes column, with a modal
  for the detail; the answer still happens in chat ([K]).
- **[T] Every UI operation has a cli equivalent, and the cli must deliver the diagram.**
  Open, focus, export, compare are commands; the agent pastes ascii in chat and PNG, SVG,
  or a link in a PR. If the human never opens the web UI, the cli still puts the diagram
  in front of them. The shell keeps no state of its own; tabs and navigation history live
  in the browser, undo of state is git ([C]).
- **[U] Exports come from the canonical artifact only.** `addone export <view> json|png|svg`
  reads the HTML that `deliver` wrote. The appended page is a build product opened only
  inside the shell, where `?embed=1` hides Archify's Export menu; it is never an export
  input. Raised by POC-3: Archify's export sanitiser is a fixed denylist of its own
  attributes, so a third-party layer would ride into PNG and SVG unnoticed. In parallel,
  ask upstream for a generic strip hook. An HTML overlay outside the SVG is the fallback if
  the appended page ever needs to stand alone.
- **[E] amended.** `docs` joins the model's keys. Views and decisions are separate files
  under `.addone/views/` and `.addone/decisions/` by [O]; they are not model keys.
- **[V] The first slice is a minimal, installable ADDONE that can dogfood a new repo.**
  Success is `addone init` in a fresh repo leaving it ready for the loop in one command,
  then the loop running there: context, apply, render, watch, scope, reconcile. Polish is
  out; the author's next repos are waiting on this. Install shape: the cli on PATH by a
  symlink to `src/cli.ts`; skill and hook fragments written into the target repo by `init`
  (`.claude/settings.json`, `.codex/hooks.json`, `.claude/skills/addone`,
  `.agents/skills/addone`); fleet-managed global files are never touched. The second
  dogfood subject is the author's next new repo, before Pipecat ([A] amended: two
  greenfield subjects before the reconstruction subject).
- **[L] The architecture map comes first; other diagram types are renderer capabilities.**
  At every depth the main diagram is the map: a node's direct children and the relations
  between them, at most 12. `workflow`, `sequence`, `dataflow`, and `lifecycle` attach to a
  node when the chosen renderer supports them. Multi-layer navigation comes after the map
  works.
- **[M] Every stage of the loop is a slot.** Core defines the interface; adapters fill it;
  `addone init` walks the slots top-down and records each choice in `.addone/config.json`;
  each slot carries its own progress (unchosen, chosen, installed, verified) and the HUD
  shows it. Slots, with the agent's proposed defaults: host (both), install (project),
  state mode (sidecar), write path (see [H]), render (archify + ascii), watch (addone
  watch), enforce (hook), evidence (agent procedure). A default can change per slot
  without reopening [M].

- **[G] No evidence provider is built.** RECONCILE is a skill procedure the agent runs with
  the grep, git, AST, and LSP it already has; ADDONE ships the intended half and the
  comparison format. Cost: an agent-run collection varies between runs, which the
  benchmark report has to state.

## Rejected alternatives

- **[A] Pure self-bootstrap, no second repo.** A control arm needs a subject large enough
  to measure. **Reconstruction only.** Leaves ADDONE with no state of its own.
- **[B] Claude Code only.** Codex has equivalent interception. **MCP server.** Advisory
  only.
- **[C] `.addone.local/` ignored.** Forfeits the thesis. **No git.** Loses an evidence
  carrier.
- **[D] Python.** Smallest author pool for community packs. **Bun-compiled TypeScript.**
  Not the release form.
- **[E] The full multi-file tree now.** Empty files.
- **[E1] YAML as source with a JSON cache.** Two representations to keep in sync. The case
  for YAML rested on PR diff readability, which invariant 3 rules out as a reading path.
- **[F] No control arm.** An A arm reconstructed later is a dirty comparison.
- **[F1] `dependency-cruiser`** (has a known-violations answer key, no group B, outside the
  user's field). **`kedro`, `backstage`, `structurizr-python`** (stale docs path,
  hand-drawn sandbox, vocabulary echo). **t3.code** (not open source).
- **[G] Ship a parser or tree-sitter.** The agent already parses. **GitNexus.** A skill,
  not a library; RECONCILE would stop being deterministic.

## Non-goals

HTML as an editor. A `<canvas>` graph engine. An own layout engine. Figma or IcePanel sync.
Hosted SaaS. Multiplayer cursors. Inline `@arch` as a requirement. A second GitNexus or
Archify; both are adapters. `PLAN.md`, `SPEC.md`, `HUD.md`, `CLI.md`, `RENDERER.md`.

## Open decisions

None. Depth 0 is closed; the second layer is settled.

## Domain references

- `CONTEXT.md` — vocabulary and the six invariants.

## Artifacts

- Spec: https://github.com/Decayo/ADDONE/issues/1 (approved 2026-08-29). `docs/archive/INTERFACE.md`
  sections 4, 5, and 8 remain the source for HUD contents, the live-reload minimum, and
  the deferred list.
- Skeleton: `.addone/architecture.json` is the state; `src/`, `skill/`, `hooks/` are its
  materialization. Signatures, types, and `todo()` bodies only. `src/types.ts` is the
  type form of `CONTEXT.md`; the `Mutation` union there is the whole write vocabulary.
  Round 6 added `View`, `Decision`, `DocRef`, `Layer`, `Workspace`, the `open` slot, and
  `render/archify-append.ts`; `.addone/views/addone.map.json` holds the world map's layout.
- Work tickets (GitHub, native `blocked_by` edges set 2026-08-29; #2 delivered, frontier now #3 #4 #5 #6):
  - #2 read and write the model through the cli (context, apply) — https://github.com/Decayo/ADDONE/issues/2 — **delivered 2026-08-31**, evidence on the issue
  - #3 addone init installs into a fresh repo — blocked by #2 — https://github.com/Decayo/ADDONE/issues/3
  - #4 scope guard blocks an out-of-scope write on both hosts — blocked by #2 — https://github.com/Decayo/ADDONE/issues/4
  - #5 world map rendered through Archify with the second layer and the shell — blocked by #2 — https://github.com/Decayo/ADDONE/issues/5
  - #6 ascii projection after every apply — blocked by #2 — https://github.com/Decayo/ADDONE/issues/6
  - #7 watch re-renders and reloads on change — blocked by #5 — https://github.com/Decayo/ADDONE/issues/7
  - #8 reconcile runs on ADDONE itself — blocked by #2, #6 — https://github.com/Decayo/ADDONE/issues/8
  - #9 second view through the layout procedure — blocked by #5 — https://github.com/Decayo/ADDONE/issues/9
- Review: None.
- Delivery: None.
- Prototype: `prototypes/home-window/` — display question "What does the ADDONE home
  window show, and how does a human navigate layers, last change, todo, and explore?"
  Three variants (A map-only, B tree + map + change rail, C delta-first), rendered through
  Archify from `state.base` (round 2) and `state.head` (round 3). Verdict so far: B is
  closest but not yet right. Settled from it: last change is green, todo is yellow,
  explore is grey and semi-transparent by default; the home map is the depth-0 world map.
  Still open: the exact window shape.
- POC-1: `prototypes/poc-hook/deny.mjs` — logic question "does a PreToolUse hook block a
  write on both hosts?" Answer: yes on both. Details under [B].
- POC-2: `prototypes/poc-layout/place.mjs` — logic question "can render derive Archify
  row/col from state without a layout engine?" Answer: **not with a naive placer.**
  Longest-path rows plus barycenter columns fail Archify `standard` on both a 9-node and a
  12-node graph: edges run through unrelated nodes (`render → state` straight through
  `cli`), endpoint sides are wrong, labels overlap. Passing needs reserved lanes for
  multi-row edges (Sugiyama dummy vertices), which is the start of the layout engine
  INTERFACE.md section 7 rules out. Decision [N] below.
- POC-3: `prototypes/poc-append/` — logic question "can the second layer be added onto
  Archify's generated HTML without a fork?" Answer: **yes, all four capabilities**, by an
  append step plus the shell; `archify check` stays 9/9. Facts that bind the design: node
  groups are `g[data-node-id]`; focus lands on `[data-focus-selected]` from every path;
  Archify has no `postMessage`, the bridge is ours; `?embed=1` hides the passport, so under
  embed our own overlay panel hosts the links; the append must re-run after every `deliver`.
  One open risk: Archify's canonical export (PNG, SVG) silently carries our layer, its
  sanitiser is a fixed denylist. Decision [U] below.
