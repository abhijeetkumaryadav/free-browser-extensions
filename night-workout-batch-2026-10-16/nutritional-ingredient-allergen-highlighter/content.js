/**
 * Ingredient Allergen Highlighter — page-side scan/clear engine.
 * Injected only when the user clicks "Scan this page" (activeTab + scripting).
 * Everything is local; the page is restored exactly on clear.
 */
(() => {
  if (window.__allergenHighlighterEngine) return; // boot-once guard
  window.__allergenHighlighterEngine = true;

  const HL_CLASS = '__allergen-hl__';
  const STYLE_ID = '__allergen-hl-style__';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'MARK', 'CODE', 'PRE']);

  /** Insert the highlight stylesheet once. */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      mark.${HL_CLASS} {
        background: #fb923c !important;
        color: #111 !important;
        border-radius: 3px;
        padding: 0 2px;
        box-shadow: 0 0 0 2px rgba(251,146,60,.35);
      }`;
    (document.head || document.documentElement).appendChild(s);
  }

  /** Unwrap every highlight mark, restoring the original text. */
  function clearHighlights() {
    let removed = 0;
    document.querySelectorAll(`mark.${HL_CLASS}`).forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      removed++;
    });
    return removed;
  }

  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Heuristic: does this block of text look like an ingredient list?
   * - mentions "ingredient(s)" near the start, or
   * - is a comma-separated run (3+ commas) that isn't enormous.
   */
  function ingredientLike(text) {
    const head = text.slice(0, 500);
    if (/\bingredients?\b/i.test(head)) return true;
    const commas = (text.match(/,/g) || []).length;
    return commas >= 3 && text.length < 4000;
  }

  /** Scan text nodes, wrap allergen matches in <mark>, return hit count. */
  function highlight(allergens) {
    injectStyle();
    clearHighlights();
    if (!allergens.length) return 0;

    const pattern = new RegExp('\\b(' + allergens.map(escapeReg).join('|') + ')(s|es)?\\b', 'gi');

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const v = node.nodeValue;
        if (!v || !v.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest(`mark.${HL_CLASS}`)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    let hits = 0;
    for (const node of nodes) {
      const el = node.parentElement;
      const block = el.innerText || el.textContent || '';
      if (!ingredientLike(block)) continue; // only ingredient-like regions

      const text = node.nodeValue;
      pattern.lastIndex = 0;
      if (!pattern.test(text)) continue;

      pattern.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = HL_CLASS;
        mark.title = 'Possible allergen match — always read the label yourself';
        mark.textContent = m[0];
        frag.appendChild(mark);
        hits++;
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
    return hits;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (msg.type === 'ALLERGEN_SCAN') {
        sendResponse({ ok: true, count: highlight(msg.allergens || []) });
      } else if (msg.type === 'ALLERGEN_CLEAR') {
        sendResponse({ ok: true, cleared: clearHighlights() });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
    return true;
  });
})();
