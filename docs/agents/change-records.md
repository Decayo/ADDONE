# Change records

- **Decision root:** `docs/decisions`
- **Decision registry:** `docs/decisions/README.md`
- **Record path:** `docs/decisions/<feature-slug>.md`

## Registry contract

The registry contains one entry per feature. Each entry has the feature name, current
status, and one relative link to the canonical record. It does not copy the record, spec,
ticket, review, or delivery body.

## Canonical record contract

Create one record per feature with this shape.

```markdown
# Change: <feature name>

**Status:** discussing | settled | planned | implementing | reviewing | delivered | paused
**Route:** very-small | small | large | foggy

## Outcome

<The user-visible or operational result.>

## Settled decisions

- **[<stable-id>] <decision>.** <Reason and relevant constraint.>

## Rejected alternatives

- **[<stable-id>] <alternative>.** <Why it was rejected.>

## Open decisions

- **[<stable-id>] <question>.** <What must be settled first.>

Write `None.` when the planning frontier is empty.

## Domain references

- <Relative link to a relevant glossary entry or ADR.>

Write `None.` when no domain document applies.

## Artifacts

- Spec: <relative link or `None`>
- Work tickets:
  - <native ticket link or `None`>
- Review: <relative link or `None`>
- Delivery: <relative link or `None`>
```

Keep decision detail in this record. Keep each linked artifact's body at its native path.

## Relationship to `.addone/`

This repo is the dogfood target of the tool it describes. Two decision stores will coexist,
and they own different things:

- `docs/decisions/` owns **how this repo is built**: the planning frontier, rejected
  alternatives, and the reasoning behind each choice.
- `.addone/decisions/` will own **what this repo's architecture means**: decisions compiled
  into architecture state, addressable by architecture ID.

A decision that changes architecture state belongs in both: the reasoning here, the compiled
result there. Do not duplicate the body. Link.
