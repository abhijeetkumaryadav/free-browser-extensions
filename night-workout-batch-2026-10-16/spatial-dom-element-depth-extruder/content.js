/* DOM Depth Analyzer — content script (injected on click only).
   Read-only: walks the DOM tree and reports depth statistics.
   Never modifies the page. */

(function () {
  'use strict';

  /**
   * Build a short CSS-ish path for an element: tag#id.class1.class2
   * @param {Element} el
   * @returns {string}
   */
  function describe(el) {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) {
      s += '.' + Array.from(el.classList).slice(0, 3).join('.');
    }
    return s;
  }

  /**
   * Build a full ancestor path, capped to keep messages small.
   * @param {Element} el
   * @returns {string}
   */
  function fullPath(el) {
    const parts = [];
    let cur = el;
    let guard = 0;
    while (cur && cur.nodeType === 1 && guard < 12) {
      parts.unshift(describe(cur));
      cur = cur.parentElement;
      guard++;
    }
    if (cur && cur.nodeType === 1) parts.unshift('…');
    return parts.join(' > ');
  }

  function analyze() {
    const perDepth = Object.create(null);
    const deepest = []; // {depth, tag, cls, path}
    let maxDepth = 0;
    let total = 0;

    // Iterative DFS with explicit stack — safe for very deep trees.
    const root = document.documentElement;
    if (!root) return { maxDepth: 0, total: 0, perDepth: {}, deepest: [] };

    const stack = [{ el: root, depth: 0 }];
    while (stack.length) {
      const { el, depth } = stack.pop();
      total++;
      perDepth[depth] = (perDepth[depth] || 0) + 1;
      if (depth > maxDepth) maxDepth = depth;
      if (depth >= maxDepth - 4) {
        // keep candidates near the frontier; trimmed later
        deepest.push({
          depth,
          tag: el.tagName.toLowerCase(),
          cls: el.classList && el.classList.length
            ? Array.from(el.classList).slice(0, 3).join(' ')
            : '',
          path: fullPath(el),
        });
      }
      // push children in reverse so document order is preserved
      const kids = el.children;
      for (let i = kids.length - 1; i >= 0; i--) {
        stack.push({ el: kids[i], depth: depth + 1 });
      }
    }

    deepest.sort((a, b) => b.depth - a.depth);
    return {
      maxDepth,
      total,
      perDepth,
      deepest: deepest.slice(0, 12),
    };
  }

  // Message-based API: popup sends {type:'ANALYZE_DEPTH'}.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'ANALYZE_DEPTH') {
      try {
        sendResponse({ ok: true, data: analyze() });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
      return true;
    }
    return false;
  });
})();
