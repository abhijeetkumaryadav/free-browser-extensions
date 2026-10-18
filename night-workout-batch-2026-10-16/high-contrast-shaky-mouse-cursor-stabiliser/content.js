// SteadyCursor content script — large high-contrast smoothed cursor + optional target magnification.
// Injected on demand only when the user enables it. Fully reversible.
'use strict';

(() => {
  if (window.__steadyCursorInstalled) return;
  window.__steadyCursorInstalled = true;

  const NS = 'steadycursor';
  let styleEl = null;
  let cursorEl = null;
  let rafId = null;
  let target = { x: -100, y: -100 };   // raw mouse position
  let pos = { x: -100, y: -100 };      // smoothed position
  let lerp = 0.6;                       // 1 - smoothing/100
  let magnifiedEl = null;
  let magnifyOn = false;
  let running = false;

  // Cursor SVG: bold arrow with dark outline for contrast on any background.
  function cursorSVG(color, size) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">`
      + `<path d="M7 3 L26 16 L16.5 17.5 L13 28 Z" fill="${color}" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>`
      + `</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function ensureCursor(color, size) {
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.id = NS + '-cursor';
      Object.assign(cursorEl.style, {
        position: 'fixed', left: '0px', top: '0px', width: size + 'px', height: size + 'px',
        zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-100px,-100px)',
      });
      document.documentElement.appendChild(cursorEl);
    }
    cursorEl.style.width = size + 'px';
    cursorEl.style.height = size + 'px';
    cursorEl.style.backgroundImage = `url("${cursorSVG(color, size)}")`;
    cursorEl.style.backgroundSize = 'contain';
    cursorEl.style.backgroundRepeat = 'no-repeat';
  }

  function hideNativeCursor() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = NS + '-style';
    styleEl.textContent = `html.${NS}-on, html.${NS}-on *, html.${NS}-on *::before, html.${NS}-on *::after { cursor: none !important; }`;
    document.documentElement.appendChild(styleEl);
    document.documentElement.classList.add(NS + '-on');
  }

  function restoreNativeCursor() {
    document.documentElement.classList.remove(NS + '-on');
    if (styleEl) { styleEl.remove(); styleEl = null; }
  }

  function tick() {
    if (!running) return;
    // Exponential smoothing: higher lerp factor = snappier, lower = steadier.
    pos.x += (target.x - pos.x) * lerp;
    pos.y += (target.y - pos.y) * lerp;
    if (cursorEl) cursorEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    rafId = requestAnimationFrame(tick);
  }

  function onMove(e) {
    target.x = e.clientX;
    target.y = e.clientY;
    if (magnifyOn) updateMagnify(e.clientX, e.clientY);
  }

  const CLICKABLE = 'a, button, input, select, textarea, [role="button"], [role="link"], [onclick], summary';

  function updateMagnify(x, y) {
    const el = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    const hit = el && el.closest ? el.closest(CLICKABLE) : null;
    if (hit === magnifiedEl) return;
    if (magnifiedEl) {
      magnifiedEl.style.setProperty('transform', magnifiedEl.dataset[NS + 'OrigTransform'] || '', '');
      delete magnifiedEl.dataset[NS + 'OrigTransform'];
      magnifiedEl = null;
    }
    if (hit && hit !== cursorEl) {
      const cs = getComputedStyle(hit);
      if (!(NS + 'OrigTransform' in hit.dataset)) hit.dataset[NS + 'OrigTransform'] = hit.style.transform || '';
      hit.style.setProperty('transform', `${cs.transform === 'none' ? '' : cs.transform} scale(1.25)`, 'important');
      hit.style.setProperty('transform-origin', 'center', 'important');
      hit.style.setProperty('transition', 'transform .15s ease', 'important');
      magnifiedEl = hit;
    }
  }

  function enable(settings) {
    lerp = 1 - settings.smoothing / 100; // 90% smoothing -> 0.1 (very steady)
    magnifyOn = !!settings.magnify;
    if (!magnifyOn && magnifiedEl) {
      magnifiedEl.style.setProperty('transform', magnifiedEl.dataset[NS + 'OrigTransform'] || '', '');
      delete magnifiedEl.dataset[NS + 'OrigTransform'];
      magnifiedEl = null;
    }
    ensureCursor(settings.color, settings.size);
    hideNativeCursor();
    if (!running) {
      running = true;
      pos.x = target.x; pos.y = target.y;
      document.addEventListener('mousemove', onMove, { passive: true });
      rafId = requestAnimationFrame(tick);
    }
  }

  function disable() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    document.removeEventListener('mousemove', onMove);
    restoreNativeCursor();
    if (magnifiedEl) {
      magnifiedEl.style.setProperty('transform', magnifiedEl.dataset[NS + 'OrigTransform'] || '', '');
      delete magnifiedEl.dataset[NS + 'OrigTransform'];
      magnifiedEl = null;
    }
    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.kind === 'steadycursor-ping') { sendResponse({ alive: true }); return true; }
    if (msg.kind === 'steadycursor-apply') {
      try {
        if (msg.settings.enabled) enable(msg.settings); else disable();
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      return true;
    }
    return false;
  });
})();
