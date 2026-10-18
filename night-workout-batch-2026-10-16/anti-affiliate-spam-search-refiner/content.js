// Anti-Affiliate Spam Search Refiner — page-side scan/dim/restore engine.
// Boot-once guard: safe to inject repeatedly; only one listener registers.
(() => {
  if (window.__aasrLoaded) return;
  window.__aasrLoaded = true;

  // Original inline styles stashed per element so restore is exact.
  const originalStyles = new Map();
  let dimmed = [];

  // --- Heuristic signals (bundled, local only) ---
  const DISCLOSURE_RE = /affiliate(\s+link|\s+disclosure)?|we\s+may\s+earn\s+(a\s+)?commission|paid\s+link|advertising\s+disclosure|sponsored\s+link/i;
  const TRACKING_URL_RE = /\/out\?|\/go\/|redirect|aff_?id=|[?&](tag|ref|affiliate|ascsubtag)=|utm_medium=affiliate|click\.bank|shareasale|awin1|go\.skimresources/i;
  const LISTICLE_BAIT_RE = /^(best|top)\s+\d+|best\s+.+\s+(of\s+)?20\d\d|honest\s+review|unbiased\s+review/i;

  /** Climb from an anchor to the nearest result-card-like ancestor. */
  function cardOf(anchor) {
    let el = anchor;
    for (let i = 0; i < 6 && el && el !== document.body; i++) {
      if (el.matches && el.matches('div.g, li.b_algo, article[data-testid="result"], [data-result-card], li, article, div')) {
        const text = (el.innerText || '').trim();
        if (text.length > 40 && text.length < 4000) return el;
      }
      el = el.parentElement;
    }
    return anchor.parentElement || anchor;
  }

  /** Collect candidate result anchors on the page. */
  function findAnchors() {
    const found = [];
    // Known search-engine result containers first.
    const containers = document.querySelectorAll('div.g, li.b_algo, article[data-testid="result"]');
    for (const c of containers) {
      const a = c.querySelector('a[href^="http"]');
      if (a) found.push(a);
    }
    // Generic fallback: links with substantial anchor text.
    if (found.length < 3) {
      for (const a of document.querySelectorAll('a[href^="http"]')) {
        const t = (a.innerText || '').trim();
        if (t.length > 25 && t.length < 220) found.push(a);
        if (found.length > 60) break;
      }
    }
    return found;
  }

  /** Score one result card; return {score, reasons[]} of affiliate signals. */
  function scoreCard(anchor, card) {
    const reasons = [];
    const href = anchor.getAttribute('href') || '';
    const cardText = (card.innerText || '').slice(0, 2000);
    const title = (anchor.innerText || '').trim().slice(0, 140);

    if (DISCLOSURE_RE.test(cardText)) reasons.push('affiliate disclosure text');
    if (TRACKING_URL_RE.test(href)) reasons.push('affiliate/tracking URL');
    if (LISTICLE_BAIT_RE.test(title)) reasons.push('listicle bait title');
    // "Best X" + buy-now language combo.
    if (/best\s+\d+/i.test(title) && /(buy now|check price|discount|deal)/i.test(cardText)) {
      reasons.push('best-list + buy language');
    }
    return { title, reasons };
  }

  function stash(el) {
    if (!originalStyles.has(el)) {
      originalStyles.set(el, { opacity: el.style.opacity, display: el.style.display, outline: el.style.outline });
    }
  }

  function applyDim(card, mode) {
    stash(card);
    if (mode === 'collapse') {
      card.style.display = 'none';
    } else {
      card.style.opacity = '0.35';
      card.style.outline = '2px dashed #ff6b6b';
      card.style.outlineOffset = '2px';
    }
    card.setAttribute('data-aasr-dimmed', '1');
    dimmed.push(card);
  }

  function scan(mode) {
    restore(true); // clear previous run first
    const matches = [];
    const seen = new Set();
    for (const anchor of findAnchors()) {
      const card = cardOf(anchor);
      if (seen.has(card) || card.hasAttribute('data-aasr-dimmed')) continue;
      seen.add(card);
      const { title, reasons } = scoreCard(anchor, card);
      if (reasons.length > 0) {
        applyDim(card, mode);
        matches.push({ title, why: reasons.join('; ') });
        if (matches.length >= 50) break;
      }
    }
    return { dimmed: matches.length, matches };
  }

  function restore(silent) {
    for (const el of dimmed) {
      const o = originalStyles.get(el);
      if (o) {
        el.style.opacity = o.opacity; el.style.display = o.display; el.style.outline = o.outline;
      }
      el.removeAttribute('data-aasr-dimmed');
    }
    dimmed = [];
    if (!silent) originalStyles.clear();
    return { restored: true };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.command === 'scan') sendResponse({ ok: true, ...scan(msg.mode || 'dim') });
      else if (msg.command === 'restore') sendResponse({ ok: true, ...restore(false) });
      else sendResponse({ ok: false, error: 'unknown command' });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  });
})();
