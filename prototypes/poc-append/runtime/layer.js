/* ADDONE second layer — appended runtime.
   Runs after Archify's own scripts, so `window.Archify` (var Archify = {} at
   template.html:5385) is already built.

   Two hard constraints this file obeys, both verified by append.mjs:
   - No literal SVG open tag anywhere. Archify's artifact checker regex-counts
     SVG blocks over the raw file text and fails `single_svg` at 2. Every SVG
     element here is built with createElementNS instead. append.mjs enforces
     this — the exact regex lives there.
   - No script close tag. This file ships inlined inside a script block, so
     the literal sequence would end that block early. Also enforced by
     append.mjs.

   All injected SVG elements carry data-addone-layer, so one selector can
   lift the whole layer back out again (see stripLayer, used before export). */
(function () {
  'use strict';
  var el = document.getElementById('addone-layer-data');
  if (!el) return;
  var DATA = JSON.parse(el.textContent);
  var NS = 'http://www.w3.org/2000/svg';
  var embed = document.documentElement.getAttribute('data-embed') === 'true';
  var svg = document.querySelector('.diagram-container svg');
  if (!svg) return;

  function entry(id) { return (DATA.nodes || {})[id] || {}; }
  function post(type, body) {
    if (window.parent === window) return;
    body = body || {};
    body.source = 'addone';
    body.type = type;
    window.parent.postMessage(body, '*');
  }
  function openUrl(a) {
    return String(DATA.openTemplate || '')
      .replace(/\{abs\}/g, (DATA.repoRoot || '') + '/' + a.path)
      .replace(/\{path\}/g, a.path)
      .replace(/\{line\}/g, String(a.line));
  }
  function anchorsOf(id) {
    return (entry(id).anchors || []).map(function (a) {
      return { path: a.path, line: a.line, state: a.state || 'match', url: openUrl(a) };
    });
  }

  /* ---- capability 1 + 3: decorate every node the layer names ---- */
  Object.keys(DATA.nodes || {}).forEach(function (id) {
    var g = svg.querySelector('[data-node-id="' + id + '"]');
    if (!g) return;
    var e = entry(id);
    if (e.phase && e.phase !== 'none') g.setAttribute('data-addone-phase', e.phase);

    // The semantic type rect stays exactly as Archify wrote it. `.c-mask` is
    // Archify's backing plate; the next rect carries `.c-<kind>`.
    var box = g.querySelector('rect:not(.c-mask)');
    if (!box) return;
    var x = parseFloat(box.getAttribute('x')), y = parseFloat(box.getAttribute('y'));
    var w = parseFloat(box.getAttribute('width')), h = parseFloat(box.getAttribute('height'));

    var ring = document.createElementNS(NS, 'rect');
    ring.setAttribute('data-addone-layer', 'ring');
    ring.setAttribute('x', x - 3); ring.setAttribute('y', y - 3);
    ring.setAttribute('width', w + 6); ring.setAttribute('height', h + 6);
    ring.setAttribute('rx', '8');
    g.appendChild(ring);

    anchorsOf(id).forEach(function (a, i) {
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('data-addone-layer', 'anchor');
      dot.setAttribute('data-addone-anchor-state', a.state);
      dot.setAttribute('cx', x + w - 6 - i * 9);
      dot.setAttribute('cy', y - 4);
      dot.setAttribute('r', '3.2');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('role', 'link');
      dot.setAttribute('aria-label', a.path + ' line ' + a.line + ', ' + a.state);
      var t = document.createElementNS(NS, 'title');
      t.textContent = a.path + ':' + a.line + ' (' + a.state + ')';
      dot.appendChild(t);
      dot.addEventListener('click', function (ev) {
        ev.stopPropagation();           // do not also focus the node
        post('anchor-open', { nodeId: id, anchor: a });
        if (!embed) window.open(a.url, '_blank');
      });
      g.appendChild(dot);
    });
  });

  /* ---- capability 2: double click. Archify binds no dblclick anywhere,
         so the gesture is free. The two clicks underneath still focus. ---- */
  svg.addEventListener('dblclick', function (ev) {
    var g = ev.target.closest('[data-node-id]');
    if (!g) return;
    ev.preventDefault();
    post('node-open', { nodeId: g.getAttribute('data-node-id') });
  });

  /* ---- capability 4: extra links on focus ---- */
  function linkRow(l) {
    var a = document.createElement('a');
    a.className = 'addone-link';
    a.href = l.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.setAttribute('data-addone-kind', l.kind || 'doc');
    a.textContent = l.label;
    return a;
  }
  function fill(box, id) {
    box.textContent = '';
    var links = id ? (entry(id).links || []) : [];
    links.forEach(function (l) { box.appendChild(linkRow(l)); });
    box.hidden = links.length === 0;
  }

  // Host A — inside Archify's Semantic Passport. `.relationship-lens-copy`
  // survives a focus change: Archify only clears #focus-evidence-links.
  function paintPassport(id) {
    var host = document.querySelector('.relationship-lens-copy');
    if (!host) return;
    var box = document.getElementById('addone-passport-extra');
    if (!box) {
      box = document.createElement('div');
      box.id = 'addone-passport-extra';
      box.className = 'addone-links';
      host.appendChild(box);
    }
    fill(box, id);
  }

  // Host B — our own overlay, next to the focused node. Needed in embed mode:
  // Archify hides .focus-chip with `display: none !important` there.
  function paintPanel(id) {
    var panel = document.getElementById('addone-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'addone-panel';
      panel.className = 'addone-panel';
      panel.innerHTML = '<strong class="addone-panel-title"></strong>' +
        '<span class="addone-panel-phase"></span><div class="addone-links"></div>';
      document.body.appendChild(panel);
    }
    var g = id && svg.querySelector('[data-node-id="' + id + '"]');
    if (!g) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.querySelector('.addone-panel-title').textContent = id;
    panel.querySelector('.addone-panel-phase').textContent =
      'phase: ' + (entry(id).phase || 'none') + ' · anchors: ' + anchorsOf(id).length;
    fill(panel.querySelector('.addone-links'), id);
    var r = g.getBoundingClientRect();
    panel.style.left = Math.min(r.right + 10, window.innerWidth - 290) + 'px';
    panel.style.top = Math.max(8, r.top) + 'px';
  }

  /* Focus arrives four ways — click, Enter/Space, the node finder, and
     #focus= in the URL. All four land on the same attribute, so one
     MutationObserver covers every path. */
  var last = null;
  function sync() {
    var n = svg.querySelector('[data-node-id][data-focus-selected]');
    var id = n ? n.getAttribute('data-node-id') : null;
    if (id === last) return;
    last = id;
    paintPassport(id);
    if (embed) paintPanel(id);
    post('node-focus', {
      nodeId: id,
      phase: id ? (entry(id).phase || 'none') : null,
      links: id ? (entry(id).links || []) : [],
      anchors: id ? anchorsOf(id) : []
    });
  }
  new MutationObserver(sync).observe(svg, {
    subtree: true, attributes: true, attributeFilter: ['data-focus-selected']
  });
  sync();

  /* Archify's export sanitiser is a fixed denylist of its own attribute
     names, so a third-party layer would ride into the canonical PNG/SVG
     unnoticed. Strip it ourselves before any export runs. */
  function stripLayer() {
    Array.prototype.forEach.call(svg.querySelectorAll('[data-addone-layer]'), function (n) { n.remove(); });
    Array.prototype.forEach.call(svg.querySelectorAll('[data-addone-phase]'), function (n) {
      n.removeAttribute('data-addone-phase');
    });
  }
  var menu = document.getElementById('export-menu') || document.querySelector('.export-menu');
  if (menu) menu.addEventListener('click', stripLayer, true);
  window.addEventListener('beforeprint', stripLayer);

  window.AddoneLayer = { data: DATA, strip: stripLayer, focused: function () { return last; } };
})();
