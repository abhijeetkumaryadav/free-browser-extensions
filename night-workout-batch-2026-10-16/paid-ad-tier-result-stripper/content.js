/* Ad-tier heuristic scanner: runs read-only in the tab, never edits page text.
   Matches are collapsed (hidden, never deleted); original display styles are
   stashed per node so Restore returns the page exactly. */
(function () {
  'use strict';

  // Boot-once guard so repeated injections don't double-register listeners.
  if (window.__adTierStripperLoaded) return;
  window.__adTierStripperLoaded = true;

  // --- Heuristic ad-tier signals (bundled, heuristic, not authoritative) ---
  const AD_LABEL_RE = /\b(ad|sponsored|promoted|paid\s*(ad|promotion|result|listing)|advertisement|partner\s*content)\b/i;
  const AD_URL_RE = /(aclk|doubleclick|googleadservices|gclid=|fbclid=|msclkid=|dclid=|yclid=|\/aclk\?|adurl=|clickid=|aff_id=|affid=)/i;

  // Card selectors for the major search engines + generic fallbacks.
  const CARD_SELECTORS = [
    'div.g',                    // Google
    'div[data-hveid] div.g',
    'li.b_algo',                // Bing
    'article[data-testid="result"]', // DuckDuckGo
    'div.result',                // Brave / Startpage
    'div.search-result',
    'li.search-result',
    'article'
  ];

  // Collapse a node, stashing its original display for exact restore.
  function collapseNode(node) {
    if (!node || node.dataset.adTierStripped === '1') return;
    node.dataset.adTierStripped = '1';
    node.dataset.adTierOrigDisplay = node.style.display || '';
    node.style.display = 'none';
  }

  // Restore every node collapsed by this extension.
  function restoreAll() {
    const nodes = document.querySelectorAll('[data-ad-tier-stripped="1"]');
    nodes.forEach((node) => {
      node.style.display = node.dataset.adTierOrigDisplay || '';
      delete node.dataset.adTierStripped;
      delete node.dataset.adTierOrigDisplay;
    });
    return nodes.length;
  }

  // Return the first ad signal found in a card, or null.
  function flagCard(card) {
    if (card.dataset.adTierStripped === '1') return null;

    // 1) Visible ad/sponsored labels inside the card.
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const text = textNode.nodeValue.trim();
      if (text.length > 0 && text.length <= 40 && AD_LABEL_RE.test(text)) {
        return `label "${text}"`;
      }
    }

    // 2) Ad-labeled attributes.
    if (card.querySelector('[aria-label*="ad" i],[data-ad],[data-sponsored],[class*="sponsored" i],[id*="sponsored" i]')) {
      return 'ad-labeled attribute';
    }

    // 3) Ad/tracking URLs on links inside the card.
    const links = card.querySelectorAll('a[href]');
    for (const a of links) {
      if (AD_URL_RE.test(a.href)) return 'ad/tracking URL';
    }

    // 4) Suspicious sponsored-language phrasing near the top of the card.
    const head = card.textContent.slice(0, 200);
    if (/\b(shop\s*now|limited\s*time\s*offer|act\s*now|buy\s*now)\b/i.test(head) &&
        /sponsor|partner/i.test(card.textContent.slice(0, 500))) {
      return 'sponsored phrasing';
    }

    return null;
  }

  // Scan the page and collapse flagged cards. Returns flagged items.
  function scanAndCollapse() {
    const flagged = [];
    const seen = new Set();
    for (const sel of CARD_SELECTORS) {
      for (const card of document.querySelectorAll(sel)) {
        if (seen.has(card)) continue;
        seen.add(card);
        const reason = flagCard(card);
        if (reason) {
          const title = (card.querySelector('h3, h2, a')?.textContent || card.textContent)
            .trim().slice(0, 80);
          collapseNode(card);
          flagged.push({ title: title || '(untitled result)', reason });
        }
      }
    }
    return flagged;
  }

  // Message interface for the popup.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'ADTIER_SCAN') {
      sendResponse({ flagged: scanAndCollapse() });
    } else if (msg.type === 'ADTIER_RESTORE') {
      sendResponse({ restored: restoreAll() });
    }
    return true;
  });
})();
