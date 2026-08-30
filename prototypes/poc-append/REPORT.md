# POC-3 · appending ADDONE's second layer onto Archify

**Answer: yes, no fork.** All four capabilities work. Archify needs no change. The split is
append-first: the append does the work, the shell receives events and owns navigation.
Reproduce with `node append.mjs && node verify.mjs` — 28/28 pass, real headless Chrome 151.

## The four capabilities

- **1 · Status colour — `append`.** Own `rect[data-addone-layer=ring]` plus `data-addone-phase`
  on `g[data-node-id]`. Evidence: `out/shell-atrest.png` shows green `cli/skill/hooks`, amber
  `watch/scope`, grey-dashed `render/state`, and `human/hosts` untouched. Archify's semantic
  colours survive because the ring is a new **sibling** of the `c-<kind>` rect, never a
  replacement — `rect.c-frontend` count is identical to base. `.c-mask` is Archify's backing
  plate; the next `rect:not(.c-mask)` carries the type class.
- **2 · Double-click → shell — `append` + `shell`.** `svg.addEventListener('dblclick')` →
  `postMessage`. Archify binds **no** `dblclick` anywhere in `template.html`, so the gesture is
  free. Evidence: a real CDP double-click on `state` logged `node-open state` in the parent.
- **3 · Anchor badge — `append`.** Own `circle[data-addone-layer=anchor]` with
  `data-addone-anchor-state=match|drift` inside the node `g`. Evidence: 12 badges drawn; a real
  click posted `vscode://file//mnt/.../.addone/state.json:1`, built from the `{abs}`/`{line}`
  template in `layer.json`.
- **4 · Extra links — `append` on direct open, `shell` under embed.** Host is
  `.relationship-lens-copy` inside `#focus-chip`; Archify only clears `#focus-evidence-links`
  on a focus change, so an injected sibling survives. Evidence: `out/passport-extended.png`
  shows our two links inside the Semantic Passport, under "Authored reach".
  **The limit:** embed mode hides the passport outright with
  `html[data-embed="true"] .focus-chip { display: none !important }` (template.html:402). The
  runtime therefore paints two hosts — the passport, and `.addone-panel`, our own fixed overlay
  beside the focused node (`out/shell-focused.png`). The shell side panel is the third surface.

## Load-bearing DOM and runtime facts

- Node group is `g#node-<id>[data-node-id="<id>"]`; all nine sample ids present.
- Focus lands on `[data-node-id][data-focus-selected]` from all four paths — click,
  Enter/Space, node finder, `#focus=`. One `MutationObserver` covers every path, so no Archify
  function needs wrapping.
- `var Archify = {}` (template.html:5385) is a real global; the appended script runs after it
  and can call `Archify.focus.set/active`. This POC only reads the DOM, but the API is there.
- `#focus=<id>` still works under `?embed=1`; the embed guard blocks only `#relation=`
  (template.html:8804). The shell drives focus with `iframe.src = …?embed=1#focus=<id>`.
- Archify has **no** `postMessage` at all. The bridge is entirely ours, injected by the append.
- Native evidence links exist (`#focus-evidence-links`), but `meta.repository.url` is schema-
  locked to `^https://github\.com/…`, so a `vscode://` template needs our layer regardless.

## `archify check`

Identical before and after: `ok: true`, **9/9** artifact checks, composition `pass`
(0 errors, 1 warning — the warning is pre-existing in the sample).

`single_svg` is the one hard constraint: the checker regex-counts SVG blocks over the **raw
file text** and requires exactly 1. A literal SVG open tag anywhere in the payload — even in a
JS string or a code comment — fails it. Every SVG element is therefore built with
`createElementNS`, and `append.mjs` rejects any payload containing that literal or a script
close tag. Both guards fired on my own doc comments during development.

## What breaks Archify's export / PNG

`visual-check` is unchanged: base and appended produce the **same 3 diagnostics** with the same
pixel evidence. Those failures (955px overflow at 1440×900, one readability floor) are
pre-existing in the `--quality standard` sample, not caused by the append.

Canonical export is the real issue. Archify's sanitiser is a **fixed denylist of its own
attribute names**; a third-party layer is not in it. Measured: all 21 injected elements survive
`svg.cloneNode(true)`, **0/21** match the denylist, so `canonicalStateClean` still reports
`true` while the PNG/SVG silently carries our decoration. The rule is violated in substance
with no check firing. Mitigations, in order of honesty:

1. `AddoneLayer.strip()` on `#export-menu` click and `beforeprint` — what this POC does. It is
   one-way: after an export the layer is gone until reload. Proves the point, not shippable.
2. Keep the layer out of `<svg>` entirely, as an HTML overlay mirroring the pan/zoom transform.
   Costs geometry work; immune by construction.
3. Ask upstream for one generic hook, e.g. strip `[data-external-overlay]`. Cheapest real fix.

Our CSS does not leak: the exporter copies host rules only for selectors matching
`svg|:root|[data-theme|[data-preset|.c-|.t-|.a-|.m-`, and every selector here is
`addone-`-namespaced. An unstripped export carries unstyled geometry, not colour.

## Recommended split, and delivery order

- **Append** owns everything anchored to a node — status ring, badges, passport links, and the
  event bridge. It needs the SVG, which exists only inside the artifact.
- **Shell** owns everything that is not one map — opening a sub-map tab, resolving and opening
  `vscode://` links (an iframe should not navigate the host), and the side panel that survives
  an iframe reload.
- `deliver` writes the HTML atomically, so **the append must be a separate post-step and must
  re-run after every deliver**. Treat `appended.html` as a build product, never a source.
  `append.mjs` writes only its output file and never touches the input.

## Not proven

`vscode://file/{abs}:{line}` yields `vscode://file//mnt/...` — a double slash from joining a
root-anchored `{abs}`. The URL was never handed to a real editor; only the string was asserted.
Template joining needs a decision before use.

---

Written by the POC-3 subagent (Opus), saved by the main session; the subagent's harness did
not allow it to write this file itself.
