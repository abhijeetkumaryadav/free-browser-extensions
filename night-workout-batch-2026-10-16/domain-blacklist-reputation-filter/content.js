// Domain Blacklist Filter — content engine (message-driven).
// Scan: dims/collapses result cards linking to the user's blacklisted domains.
// Restore: puts every hidden card back exactly as it was. Nothing runs until asked.
"use strict";

(() => {
  const ATTR = "data-dblf-hidden";
  const stashed = new Map(); // element -> { display, opacity, outline, filter }

  function domainMatches(host, entry) {
    host = host.toLowerCase().replace(/^www\./, "");
    entry = entry.toLowerCase();
    return host === entry || host.endsWith("." + entry);
  }

  function hostnameOf(url) {
    try { return new URL(url, location.href).hostname; }
    catch { return ""; }
  }

  function findCard(anchor) {
    // Climb to a plausible "result card" container.
    let el = anchor;
    for (let i = 0; i < 6 && el && el !== document.body; i++) {
      el = el.parentElement;
      if (!el) break;
      const cls = (el.className || "").toString().toLowerCase();
      if (/(result|card|item|entry|teaser|snippet)/.test(cls)) return el;
    }
    return anchor;
  }

  function scan(domains, mode) {
    const anchors = document.querySelectorAll("a[href]");
    const matched = new Set();
    anchors.forEach((a) => {
      if (a.hasAttribute(ATTR)) return;
      const host = hostnameOf(a.href);
      if (!host || !domains.some((d) => domainMatches(host, d))) return;
      const card = findCard(a);
      if (matched.has(card)) return;
      matched.add(card);
      card.setAttribute(ATTR, "1");
      if (!stashed.has(card)) {
        stashed.set(card, {
          display: card.style.display,
          opacity: card.style.opacity,
          outline: card.style.outline,
          filter: card.style.filter,
        });
      }
      if (mode === "collapse") {
        card.style.display = "none";
      } else {
        card.style.opacity = "0.25";
        card.style.outline = "2px dashed #f87171";
        card.style.filter = "saturate(0.4)";
      }
    });
    return matched.size;
  }

  function restore() {
    let n = 0;
    stashed.forEach((orig, el) => {
      if (!el.isConnected) return;
      el.style.display = orig.display;
      el.style.opacity = orig.opacity;
      el.style.outline = orig.outline;
      el.style.filter = orig.filter;
      el.removeAttribute(ATTR);
      n++;
    });
    stashed.clear();
    return n;
  }

  // Boot-once: re-injecting must not duplicate the listener.
  if (window.__dblfBooted) return;
  window.__dblfBooted = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "scan") {
      try {
        const hidden = scan(msg.domains || [], msg.mode || "dim");
        sendResponse({ ok: true, hidden });
      } catch (e) { sendResponse({ ok: false, error: String(e) }); }
    } else if (msg.type === "restore") {
      sendResponse({ ok: true, restored: restore() });
    }
    return true;
  });
})();
