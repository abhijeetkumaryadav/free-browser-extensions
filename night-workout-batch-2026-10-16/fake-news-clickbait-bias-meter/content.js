/* Clickbait & Bias Meter — content script (injected on demand via chrome.scripting).
 * Extracts headlines from the active tab and scores them with local heuristics.
 * 100% local: nothing is read beyond headline text, nothing leaves the device. */

(function () {
  'use strict';

  /* ---------- heuristic signal lists (local, clearly heuristic) ---------- */

  // Sensationalist / clickbait phrasing (case-insensitive whole-phrase match)
  const SENSATIONAL = [
    "you won't believe", "you will not believe", "will shock you", "will blow your mind",
    "blow your mind", "mind blown", "jaw-dropping", "jaw dropping", "unbelievable",
    "incredible", "shocking", "secret", "secrets", "exposed", "revealed", "leaked",
    "they don't want you to know", "what happens next", "number \d+ will", "doctors hate",
    "one weird trick", "this one trick", "gone wrong", "gone viral", "breaking:",
    "must see", "must-see", "watch before", "banned", "censored", "the truth about",
    "nobody is talking about", "everyone is talking about", "changed everything",
    "never seen before", "of all time", "epic fail", "instant regret"
  ];

  // Loaded / emotionally charged words suggesting editorial bias framing
  const LOADED = [
    "disgusting", "outrageous", "scandal", "scandalous", "corrupt", "corruption",
    "liar", "lying", "fake", "stupid", "idiot", "moron", "dumb", "evil", "inhumane",
    "barbaric", "disaster", "catastrophe", "humiliating", "humiliated", "destroyed",
    "slammed", "blasted", "eviscerated", "owned", "wrecked", "panic", "terrifying",
    "horrifying", "miracle", "heroic", "brave", "coward", "shameful", "disgrace",
    "pathetic", "insane", "crazy", "unhinged", "deranged", "toxic", "vile"
  ];

  // Urgency / pressure phrasing
  const URGENCY = [
    "act now", "limited time", "last chance", "don't miss", "do not miss",
    "breaking news", "urgent", "alert:", "just in:", "developing:"
  ];

  /* ---------- helpers ---------- */

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function collectHeadlines() {
    const out = [];
    const seen = new Set();
    // Priority headline selectors
    const selectors = [
      'h1', 'h2',
      'article h3', '[role="heading"]',
      'a[class*="headline"]', '[class*="headline"]',
      '[class*="title"] a', 'h3'
    ];
    const nodes = document.querySelectorAll(selectors.join(','));
    for (const el of nodes) {
      if (!visible(el)) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 12 || text.length > 300) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      out.push({ text, tag: el.tagName.toLowerCase() });
      if (out.length >= 40) break;
    }
    return out;
  }

  function countMatches(text, patterns) {
    // Case-insensitive substring match against the lowered headline text.
    // Digit placeholders ("number \d+ will") are matched loosely.
    const lower = ' ' + text.toLowerCase() + ' ';
    const hits = [];
    for (const p of patterns) {
      const needle = p.toLowerCase().replace('\\d+', '');
      if (needle && lower.includes(needle) && !hits.includes(p)) {
        hits.push(p.replace(/\\d\+/g, '#'));
      }
    }
    return hits;
  }

  function scoreHeadline(text) {
    const signals = [];
    let score = 0;
    const add = (pts, label, detail) => {
      score += pts;
      signals.push({ label, detail, pts });
    };

    // 1. ALL-CAPS ratio
    const letters = text.replace(/[^A-Za-z]/g, '');
    const upper = text.replace(/[^A-Z]/g, '');
    if (letters.length >= 10 && upper.length / letters.length > 0.7) {
      add(22, 'ALL-CAPS shouting', Math.round((upper.length / letters.length) * 100) + '% of letters are uppercase');
    }

    // 2. Excessive punctuation
    const bangs = (text.match(/!/g) || []).length;
    const qs = (text.match(/\?/g) || []).length;
    const dots = (text.match(/\.{3,}/g) || []).length;
    if (bangs >= 2) add(12, 'Excessive exclamation', bangs + ' exclamation marks');
    else if (bangs === 1) add(5, 'Exclamation mark', '1 exclamation mark');
    if (qs >= 2) add(10, 'Question-bait', qs + ' question marks');
    if (dots >= 1) add(6, 'Suspense ellipsis', 'trailing "…" teases withheld info');

    // 3. Sensationalist phrasing
    const sens = countMatches(text, SENSATIONAL);
    if (sens.length) add(Math.min(28, 14 * sens.length), 'Sensationalist phrasing',
      'matched: ' + sens.slice(0, 3).join(', ') + (sens.length > 3 ? ` (+${sens.length - 3} more)` : ''));

    // 4. Loaded / emotionally charged words
    const loaded = countMatches(text, LOADED);
    if (loaded.length) add(Math.min(24, 9 * loaded.length), 'Loaded language',
      'matched: ' + loaded.slice(0, 3).join(', ') + (loaded.length > 3 ? ` (+${loaded.length - 3} more)` : ''));

    // 5. Urgency phrasing
    const urg = countMatches(text, URGENCY);
    if (urg.length) add(Math.min(16, 9 * urg.length), 'Urgency pressure',
      'matched: ' + urg.slice(0, 3).join(', '));

    // 6. Number-bait listicles
    if (/\b\d{1,2}\s+(things|reasons|ways|signs|photos|facts|tips|tricks|secrets|lies|mistakes)\b/i.test(text)) {
      add(10, 'Number-bait listicle', 'numbered-list hook ("N things…")');
    }

    // 7. Second-person curiosity gap
    if (/\b(you|your|yours)\b/i.test(text) && /\b(what|why|how|when|which)\b/i.test(text)) {
      add(6, 'Curiosity gap', '"you" + question word teases withheld info');
    }

    score = Math.min(100, score);
    const level = score >= 55 ? 'high' : score >= 28 ? 'med' : 'low';
    const verdict = score >= 55 ? 'High clickbait/bias signals'
      : score >= 28 ? 'Moderate signals' : 'Low signals';
    return { score, level, verdict, signals };
  }

  /* ---------- main ---------- */

  const headlines = collectHeadlines().map(h => {
    const r = scoreHeadline(h.text);
    return { text: h.text, tag: h.tag, ...r };
  });

  // Sort: highest score first
  headlines.sort((a, b) => b.score - a.score);

  const avg = headlines.length
    ? Math.round(headlines.reduce((s, h) => s + h.score, 0) / headlines.length)
    : 0;

  return { headlines, avg, count: headlines.length, url: location.href };
})();
