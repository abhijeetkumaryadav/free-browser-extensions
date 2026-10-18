// Dropship Spam Blocker — page-side engine (boot-once content script).
// Injected only when the user clicks "Scan & flag".
// Scores product cards against bundled text-signal heuristics and
// dims/hides the ones that look like dropship spam. Fully reversible.
(function () {
  'use strict';
  if (window.__dropshipBlockerV1) return;
  window.__dropshipBlockerV1 = true;

  const THRESHOLD = 3; // points needed to flag a card

  // Bundled heuristic signals. Weights are illustrative, not factual claims.
  const SIGNALS = [
    { re: /free\s+(worldwide|global)\s+shipping/i, w: 2, why: '“Free worldwide shipping” claim' },
    { re: /only\s+\d+\s+left|selling\s+fast|almost\s+(gone|sold\s+out)/i, w: 1, why: 'Urgency wording (“only X left”)' },
    { re: /sale\s+ends|ends?\s+in\s+\d|limited[\s-]?time|offer\s+ends|deal\s+ends/i, w: 1, why: 'Urgency wording (“sale ends”)' },
    { re: /as\s+seen\s+on\s+tv/i, w: 1, why: '“As seen on TV” claim' },
    { re: /100%\s*(satisfaction|money[\s-]?back)\s*guarantee/i, w: 1, why: 'Guarantee-heavy wording' },
    { re: /was\s*[$€£¥]\s?[\d.,]+\s*(now|sale)\s*[$€£¥]\s?[\d.,]+/i, w: 2, why: 'Was/now strikethrough pricing' },
    { re: /no\s+brand|unbranded|generic\s+version/i, w: 1, why: 'Generic/unbranded wording' },
  ];
  const DISCOUNT_RE = /(\d{1,3})\s*%\s*off/i;
  const TIMER_SEL = '[class*="countdown" i],[class*="timer" i],[id*="countdown" i]';
  const TIME_RE = /\b\d{1,2}:\d{2}(:\d{2})?\b/;
  const PRICE_RE = /[$€£¥]\s?\d[\d.,]*/;

  const touched = new Map();

  // ---------- card discovery ----------
  // Find price-bearing elements, then climb to a card-like ancestor.
  function findCards() {
    const cards = new Map(); // element -> price text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seenCards = new Set();
    let node;
    let guard = 0;
    while ((node = walker.nextNode()) && guard < 20000) {
      guard += 1;
      const t = node.nodeValue || '';
      if (!PRICE_RE.test(t)) continue;
      let el = node.parentElement;
      let card = null;
      for (let depth = 0; depth < 6 && el && el !== document.body; depth += 1) {
        const cls = (el.className || '').toString().toLowerCase();
        const id = (el.id || '').toLowerCase();
        if (/product|card|item|tile|listing|deal|offer/.test(cls + ' ' + id) ||
            el.tagName === 'ARTICLE' || el.tagName === 'LI') {
          card = el;
          break;
        }
        el = el.parentElement;
      }
      if (card && !seenCards.has(card)) {
        const r = card.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          seenCards.add(card);
          cards.set(card, t.trim().slice(0, 40));
        }
      }
    }
    return Array.from(cards.keys());
  }

  // ---------- scoring ----------
  function hasTimer(card) {
    if (card.querySelector(TIMER_SEL)) return true;
    // Small elements that look like a ticking clock, e.g. "04:59:12".
    const els = card.querySelectorAll('span, div, p, b, strong');
    for (const el of els) {
      const t = (el.textContent || '').trim();
      if (t.length <= 12 && TIME_RE.test(t)) return true;
    }
    return false;
  }

  function scoreCard(card) {
    const text = (card.innerText || '').replace(/\s+/g, ' ');
    let score = 0;
    const reasons = [];
    for (const s of SIGNALS) {
      if (s.re.test(text)) { score += s.w; reasons.push(s.why); }
    }
    const dm = text.match(DISCOUNT_RE);
    if (dm && parseInt(dm[1], 10) >= 70) {
      score += 2;
      reasons.push(`Very large discount (${dm[1]}% off)`);
    }
    if (hasTimer(card)) {
      score += 2;
      reasons.push('Visible countdown timer');
    }
    return { score, reasons };
  }

  // ---------- actions ----------
  function applyScan(opts) {
    restore();
    const mode = opts.mode === 'hide' ? 'hide' : 'dim';
    const cards = findCards();
    let flagged = 0;
    const top = [];
    for (const card of cards) {
      const { score, reasons } = scoreCard(card);
      if (score < THRESHOLD) continue;
      touched.set(card, {
        opacity: card.style.opacity,
        outline: card.style.outline,
        display: card.style.display,
      });
      if (mode === 'hide') {
        card.style.display = 'none';
      } else {
        card.style.opacity = '0.25';
        card.style.outline = '2px dashed #fb7185';
      }
      flagged += 1;
      if (top.length < 8) top.push({ score, why: reasons.slice(0, 2).join('; ') });
    }
    top.sort((a, b) => b.score - a.score);
    return { total: cards.length, flagged, top };
  }

  function restore() {
    touched.forEach((orig, el) => {
      el.style.opacity = orig.opacity;
      el.style.outline = orig.outline;
      el.style.display = orig.display;
    });
    const n = touched.size;
    touched.clear();
    return { restored: n };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.action === 'dropship-scan') {
        sendResponse(Object.assign({ ok: true }, applyScan(msg.opts || {})));
      } else if (msg.action === 'dropship-restore') {
        sendResponse(Object.assign({ ok: true }, restore()));
      } else {
        sendResponse({ ok: false, error: 'unknown-action' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
    return true;
  });
})();
