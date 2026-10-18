/* HighlightLayer — content script.
 * Wraps selected text in color spans, persists highlights per URL,
 * and restores them on revisit using text-snippet anchoring.
 * Non-destructive: removing a highlight unwraps the span, restoring the DOM.
 */
(function () {
  'use strict';

  // Highlight palette (background tints that read well on light & dark pages)
  const COLORS = {
    yellow: 'rgba(253, 224, 71, 0.45)',
    lime:   'rgba(163, 230, 53, 0.40)',
    cyan:   'rgba(34, 211, 238, 0.40)',
    pink:   'rgba(244, 114, 182, 0.40)'
  };
  const CONTEXT_LEN = 40; // chars of surrounding context stored for disambiguation

  const storageKey = () => 'hlp:' + location.href.split('#')[0];

  /* ---------- DOM helpers ---------- */

  // Collect visible, non-highlighted text nodes under root
  function getTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
            tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
          return NodeFilter.FILTER_REJECT;
        }
        if (p.closest('.hlp-highlight')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  // Build a flat char-index map: each entry maps a global offset to (node, offset)
  function buildCharMap(nodes) {
    let concat = '';
    const map = [];
    for (const node of nodes) {
      const t = node.nodeValue;
      for (let i = 0; i < t.length; i++) map.push({ node, offset: i });
      concat += t;
    }
    return { concat, map };
  }

  // Score candidate match positions using stored prefix/suffix context
  function pickBestMatch(concat, needle, prefix, suffix) {
    const positions = [];
    let idx = -1;
    while ((idx = concat.indexOf(needle, idx + 1)) !== -1) positions.push(idx);
    if (positions.length === 0) return -1;
    if (positions.length === 1) return positions[0];
    let best = positions[0], bestScore = -1;
    for (const pos of positions) {
      let score = 0;
      const before = concat.slice(Math.max(0, pos - CONTEXT_LEN), pos);
      const after = concat.slice(pos + needle.length, pos + needle.length + CONTEXT_LEN);
      if (prefix && before.endsWith(prefix)) score += 2;
      else if (prefix && before.includes(prefix.slice(-10))) score += 1;
      if (suffix && after.startsWith(suffix)) score += 2;
      else if (suffix && after.includes(suffix.slice(0, 10))) score += 1;
      if (score > bestScore) { bestScore = score; best = pos; }
    }
    return best;
  }

  // Wrap character range [start, end) in highlight spans (split per text node)
  function wrapRange(charMap, start, end, color, id) {
    const byNode = new Map();
    for (let i = start; i < end; i++) {
      const m = charMap.map[i];
      if (!m) continue;
      if (!byNode.has(m.node)) byNode.set(m.node, []);
      byNode.get(m.node).push(m.offset);
    }
    let wrapped = 0;
    byNode.forEach((offsets, node) => {
      if (!node.isConnected || !node.parentNode) return;
      try {
        const s = Math.min(...offsets);
        const e = Math.max(...offsets) + 1;
        const range = document.createRange();
        range.setStart(node, s);
        range.setEnd(node, e);
        const span = document.createElement('span');
        span.className = 'hlp-highlight';
        span.dataset.hlpId = id;
        span.style.backgroundColor = COLORS[color] || COLORS.yellow;
        span.style.borderRadius = '2px';
        span.style.padding = '0 1px';
        span.style.color = 'inherit';
        range.surroundContents(span);
        wrapped++;
      } catch (err) {
        // Range spans mixed content; skip this fragment (best-effort)
      }
    });
    return wrapped > 0;
  }

  // Highlight a text snippet on the page; returns true if anything was wrapped
  function highlightSnippet(text, color, id, prefix, suffix) {
    if (!text) return false;
    const { concat, map } = buildCharMap(getTextNodes(document.body));
    if (!concat) return false;
    const pos = pickBestMatch(concat, text, prefix || '', suffix || '');
    if (pos === -1) return false;
    return wrapRange({ concat, map }, pos, pos + text.length, color, id);
  }

  // Unwrap all spans belonging to one highlight id
  function removeHighlight(id) {
    const spans = document.querySelectorAll(`.hlp-highlight[data-hlp-id="${CSS.escape(id)}"]`);
    spans.forEach((span) => {
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize(); // merge adjacent text nodes back together
    });
    return spans.length;
  }

  function clearAll() {
    document.querySelectorAll('.hlp-highlight').forEach((span) => {
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    });
  }

  function jumpTo(id) {
    const span = document.querySelector(`.hlp-highlight[data-hlp-id="${CSS.escape(id)}"]`);
    if (span) {
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const orig = span.style.boxShadow;
      span.style.boxShadow = '0 0 0 2px #a3e635';
      setTimeout(() => { span.style.boxShadow = orig; }, 1200);
      return true;
    }
    return false;
  }

  /* ---------- selection serialization ---------- */

  function serializeSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    // Only handle selections fully inside the page body (not in our UI)
    if (!document.body.contains(range.commonAncestorContainer)) return null;
    const text = sel.toString().trim();
    if (!text || text.length > 2000) return null;

    // Capture surrounding context from the page's full text
    const { concat } = buildCharMap(getTextNodes(document.body));
    let prefix = '', suffix = '';
    const idx = concat.indexOf(text);
    if (idx !== -1) {
      prefix = concat.slice(Math.max(0, idx - CONTEXT_LEN), idx);
      suffix = concat.slice(idx + text.length, idx + text.length + CONTEXT_LEN);
    }
    return { text, prefix, suffix };
  }

  /* ---------- storage ---------- */

  async function loadHighlights() {
    const data = await chrome.storage.local.get(storageKey());
    return data[storageKey()] || [];
  }

  async function saveHighlights(list) {
    await chrome.storage.local.set({ [storageKey()]: list });
  }

  function makeId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- restore on page load ---------- */

  async function restoreAll() {
    const list = await loadHighlights();
    for (const h of list) {
      highlightSnippet(h.text, h.color, h.id, h.prefix, h.suffix);
    }
  }

  // Pages that mutate after load (SPAs): retry restore once after a delay
  let restored = false;
  async function init() {
    if (restored) return;
    restored = true;
    await restoreAll();
    setTimeout(restoreAll, 2500); // second pass for late-rendered content
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  /* ---------- message interface (popup / background) ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg.type === 'HLP_HIGHLIGHT_SELECTION') {
        const ser = serializeSelection();
        if (!ser) { sendResponse({ ok: false, reason: 'no-selection' }); return; }
        const list = await loadHighlights();
        const entry = {
          id: makeId(),
          text: ser.text,
          prefix: ser.prefix,
          suffix: ser.suffix,
          color: msg.color || 'yellow',
          createdAt: Date.now(),
          title: document.title
        };
        const applied = highlightSnippet(entry.text, entry.color, entry.id, entry.prefix, entry.suffix);
        if (applied) {
          list.push(entry);
          await saveHighlights(list);
          window.getSelection().removeAllRanges();
        }
        sendResponse({ ok: applied, entry: applied ? entry : null });
      } else if (msg.type === 'HLP_LIST') {
        sendResponse({ ok: true, highlights: await loadHighlights() });
      } else if (msg.type === 'HLP_REMOVE') {
        removeHighlight(msg.id);
        const list = (await loadHighlights()).filter((h) => h.id !== msg.id);
        await saveHighlights(list);
        sendResponse({ ok: true });
      } else if (msg.type === 'HLP_CLEAR') {
        clearAll();
        await saveHighlights([]);
        sendResponse({ ok: true });
      } else if (msg.type === 'HLP_JUMP') {
        sendResponse({ ok: jumpTo(msg.id) });
      } else {
        sendResponse({ ok: false });
      }
    })();
    return true; // async response
  });
})();
