#!/usr/bin/env node
/* POC-3 · append.mjs
 *
 * QUESTION
 *   Can ADDONE's second layer (status colour, double-click-to-open, anchor
 *   badges, extra passport links) be added to a generated Archify architecture
 *   HTML without forking Archify's renderer?
 *
 * ANSWER THIS FILE TESTS
 *   Yes, as a post-step: splice one <style>, one JSON <script>, and one
 *   behaviour <script> in front of </body>. Archify's own markup is copied
 *   byte for byte; nothing above </body> is rewritten.
 *
 * WRITE BOUNDARY
 *   Reads  <input.html>, <layer.json>, runtime/layer.css, runtime/layer.js.
 *   Writes exactly one file, <output.html> (default out/appended.html).
 *   Never writes to the input, and never to anything outside this folder.
 *   `archify deliver` commits its HTML atomically, so this must run AFTER
 *   delivery, as a separate step, and must be re-run after every re-deliver.
 *
 * USAGE
 *   node append.mjs [input.html] [layer.json] [output.html]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (i, fallback) => path.resolve(here, process.argv[i + 2] ?? fallback);

const inputPath = arg(0, 'out/base.html');
const layerPath = arg(1, 'layer.json');
const outputPath = arg(2, 'out/appended.html');

const html = fs.readFileSync(inputPath, 'utf8');
const layerRaw = fs.readFileSync(layerPath, 'utf8');
const css = fs.readFileSync(path.join(here, 'runtime/layer.css'), 'utf8');
const js = fs.readFileSync(path.join(here, 'runtime/layer.js'), 'utf8');

JSON.parse(layerRaw); // fail loudly on a malformed layer rather than shipping it

/* Guard 1 — `single_svg`. Archify's artifact checker counts
 * /<svg\b[\s\S]*?<\/svg>/gi over the raw file text and requires exactly 1.
 * A literal "<svg" in our payload — even inside a JS string — opens a second
 * match and fails the check. Every SVG element in runtime/layer.js is built
 * with createElementNS for this reason. */
for (const [name, body] of [['layer.css', css], ['layer.js', js], ['layer.json', layerRaw]]) {
  if (/<svg\b/i.test(body)) {
    throw new Error(`${name} contains a literal "<svg"; that would break archify check single_svg`);
  }
  if (/<\/script/i.test(body)) {
    throw new Error(`${name} contains "</script"; that would close the injected block early`);
  }
}

/* Guard 2 — the splice point. We only ever replace the final </body>. */
const marker = html.lastIndexOf('</body>');
if (marker < 0) throw new Error('no </body> in input; not an Archify artifact?');

/* JSON in a <script type="application/json"> block is data, not code: the
 * only sequences that can escape it are "</script" (rejected above) and a
 * lone "<!--". Neutralise the latter defensively. */
const layerJson = layerRaw.replace(/<!--/g, '<\\u0021--');

const block = [
  '',
  '  <!-- ADDONE second layer · appended by prototypes/poc-append/append.mjs.',
  '       Everything above this comment is Archify output, untouched. -->',
  `  <style id="addone-layer-style">\n${css}\n  </style>`,
  `  <script id="addone-layer-data" type="application/json">${layerJson}</script>`,
  `  <script id="addone-layer-runtime">\n${js}\n  </script>`,
  '',
].join('\n');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html.slice(0, marker) + block + html.slice(marker), 'utf8');

/* Receipt. The prefix assertion is the load-bearing claim: the appended file
 * is the Archify artifact plus a suffix, so the single <svg> block, the node
 * geometry, and every Archify script are bit-identical. */
const out = fs.readFileSync(outputPath, 'utf8');
const nodeIds = [...new Set([...html.matchAll(/data-node-id="([a-z0-9_-]+)"/gi)].map((m) => m[1]))];
console.log(JSON.stringify({
  input: path.relative(here, inputPath),
  output: path.relative(here, outputPath),
  inputBytes: Buffer.byteLength(html, 'utf8'),
  outputBytes: Buffer.byteLength(out, 'utf8'),
  appendedBytes: Buffer.byteLength(out, 'utf8') - Buffer.byteLength(html, 'utf8'),
  archifyPrefixIntact: out.startsWith(html.slice(0, marker)),
  svgBlocks: (out.match(/<svg\b[\s\S]*?<\/svg>/gi) || []).length,
  nodeIdsInArtifact: nodeIds,
  layerNodes: Object.keys(JSON.parse(layerRaw).nodes || {}),
}, null, 2));
