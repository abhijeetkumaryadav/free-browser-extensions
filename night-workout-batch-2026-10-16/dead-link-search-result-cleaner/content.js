// Dead Link Checker — content engine (message-driven).
// On "check": collects visible http(s) links (up to maxLinks), probes each with a
// no-cors request (concurrency 4, 8s timeout). A rejected request means the host
// never connected — badge it. Browser CORS rules make status codes invisible to
// us, so 404s CANNOT be detected — this is labeled honestly in the UI.
// On "clear": removes every badge. The page itself is never modified.
"use strict";

(() => {
  const ATTR = "data-dlc-dead";
  const BADGE_CLASS = "dlc-dead-badge";
  const CONCURRENCY = 4;
  const TIMEOUT_MS = 8000;

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  }

  function collectLinks(maxLinks) {
    const seen = new Set();
    const out = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      if (out.length >= maxLinks) return;
      if (a.hasAttribute(ATTR)) return;
      let url;
      try { url = new URL(a.href, location.href); }
      catch { return; }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const key = url.href.split("#")[0];
      if (seen.has(key)) return;
      seen.add(key);
      if (!isVisible(a)) return;
      out.push({ anchor: a, url: key });
    });
    return out;
  }

  function probe(url) {
    // Try HEAD first (cheap), fall back to GET. no-cors: resolves if the host
    // connects at all; rejects on DNS/connection failure. Status is opaque.
    const attempt = (method) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      return fetch(url, { method, mode: "no-cors", credentials: "omit", signal: ctrl.signal })
        .finally(() => clearTimeout(timer));
    };
    return attempt("HEAD").catch(() => attempt("GET"));
  }

  function badge(anchor) {
    anchor.setAttribute(ATTR, "1");
    const b = document.createElement("span");
    b.className = BADGE_CLASS;
    b.textContent = "⚠ may be dead";
    b.title = "Dead Link Checker: this link failed to connect. May be a false positive on bot-protected sites.";
    b.style.cssText = [
      "display:inline-block", "font:600 10px/1.4 system-ui,sans-serif",
      "color:#fbbf24", "background:rgba(20,20,26,.92)",
      "border:1px solid #fbbf24", "border-radius:6px",
      "padding:1px 6px", "margin-left:6px", "vertical-align:middle",
      "pointer-events:none",
    ].join(";");
    anchor.insertAdjacentElement("afterend", b);
  }

  async function check(maxLinks, tabId) {
    const links = collectLinks(maxLinks);
    let dead = 0, done = 0;
    const notify = () => {
      chrome.runtime.sendMessage({ type: "dlc-progress", done, total: links.length }).catch(() => {});
    };
    // Concurrency pool of 4.
    let i = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, links.length) }, async () => {
      while (i < links.length) {
        const { anchor, url } = links[i++];
        try { await probe(url); }
        catch { badge(anchor); dead++; }
        done++;
        notify();
      }
    });
    await Promise.all(workers);
    return { checked: links.length, dead };
  }

  function clear() {
    let n = 0;
    document.querySelectorAll(`[${ATTR}]`).forEach((a) => {
      a.removeAttribute(ATTR);
      const next = a.nextElementSibling;
      if (next && next.classList && next.classList.contains(BADGE_CLASS)) next.remove();
      n++;
    });
    return n;
  }

  // Boot-once: re-injecting must not duplicate the listener.
  if (window.__dlcBooted) return;
  window.__dlcBooted = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "check") {
      check(msg.maxLinks || 30).then(
        (r) => sendResponse({ ok: true, ...r }),
        (e) => sendResponse({ ok: false, error: String(e) })
      );
      return true; // async response
    }
    if (msg.type === "clear") {
      sendResponse({ ok: true, cleared: clear() });
    }
    return true;
  });
})();
