#!/usr/bin/env node
/* POC-3 · verify.mjs — drives shell.html in headless Chrome over CDP.
 * No dependencies: Node 26 ships a global WebSocket, Chrome ships the protocol.
 * Writes out/shell-focused.png. Exits non-zero if any assertion fails. */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/usr/bin/google-chrome-stable';
const PORT = 9333;
const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  — ' + note : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox',
  '--user-data-dir=/tmp/poc-append-chrome', '--window-size=1600,1000',
  '--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1',
  'about:blank',
], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
const contexts = [];

function send(method, params = {}, sessionId) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => pending.set(msgId, { res, rej }));
}

async function evalIn(expr, contextId) {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
    ...(contextId ? { contextId } : {}),
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
}

try {
  // --- connect ---
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; }
    catch { await sleep(250); }
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method === 'Runtime.executionContextCreated') {
      contexts.push(m.params.context);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  const url = 'file://' + path.join(here, 'shell.html');
  await send('Page.navigate', { url });
  await sleep(4000); // the artifact is 730 KB with a large inline runtime

  // Pick the context whose document is the appended artifact, by asking each.
  let iframeCtx = null;
  for (const c of contexts) {
    try {
      if (/appended\.html/.test(await evalIn('location.href', c.id))) { iframeCtx = c; break; }
    } catch { /* stale context */ }
  }
  check('iframe execution context found', !!iframeCtx, iframeCtx ? `contextId ${iframeCtx.id}` : 'none matched appended.html');

  // --- the layer actually installed itself inside the iframe ---
  const layer = await evalIn(`JSON.stringify({
    embed: document.documentElement.getAttribute('data-embed'),
    archify: typeof Archify,
    api: typeof window.AddoneLayer,
    rings: document.querySelectorAll('[data-addone-layer="ring"]').length,
    badges: document.querySelectorAll('[data-addone-layer="anchor"]').length,
    phased: document.querySelectorAll('[data-addone-phase]').length,
    phases: Array.from(document.querySelectorAll('[data-addone-phase]')).map(n => n.getAttribute('data-node-id') + ':' + n.getAttribute('data-addone-phase')).sort(),
    typeRects: document.querySelectorAll('rect[class^="c-"]').length,
    ringStroke: getComputedStyle(document.querySelector('[data-node-id="cli"] [data-addone-layer="ring"]')).stroke,
    cliTypeRectFill: document.querySelector('[data-node-id="cli"] rect.c-frontend') ? 'c-frontend intact' : 'MISSING',
    passportHidden: getComputedStyle(document.getElementById('focus-chip')).display
  })`, iframeCtx.id).then(JSON.parse);

  check('embed mode active', layer.embed === 'true');
  check('global Archify reachable from appended script', layer.archify === 'object');
  check('layer runtime installed', layer.api === 'object');
  check('status rings drawn', layer.rings === 9, `${layer.rings} rings, one per layer node`);
  check('anchor badges drawn', layer.badges === 12, `${layer.badges} badges`);
  check('semantic type rect untouched', layer.cliTypeRectFill === 'c-frontend intact');
  check('phase colour resolved by CSS', /rgb\(63, ?185, ?80\)/.test(layer.ringStroke), `cli ring stroke = ${layer.ringStroke}`);
  check('phases assigned', layer.phased === 7, layer.phases.join(' '));
  check('Archify passport hidden in embed mode', layer.passportHidden === 'none', `.focus-chip display:${layer.passportHidden}`);

  // --- screenshot 1: the status layer at rest, before any focus dimming ---
  const rest = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(here, 'out/shell-atrest.png'), Buffer.from(rest.data, 'base64'));
  check('at-rest screenshot written', true, 'out/shell-atrest.png');

  // --- capability: shell drives the iframe with #focus= ---
  await evalIn(`document.querySelectorAll('#focusButtons button')[4].click()`); // cli
  await sleep(3500);
  const focused = await evalIn(`JSON.stringify({
    node: document.getElementById('node').textContent,
    phase: document.getElementById('phase').textContent,
    links: document.getElementById('links').textContent,
    anchors: document.getElementById('anchors').textContent,
    log: document.getElementById('log').textContent.split('\\n')[0]
  })`).then(JSON.parse);
  check('#focus= drove the iframe and node-focus reached the shell', focused.node === 'cli', `panel node = "${focused.node}", log = "${focused.log}"`);
  check('shell shows the focused node phase', focused.phase === 'changed', focused.phase);
  check('shell shows the node links', /CONTEXT\.md/.test(focused.links), focused.links.replace(/\s+/g, ' ').trim());
  check('shell shows anchors with lines', /src\/cli\.ts:24/.test(focused.anchors), focused.anchors.replace(/\s+/g, ' ').trim());

  // --- capability: our own overlay stands in for the hidden passport ---
  const panel = await evalIn(`JSON.stringify({
    hidden: document.getElementById('addone-panel').hidden,
    text: document.getElementById('addone-panel').textContent,
    passportExtra: !!document.getElementById('addone-passport-extra')
  })`, iframeCtx.id).then(JSON.parse);
  check('in-iframe overlay panel shown next to focused node', panel.hidden === false, panel.text.replace(/\s+/g, ' ').trim());
  check('extra links also injected into the passport DOM', panel.passportExtra === true);

  // --- capability: real double click on the node reaches the parent ---
  const box = await evalIn(`JSON.stringify(document.querySelector('[data-node-id="state"]').getBoundingClientRect())`, iframeCtx.id).then(JSON.parse);
  const cx = Math.round(box.x + box.width / 2), cy = Math.round(box.y + box.height / 2);
  for (const clickCount of [1, 2]) {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: cx, y: cy, button: 'left', clickCount, buttons: 1 });
    }
  }
  await sleep(1200);
  const log = await evalIn(`document.getElementById('log').textContent`);
  check('double click posted node-open to the shell', /node-open\s+state/.test(log), (log.split('\n').find((l) => /node-open/.test(l)) || log.split('\n')[0]).trim());

  // --- capability: anchor badge click carries the templated URL out ---
  const bbox = await evalIn(`JSON.stringify(document.querySelector('[data-node-id="state"] [data-addone-layer="anchor"]').getBoundingClientRect())`, iframeCtx.id).then(JSON.parse);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(bbox.x + bbox.width / 2), y: Math.round(bbox.y + bbox.height / 2), button: 'left', clickCount: 1, buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(bbox.x + bbox.width / 2), y: Math.round(bbox.y + bbox.height / 2), button: 'left', clickCount: 1, buttons: 1 });
  await sleep(800);
  const log2 = await evalIn(`document.getElementById('log').textContent`);
  const anchorLine = (log2.split('\n').find((l) => /anchor-open/.test(l)) || '').trim();
  check('anchor badge click posted the templated URL', /vscode:\/\/file\/.*:\d+/.test(anchorLine), anchorLine);

  /* --- what the canonical export would contain.
     Archify decides "clean" with a fixed denylist of its own attribute names
     (template.html, canonicalStateClean). A third-party layer is not in that
     list, so the export reports clean while carrying our elements. --- */
  const DENY = '[data-story-overlay],[data-focus-match],[data-focus-selected],[data-semantic-lens-overlay],' +
    '[data-intent-trace-overlay],[data-route-probe-overlay],[data-relationship-hit-overlay],' +
    '[data-relationship-pulse-overlay],[data-source-evidence-beacon],[data-detail],[data-detail-anchor]';
  const exportProbe = await evalIn(`(function () {
    var svg = document.querySelector('.diagram-container svg');
    var clone = svg.cloneNode(true);
    var mine = Array.prototype.slice.call(clone.querySelectorAll('[data-addone-layer]'));
    // How many of OUR elements would Archify's sanitiser recognise and remove?
    var caught = mine.filter(function (n) { return n.matches('${DENY}'); }).length;
    window.AddoneLayer.strip();
    var after = svg.cloneNode(true).querySelectorAll('[data-addone-layer]').length;
    return JSON.stringify({ ours: mine.length, caught: caught, after: after });
  })()`, iframeCtx.id).then(JSON.parse);
  check('layer WOULD ride into an unstripped export clone', exportProbe.ours > 0, `${exportProbe.ours} of our elements survive svg.cloneNode(true)`);
  check('Archify\'s sanitiser catches none of them', exportProbe.caught === 0,
    `${exportProbe.caught}/${exportProbe.ours} matched the denylist, so canonicalStateClean still reports true`);
  check('AddoneLayer.strip() removes it again', exportProbe.after === 0);

  // --- screenshot ---
  await evalIn(`document.querySelectorAll('#focusButtons button')[4].click()`);
  await sleep(3500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const png = path.join(here, 'out/shell-focused.png');
  fs.writeFileSync(png, Buffer.from(shot.data, 'base64'));
  check('screenshot written', fs.statSync(png).size > 20000, `out/shell-focused.png ${fs.statSync(png).size} bytes`);

  /* --- the append-only case: open the artifact directly, no shell, no embed.
         Here Archify's Semantic Passport is visible, so capability 4 can live
         inside it rather than in an overlay of our own. --- */
  contexts.length = 0;
  await send('Page.navigate', { url: 'file://' + path.join(here, 'out/appended.html') + '#focus=cli' });
  await sleep(4500);
  const direct = await evalIn(`JSON.stringify({
    embed: document.documentElement.getAttribute('data-embed'),
    chipHidden: document.getElementById('focus-chip').hidden,
    chipDisplay: getComputedStyle(document.getElementById('focus-chip')).display,
    extraInChip: document.getElementById('focus-chip').contains(document.getElementById('addone-passport-extra')),
    extraVisible: document.getElementById('addone-passport-extra')
      ? getComputedStyle(document.getElementById('addone-passport-extra')).display : 'absent',
    extraText: (document.getElementById('addone-passport-extra') || {}).textContent || '',
    focusedByHash: (document.querySelector('[data-node-id][data-focus-selected]') || {}).id || 'none'
  })`).then(JSON.parse);
  check('direct open is not embed mode', direct.embed === null);
  check('#focus= in the URL focused the node on load', direct.focusedByHash === 'node-cli', direct.focusedByHash);
  check('Archify passport is visible when not embedded', direct.chipHidden === false && direct.chipDisplay !== 'none', `display:${direct.chipDisplay}`);
  check('our links live inside Archify\'s passport', direct.extraInChip === true && direct.extraVisible !== 'none', direct.extraText.replace(/\s+/g, ' ').trim());
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(here, 'out/passport-extended.png'), Buffer.from(shot2.data, 'base64'));
  check('passport screenshot written', true, 'out/passport-extended.png');
} catch (err) {
  check('driver completed', false, err.message);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
