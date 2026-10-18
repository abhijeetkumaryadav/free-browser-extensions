/* Transcript Keyword Skipper — content script (injected on demand only).
 * Read-only: wraps keyword matches in <mark> overlays for navigation.
 * Nothing is written to the page's data, and marks are removed on Clear. */
(() => {
  'use strict';

  const MARK_CLASS = 'tks-match';
  const ACTIVE_CLASS = 'tks-active';

  // Injected once per page-load: guard against double-injection.
  if (window.__tksInstalled) return;
  window.__tksInstalled = true;

  let marks = [];
  let current = -1;

  // Inject the highlight styles once (read-only, cosmetic only).
  function ensureStyles() {
    if (document.getElementById('tks-style')) return;
    const style = document.createElement('style');
    style.id = 'tks-style';
    style.textContent =
      '.' + MARK_CLASS + ' { background: rgba(139,92,246,.35); color: inherit; ' +
      'border-radius: 3px; padding: 0 1px; }' +
      '.' + ACTIVE_CLASS + ' { background: #8b5cf6 !important; color: #fff !important; ' +
      'outline: 2px solid #c4b5fd; }';
    document.documentElement.appendChild(style);
  }

  // Prefer transcript-like regions; fall back to the whole body (minus chrome).
  function searchRoots() {
    const candidates = document.querySelectorAll(
      'article, main, [role="main"], .transcript, #transcript, .show-notes, .episode-notes'
    );
    return candidates.length ? Array.from(candidates) : [document.body];
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Remove all existing highlight marks, restoring original text.
  function clear() {
    document.querySelectorAll('mark.' + MARK_CLASS).forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    marks = [];
    current = -1;
  }

  // Wrap every keyword match in text nodes under the search roots.
  function highlight(keywords, caseSensitive, wholeWords) {
    ensureStyles();
    clear();

    const terms = keywords.map(k => k.trim()).filter(Boolean);
    if (!terms.length) return 0;

    const boundary = wholeWords ? '\\b' : '';
    const pattern = new RegExp(
      boundary + '(' + terms.map(escapeRegExp).join('|') + ')' + boundary,
      caseSensitive ? 'g' : 'gi'
    );

    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);

    for (const root of searchRoots()) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('mark.' + MARK_CLASS)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      for (const node of nodes) {
        const text = node.nodeValue;
        pattern.lastIndex = 0;
        let match, last = 0;
        const frag = document.createDocumentFragment();
        let found = false;
        while ((match = pattern.exec(text)) !== null) {
          found = true;
          frag.appendChild(document.createTextNode(text.slice(last, match.index)));
          const mark = document.createElement('mark');
          mark.className = MARK_CLASS;
          mark.textContent = match[0];
          frag.appendChild(mark);
          marks.push(mark);
          last = match.index + match[0].length;
          // Guard against zero-length matches looping forever.
          if (match[0].length === 0) pattern.lastIndex++;
        }
        if (found) {
          frag.appendChild(document.createTextNode(text.slice(last)));
          node.parentNode.replaceChild(frag, node);
        }
      }
    }
    return marks.length;
  }

  function goto(index) {
    if (!marks.length) return -1;
    marks.forEach(m => m.classList.remove(ACTIVE_CLASS));
    current = ((index % marks.length) + marks.length) % marks.length;
    const el = marks[current];
    el.classList.add(ACTIVE_CLASS);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return current;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.action === 'highlight') {
        const count = highlight(msg.keywords || [], !!msg.caseSensitive, !!msg.wholeWords);
        sendResponse({ ok: true, count });
      } else if (msg.action === 'goto') {
        sendResponse({ ok: true, index: goto(msg.index) });
      } else if (msg.action === 'clear') {
        clear();
        sendResponse({ ok: true });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    }
    return true;
  });
})();
