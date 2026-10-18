'use strict';
/* Furigana Inserter — content script (runs in page context via click-only injection).
 * Wraps matches of the user's pairs in <ruby> tags; removal restores original text.
 * The page DOM is never destructively modified: INSERT only wraps, REMOVE unwraps.
 */

// ==================== ENGINE-START ====================
// Pure, DOM-free matching engine — safe to unit-test headlessly.
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Find non-overlapping matches of pairs in text.
 * Longest kanji first so "日本語" wins over "日本" at the same position.
 * @returns [{start, end, text, reading}]
 */
function findMatches(text, pairs) {
  const clean = (pairs || []).filter((p) => p && p.kanji);
  if (!clean.length || !text) return [];
  const sorted = [...clean].sort((a, b) => b.kanji.length - a.kanji.length);
  const byKanji = new Map();
  for (const p of sorted) if (!byKanji.has(p.kanji)) byKanji.set(p.kanji, p.reading);
  const re = new RegExp([...byKanji.keys()].map(escapeRegExp).join('|'), 'g');
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], reading: byKanji.get(m[0]) });
  }
  return out;
}
// ==================== ENGINE-END ====================

const RUBY_CLASS = 'fg-ruby';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'RUBY', 'RT', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'SELECT', 'OPTION']);

function collectTextNodes() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

function wrapNode(node, pairs) {
  const text = node.nodeValue;
  const matches = findMatches(text, pairs);
  if (!matches.length) return 0;
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, m.start)));
    const ruby = document.createElement('ruby');
    ruby.className = RUBY_CLASS;
    ruby.dataset.orig = m.text;
    ruby.appendChild(document.createTextNode(m.text));
    const rt = document.createElement('rt');
    rt.textContent = m.reading;
    ruby.appendChild(rt);
    frag.appendChild(ruby);
    pos = m.end;
  }
  if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
  node.replaceWith(frag);
  return matches.length;
}

function insertAll(pairs) {
  let total = 0;
  for (const node of collectTextNodes()) total += wrapNode(node, pairs);
  return total;
}

function removeAll() {
  const rubies = document.querySelectorAll('ruby.' + RUBY_CLASS);
  rubies.forEach((r) => r.replaceWith(document.createTextNode(r.dataset.orig || r.textContent)));
  return rubies.length;
}

// Guard against double-injection.
if (!window.__fgInserterReady) {
  window.__fgInserterReady = true;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg && msg.type === 'FG_INSERT') {
        sendResponse({ ok: true, count: insertAll(msg.pairs || []) });
      } else if (msg && msg.type === 'FG_REMOVE') {
        sendResponse({ ok: true, count: removeAll() });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return true;
  });
}
