/* Ad-Node Purger — content script.
 * Scans the document (plus open shadow roots and same-origin iframes when
 * enabled) for heuristic ad containers and hides them visibility-only.
 * Restore removes every trace. The page DOM is never modified. */

(() => {
  'use strict';

  // Bundled heuristic selector list: common ad-container patterns.
  // These are guesses, not certainties — the UI labels results as heuristic.
  const BUNDLED_SELECTORS = [
    '[id^="google_ads"]', '[id^="div-gpt-ad"]', '.adsbygoogle',
    '[id*="ad-banner"]', '[id*="ad_banner"]', '[class*="ad-banner"]',
    '[id*="sponsored"]', '[class*="sponsored-link"]',
    '[id^="ad-slot"]', '[class^="ad-slot"]',
    '[data-ad]', '[data-ad-slot]', '[data-adunit]',
    'ins.adsbygoogle', '.advertisement', '#advertisement',
    '.ad-container', '.ads-container', '.ad-wrapper',
    '[aria-label="Advertisement"]'
  ];

  const HIDE_ATTR = 'data-anp-hidden';

  // Track last purge so the popup can show state on reopen.
  let lastResult = { hidden: 0, shadow: 0, active: false };

  // Collect candidate elements from a root node.
  function collectFromRoot(root, selectors, out) {
    for (const sel of selectors) {
      let nodes = [];
      try { nodes = root.querySelectorAll(sel); } catch (e) { /* bad selector */ }
      for (const el of nodes) {
        if (el instanceof Element && !el.hasAttribute(HIDE_ATTR)) out.push(el);
      }
    }
  }

  // Recursively walk into open shadow roots.
  function collectShadow(host, selectors, out, depth) {
    if (depth > 6) return;
    const roots = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node.shadowRoot) roots.push(node.shadowRoot);
      node = walker.nextNode();
    }
    for (const sr of roots) {
      collectFromRoot(sr, selectors, out);
      collectShadow(sr, selectors, out, depth + 1);
    }
  }

  // Same-origin iframes only — cross-origin frames are inaccessible by design.
  function collectIframes(selectors, out) {
    for (const frame of document.querySelectorAll('iframe')) {
      try {
        const doc = frame.contentDocument;
        if (!doc) continue;
        collectFromRoot(doc, selectors, out);
      } catch (e) { /* cross-origin — skip silently */ }
    }
  }

  function purge(options) {
    const selectors = BUNDLED_SELECTORS.concat(options.custom || []);
    const found = [];
    collectFromRoot(document, selectors, found);
    if (options.shadow) collectShadow(document.documentElement, selectors, found, 0);
    if (options.iframes) collectIframes(selectors, found);

    // Dedupe (same node can match several selectors).
    const unique = [...new Set(found)];
    let shadowHits = 0;
    for (const el of unique) {
      el.setAttribute(HIDE_ATTR, '1');
      el.dataset.anpPrevDisplay = el.style.display || '';
      el.style.setProperty('display', 'none', 'important');
      if (el.getRootNode() instanceof ShadowRoot) shadowHits++;
    }
    lastResult = { hidden: unique.length, shadow: shadowHits, active: unique.length > 0 };
    return lastResult;
  }

  function restore() {
    const nodes = document.querySelectorAll('[' + HIDE_ATTR + ']');
    let count = 0;
    for (const el of nodes) {
      el.style.display = el.dataset.anpPrevDisplay || '';
      el.removeAttribute(HIDE_ATTR);
      delete el.dataset.anpPrevDisplay;
      count++;
    }
    // Shadow roots are separate documents from querySelectorAll's view —
    // walk them again to clear any marks left inside.
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node.shadowRoot) {
        const inner = node.shadowRoot.querySelectorAll('[' + HIDE_ATTR + ']');
        for (const el of inner) {
          el.style.display = el.dataset.anpPrevDisplay || '';
          el.removeAttribute(HIDE_ATTR);
          delete el.dataset.anpPrevDisplay;
          count++;
        }
      }
      node = walker.nextNode();
    }
    return { restored: count };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'ANP_PURGE') {
      sendResponse(purge(msg.options || {}));
    } else if (msg.type === 'ANP_RESTORE') {
      const r = restore();
      lastResult = { hidden: 0, shadow: 0, active: false };
      sendResponse(r);
    } else if (msg.type === 'ANP_STATE') {
      // Recompute in case the page changed since the purge.
      const still = document.querySelectorAll('[' + HIDE_ATTR + ']').length;
      sendResponse({ hidden: still, shadow: lastResult.shadow, active: still > 0 });
    }
    return true;
  });
})();
