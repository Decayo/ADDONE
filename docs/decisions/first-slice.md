# Change: First slice

**Status:** implementing
**Route:** large

## Outcome

CONTEXT, SCOPE, RECONCILE, and WATCH exist, with ADDONE itself as the architecture they
describe, and with a SCOPE hook that blocks an out-of-bounds write on both Claude Code and
Codex. Success is measured on the same task with the same model and budget: fewer grep and
read calls, fewer scope violations, fewer human reconstructions of what the agent did.
The slice ships as a minimal installable tool: `addone init` in a fresh repo, then the
loop runs there.

Inherited as settled: the invariants in `CONTEXT.md`.

## Settled decisions

### Two subjects, two jobs

ADDONE is the greenfield subject and the dogfood target;
the vision's success signal (the author still reaching for the loop after a few
features) exists only here. `pipecat-ai/pipecat` is the read-only reconstruction subject
for the benchmark. Its `.addone/` is produced once and graded, so only one tree evolves.
### Host-neutral core; enforcement through each host's PreToolUse hook. No MCP

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
### `.addone/` is tracked; only `.cache/` is ignored

Untracked state forfeits shared
state, CI enforcement, PR architecture diff, and persistent decisions, which are the
thesis. Cost: schema churn shows in git log until the shape settles.
### TypeScript on Node, run directly

Node 26 strips types natively, so there is no
build step. A binary release is a later stage and would be Go or Rust; Bun is rejected
as the release form, so it is not adopted as the dev form either. Cost: a user with only
Claude Code has no Node runtime (both hosts ship compiled binaries) and must install one.
### One file, `.addone/architecture.json`, using the final key names

(`entities`,
`relations`, `forbidden`, `anchors`, `scopes`). Splitting later is a move, not a rename.
Opening the full tree now would leave empty files that manufacture discovery tax.
### JSON everywhere

Humans neither write nor read the file (invariant 3), which
removes YAML's reasons; `intent` is one sentence, which removes the last one. JSON has no
type coercion surprises.
### Full A/B/C benchmark on the reconstruction subject

A is the bare repo with its
`AGENTS.md` withheld, B is Pipecat's existing 17.7 KB `AGENTS.md`, C is ADDONE's compiled
context. C over A tests nothing; C over B is the claim.
### `pipecat-ai/pipecat`, graded by hand against its `AGENTS.md`

23 sibling
packages under `src/pipecat/`, a named frame-pipeline architecture, active daily. No
machine-readable dependency rule, so no automated grading in this slice; the user knows
the codebase, so a fabricated reconstruction is visible without one.
### The private work repo waits

until the loop has run on ADDONE and Pipecat.
### The depth-0 happy path is ten steps

intent → GRILL one question at a time →
apply to state → render (HUD, ascii delta in chat, agent context) → human says yes →
SKELETON, phase becomes skeleton → SCOPE on, hook active → implement inside scope, every
write checked, phase becomes implementing → evidence → RECONCILE, human decides:
reconciled, or back to GRILL, or back to implement. Two non-happy branches: a scope
violation raises an expansion request; a reconcile mismatch returns to step 2 or 8.
Phase is a lifecycle: architecture → skeleton → implementing → reconciled. Todo derives
from it and is never stored separately.
### The human answers in chat. The HUD is read-only for the first slice

Agent-first;
HUD interaction is a later stage, verified only after the other stages work.
Confirms INTERFACE.md section 8 ordering.
### State is written through `cli apply`

Validation at write time (ids unique,
parents exist, single-valued fields), and the LAST record is written in the same step.
Direct JSON edits stay possible for repair but are not the documented path. How much
of this the skill must say is decided when SKILL.md is written.
### Layout belongs to the view, and the agent authors it. Auto-layout: a deferred
option

Positions live in the diagram's own JSON under `.addone/views/`, never on the
entity: one node can sit in a parent map and in a related diagram at different places.
The agent places nodes when topology changes, following Archify's mode rules (one
left-to-right spine, short branches, 6 to 12 nodes), repairs from the validator's
`supportedFixes`, and writes the positions into the view; the human adjusts in chat.
Render is a pure read. Automatic layout (dagre / elk, as Mermaid and React Flow use)
stays on the render slot as `layout: auto`, deferred, not rejected. POC-2's failure was
the implementation, not the approach. Amended in round 6: layout moved from entity to
view.
### Two SSOT layers, both JSON, never overlapping

`architecture.json` is the model:
what exists, who connects to whom, what is forbidden. A view file under `.addone/views/`
is the diagram: which nodes it shows, where, in what colour, with what links. A view
cannot add a node or edge the model lacks; validate rejects it. A view whose node left
the model is dirty, like a stale anchor. Later SSOTs (decisions, extensions) follow the
same rule: JSON, one owner each.
### A diagram is an independent JSON file with a renderer-neutral shape

It can be
referenced, pasted, exported (raw JSON, PNG, SVG) and rendered by any adapter:
Archify plus our layer, Mermaid, others. `render/archify.ts` therefore consumes the view
JSON, not SubState. Views are `map` (a node's children, generated from the model then
persisted with layout) or `attached` (authored: sequence, lifecycle, dataflow), and any
view may declare `related` links to views that are not its children.
### Two layers of information, no third

Layer one is the diagram. Layer two opens
on a node: every anchor with its sync colour (green: recorded line still matches;
yellow: the file changed since the last sync), the markdown doc link, related views,
and, for a finished node, its commit and PR links. Markdown is the auxiliary form: it
holds explanation and history, never structure, and the agent writes it as a second
pass on how to present with the least load. An engineer dives only when interested or
when something is wrong. A third layer exists only as an extension's modal (error
style, complexity, smell scores), and an extension's output is its own JSON under
`.addone/`.
### A link is a kind plus a relative target. Adapters open it; core never builds a URI

Superseded the template form after three failures on one bug (`vscode://file/{abs}` with
`{abs}` already starting with a slash, sent twice unmeasured). State stores the anchor as
a repo-relative path; nothing stores or formats an absolute path. `{abs}` is removed.
Three routes, by kind:
- **code, doc → editor.** VS Code family, driven by the CLI, three steps: find (does a
    window already hold this repo? `code --status` prints `Folder (<name>)`), ensure (if
    not, `code <repoRoot>` and poll until it appears), focus
    (`cd <repoRoot> && code -r -g <relative>:<line>`). Measured 2026-08-31: the line is
    reached and highlighted. `-r` reuses the window instead of opening another.
- **commit, PR, issue → browser.** `xdg-open <url>`, the system default (now Firefox,
    verified through `xdg-settings` and `x-scheme-handler/https`). Never t3.code's internal
    browser: the GitHub session lives in the real browser.
- **view → surface.** t3.code renders an `https://` link, so the watch server's URL is the
    form; a terminal prints it.

### The wait list is state and cascades

An open decision is a JSON record under
`.addone/decisions/` with a `status` and an `address`; every tree row shows the count of
open decisions in its subtree, like unread counts. This is the surface an engineer
interacts with most, so it moves out of the map into the changes column, with a modal
for the detail; the answer still happens in chat, because the HUD is read-only.
### Every UI operation has a cli equivalent, and the cli must deliver the diagram

Open, focus, export, compare are commands; the agent pastes ascii in chat and PNG, SVG,
or a link in a PR. If the human never opens the web UI, the cli still puts the diagram
in front of them. The shell keeps no state of its own; tabs and navigation history live
in the browser, undo of state is git, because `.addone/` is tracked.
### Exports come from the canonical artifact only

`addone export <view> json|png|svg`
reads the HTML that `deliver` wrote. The appended page is a build product opened only
inside the shell, where `?embed=1` hides Archify's Export menu; it is never an export
input. Raised by POC-3: Archify's export sanitiser is a fixed denylist of its own
attributes, so a third-party layer would ride into PNG and SVG unnoticed. In parallel,
ask upstream for a generic strip hook. An HTML overlay outside the SVG is the fallback if
the appended page ever needs to stand alone.
### docs joins the model's keys

`docs` joins the model's keys. Views and decisions are separate files
under `.addone/views/` and `.addone/decisions/`, one SSOT each; they are not model keys.
### The first slice is a minimal, installable ADDONE that can dogfood a new repo

Success is `addone init` in a fresh repo leaving it ready for the loop in one command,
then the loop running there: context, apply, render, watch, scope, reconcile. Polish is
out; the author's next repos are waiting on this. Install shape: the cli on PATH by a
symlink to `src/cli.ts`; skill and hook fragments written into the target repo by `init`
(`.claude/settings.json`, `.codex/hooks.json`, `.claude/skills/addone`,
`.agents/skills/addone`); fleet-managed global files are never touched. The second
dogfood subject is the author's next new repo, before Pipecat. This amends "Two subjects,
two jobs": two greenfield subjects come before the reconstruction subject.
### The surface is an adapter, and t3.code gets none for now

A surface is the
environment a human reads ADDONE in: t3.code today, a plain terminal, an app later. It
decides how a link is delivered, never what a link means. An adapter is three actions,
`find` / `ensure` / `focus`, not a string template.
**t3.code has no external open-a-file interface.** Read from its own bundle
(`/opt/t3code-bin/resources/app.asar`, `apps/server/dist/bin.mjs`, which ships readable
source): the RPC table has `projects.readFile`, `projects.writeFile`,
`filesystem.browse`, and `shell.openInEditor({ cwd, editor })`. Nothing takes a file with
a line. Its own `resolveCommandEditorArgs` sends `["--goto", "path:line:col"]` to the
VS Code family, so the capability exists inside and is not exposed. `t3code://` routes
are `app`, `threads/<env>/<thread>`, `checkout-pr` only. Its `preview_*` MCP tools accept
http(s) alone and only inside an agent turn.
So t3.code is the surface that supplies cwd and picks an editor; the editor adapter does
the jumping. Add a t3.code adapter when it exposes an open-file RPC. An upstream request
for one optional `target` on `shell.openInEditor` would be cheap for them; not filed.
### Nothing invalid reaches the JSON

An anchor naming a file that is not in the repo
is refused at write time, beside the entity and relation shape rules; `validate` gains
`anchors.file-missing`. A stale anchor whose file later disappears renders red as
`missing`, a third state beside green `match` and yellow `drift`, and the HUD says so
instead of emitting a dead link. The rule exists because a hallucinated path,
`src/commands/context.ts`, survived from POC-3's sample data all the way to a failed jump
in front of the user.
### `addone doctor` reports the machine, not the config

Every line is measured:
editor present and which, the registered `vscode://` handler, the default browser through
`xdg-settings`, the detected surface, whether a window already holds this repo, anchors
that exist versus missing versus drifted, hook files in place. `init` runs it at the end,
so an install that cannot work says so on the spot. A product that cannot be used cannot
be dogfooded.
### The architecture map comes first; other diagram types are renderer capabilities

At every depth the main diagram is the map: a node's direct children and the relations
between them, at most 12. `workflow`, `sequence`, `dataflow`, and `lifecycle` attach to a
node when the chosen renderer supports them. Multi-layer navigation comes after the map
works.
### Every stage of the loop is a slot

Core defines the interface; adapters fill it;
`addone init` walks the slots top-down and records each choice in `.addone/config.json`;
each slot carries its own progress (unchosen, chosen, installed, verified) and the HUD
shows it. Slots, with the agent's proposed defaults: host (both), install (project),
state mode (sidecar), write path (cli), render (archify + ascii), watch (addone
watch), enforce (hook), evidence (agent procedure). A default can change per slot
without reopening the slot list itself.

### No evidence provider is built

RECONCILE is a skill procedure the agent runs with
the grep, git, AST, and LSP it already has; ADDONE ships the intended half and the
comparison format. Cost: an agent-run collection varies between runs, which the
benchmark report has to state.

### The type gate is a pinned devDependency, not a network call

The deleted skill required `tsc --noEmit` before review. Nothing in the repo could run it:
no `tsconfig.json`, no typescript dependency, no binary on the machine. Node runs
TypeScript by stripping the types, so every type error went through unseen. The answer is
a `tsconfig.json` and typescript pinned as a devDependency. This costs the repo its
zero-dependency working tree, which is the price of the gate existing at all; the
dependency is dev-only and never reaches an installed ADDONE. `npx` was rejected: a check
that needs the network is a check that skips itself when the network is down, silently.
No build step is added. `--noEmit` reads; it does not produce.

## Rejected alternatives

Each group names the decision it was weighed against.

**Two subjects, two jobs**
- **Pure self-bootstrap, no second repo.** A control arm needs a subject large enough to
  measure.
- **Reconstruction only.** Leaves ADDONE with no state of its own.

**Host-neutral core, a hook on each host**
- **Claude Code only.** Codex has equivalent interception.
- **MCP server.** Advisory only.

**`.addone/` is tracked**
- **`.addone.local/` ignored.** Forfeits the thesis.
- **No git.** Loses an evidence carrier.

**TypeScript on Node, run directly**
- **Python.** Smallest author pool for community packs.
- **Bun-compiled TypeScript.** Not the release form.

**One architecture file, final key names**
- **The full multi-file tree now.** Empty files.

**JSON everywhere**
- **YAML as source with a JSON cache.** Two representations to keep in sync. The case for
  YAML rested on PR diff readability, which invariant 3 rules out as a reading path.

**Full A/B/C benchmark**
- **No control arm.** An A arm reconstructed later is a dirty comparison.

**pipecat as the benchmark subject**
- **`dependency-cruiser`.** Has a known-violations answer key, no group B, outside the
  user's field.
- **`kedro`, `backstage`, `structurizr-python`.** Stale docs path, hand-drawn sandbox,
  vocabulary echo.
- **t3.code.** Not open source.

**No evidence provider is built**
- **Ship a parser or tree-sitter.** The agent already parses.
- **GitNexus.** A skill, not a library; RECONCILE would stop being deterministic.

## Non-goals

HTML as an editor. A `<canvas>` graph engine. An own layout engine. Figma or IcePanel sync.
Hosted SaaS. Multiplayer cursors. Inline `@arch` as a requirement. A second GitNexus or
Archify; both are adapters. `PLAN.md`, `SPEC.md`, `HUD.md`, `CLI.md`, `RENDERER.md`.

## Open decisions

None. Depth 0 is closed; the second layer is settled.

## Domain references

- `CONTEXT.md` — vocabulary and the six invariants.

## Artifacts

- Spec: deleted with the tickets on 2026-08-31. `docs/archive/INTERFACE.md` sections 4,
  5, and 8 remain the source for HUD contents, the live-reload minimum, and the deferred
  list.
- Skeleton: deleted on 2026-08-31, commit `89bcec8`. `src/`, `test/`, `hooks/` and
  `skill/SKILL.md` are gone, and so are every anchor, phase, and assurance field in
  `.addone/architecture.json`. The documents around the skeleton named things that were
  never built, so nothing written against them could be trusted. What remains in
  `.addone/architecture.json` is intent only: entities, relations, forbidden edges,
  scopes, docs.
- Work tickets: all nine GitHub issues deleted on 2026-08-31. Nothing is in flight.
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
  write on both hosts?" Answer: yes on both. Details under "Host-neutral core, a hook on
  each host".
- POC-2: `prototypes/poc-layout/place.mjs` — logic question "can render derive Archify
  row/col from state without a layout engine?" Answer: **not with a naive placer.**
  Longest-path rows plus barycenter columns fail Archify `standard` on both a 9-node and a
  12-node graph: edges run through unrelated nodes (`render → state` straight through
  `cli`), endpoint sides are wrong, labels overlap. Passing needs reserved lanes for
  multi-row edges (Sugiyama dummy vertices), which is the start of the layout engine
  INTERFACE.md section 7 rules out. See "Layout belongs to the view" above.
- POC-3: `prototypes/poc-append/` — logic question "can the second layer be added onto
  Archify's generated HTML without a fork?" Answer: **yes, all four capabilities**, by an
  append step plus the shell; `archify check` stays 9/9. Facts that bind the design: node
  groups are `g[data-node-id]`; focus lands on `[data-focus-selected]` from every path;
  Archify has no `postMessage`, the bridge is ours; `?embed=1` hides the passport, so under
  embed our own overlay panel hosts the links; the append must re-run after every `deliver`.
  One open risk: Archify's canonical export (PNG, SVG) silently carries our layer, its
  sanitiser is a fixed denylist. See "Exports come from the canonical artifact only" above.
