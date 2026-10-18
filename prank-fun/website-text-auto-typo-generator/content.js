// TypoStorm content script — runs in the page's isolated world.
// Keeps a Map of original text-node values so restore is exact.
(() => {
  'use strict';

  // Adjacent keys on a QWERTY layout, for believable "fat finger" typos.
  const NEIGHBORS = {
    a: 'qwsz', b: 'vghn', c: 'xdfv', d: 'serfcx', e: 'wsdfr', f: 'dertgv',
    g: 'ftyhbv', h: 'gyujnb', i: 'ujko', j: 'huiknm', k: 'jiolm', l: 'kop',
    m: 'njk', n: 'bhjm', o: 'iklp', p: 'ol', q: 'wa', r: 'edfgt', s: 'awedxz',
    t: 'rfgy', u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu', z: 'asx'
  };

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
    'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP'
  ]);

  let active = false;
  const originals = new Map(); // Text -> original string

  const rand = n => Math.floor(Math.random() * n);
  const pick = s => s[rand(s.length)];

  function matchCase(template, replacement) {
    // Preserve the original letter's casing on the substituted character.
    return template === template.toUpperCase() ? replacement.toUpperCase() : replacement;
  }

  /** Apply one random realistic typo to a word. Returns the word unchanged
   *  when no typo is applicable. */
  function typoWord(word, rnd) {
    if (word.length < 4) return word;
    if (/\d/.test(word)) return word; // leave numbers / alphanumerics alone
    const i = 1 + rand(word.length - 2); // never touch the first letter
    const op = rand(4);
    if (op === 0) {
      // Swap two adjacent letters: "receive" -> "recieve"
      return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    }
    if (op === 1) {
      // Double a letter: "occurred" -> "occurrred"
      return word.slice(0, i) + word[i] + word.slice(i);
    }
    if (op === 2) {
      // Drop a letter: "definitely" -> "definately"-style loss
      return word.slice(0, i) + word.slice(i + 1);
    }
    // Fat-finger: substitute a neighboring QWERTY key, preserving case.
    const lower = word[i].toLowerCase();
    const neighbors = NEIGHBORS[lower];
    if (!neighbors) return word;
    return word.slice(0, i) + matchCase(word[i], pick(neighbors)) + word.slice(i + 1);
  }

  /** Rewrite one text node in place, remembering the original on first touch. */
  function typofyNode(node, wordProb) {
    const original = node.nodeValue;
    // Split into words vs. separators so whitespace/punctuation is untouched.
    const parts = original.split(/(\s+|[^\w']+|\w+)/g);
    let changed = false;
    const out = parts.map(part => {
      if (/^[A-Za-z']{4,}$/.test(part) && Math.random() < wordProb) {
        const t = typoWord(part, Math.random);
        if (t !== part) { changed = true; return t; }
      }
      return part;
    });
    if (changed) {
      if (!originals.has(node)) originals.set(node, original);
      node.nodeValue = out.join('');
    }
  }

  function collectTextNodes() {
    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
          const v = node.nodeValue;
          if (!v || !v.trim() || !/[A-Za-z]/.test(v)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function activate(intensity) {
    // intensity: 1..100 from the slider -> per-word typo probability.
    const wordProb = Math.min(0.75, (intensity / 100) * 0.6);
    active = true;
    for (const node of collectTextNodes()) {
      if (document.contains(node)) typofyNode(node, wordProb);
    }
  }

  function deactivate() {
    active = false;
    for (const [node, original] of originals) {
      try {
        if (document.contains(node)) node.nodeValue = original;
      } catch { /* node detached mid-restore; nothing to do */ }
    }
    originals.clear();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'typo-status') {
      sendResponse({ active, count: originals.size });
    } else if (msg.action === 'typo-on') {
      activate(Math.max(1, Math.min(100, msg.intensity || 25)));
      sendResponse({ active: true, count: originals.size });
    } else if (msg.action === 'typo-off') {
      deactivate();
      sendResponse({ active: false, count: 0 });
    }
    return false; // synchronous responses only
  });
})();
