/* 3D Layer Exploder — content script (injected on explicit click only).
 * Builds an overlay of simplified layer CLONES; the real page DOM is never modified.
 * Guards against double injection. */
'use strict';

if (window.__layerExploderLoaded) {
  // Already injected: just forward to the running instance via a custom event.
} else {
  window.__layerExploderLoaded = true;

  const OVERLAY_ID = '__lx_overlay';
  let state = null; // { overlay, stage, layers, spinDeg, tilt, spread, spin, raf }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE']);

  /** Collect up to N visible, reasonably-sized elements. */
  function collectElements() {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode()) && out.length < 140) {
      if (SKIP.has(node.tagName)) continue;
      if (node.closest('#' + OVERLAY_ID)) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 24 || r.height < 16) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      // Keep only elements with no element children already collected (avoid nested dupes).
      out.push({ el: node, rect: r, tag: node.tagName.toLowerCase(),
                 z: cs.zIndex === 'auto' ? 'auto' : cs.zIndex });
    }
    // Drop nested duplicates: keep the outermost of overlapping same-position nodes.
    const seen = new Set();
    return out.filter((it) => {
      const key = `${it.tag}:${Math.round(it.rect.left)}:${Math.round(it.rect.top)}:${Math.round(it.rect.width)}x${Math.round(it.rect.height)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 120);
  }

  function buildOverlay(items, opts) {
    destroy();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:hidden;' +
      'background:rgba(8,10,16,.82);backdrop-filter:blur(2px);cursor:grab;';
    const stage = document.createElement('div');
    stage.style.cssText = 'position:absolute;left:50%;top:50%;width:100vw;height:100vh;' +
      'transform-style:preserve-3d;';
    overlay.appendChild(stage);
    document.documentElement.appendChild(overlay);

    const layers = items.map((it, i) => {
      const d = document.createElement('div');
      const hue = (i * 37) % 360;
      d.style.cssText = `position:absolute;left:${it.rect.left + innerWidth / 2 - 0}px;` +
        `top:${it.rect.top}px;width:${it.rect.width}px;height:${it.rect.height}px;` +
        `transform:translate(-50%,0) translateZ(${-i * opts.spread}px);` +
        `background:hsla(${hue},70%,55%,.28);border:1.5px solid hsla(${hue},70%,60%,.9);` +
        'border-radius:6px;box-sizing:border-box;pointer-events:none;';
      const label = document.createElement('span');
      label.textContent = `${it.tag}${it.z !== 'auto' ? ' · z:' + it.z : ''}`;
      label.style.cssText = 'position:absolute;left:6px;top:4px;font:600 11px/1.2 system-ui,sans-serif;' +
        `color:hsl(${hue},80%,72%);text-shadow:0 1px 3px #000;white-space:nowrap;`;
      d.appendChild(label);
      stage.appendChild(d);
      return d;
    });

    state = { overlay, stage, layers, spinDeg: 0, tilt: opts.tilt, spread: opts.spread, spin: opts.spin, raf: 0, items };
    applyTransform();

    // Drag to spin.
    let dragging = false, lastX = 0;
    overlay.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; overlay.style.cursor = 'grabbing'; });
    addEventListener('pointermove', (e) => {
      if (!dragging || !state) return;
      state.spinDeg += (e.clientX - lastX) * 0.4; lastX = e.clientX; applyTransform();
    });
    addEventListener('pointerup', () => { dragging = false; if (state) state.overlay.style.cursor = 'grab'; });
    addEventListener('keydown', onKey);

    if (state.spin) tick();
  }

  function applyTransform() {
    if (!state) return;
    state.stage.style.transform =
      `translate(-50%,-50%) rotateX(${state.tilt}deg) rotateZ(${state.spinDeg}deg)`;
  }

  function tick() {
    if (!state) return;
    if (state.spin && !document.hidden) { state.spinDeg += 0.35; applyTransform(); }
    state.raf = requestAnimationFrame(tick);
  }

  function onKey(e) {
    if (e.key === 'Escape') { destroy(); chrome.runtime.sendMessage({ action: '__lx_restored' }).catch(() => {}); }
  }

  function destroy() {
    if (!state) return;
    cancelAnimationFrame(state.raf);
    removeEventListener('keydown', onKey);
    state.overlay.remove();
    state = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.__ping) { sendResponse(true); return true; }
    if (!msg || !msg.action) return false;
    if (msg.action === 'explode') {
      const items = collectElements();
      buildOverlay(items, { tilt: msg.tilt ?? 55, spread: msg.spread ?? 55, spin: msg.spin ?? true });
      sendResponse({ ok: true, count: items.length });
    } else if (msg.action === 'settings') {
      if (state) {
        state.tilt = msg.tilt ?? state.tilt;
        const newSpread = msg.spread ?? state.spread;
        if (newSpread !== state.spread) {
          state.spread = newSpread;
          state.layers.forEach((d, i) => {
            d.style.transform = `translate(-50%,0) translateZ(${-i * newSpread}px)`;
          });
        }
        const wasSpin = state.spin;
        state.spin = msg.spin ?? state.spin;
        if (state.spin && !wasSpin) tick();
        applyTransform();
      }
      sendResponse({ ok: true });
    } else if (msg.action === 'restore') {
      destroy();
      sendResponse({ ok: true });
    }
    return true;
  });
}
