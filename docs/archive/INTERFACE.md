> **Archived 2026-08-29.** Contract v0.2, frozen at this text. Its hard rules moved to
> `CONTEXT.md` § Invariants. Its first slice and non-goals moved to
> `docs/decisions/first-slice.md`. Sections 4 (HUD), 5 (Glue), and 8 (Later) stay here
> until a spec takes them.

# ADDONE Interface Contract

> **Status:** Decision  
> **Version:** v0.2  
> **Companion to:** `ADDONE.md` v0.2  
>
> `ADDONE.md` is why architecture is a development interface.  
> This file is how humans and agents actually meet.
>
> It is a contract, not a second vision.

---

## 1. Loop

```text
Human watches HTML HUD
        ↓  speaks intent
CLI conversation with agent
        ↓
Agent mutates JSON
        ↓  and code only inside SCOPE
Deterministic render(json) → html
        ↓
Browser live-reloads
```

Human attention stays on architectural meaning.  
Hands do not drag boxes or edit JSON in the happy path.

---

## 2. Three Surfaces

| Surface | Role | Writes? |
|---|---|---|
| JSON | Project architecture SSOT | Agent |
| HTML | Human HUD / projection | No |
| CLI | Human ↔ agent conversation | Human intent in; agent writes JSON/code out |

ASCII in the agent reply is a third projection of the same JSON.  
It exists so the human does not alt-tab for every sentence.

Markdown, Mermaid, Archify HTML, and PR text are also projections.  
None of them are source.

---

## 3. Hard Rules

1. **JSON is the only SSOT.** If it is not in JSON, it is not architecture state.
2. **`render(json) → html` is a pure function.** The render path never calls an LLM.
3. **Humans write only through CLI conversation.** The HUD is not an editor.
4. **Agent context and HTML compile from the same JSON.** If the human cannot see it on the HUD, the agent must not claim it as decided.
5. **Code changes require architectural closure and an active SCOPE.** Discussion-only sessions must not enable write guards.

Violation of (4) is the failure mode: chat and canvas diverge, trust dies.

---

## 4. HUD

The HTML page is an architecture HUD, not a poster and not a Figma.

It must show:

```text
Where        Architecture Address + breadcrumb
Intended     relations, ownership, constraints
Observed     extra / missing / changed edges
Open         questions the human should answer in CLI
Scope        writable paths; paths that need approval
Last change  implementation | contract | architecture | policy
```

It must not try to be:

- a layout-competition diagram
- a full codebase map
- a collaborative cursor canvas
- a JSON form

Semantic zoom is allowed. Pixel-zoom of a giant graph is not the point.

Prefer HTML + SVG + DOM. Do not start from the Canvas 2D API.

---

## 5. Glue

Without live reload, the interface is fiction.

Minimum:

```text
watch .addone/*.json
  → render
  → html
  → browser reload
```

A local static server is enough.  
No hosted app. No auth. No realtime collaboration.

Agent after a successful mutation:

1. write JSON
2. trigger render (or rely on watch)
3. reply with a short ASCII delta of what the HUD should now show
4. if code changed, name the SCOPE and change type

---

## 6. First Slice

Build only this, on ADDONE itself:

```text
CONTEXT     compile HUD + agent context from JSON
SCOPE       session-scoped write boundary hook
RECONCILE   intended JSON vs observed evidence
WATCH       json → html live reload
```

Success is not a prettier diagram.

Success is: same model, same task, same budget → fewer grep/read calls, fewer scope violations, fewer human reconstructions of “what did the agent do?”

Dogfood three features through this loop before adding GRILL UI, CARVE, or a native renderer.

---

## 7. Non-Goals

Do not build:

```text
HTML as an editor
<canvas> graph engine
own layout engine
Figma / IcePanel sync
hosted SaaS
multiplayer cursors
inline @arch annotation tax as a requirement
a second GitNexus
a second Archify
PLAN.md / SPEC.md / HUD.md / CLI.md / RENDERER.md
```

Archify may render a graph view from a projection of JSON.  
GitNexus may supply observed evidence.  
Both are adapters. Neither is ADDONE.

Sidecar JSON is the default persistence.  
Inline `@arch` signals are optional acceleration, not the interface.

---

## 8. Later, Not Now

Only after the first slice is used for real:

- HUD buttons that emit structured actions  
  (`reject_relation`, `approve_scope`, `answer_grill`)  
  still writing through JSON, not a second editor
- GRILL as one forced decision at a time, persisted immediately
- PR architecture delta as a projection of JSON diff
- CARVE as a second thesis, not as the bootstrap

If a HUD click appears, it is a write-back to JSON.  
The CLI remains valid. The HUD never becomes the SSOT.

---

## 9. Split of Documents

```text
ADDONE.md      why, primitives, research thesis
INTERFACE.md   how human, agent, json, html meet
.addone/       what this project has decided
Skill          how an agent should use ADDONE
Hook           what the runtime will not allow to be skipped
```

Do not grow more narrative docs.  
If a decision matters, it belongs in JSON or in this contract.
