/* Sponsored Link Nuclear Purger — page-side engine.
 *
 * Runs in the page's isolated world only after being injected on the user's
 * explicit click (popup -> chrome.scripting). Listens for one-shot messages:
 *   { cmd: 'purge',   mode: 'dim' | 'collapse' } -> hides sponsored cards
 *   { cmd: 'restore' }                           -> restores every hidden card
 *   { cmd: 'status' }                            -> current hidden count
 *
 * Detection is HEURISTIC: looks for short text/attributes containing
 * "sponsored", "advertisement", "promoted", etc., then finds the enclosing
 * card. It can miss or misfire — the UI says so. Guarded against
 * double-injection.
 */

(() => {
  if (window.__sponsoredPurgerLoaded) return; // injected once per page
  window.__sponsoredPurgerLoaded = true;

  // Short-label text that marks a sponsored unit.
  const LABEL_RE = /\b(sponsored|advertisement|advertisements|promoted|paid\s+post|advertorial)\b/i;
  // Attribute values that commonly mark ad units (search engines, feeds).
  const ATTR_RE = /\b(ad|sponsored|promoted|advertisement)\b/i;

  /** Previously hidden elements, so restore can put them back exactly. */
  let hidden = []; // { el, display, opacity, outline, filter }

  /** True if this element itself is a sponsored label candidate. */
  function isSponsorLabel(el) {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|IFRAME)$/.test(tag)) return false;

    // 1. Attribute signals (fast, reliable).
    for (const attr of ['aria-label', 'data-ad', 'data-sponsored', 'data-ad-client', 'title']) {
      const v = el.getAttribute(attr);
      if (v && ATTR_RE.test(v)) return true;
    }

    // 2. Short visible text that IS a label, not a whole paragraph.
    const text = (el.textContent || '').trim();
    if (text.length === 0 || text.length > 48) return false;
    if (LABEL_RE.test(text)) return true;

    return false;
  }

  /**
   * Find the card that contains a sponsored label: walk up the tree until
   * we reach an element whose parent holds at least two siblings (a list of
   * cards), capped at 6 levels. Falls back to the label's direct parent.
   */
  function findCard(labelEl) {
    let el = labelEl;
    for (let i = 0; i < 6 && el && el !== document.body && el !== document.documentElement; i++) {
      const parent = el.parentElement;
      if (!parent) break;
      el = parent;
      if (parent.children.length >= 2 && el.offsetHeight > 24) return el;
    }
    return labelEl.parentElement || labelEl;
  }

  /** Collect distinct card elements whose labels mark them sponsored. */
  function scanSponsored() {
    const cards = new Map(); // card -> label text (evidence)
    // Candidate label elements: small inline-ish nodes plus attribute matches.
    const candidates = document.querySelectorAll(
      'span, a, p, small, label, b, i, em, strong, div, button, [aria-label], [data-ad], [data-sponsored]'
    );
    for (const el of candidates) {
      if (!isSponsorLabel(el)) continue;
      const card = findCard(el);
      if (!card || hidden.some(h => h.el === card)) continue;
      const evidence = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 60);
      if (!cards.has(card)) cards.set(card, evidence);
    }
    return cards;
  }

  /** Hide the cards per mode; record previous inline styles for restore. */
  function purge(mode) {
    const cards = scanSponsored();
    let newly = 0;
    for (const [card, evidence] of cards) {
      const style = card.style;
      hidden.push({
        el: card,
        display: style.display,
        opacity: style.opacity,
        outline: style.outline,
        filter: style.filter,
        evidence
      });
      if (mode === 'collapse') {
        style.display = 'none';
      } else {
        // dim: leave layout intact, make it unmistakable
        style.opacity = '0.22';
        style.outline = '2px dashed #ef4444';
        style.outlineOffset = '-2px';
        style.filter = 'saturate(0.2)';
      }
      newly++;
    }
    return { newly, total: hidden.length, labels: hidden.slice(0, 8).map(h => h.evidence) };
  }

  /** Restore every previously hidden card to its exact prior styling. */
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
      if (msg.cmd === 'purge') {
        sendResponse({ ok: true, ...purge(msg.mode === 'collapse' ? 'collapse' : 'dim') });
      } else if (msg.cmd === 'restore') {
        sendResponse({ ok: true, ...restore() });
      } else if (msg.cmd === 'status') {
        sendResponse({ ok: true, total: hidden.length });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return false; // synchronous response
  });
})();
