// Content script: on-demand scan of the current page for cancel/manage links.
// Runs only when the user clicks "Scan this page" — never automatically.
// Heuristic matching: looks for links/buttons whose text matches cancel-related
// patterns. Results are suggestions, not guarantees.

(() => {
  'use strict';

  // (text pattern, confidence) — higher = more likely to be the real cancel link
  const PATTERNS = [
    [/\bcancel\s+(my\s+)?(subscription|membership|plan|account|trial|service)\b/i, 100],
    [/\bcancel\b/i, 80],
    [/\b(unsubscribe|turn\s+off\s+auto[\s-]?renew|disable\s+auto[\s-]?renew)\b/i, 90],
    [/\bend\s+(my\s+)?(subscription|membership|trial)\b/i, 90],
    [/\b(manage|my)\s+(subscription|membership|plan|billing)\b/i, 60],
    [/\bbilling\s+(settings|portal|details)\b/i, 55],
    [/\b(downgrade|pause)\s+(my\s+)?(subscription|plan|membership)\b/i, 65],
  ];

  const EXCLUDE = /\b(subscribe|sign\s*up|buy|purchase|order|checkout|upgrade|renew\s+now)\b/i;

  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 &&
      getComputedStyle(el).visibility !== 'hidden' &&
      getComputedStyle(el).display !== 'none';
  }

  function scan() {
    const found = [];
    const seen = new Set();
    const els = document.querySelectorAll('a, button, [role="button"]');
    for (const el of els) {
      const text = (el.innerText || el.getAttribute('aria-label') || '').trim();
      if (!text || text.length > 90 || EXCLUDE.test(text)) continue;
      let score = 0;
      for (const [re, pts] of PATTERNS) {
        if (re.test(text)) score = Math.max(score, pts);
      }
      if (score === 0 || !visible(el)) continue;
      const key = text.toLowerCase() + '|' + score;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        text,
        href: el.tagName === 'A' ? (el.href || '') : '',
        score,
      });
    }
    found.sort((a, b) => b.score - a.score);
    return found.slice(0, 12);
  }

  // Entry point: popup sends {type:'SCAN_CANCEL_LINKS'} via scripting message.
  // For executeScript injection we expose a one-shot function instead.
  window.__cancelHelperScan = scan;
})();
