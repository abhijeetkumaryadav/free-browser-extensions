/* SEO-farm domain blocker engine: runs only on explicit user click.
   Scans result-like cards for links whose host matches the USER's blacklist
   (exact host or subdomain suffix), then dims or collapses the enclosing card.
   All original styles are stashed per node so Restore returns the page exactly. */
(function () {
  'use strict';

  // Boot-once guard so repeated injections don't double-register listeners.
  if (window.__seoFarmBlockerLoaded) return;
  window.__seoFarmBlockerLoaded = true;

  // Result-card selectors for the major search engines + generic fallbacks.
  const CARD_SELECTORS = [
    'div.g',                       // Google
    'li.b_algo',                   // Bing
    'article[data-testid="result"]', // DuckDuckGo
    'div.result',                  // Brave / Startpage
    'div.search-result',
    'li.search-result',
    'article'
  ];

  // Normalize a user entry: lowercase, strip scheme/path/www, trim.
  function normalizeDomain(entry) {
    let d = entry.trim().toLowerCase();
    d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
    d = d.split('/')[0].split(':')[0].trim();
    return d;
  }

  // True if host equals or is a subdomain of the blacklisted domain.
  function hostMatches(host, blacklisted) {
    return host === blacklisted || host.endsWith('.' + blacklisted);
  }

  // Unwrap common tracker redirects so we judge the real destination.
  function realDestination(href) {
    try {
      const url = new URL(href, location.origin);
      const q = url.searchParams.get('q') || url.searchParams.get('u');
      if ((url.pathname === '/url' || /aclk/i.test(url.href)) && q) return q;
    } catch (_) { /* keep original href */ }
    return href;
  }

  // Hide/dim a node, stashing its original inline styles for exact restore.
  function applyToNode(node, mode) {
    if (!node || node.dataset.seoFarmBlocked === '1') return;
    node.dataset.seoFarmBlocked = '1';
    node.dataset.seoFarmOrigDisplay = node.style.display || '';
    node.dataset.seoFarmOrigOpacity = node.style.opacity || '';
    node.dataset.seoFarmOrigOutline = node.style.outline || '';
    if (mode === 'collapse') {
      node.style.display = 'none';
    } else {
      node.style.opacity = '0.22';
      node.style.outline = '2px dashed #a78bfa';
    }
  }

  // Restore every node this extension touched.
  function restoreAll() {
    const nodes = document.querySelectorAll('[data-seo-farm-blocked="1"]');
    nodes.forEach((node) => {
      node.style.display = node.dataset.seoFarmOrigDisplay || '';
      node.style.opacity = node.dataset.seoFarmOrigOpacity || '';
      node.style.outline = node.dataset.seoFarmOrigOutline || '';
      delete node.dataset.seoFarmBlocked;
      delete node.dataset.seoFarmOrigDisplay;
      delete node.dataset.seoFarmOrigOpacity;
      delete node.dataset.seoFarmOrigOutline;
    });
    return nodes.length;
  }

  // Scan the page and block cards from blacklisted domains.
  function scanAndBlock(blacklist, mode) {
    const blocked = [];
    const seen = new Set();
    for (const sel of CARD_SELECTORS) {
      for (const card of document.querySelectorAll(sel)) {
        if (seen.has(card)) continue;
        seen.add(card);
        const link = card.querySelector('a[href]');
        if (!link) continue;
        let host = '';
        try { host = new URL(realDestination(link.href), location.origin).hostname.toLowerCase(); }
        catch (_) { continue; }
        host = host.replace(/^www\./, '');
        const match = blacklist.find((b) => hostMatches(host, b));
        if (match) {
          const title = (card.querySelector('h3, h2, a')?.textContent || card.textContent)
            .trim().slice(0, 80);
          applyToNode(card, mode);
          blocked.push({ title: title || '(untitled result)', domain: host });
        }
      }
    }
    return blocked;
  }

  // Message interface for the popup.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'SEOFARM_SCAN') {
      sendResponse({ blocked: scanAndBlock(msg.blacklist || [], msg.mode || 'dim') });
    } else if (msg.type === 'SEOFARM_RESTORE') {
      sendResponse({ restored: restoreAll() });
    }
    return true;
  });
})();
