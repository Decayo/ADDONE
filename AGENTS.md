# AGENTS.md

ADDONE makes architecture the working interface between a human and coding agents.
Architecture intent lives as tracked JSON under `.addone/`; an agent compiles its context
from that state instead of rediscovering the repo by grep each session.

Where we are: nothing is built. The skeleton, the tests, the host hooks, the skill, every
ticket, and `.addone/` itself were deleted on 2026-08-31 (commits `89bcec8`, `8d52944`,
and the one that follows them), because every one of them described something that was
never built or was never run by the person who owns this repo.

What is left is a change record. `docs/decisions/first-slice.md` holds eleven settled
decisions that govern the first slice and eighteen later ones that describe stages with no
code. A later decision is not a premise.

The first slice is `addone doctor`, then `addone init`, then `addone ascii`. `doctor`
measures this machine and reports what the tool can actually do here. `init` writes the
`.addone/` that doctor's findings imply. `ascii` prints the architecture as text. No web
UI, no Archify, no link routing, until those three run.

## Read first

- `CONTEXT.md` — the vocabulary this repo speaks, and six invariants every change obeys.
  Use its terms in tickets, tests, and replies.
- `docs/decisions/first-slice.md` — what is settled and why. Reopen a decision by editing
  the record.
- `docs/archive/` — the vision and the original contract, frozen. Read for the reasoning
  behind a primitive.

## Working rules

- Architecture closes first, then a ticket names the change, then code. Spend attention on
  the architecture and the skeleton; implementation follows.
- The agent maintains metadata, anchors, signals, and bookkeeping.
- Report a change in prose. When prose outgrows a screen, use a table or an ASCII block.
  When that outgrows a page, publish a page and link it.
- Build the core. Between two working options, maintainability decides.

## Runtime

TypeScript on Node 26, run directly. No build step. A binary release is a later stage and
would be Go or Rust.

## Agent skills

### Issue tracker

GitHub Issues on `Decayo/ADDONE`, through `gh`. See `docs/agents/issue-tracker.md`.

### Change records

Decision root `docs/decisions/`, indexed by `docs/decisions/README.md`. See
`docs/agents/change-records.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root, `docs/adr/` created lazily. See
`docs/agents/domain.md`.
