// Element Spacing Measurer — content script.
// Runs only when the user clicks "Measure elements" in the popup.
// Hover-highlights elements, captures two clicks, draws a non-destructive
// SVG overlay with guide lines + pixel readouts. Esc cancels; everything is
// removed on clear. Nothing is ever sent anywhere.

'use strict';

(() => {
  // Guard against double-injection on repeated popup clicks.
  if (window.__esmInjected) return;
  window.__esmInjected = true;

  const ACCENT = '#22d3ee';
  const NS = 'http://www.w3.org/2000/svg';

  let measuring = false;
  let picks = [];            // captured {el, rect, info}
  let hoverEl = null;
  let overlay = null;        // root overlay div
  let svg = null;            // guide-line layer
  let lastResult = null;     // {a, b, rectA, rectB} for redraws on scroll

  /* ---------- element description ---------- */

  function describe(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id || '';
    const cls = (typeof el.className === 'string' ? el.className : '')
      .trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
    return { tag, id, cls };
  }

  /* ---------- overlay construction ---------- */

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = '__esm-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647',
      pointerEvents: 'none', margin: '0', padding: '0',
    });
    svg = document.createElementNS(NS, 'svg');
    Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    overlay.appendChild(svg);
    document.documentElement.appendChild(overlay);
  }

  function removeOverlay() {
    if (overlay) overlay.remove();
    overlay = null; svg = null;
    lastResult = null;
  }

  // Clear hover outline.
  function clearHover() {
    if (hoverEl) { hoverEl.style.outline = ''; hoverEl = null; }
  }

  /* ---------- geometry ---------- */

  // Edge-gap between two rects: 0 on an axis when they overlap on that axis.
  function gap(a, b) {
    const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
    const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
    return { dx, dy, diag: Math.sqrt(dx * dx + dy * dy) };
  }

  // Nearest point on rect r to point p.
  function nearestPoint(r, p) {
    return {
      x: Math.min(Math.max(p.x, r.left), r.right),
      y: Math.min(Math.max(p.y, r.top), r.bottom),
    };
  }

  function center(r) {
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
  }

  /* ---------- drawing ---------- */

  function el(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }

  function label(text, x, y) {
    const g = el('g', {});
    const t = el('text', {
      x, y: y - 8, 'text-anchor': 'middle',
      fill: ACCENT, 'font-size': '12', 'font-weight': '700',
      'font-family': 'ui-monospace, Menlo, monospace',
      stroke: '#0b0d12', 'stroke-width': '3', 'paint-order': 'stroke',
    });
    t.textContent = text;
    g.appendChild(t);
    return g;
  }

  function draw() {
    if (!overlay || picks.length < 2) return;
    svg.innerHTML = '';
    const [A, B] = picks;
    const rA = A.el.getBoundingClientRect();
    const rB = B.el.getBoundingClientRect();
    lastResult = { a: A, b: B, rA, rB };

    // Element outlines.
    for (const r of [rA, rB]) {
      svg.appendChild(el('rect', {
        x: r.left, y: r.top, width: r.width, height: r.height,
        fill: 'none', stroke: ACCENT, 'stroke-width': '2', rx: '3',
      }));
    }

    const { dx, dy, diag } = gap(rA, rB);
    const cA = center(rA), cB = center(rB);
    const pA = nearestPoint(rA, cB);
    const pB = nearestPoint(rB, cA);

    // Diagonal connector between nearest points.
    svg.appendChild(el('line', {
      x1: pA.x, y1: pA.y, x2: pB.x, y2: pB.y,
      stroke: ACCENT, 'stroke-width': '2',
    }));
    for (const p of [pA, pB]) {
      svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: '4', fill: ACCENT }));
    }
    svg.appendChild(label(`${Math.round(diag)} px`, (pA.x + pB.x) / 2, (pA.y + pB.y) / 2));

    // Horizontal + vertical dashed projections.
    if (dx > 0) {
      const y = Math.min(pA.y, pB.y);
      svg.appendChild(el('line', {
        x1: pA.x, y1: y, x2: pB.x, y2: y,
        stroke: ACCENT, 'stroke-width': '1.5', 'stroke-dasharray': '5 4', opacity: '0.85',
      }));
      svg.appendChild(label(`${Math.round(dx)}`, (pA.x + pB.x) / 2, y));
    }
    if (dy > 0) {
      const x = Math.min(pA.x, pB.x);
      svg.appendChild(el('line', {
        x1: x, y1: pA.y, x2: x, y2: pB.y,
        stroke: ACCENT, 'stroke-width': '1.5', 'stroke-dasharray': '5 4', opacity: '0.85',
      }));
      svg.appendChild(label(`${Math.round(dy)}`, x, (pA.y + pB.y) / 2));
    }
  }

  /* ---------- measure mode ---------- */

  function notify(msg) {
    // Popup may be closed; failure is harmless.
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  function onMouseMove(e) {
    if (!measuring) return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (t === hoverEl || !t || t === document.documentElement || t === document.body) {
      if (t !== hoverEl) clearHover();
      return;
    }
    clearHover();
    hoverEl = t;
    t.style.outline = `2px dashed ${ACCENT}`;
    t.style.outlineOffset = '2px';
  }

  function onClick(e) {
    if (!measuring) return;
    e.preventDefault();
    e.stopPropagation();
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (!t || t === document.documentElement) return;
    clearHover();

    const rect = t.getBoundingClientRect();
    picks.push({ el: t, info: describe(t) });
    // Mark the picked element with a solid outline (kept until clear).
    t.dataset.esmPicked = '1';
    t.style.outline = `2px solid ${ACCENT}`;
    t.style.outlineOffset = '2px';

    if (picks.length === 1) {
      ensureOverlay();
      notify({ type: 'esm-progress', text: 'First element picked — now pick the second…' });
    } else {
      finish();
    }
  }

  function onKeyDown(e) {
    if (measuring && e.key === 'Escape') cancel();
  }

  function onScroll() {
    if (overlay && picks.length === 2) draw(); // keep guides glued while scrolling
  }

  function start() {
    if (measuring) return;
    removeOverlay();
    restorePickedStyles();
    measuring = true;
    picks = [];
    ensureOverlay();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll, true);
    notify({ type: 'esm-progress', text: 'Pick the first element…' });
  }

  function teardownListeners() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll, true);
    measuring = false;
  }

  function restorePickedStyles() {
    document.querySelectorAll('[data-esm-picked]').forEach((n) => {
      n.style.outline = '';
      n.style.outlineOffset = '';
      delete n.dataset.esmPicked;
    });
  }

  function finish() {
    teardownListeners();
    clearHover();
    draw();
    const [A, B] = picks;
    const { dx, dy, diag } = gap(A.el.getBoundingClientRect(), B.el.getBoundingClientRect());
    const payload = {
      type: 'esm-done',
      a: A.info, b: B.info,
      h: Math.round(dx), v: Math.round(dy), diag: Math.round(diag),
    };
    // Persist so the popup can show the result even if it was closed.
    chrome.storage.local.set({ esm_last: payload }).catch(() => {});
    notify(payload);
    picks = [];
  }

  function cancel() {
    teardownListeners();
    clearHover();
    restorePickedStyles();
    removeOverlay();
    picks = [];
    notify({ type: 'esm-cancelled' });
  }

  function clear() {
    teardownListeners();
    clearHover();
    restorePickedStyles();
    removeOverlay();
    picks = [];
    chrome.storage.local.remove('esm_last').catch(() => {});
  }

  /* ---------- message bus ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'esm-ping') { sendResponse({ ok: true }); return true; }
    if (msg.type === 'esm-start') { start(); sendResponse({ ok: true }); return true; }
    if (msg.type === 'esm-clear') { clear(); sendResponse({ ok: true }); return true; }
    if (msg.type === 'esm-state') {
      sendResponse({ measuring, picks: picks.length });
      return true;
    }
    return false;
  });
})();
