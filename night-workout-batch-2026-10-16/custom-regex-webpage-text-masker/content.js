/* Custom Regex Text Masker — content script.
   Injected on demand (click-only via chrome.scripting). Walks text nodes and
   wraps regex matches in masked spans (blur or replacement). Visual only —
   the page source and DOM data are unchanged. Guarded against double install.
   IMPORTANT: never run this script in the extension's own popup context. */
(() => {
  'use strict';
  if (window.__regexMaskerInstalled) return;
  window.__regexMaskerInstalled = true;

  const WRAP_CLASS = '__regex-masker-wrap';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'SELECT', 'OPTION']);

  function isEditable(el) {
    return el && (el.isContentEditable || el.closest('[contenteditable="true"]'));
  }

  /* Replace matches in a single text node with masked spans. */
  function maskTextNode(node, patterns) {
    const text = node.nodeValue;
    if (!text || !text.trim()) return false;
    let best = null;
    patterns.forEach(p => {
      try {
        const rx = new RegExp(p.pattern, 'g');
        let m;
        while ((m = rx.exec(text)) !== null) {
          if (!best || m.index < best.index) {
            best = { index: m.index, len: m[0].length, pattern: p, text: m[0] };
          }
          if (m[0].length === 0) rx.lastIndex++; // avoid empty-match loop
        }
      } catch (e) { /* skip invalid patterns defensively */ }
    });
    if (!best) return false;

    const parent = node.parentNode;
    const frag = document.createDocumentFragment();
    let last = 0;
    // walk all matches of all patterns in order
    const all = [];
    patterns.forEach(p => {
      try {
        const rx = new RegExp(p.pattern, 'g');
        let m;
        while ((m = rx.exec(text)) !== null) {
          if (m[0].length) all.push({ index: m.index, len: m[0].length, pattern: p, text: m[0] });
          else rx.lastIndex++;
        }
      } catch (e) { /* skip */ }
    });
    all.sort((a, b) => a.index - b.index);
    // skip overlapping matches (keep the earliest)
    const chosen = [];
    all.forEach(m => {
      if (!chosen.length || m.index >= chosen[chosen.length - 1].index + chosen[chosen.length - 1].len) {
        chosen.push(m);
      }
    });
    chosen.forEach(m => {
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement('span');
      span.className = WRAP_CLASS;
      if (m.pattern.mode === 'blur') {
        span.textContent = m.text;
        span.style.cssText = 'filter:blur(5px);-webkit-filter:blur(5px);user-select:none;';
      } else {
        span.textContent = m.pattern.replacement || '█████';
      }
      span.dataset.maskerOrig = m.text; // for unmasking
      frag.appendChild(span);
      last = m.index + m.len;
    });
    frag.appendChild(document.createTextNode(text.slice(last)));
    parent.replaceChild(frag, node);
    return true;
  }

  function apply(patterns) {
    clear(); // start clean
    if (!patterns || !patterns.length) return 0;
    let count = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el || SKIP_TAGS.has(el.tagName) || isEditable(el)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => { if (maskTextNode(n, patterns)) count++; });
    return count;
  }

  function clear() {
    document.querySelectorAll('span.' + WRAP_CLASS).forEach(span => {
      const orig = span.dataset.maskerOrig || span.textContent;
      span.replaceWith(document.createTextNode(orig));
    });
    // normalize adjacent text nodes
    if (document.body) document.body.normalize();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.cmd === 'mask:apply') sendResponse({ ok: true, masked: apply(msg.patterns) });
    else if (msg.cmd === 'mask:clear') { clear(); sendResponse({ ok: true }); }
    else sendResponse({ ok: false, error: 'unknown command' });
    return true;
  });
})();
