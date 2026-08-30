# ADDONE

Architecture as the working interface between a human and coding agents. The human decides
architectural intent; agents compile it into context, boundaries, skeletons, and code, and
return evidence. The purpose is to reduce the load on both.

## Language

### Primitives

**CONTEXT**:
The smallest architectural context an agent needs for one task, compiled from architecture
state. An agent reads it instead of rediscovering the repo.

**GRILL**:
Resolving an architectural ambiguity by asking the human one forced decision at a time and
persisting each answer as state.
_Avoid_: discussion, brainstorm

**SKELETON**:
Architecture made physical before business logic: folders, shells, signatures, TODOs,
signals.
_Avoid_: scaffold, boilerplate

**SCOPE**:
A write boundary compiled from architecture for one agent session, enforced by the host.
_Avoid_: permission, sandbox

**RECONCILE**:
Comparing intended architecture with observed evidence and surfacing every difference as a
decision for the human. Intent changes only by decision.
_Avoid_: sync

**CARVE**:
Extracting a semantic skeleton from an existing implementation: contracts and
responsibilities kept, framework detail dropped.

### State and projections

**Architecture state**:
The tracked JSON under `.addone/`. The only source of truth for what the architecture means.
_Avoid_: architecture docs, diagram

**Projection**:
Any rendering of architecture state: the HUD, ASCII in a reply, markdown, PR text, agent
context. A projection is read, not edited.
_Avoid_: export, report

**HUD**:
The HTML projection a human watches. It shows where, intended, observed, open, scope, and
last change.
_Avoid_: dashboard, canvas, editor

**Architecture Address**:
A stable dotted id with a parent (`payment.jp.sms`, parent `payment.jp`). It says what code
means in the system, where a file path says only where the code is.
_Avoid_: path, namespace

**Anchor**:
The binding from an Architecture Address to a file and a symbol.

**Architecture Signal**:
A semantic landmark in or beside source (`@arch.id` inline, or a sidecar anchor) that an
agent compiles from a decision. Optional acceleration.
_Avoid_: annotation, tag

### Evidence

**Evidence**:
Anything observed rather than intended: source, grep, git history, AST, tests, telemetry.
Code is evidence, not truth.

**Intended**:
What architecture state says is true.

**Observed**:
What evidence says is true. RECONCILE compares Observed against Intended.

**Sync**:
Deterministic bookkeeping after a rename or move: line numbers, paths, anchors. It
self-heals and never touches intent.

**Discovery Tax**:
The cost an agent pays rediscovering a repo each session by listing, grepping, and reading.
CONTEXT exists to remove it.

### Loop

**Phase**:
Where one entity is in the loop: `architecture`, `skeleton`, `implementing`, `reconciled`.
Todo is derived from it and never stored. An entity without a phase is not ours to build.
_Avoid_: status, progress

**Slot**:
One stage of the loop with a core-defined interface and swappable adapters: host,
install, state mode, write path, render, watch, enforce, evidence. `init` walks them in
that order and records each choice and its progress.
_Avoid_: plugin, provider, backend

### Rules and change

**Change type**:
One of implementation, contract, architecture, policy. It decides how much review a change
earns.

**Rule kind**:
One of structural invariant (an error), architecture policy (fails CI), architecture smell
(opens a GRILL). Each kind keeps its own severity.

**Assurance**:
The level of engineering guarantee a region needs, declared in state (`standard`,
`critical`). A skill or profile decides how to meet it; state says only how much.

**Architecture Pressure**:
Size and fan-out measures on one address that open a GRILL. A signal, not a verdict.

## Invariants

1. Architecture state is the only source of truth. What is not in `.addone/` JSON is not
   architecture.
2. `render(state) → html` is a pure function. It never calls a model.
3. A human writes architecture only through the CLI conversation. The HUD is a projection.
4. Agent context and the HUD compile from the same state. What a human cannot see on the
   HUD, an agent cannot claim as decided.
5. Code changes need architectural closure and an active SCOPE. A discussion session never
   enables a write guard.
6. `id`, `parent`, `kind`, and `owner` are single-valued. Every relation is one object,
   reviewed on its own.
