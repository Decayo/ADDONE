# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring
the codebase. Layout is **single-context**.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you're about to work in

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't
suggest creating them upfront. The `domain-modeling` skill (reached via `grill-with-docs`)
creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-<slug>.md
│   └── 0002-<slug>.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a
hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms
the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently
overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## This repo defines its own vocabulary

`ADDONE.md` introduces terms with specific meanings that differ from their ordinary use:
Architecture Address, Semantic Skeleton, Architecture Signal, Evidence, Intended vs
Observed, Discovery Tax, Architecture Pressure. `ADDONE.md` is a vision document, not a
glossary, and it is not the place to look up one term.

When `CONTEXT.md` exists, it is the glossary. Until then, treat `ADDONE.md` section headings
as the provisional source and expect drift.
