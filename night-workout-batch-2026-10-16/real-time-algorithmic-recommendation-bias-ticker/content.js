/* Feed Diversity Ticker — content script.
 * Counts outbound links on the page, groups them by registrable domain,
 * and extracts author-ish signals (rel=author links, meta author tags,
 * byline-ish elements). Pure counting — no bias measurement. */

(() => {
  'use strict';

  // Naive registrable-domain extraction (last two labels). Good enough for
  // a diversity heuristic; labeled as approximate in the UI.
  function registrableDomain(host) {
    const parts = host.toLowerCase().split('.').filter(Boolean);
    if (parts.length <= 2) return parts.join('.');
    return parts.slice(-2).join('.');
  }

  function scan() {
    const pageHost = location.hostname.toLowerCase();
    const domainCounts = {};
    let totalLinks = 0;

    for (const a of document.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(a.href, location.href); } catch (e) { continue; }
      if (!/^https?:$/.test(url.protocol)) continue;
      if (url.hostname.toLowerCase() === pageHost) continue; // skip self-links
      totalLinks++;
      const d = registrableDomain(url.hostname);
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    }

    // Author signals: rel=author links + meta author + byline-ish elements.
    const authors = new Set();
    for (const a of document.querySelectorAll('a[rel~="author"]')) {
      const t = (a.textContent || '').trim();
      if (t) authors.add(t.slice(0, 60));
    }
    const metaAuthor = document.querySelector('meta[name="author"], meta[property="article:author"]');
    if (metaAuthor && metaAuthor.content) authors.add(metaAuthor.content.trim().slice(0, 60));
    for (const el of document.querySelectorAll('[class*="byline"], [class*="by-line"], [class*="author-name"]')) {
      const t = (el.textContent || '').trim();
      if (t && t.length < 80) authors.add(t);
      if (authors.size >= 50) break;
    }

    const domains = Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((x, y) => y.count - x.count);

    // Diversity score: 0–100. Based on effective number of domains
    // (inverse Simpson index), normalized against a 10-domain ceiling.
    let score = 0;
    if (totalLinks > 0 && domains.length > 0) {
      let simpson = 0;
      for (const d of domains) {
        const p = d.count / totalLinks;
        simpson += p * p;
      }
      const effective = 1 / simpson;
      score = Math.round(Math.min(100, (effective / 10) * 100));
    }

    return {
      totalLinks,
      domains: domains.slice(0, 15),
      domainCount: domains.length,
      authors: [...authors].slice(0, 20),
      authorCount: authors.size,
      score
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'FDT_SCAN') sendResponse(scan());
    return true;
  });
})();
