/* SitemapForge content script.
   Exposes a page-context helper that collects same-origin links.
   Registered via chrome.scripting only when the user asks for it. */
window.__sitemapforge_collect = function () {
  const seen = new Set();
  const out = [];
  const origin = location.origin;
  document.querySelectorAll('a[href]').forEach((a) => {
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== origin) return;              // same-site only
      if (!/^https?:$/.test(u.protocol)) return;
      u.hash = '';
      const href = u.href;
      if (!seen.has(href)) { seen.add(href); out.push(href); }
    } catch { /* skip malformed hrefs */ }
  });
  return out;
};
