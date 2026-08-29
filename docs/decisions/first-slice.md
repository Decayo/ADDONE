# Change: First slice

**Status:** settled
**Route:** large

## Outcome

CONTEXT, SCOPE, RECONCILE, and WATCH exist, with ADDONE itself as the architecture they
describe, and with a SCOPE hook that blocks an out-of-bounds write on both Claude Code and
Codex. Success is measured on the same task with the same model and budget: fewer grep and
read calls, fewer scope violations, fewer human reconstructions of what the agent did.

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

None.

## Domain references

- `CONTEXT.md` — vocabulary and the six invariants.

## Artifacts

- Spec: None. `docs/archive/INTERFACE.md` sections 4, 5, and 8 hold the HUD contents, the
  live-reload minimum, and the deferred list a spec will draw from.
- Work tickets: None.
- Review: None.
- Delivery: None.
