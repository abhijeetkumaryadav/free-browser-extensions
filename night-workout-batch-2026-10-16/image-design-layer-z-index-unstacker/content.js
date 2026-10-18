/* Z-Index Unstacker — content script: read-only stacking-order scan.
   Injected on explicit user click only. Only persistent change it can make
   is a highlight outline, which "Clear highlight" removes. */
'use strict';

(() => {
  if (window.__zUnstackerRan) {
    // Re-run messages are still handled; this guard prevents double listeners.
  }
  window.__zUnstackerRan = true;

  const OUTLINE_ID = '__zUnstackerHighlight';

  /** True if this element creates a new stacking context (heuristic subset). */
  function createsStackingContext(el, cs) {
    if (cs.position !== 'static' && cs.zIndex !== 'auto') return true;
    if (parseFloat(cs.opacity) < 1) return true;
    const t = cs.transform;
    if (t && t !== 'none') return true;
    if (cs.filter && cs.filter !== 'none') return true;
    if (cs.isolation === 'isolate') return true;
    if (cs.willChange && /transform|opacity|filter/.test(cs.willChange)) return true;
    return false;
  }

  function describe(el) {
    const cs = getComputedStyle(el);
    const sel = el.tagName.toLowerCase()
      + (el.id ? '#' + el.id : '')
      + (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      selector: sel,
      position: cs.position,
      z: cs.zIndex,
      zNum: cs.zIndex === 'auto' ? null : parseInt(cs.zIndex, 10),
      stacking: createsStackingContext(el, cs),
      opacity: cs.opacity,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    };
  }

  /** Cheap xpath-ish path so the popup can re-locate the element for highlight. */
  function pathOf(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let i = 1, sib = node.previousElementSibling;
      while (sib) { if (sib.tagName === node.tagName) i++; sib = sib.previousElementSibling; }
      parts.unshift(node.tagName.toLowerCase() + '[' + i + ']');
      node = node.parentElement;
    }
    return parts.join('>');
  }

  function scan() {
    const all = Array.from(document.querySelectorAll('*'));
    const out = [];
    for (const el of all) {
      if (el.id === OUTLINE_ID) continue;
      const info = describe(el);
      if (info.position === 'static') continue; // only positioned elements matter
      info.path = pathOf(el);
      out.push(info);
    }
    // Sort: explicit z-index first (desc), then auto.
    out.sort((a, b) => {
      const az = a.zNum === null ? -Infinity : a.zNum;
      const bz = b.zNum === null ? -Infinity : b.zNum;
      return bz - az;
    });
    return out;
  }

  function highlight(path) {
    clearHighlight();
    const el = document.evaluate(
      '//' + path.split('>').join('//'),
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    if (!el || el.nodeType !== 1) return false;
    el.setAttribute('data-__zunstack', '1');
    el.style.outline = '3px solid #a78bfa';
    el.style.outlineOffset = '2px';
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }

  function clearHighlight() {
    document.querySelectorAll('[data-__zunstack]').forEach((el) => {
      el.removeAttribute('data-__zunstack');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'zunstack-scan') {
      try { sendResponse({ ok: true, items: scan() }); }
      catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    } else if (msg.type === 'zunstack-highlight') {
      sendResponse({ ok: highlight(msg.path) });
    } else if (msg.type === 'zunstack-clear') {
      clearHighlight();
      sendResponse({ ok: true });
    }
    return true;
  });
})();
