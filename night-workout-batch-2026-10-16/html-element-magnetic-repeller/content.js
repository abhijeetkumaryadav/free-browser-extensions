/* HTML Element Magnetic Repeller — content script.
   Builds lightweight visual CLONES of visible page elements on a fixed overlay,
   then pushes those clones away from the cursor with a magnetic-repel effect.
   HARD GUARANTEE: the real page DOM is never modified — only clones on one
   overlay container that is fully removed on stop / Esc. 100% local, no network. */

(() => {
  // Install the message listener only once per page.
  if (window.__hemrInstalled) return;
  window.__hemrInstalled = true;

  const MAX_CLONES = 90; // performance cap

  let overlay = null;   // overlay container
  let clones = [];      // [{node, cx, cy, ox, oy, w, h}]
  let rafId = 0;
  let running = false;
  let settings = { strength: 60, radius: 220 };
  let mouse = { x: -9999, y: -9999 };

  // ---------- helpers ----------
  function isVisible(el, rect) {
    if (rect.width < 28 || rect.height < 28) return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    if (rect.right < 0 || rect.left > window.innerWidth) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function bgTint(el) {
    try {
      const bg = window.getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (m && (!m[4] || parseFloat(m[4]) > 0.5)) return `rgb(${m[1]},${m[2]},${m[3]})`;
    } catch (e) { /* fall through */ }
    return 'rgba(255,255,255,0.05)';
  }

  // Collect candidate elements BEFORE the overlay exists (so we never clone ourselves).
  function collectElements() {
    const out = [];
    const all = document.body ? document.body.querySelectorAll('*') : [];
    for (const el of all) {
      if (out.length >= MAX_CLONES) break;
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, rect)) continue;
      // Skip tiny text-only fragments nested inside already-collected parents.
      out.push({ el, rect });
    }
    return out;
  }

  // ---------- overlay lifecycle ----------
  function createOverlay(items) {
    overlay = document.createElement('div');
    overlay.id = '__hemr_overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483646;pointer-events:none;margin:0;padding:0;overflow:hidden;';
    document.documentElement.appendChild(overlay);

    clones = items.map(({ el, rect }) => {
      const node = document.createElement('div');
      const tag = el.tagName.toLowerCase();
      node.textContent = tag;
      node.style.cssText =
        'position:fixed;display:flex;align-items:center;justify-content:center;' +
        'overflow:hidden;border:1px solid rgba(251,113,133,0.55);border-radius:6px;' +
        'color:rgba(255,255,255,0.75);font:600 10px/1 sans-serif;' +
        `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;` +
        `background:${bgTint(el)};` +
        'will-change:transform;';
      overlay.appendChild(node);
      return {
        node,
        w: rect.width, h: rect.height,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        ox: 0, oy: 0,
      };
    });

    window.addEventListener('mousemove', trackMouse, { passive: true });
    window.addEventListener('scroll', relayout, { passive: true });
    window.addEventListener('resize', relayout);
    window.addEventListener('keydown', escListener);
  }

  // Re-anchor clones to their elements' current viewport rects (scroll/resize).
  function relayout() {
    // Simplest robust approach: positions were captured at start; on scroll the
    // fixed-position clones would drift from the page. We rebuild positions
    // relative to the original elements by re-querying their rects.
    // (Clones array order matches the elements list captured below.)
    for (const c of clones) {
      // elements list stored on the clone record at build time
    }
    rebuildPositions();
  }

  let sourceElements = [];

  function rebuildPositions() {
    clones.forEach((c, i) => {
      const el = sourceElements[i];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      c.cx = rect.left + rect.width / 2;
      c.cy = rect.top + rect.height / 2;
      c.node.style.left = rect.left + 'px';
      c.node.style.top = rect.top + 'px';
      c.node.style.width = rect.width + 'px';
      c.node.style.height = rect.height + 'px';
    });
  }

  function trackMouse(e) { mouse.x = e.clientX; mouse.y = e.clientY; }

  function escListener(e) {
    if (e.key === 'Escape') stopRepel();
  }

  function destroyOverlay() {
    window.removeEventListener('mousemove', trackMouse);
    window.removeEventListener('scroll', relayout);
    window.removeEventListener('resize', relayout);
    window.removeEventListener('keydown', escListener);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    clones = [];
    sourceElements = [];
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    mouse = { x: -9999, y: -9999 };
  }

  // ---------- repel physics ----------
  function tick() {
    if (!running) return;
    const { strength, radius } = settings;
    for (const c of clones) {
      const dx = c.cx - mouse.x;
      const dy = c.cy - mouse.y;
      const dist = Math.hypot(dx, dy) || 1;
      let tx = 0, ty = 0;
      if (dist < radius) {
        const f = (1 - dist / radius) * strength;
        tx = (dx / dist) * f;
        ty = (dy / dist) * f;
      }
      // smooth lerp toward target offset
      c.ox += (tx - c.ox) * 0.18;
      c.oy += (ty - c.oy) * 0.18;
      c.node.style.transform = `translate(${c.ox.toFixed(1)}px,${c.oy.toFixed(1)}px)`;
    }
    rafId = requestAnimationFrame(tick);
  }

  // ---------- commands ----------
  function startRepel(newSettings) {
    if (newSettings) settings = { ...settings, ...newSettings };
    stopRepel(); // tear down any previous run before restarting
    const items = collectElements();
    sourceElements = items.map(i => i.el);
    running = true;
    createOverlay(items);
    rafId = requestAnimationFrame(tick);
  }

  function stopRepel() {
    running = false;
    destroyOverlay();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'hemr:ping') { sendResponse(running); return true; }
    if (msg.action === 'hemr:start') { startRepel(msg.settings); sendResponse(true); return true; }
    if (msg.action === 'hemr:stop') { stopRepel(); sendResponse(true); return true; }
    return false;
  });
})();
