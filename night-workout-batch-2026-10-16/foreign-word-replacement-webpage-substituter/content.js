/* Foreign Word Substituter — content-script engine.
   Applies the user's word→translation pairs to the page as inline spans
   ("word (translation)") and can restore the original text exactly.
   The page is only touched when the user clicks Apply/Restore in the popup. */
(function () {
  'use strict';

  const MARK = 'data-fws-sub'; // marker attribute on injected wrapper spans

  // ENGINE-START
  /** Escape a literal string so it can be embedded in a RegExp. */
  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Build a case-insensitive whole-word pattern from pairs, or null when none are valid. */
  function buildPattern(pairs) {
    const words = (pairs || [])
      .map((p) => (p && p.word ? String(p.word).trim() : ''))
      .filter((w) => w.length > 0);
    if (!words.length) return null;
    // Longest words first so the alternation prefers the longest possible match.
    words.sort((a, b) => b.length - a.length);
    return new RegExp('\\b(' + words.map(escapeRe).join('|') + ')\\b', 'gi');
  }

  /** Find the translation for a matched word (case-insensitive). */
  function lookup(pairs, matched) {
    const lower = String(matched).toLowerCase();
    for (const p of pairs || []) {
      if (p && p.word && String(p.word).trim().toLowerCase() === lower) return p.translation;
    }
    return null;
  }
  // ENGINE-END

  /** True when a text node's parent is safe to rewrite. */
  function nodeIsSwappable(node) {
    const parent = node.parentElement;
    if (!parent) return false;
    if (parent.hasAttribute(MARK)) return false; // already processed
    // Never touch code, form fields, or editable regions.
    if (parent.closest('script, style, textarea, input, select, option, [contenteditable="true"]')) return false;
    return true;
  }

  /**
   * Replace pair occurrences in the page with "word (translation)" spans.
   * Idempotent: any previous run is removed first. Returns replacement count.
   */
  function apply(pairs) {
    remove();
    const pattern = buildPattern(pairs);
    if (!pattern) return 0;
    if (!document.body) return 0;

    // Collect candidate text nodes first (mutating while walking is unsafe).
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const targets = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (!nodeIsSwappable(node)) continue;
      pattern.lastIndex = 0;
      if (pattern.test(node.nodeValue)) targets.push(node);
    }

    let count = 0;
    for (const textNode of targets) {
      const text = textNode.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const trans = lookup(pairs, m[0]);
        const wrap = document.createElement('span');
        wrap.setAttribute(MARK, '1');
        wrap.dataset.fwsOriginal = m[0]; // original text kept for exact restore
        wrap.style.cssText = 'border-bottom:2px dotted #a78bfa;';
        wrap.textContent = trans ? m[0] + ' (' + trans + ')' : m[0];
        frag.appendChild(wrap);
        last = m.index + m[0].length;
        count++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
    return count;
  }

  /** Restore every injected span to its original text. Returns restored count. */
  function remove() {
    const els = document.querySelectorAll('[' + MARK + ']');
    let n = 0;
    els.forEach((el) => {
      const original = el.dataset.fwsOriginal != null ? el.dataset.fwsOriginal : el.textContent;
      el.replaceWith(document.createTextNode(original));
      n++;
    });
    return n;
  }

  // Exposed so the popup can drive the engine via chrome.scripting.
  window.__fws = { apply, remove };
})();
