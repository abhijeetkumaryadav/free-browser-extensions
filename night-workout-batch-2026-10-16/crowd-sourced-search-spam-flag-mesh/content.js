/* My Spam Flags — page engine.
 * Boot-once, message-driven. On explicit click it dims/collapses result cards
 * whose links point at one of the user's flagged domains. Restores exactly. */
(function () {
  'use strict';
  if (window.__spamFlagEngine) return;

  var CARD_SELECTORS = [
    'div.g', 'div.tF2Cxc', 'div.sr-ij',
    'li.b_algo',
    'article[data-testid="result"]',
    'div[data-testid="result"]',
    'li[data-layout="organic"]',
    '.organic', '.result__body'
  ];

  var engine = (window.__spamFlagEngine = {
    touched: new Map(),

    // Extract the registrable host from a URL string (best-effort).
    hostOf: function (url) {
      try { return new URL(url, location.href).hostname.toLowerCase().replace(/^www\./, ''); }
      catch (e) { return ''; }
    },

    flagged: function (host, flags) {
      for (var i = 0; i < flags.length; i++) {
        var f = flags[i];
        if (host === f || host.endsWith('.' + f)) return f;
      }
      return null;
    },

    // Unwrap common tracker redirects to reach the real destination.
    unwrap: function (href) {
      try {
        var u = new URL(href, location.href);
        var q = u.searchParams.get('q') || u.searchParams.get('url') || u.searchParams.get('u');
        if (q && /^https?:\/\//i.test(q)) return q;
      } catch (e) {}
      return href;
    },

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

    scan: function (flags, mode) {
      this.restore();
      var cards = this.findCards(), matched = 0, self = this;
      cards.forEach(function (card) {
        var hit = null;
        var links = card.querySelectorAll('a[href]');
        for (var i = 0; i < links.length && !hit; i++) {
          var host = self.hostOf(self.unwrap(links[i].getAttribute('href')));
          if (host) hit = self.flagged(host, flags);
        }
        if (!hit) return;
        self.touched.set(card, {
          opacity: card.style.opacity,
          outline: card.style.outline,
          outlineOffset: card.style.outlineOffset,
          title: card.getAttribute('title')
        });
        if (mode === 'collapse') {
          card.style.display = 'none';
        } else {
          card.style.opacity = '0.22';
          card.style.outline = '2px dashed #ff6b6b';
          card.style.outlineOffset = '2px';
          card.setAttribute('title', 'Flagged as spam by you: ' + hit);
        }
        matched++;
      });
      return { total: cards.length, matched: matched };
    },

    restore: function () {
      var n = this.touched.size;
      this.touched.forEach(function (prev, el) {
        el.style.opacity = prev.opacity;
        el.style.outline = prev.outline;
        el.style.outlineOffset = prev.outlineOffset;
        el.style.display = '';
        if (prev.title === null) el.removeAttribute('title'); else el.setAttribute('title', prev.title);
      });
      this.touched.clear();
      return { restored: n };
    }
  });

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    try {
      if (msg.action === 'scan') {
        sendResponse(engine.scan(msg.flags || [], msg.mode === 'collapse' ? 'collapse' : 'dim'));
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
