/* Strict Match Filter — page engine.
 * Boot-once, message-driven. Never edits the page: it only dims/collapses
 * result cards on explicit user click, and restores them exactly. */
(function () {
  'use strict';
  if (window.__strictMatchEngine) return;

  var CARD_SELECTORS = [
    'div.g', 'div.tF2Cxc', 'div.sr-ij',      // Google
    'li.b_algo',                             // Bing
    'article[data-testid="result"]',          // DuckDuckGo
    'div[data-testid="result"]',
    'li[data-layout="organic"]',             // Yahoo-ish
    '.organic', '.result__body'
  ];

  var engine = (window.__strictMatchEngine = {
    touched: new Map(), // el -> {opacity, outline, outlineOffset}

    // Find likely result cards; falls back to climbing from outbound links.
    findCards: function () {
      var seen = new Set(), out = [];
      CARD_SELECTORS.forEach(function (sel) {
        var nodes;
        try { nodes = document.querySelectorAll(sel); } catch (e) { return; }
        nodes.forEach(function (el) {
          if (!seen.has(el) && el.offsetParent !== null && (el.innerText || '').length > 20) {
            seen.add(el);
            out.push(el);
          }
        });
      });
      if (!out.length) {
        document.querySelectorAll('a[href^="http"]').forEach(function (a) {
          if (a.offsetParent === null) return;
          var el = a, card = null;
          for (var i = 0; i < 4 && el && el !== document.body; i++, el = el.parentElement) {
            if (el && /^(ARTICLE|LI|DIV)$/.test(el.tagName) && (el.innerText || '').length > 40) {
              card = el;
              break;
            }
          }
          if (card && !seen.has(card)) { seen.add(card); out.push(card); }
        });
      }
      return out.slice(0, 200);
    },

    // Dim/collapse cards whose text misses at least one term.
    scan: function (terms, mode) {
      this.restore(); // always start from a clean slate
      var cards = this.findCards(), kept = 0, dimmed = 0;
      var self = this;
      cards.forEach(function (card) {
        var text = (card.innerText || '').toLowerCase();
        var allHit = terms.every(function (t) { return text.indexOf(t) !== -1; });
        if (allHit) { kept++; return; }
        self.touched.set(card, {
          opacity: card.style.opacity,
          outline: card.style.outline,
          outlineOffset: card.style.outlineOffset
        });
        if (mode === 'collapse') {
          card.style.display = 'none';
        } else {
          card.style.opacity = '0.22';
          card.style.outline = '2px dashed #f59e0b';
          card.style.outlineOffset = '2px';
        }
        dimmed++;
      });
      return { total: cards.length, kept: kept, dimmed: dimmed };
    },

    // Restore every touched card to its exact original inline style.
    restore: function () {
      var n = this.touched.size;
      this.touched.forEach(function (prev, el) {
        el.style.opacity = prev.opacity;
        el.style.outline = prev.outline;
        el.style.outlineOffset = prev.outlineOffset;
        el.style.display = '';
      });
      this.touched.clear();
      return { restored: n };
    }
  });

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    try {
      if (msg.action === 'scan') {
        sendResponse(engine.scan(msg.terms || [], msg.mode === 'collapse' ? 'collapse' : 'dim'));
      } else if (msg.action === 'restore') {
        sendResponse(engine.restore());
      } else {
        sendResponse({ error: 'unknown action' });
      }
    } catch (err) {
      sendResponse({ error: String((err && err.message) || err) });
    }
    return true;
  });
})();
