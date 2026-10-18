/* Wireframe Mode — injected on explicit user click only.
   Adds ONE <style> node that outlines page elements, plus temporary floating
   label badges (tag name + dimensions). Toggle off removes everything; the
   page is never modified. */
(() => {
  if (window.__swInjected) return;
  window.__swInjected = true;

  const STYLE_ID = 'sw-wireframe-style';
  const LAYER_ID = 'sw-label-layer';
  const MAX_BADGES = 140;

  let enabled = false;
  let showLabels = true;
  let showDims = true;
  let outlinedCount = 0;
  let rafPending = false;

  // One stylesheet: outline every element except our own label layer.
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${LAYER_ID}, #${LAYER_ID} * { outline: none !important; }
      body.sw-wireframe *:not(script):not(style):not(noscript) {
        outline: 1px solid rgba(34, 211, 238, 0.55) !important;
      }
      body.sw-wireframe { background-image: none !important; }
    `;
    document.documentElement.appendChild(s);
  }

  function ensureLayer() {
    let layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement('div');
      layer.id = LAYER_ID;
      Object.assign(layer.style, {
        position: 'fixed', inset: '0', zIndex: '2147483646',
        pointerEvents: 'none', overflow: 'hidden',
      });
      document.documentElement.appendChild(layer);
    }
    return layer;
  }

  // Collect the largest visible block-level elements for labeling.
  function collectTargets() {
    const els = document.body.querySelectorAll(
      'div,section,article,main,aside,header,footer,nav,img,video,figure,form,table,ul,ol,p,h1,h2,h3,button,a,input,select,textarea'
    );
    const out = [];
    for (const el of els) {
      if (el.closest('#' + LAYER_ID)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 14) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      out.push({ el, area: r.width * r.height });
      if (out.length >= MAX_BADGES * 3) break;
    }
    out.sort((a, b) => b.area - a.area);
    return out.slice(0, MAX_BADGES);
  }

  function renderBadges() {
    const layer = ensureLayer();
    layer.innerHTML = '';
    outlinedCount = 0;
    if (!enabled) return;
    const targets = collectTargets();
    outlinedCount = targets.length;
    for (const { el } of targets) {
      const r = el.getBoundingClientRect();
      const badge = document.createElement('div');
      const tag = el.tagName.toLowerCase();
      const label = (showLabels ? tag : '') + (showLabels && showDims ? ' ' : '') +
                    (showDims ? `${Math.round(r.width)}×${Math.round(r.height)}` : '');
      badge.textContent = label || tag;
      Object.assign(badge.style, {
        position: 'absolute',
        left: Math.max(0, r.left) + 'px',
        top: Math.max(0, r.top - 18) + 'px',
        font: '10px/1.4 system-ui,sans-serif',
        background: 'rgba(34,211,238,.92)', color: '#062a33',
        padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap',
      });
      layer.appendChild(badge);
    }
  }

  // Re-layout badges on scroll/resize (throttled via rAF).
  function scheduleRender() {
    if (rafPending || !enabled) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; renderBadges(); });
  }

  function apply(opts) {
    enabled = !!opts.enabled;
    showLabels = opts.showLabels !== false;
    showDims = opts.showDims !== false;
    if (enabled) {
      ensureStyle();
      document.body.classList.add('sw-wireframe');
      ensureLayer();
      renderBadges();
      addEventListener('scroll', scheduleRender, { passive: true, capture: true });
      addEventListener('resize', scheduleRender);
    } else {
      document.body.classList.remove('sw-wireframe');
      const s = document.getElementById(STYLE_ID);
      if (s) s.remove();
      const layer = document.getElementById(LAYER_ID);
      if (layer) layer.remove();
      removeEventListener('scroll', scheduleRender, { capture: true });
      removeEventListener('resize', scheduleRender);
      outlinedCount = 0;
    }
    return { enabled, count: outlinedCount };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'SW_APPLY') sendResponse(apply(msg));
    else if (msg?.type === 'SW_STATE') sendResponse({ enabled, count: outlinedCount });
    return true;
  });
})();
