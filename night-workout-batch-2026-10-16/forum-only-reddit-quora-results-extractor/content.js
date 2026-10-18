// Forum-Only Filter — page-side engine (boot-once content script).
// Injected only when the user clicks "Filter to forums".
// Scans search-result cards, keeps forum/discussion destinations,
// dims or hides the rest. Fully reversible via "Restore page".
(function () {
  'use strict';
  if (window.__forumOnlyFilterV1) return;
  window.__forumOnlyFilterV1 = true;

  // Well-known forum / discussion domains.
  const KNOWN_DOMAINS = [
    'reddit.com', 'quora.com', 'stackoverflow.com', 'stackexchange.com',
    'superuser.com', 'serverfault.com', 'askubuntu.com', 'mathoverflow.net',
    'stackapps.com', 'discourse.org',
  ];
  // Substring clues that strongly suggest a forum in the hostname.
  const HOST_KEYWORDS = ['forum', 'forums', 'community', 'discuss', 'discussion', 'board', 'boards'];
  // Path clues.
  const PATH_RE = /\/(forums?|community|discuss|discussion|threads?)(\/|$)/;

  // Elements we touched, mapped to their original inline styles for restore.
  const touched = new Map();

  // ---------- URL helpers ----------
  function hostnameOf(href) {
    try { return new URL(href, location.href).hostname.toLowerCase(); }
    catch (e) { return ''; }
  }
  function pathOf(href) {
    try { return new URL(href, location.href).pathname.toLowerCase(); }
    catch (e) { return ''; }
  }

  function isForumHref(href, extraDomains) {
    const host = hostnameOf(href);
    if (!host) return false;
    const path = pathOf(href);
    // Known forum domains (incl. subdomains like old.reddit.com).
    if (KNOWN_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) return true;
    // Hostname keyword clues, e.g. forum.example.com.
    if (HOST_KEYWORDS.some((k) => host.includes(k))) return true;
    // Path clues, e.g. example.com/forums/…
    if (PATH_RE.test(path)) return true;
    // User-supplied extra domains.
    const extras = (extraDomains || []).map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (extras.some((d) => host === d || host.endsWith('.' + d))) return true;
    return false;
  }

  // Unwrap tracker redirects like /url?q=<real-url> so we judge the real target.
  function destinationOf(anchor) {
    const raw = anchor.getAttribute('href') || '';
    try {
      const u = new URL(raw, location.href);
      const q = u.searchParams.get('q');
      if (u.pathname === '/url' && q && /^https?:\/\//i.test(q)) return q;
    } catch (e) { /* fall through */ }
    return raw;
  }

  // ---------- result discovery ----------
  // Known search-engine result containers, plus generic fallbacks.
  const SELECTORS = [
    'div.g',                       // Google
    'li.b_algo',                   // Bing
    'article[data-testid="result"]', // DuckDuckGo
    'div.result',                  // generic
    'li.search-result',            // generic
    'div.sr-result',               // generic
  ];

  function findResults() {
    const seen = new Set();
    const out = [];
    for (const sel of SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el) || !el.isConnected) return;
        const a = el.querySelector('a[href]');
        if (!a) return;
        const href = destinationOf(a);
        if (!/^https?:\/\//i.test(href)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return; // skip hidden
        seen.add(el);
        out.push({ el, href });
      });
    }
    return out;
  }

  // ---------- actions ----------
  function applyFilter(opts) {
    restore(); // idempotent: clear any previous pass first
    const mode = opts.mode === 'hide' ? 'hide' : 'dim';
    const results = findResults();
    let kept = 0;
    let dimmed = 0;
    for (const { el, href } of results) {
      if (isForumHref(href, opts.extraDomains)) { kept += 1; continue; }
      touched.set(el, {
        opacity: el.style.opacity,
        outline: el.style.outline,
        display: el.style.display,
      });
      if (mode === 'hide') {
        el.style.display = 'none';
      } else {
        el.style.opacity = '0.25';
        el.style.outline = '2px dashed #a78bfa';
      }
      dimmed += 1;
    }
    return { total: results.length, kept, dimmed };
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

  // ---------- message bus ----------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.action === 'forum-filter') {
        sendResponse(Object.assign({ ok: true }, applyFilter(msg.opts || {})));
      } else if (msg.action === 'forum-restore') {
        sendResponse(Object.assign({ ok: true }, restore()));
      } else {
        sendResponse({ ok: false, error: 'unknown-action' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return true;
  });
})();
