// Script Labeler — content script (file-based, message-driven).
// Boot-once guard: repeated clicks never stack badges or listeners.
// Only ADDS removable badge <span> elements; page text is never modified.

// Unicode-range based script families, in priority order (most specific first).
const SCRIPT_RANGES = [
  { name: 'Arabic',     test: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/ },
  { name: 'Devanagari', test: /[\u0900-\u097F]/ },
  { name: 'CJK',        test: /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/ },
  { name: 'Thai',       test: /[\u0E00-\u0E7F]/ },
  { name: 'Hebrew',     test: /[\u0590-\u05FF]/ },
  { name: 'Greek',      test: /[\u0370-\u03FF\u1F00-\u1FFF]/ },
  { name: 'Cyrillic',   test: /[\u0400-\u04FF\u0500-\u052F]/ },
  { name: 'Latin',      test: /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/ },
];

// Majority-vote guess over the paragraph's letters.
function guessScript(text) {
  const counts = {};
  let total = 0;
  for (const ch of text) {
    for (const s of SCRIPT_RANGES) {
      if (s.test.test(ch)) { counts[s.name] = (counts[s.name] || 0) + 1; total++; break; }
    }
  }
  if (total < 8) return null; // too little text to guess
  let best = null, bestN = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestN) { bestN = v; best = k; }
  }
  return bestN / total >= 0.4 ? best : null;
}

const BADGE_ATTR = 'data-script-labeler';

function clearLabels() {
  document.querySelectorAll(`[${BADGE_ATTR}]`).forEach(el => el.remove());
}

function labelParagraphs() {
  clearLabels();
  const counts = {};
  let total = 0;
  const paras = document.querySelectorAll('p, li, h1, h2, h3, h4, blockquote, td');
  paras.forEach(p => {
    const text = (p.innerText || '').trim();
    if (text.length < 12) return;
    // Skip nested matches: only label elements without labeled descendants
    if (p.querySelector(`[${BADGE_ATTR}]`)) return;
    const script = guessScript(text);
    if (!script) return;
    const badge = document.createElement('span');
    badge.setAttribute(BADGE_ATTR, '1');
    badge.textContent = script;
    badge.title = 'Guessed writing script (heuristic — may be wrong)';
    badge.style.cssText =
      'display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;' +
      'background:rgba(45,212,191,.14);border:1px solid rgba(45,212,191,.45);' +
      'color:#2dd4bf;font-size:10px;line-height:1.6;vertical-align:middle;' +
      'font-family:system-ui,sans-serif;cursor:default;';
    // Insert after the paragraph's last text without touching the text itself
    p.appendChild(badge);
    counts[script] = (counts[script] || 0) + 1;
    total++;
  });
  return { ok: true, total, counts };
}

// Boot-once guard
if (!window.__scriptLabelerLoaded) {
  window.__scriptLabelerLoaded = true;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'label') sendResponse(labelParagraphs());
    else if (msg.action === 'clear') { clearLabels(); sendResponse({ ok: true }); }
    return true;
  });
}
