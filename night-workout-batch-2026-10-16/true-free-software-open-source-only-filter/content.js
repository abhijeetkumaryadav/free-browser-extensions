/* Keyword Result Filter — page-side engine.
 *
 * Runs in the page's isolated world only after being injected on the user's
 * explicit click (popup -> chrome.scripting). Messages:
 *   { cmd: 'filter', keywords: [..], mode: 'dim' | 'collapse' }
 *   { cmd: 'restore' }
 *   { cmd: 'status' }
 *
 * HONEST SCOPE: matches cards whose text contains the USER's keywords
 * (case-insensitive substring). It cannot know whether software is free,
 * open source, proprietary, or anything else — it only knows the strings
 * you typed. Card detection is heuristic. Guarded against double-injection.
 */

(() => {
  if (window.__kwFilterLoaded) return;
  window.__kwFilterLoaded = true;

  /** Previously hidden elements, for exact restore. */
  let hidden = []; // { el, display, opacity, outline, filter, keyword, snippet }

  /**
   * Find the "card" containing a matching node: walk up until the parent
   * holds at least two siblings (a list of results/cards), capped at 6.
   */
  function findCard(node) {
    let el = node;
    for (let i = 0; i < 6 && el && el !== document.body && el !== document.documentElement; i++) {
      const parent = el.parentElement;
      if (!parent) break;
      el = parent;
      if (parent.children.length >= 2 && el.offsetHeight > 24) return el;
    }
    return node instanceof HTMLElement ? node : document.body;
  }

  /** Scan for result-like cards whose text contains any keyword. */
  function scanKeywords(keywords) {
    const lowered = keywords.map(k => k.toLowerCase());
    const matches = new Map(); // card -> { keyword, snippet }

    // Result-card candidates: links with real text, list items, articles.
    const candidates = document.querySelectorAll('a, article, li, [role="article"], div');
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const tag = el.tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|IFRAME)$/.test(tag)) continue;
      if (hidden.some(h => h.el === el)) continue;

      const text = (el.textContent || '').trim();
      // Skip tiny fragments and giant page blobs.
      if (text.length < 30 || text.length > 2500) continue;

      const low = text.toLowerCase();
      for (let i = 0; i < lowered.length; i++) {
        if (low.includes(lowered[i])) {
          const card = findCard(el);
          if (!matches.has(card)) {
            matches.set(card, {
              keyword: keywords[i],
              snippet: text.slice(0, 80).replace(/\s+/g, ' ')
            });
          }
          break;
        }
      }
      if (matches.size >= 200) break; // sanity cap
    }
    return matches;
  }

  function filter(keywords, mode) {
    if (!keywords.length) return { newly: 0, total: hidden.length, labels: [] };
    const matches = scanKeywords(keywords);
    let newly = 0;
    for (const [card, info] of matches) {
      if (hidden.some(h => h.el === card)) continue;
      const style = card.style;
      hidden.push({ el: card, display: style.display, opacity: style.opacity,
                    outline: style.outline, filter: style.filter, ...info });
      if (mode === 'collapse') {
        style.display = 'none';
      } else {
        style.opacity = '0.22';
        style.outline = '2px dashed #a78bfa';
        style.outlineOffset = '-2px';
        style.filter = 'saturate(0.2)';
      }
      newly++;
    }
    return {
      newly,
      total: hidden.length,
      labels: hidden.slice(0, 8).map(h => `“${h.keyword}” → ${h.snippet}`)
    };
  }

  function restore() {
    const count = hidden.length;
    for (const h of hidden) {
      const s = h.el.style;
      s.display = h.display;
      s.opacity = h.opacity;
      s.outline = h.outline;
      s.outlineOffset = '';
      s.filter = h.filter;
    }
    hidden = [];
    return { restored: count };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.cmd !== 'string') return false;
    try {
      if (msg.cmd === 'filter') {
        const kw = Array.isArray(msg.keywords) ? msg.keywords.filter(k => typeof k === 'string' && k.trim()) : [];
        sendResponse({ ok: true, ...filter(kw, msg.mode === 'collapse' ? 'collapse' : 'dim') });
      } else if (msg.cmd === 'restore') {
        sendResponse({ ok: true, ...restore() });
      } else if (msg.cmd === 'status') {
        sendResponse({ ok: true, total: hidden.length });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return false;
  });
})();
