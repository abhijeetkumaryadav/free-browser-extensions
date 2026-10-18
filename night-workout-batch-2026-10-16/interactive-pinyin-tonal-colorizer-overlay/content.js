/* injected on click only; no code runs until the user presses a button */
// ENGINE-START
/** Escape RegExp special chars. */
function tcEscapeRe(s) { return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Color for a tone number (1-4, 5=neutral/other). */
function tcColor(tone) {
  switch (tone) {
    case 1: return '#f87171'; // red
    case 2: return '#fb923c'; // orange
    case 3: return '#34d399'; // green
    case 4: return '#60a5fa'; // blue
    default: return '#9ca3af'; // gray (5th/neutral/unknown)
  }
}

/** Extract tone number (1-5) from a pinyin string like "ni3 hao4" -> 3 for the first syllable.
 *  Uses the last digit found in the pair's pinyin; defaults to 5. */
function tcTone(pinyin) {
  const m = (pinyin || '').match(/([1-5])/);
  return m ? parseInt(m[1], 10) : 5;
}

/** Build matches for pairs inside a text string (longest hanzi first). */
function tcFindMatches(text, pairs) {
  const sorted = pairs.slice().sort((a, b) => b.hanzi.length - a.hanzi.length);
  const hits = [];
  sorted.forEach(p => {
    if (!p.hanzi) return;
    const re = new RegExp(tcEscapeRe(p.hanzi), 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ idx: m.index, len: p.hanzi.length, pinyin: p.pinyin, tone: tcTone(p.pinyin) });
    }
  });
  // Remove overlaps: keep the earliest-longest hit at each position.
  hits.sort((a, b) => a.idx - b.idx || b.len - a.len);
  const kept = [];
  let end = -1;
  for (const h of hits) { if (h.idx >= end) { kept.push(h); end = h.idx + h.len; } }
  return kept;
}
// ENGINE-END

// Skip elements we must never touch.
const TC_SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'RUBY', 'SELECT', 'CODE', 'PRE']);

function tcInject(pairs) {
  tcRemove(); // idempotent: clear previous pass
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (!node.parentNode || TC_SKIP.has(node.parentNode.nodeName)) return;
    const text = node.nodeValue;
    const hits = tcFindMatches(text, pairs);
    if (!hits.length) return;
    const frag = document.createDocumentFragment();
    let cur = 0;
    hits.forEach(h => {
      if (h.idx > cur) frag.appendChild(document.createTextNode(text.slice(cur, h.idx)));
      const span = document.createElement('span');
      span.className = 'tc-tone';
      span.dataset.tc = '1';
      span.title = h.pinyin;
      span.textContent = text.slice(h.idx, h.idx + h.len);
      span.style.cssText = `color:${tcColor(h.tone)}!important;font-weight:600;border-bottom:2px solid ${tcColor(h.tone)};cursor:help;`;
      frag.appendChild(span);
      cur = h.idx + h.len;
    });
    if (cur < text.length) frag.appendChild(document.createTextNode(text.slice(cur)));
    node.parentNode.replaceChild(frag, node);
  });
}

function tcRemove() {
  document.querySelectorAll('span[data-tc="1"]').forEach(sp => {
    sp.parentNode.replaceChild(document.createTextNode(sp.textContent), sp);
  });
}

// Auto-run on injection: read pairs from storage and colorize.
(async () => {
  try {
    const r = await chrome.storage.local.get({ tcPairs: [] });
    if (r.tcPairs && r.tcPairs.length) tcInject(r.tcPairs);
  } catch (e) { /* storage unavailable */ }
})();
