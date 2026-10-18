/* ChromaMark content script.
 * Handles selection capture, DOM wrapping, persistence restore, and
 * popup messages. Highlights are <mark> elements with a data attribute.
 * Restore is text-based: exact snippet re-found in text nodes on load.
 */
'use strict';

const HL_ATTR = 'data-chromamark-id';
const COLORS = {
  yellow: 'rgba(234, 179, 8, 0.45)',
  green:  'rgba(34, 197, 94, 0.45)',
  blue:   'rgba(59, 130, 246, 0.45)',
  pink:   'rgba(236, 72, 153, 0.45)',
  orange: 'rgba(249, 115, 22, 0.45)'
};

// -- storage helpers (keyed by normalized page URL) -------------------------
function pageKey() {
  const u = new URL(location.href);
  u.hash = ''; // ignore fragment so anchors don't split storage
  return 'cm:' + u.toString();
}

async function loadAll() {
  const data = await chrome.storage.local.get([pageKey()]);
  return data[pageKey()] || [];
}

async function saveAll(list) {
  await chrome.storage.local.set({ [pageKey()]: list });
}

function makeId() {
  return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// -- DOM wrapping ------------------------------------------------------------
/** Wrap a DOM Range in a <mark>. Splits across text nodes safely. */
function wrapRange(range, id, color) {
  const mark = document.createElement('mark');
  mark.setAttribute(HL_ATTR, id);
  mark.style.backgroundColor = COLORS[color] || COLORS.yellow;
  mark.style.color = 'inherit';
  try {
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  } catch (e) {
    // range crossed element boundaries in a way we can't cleanly wrap
    return null;
  }
  return mark;
}

/** Highlight the current user selection; returns the highlight record. */
async function highlightSelection(color) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0).cloneRange();
  const text = sel.toString().trim();
  if (!text) return null;

  const id = makeId();
  const mark = wrapRange(range, id, color);
  if (!mark) return null;
  sel.removeAllRanges();

  const list = await loadAll();
  list.push({ id, text, color, createdAt: Date.now() });
  await saveAll(list);
  return { id, text, color };
}

/** Re-apply saved highlights by searching text nodes for exact snippets. */
async function restore() {
  const list = await loadAll();
  if (!list.length) return;

  // Collect all text nodes once for efficiency.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (n.parentElement && n.parentElement.closest('mark[' + HL_ATTR + ']')) {
        return NodeFilter.FILTER_REJECT; // already highlighted
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  for (const rec of list) {
    for (const node of nodes) {
      if (node.parentElement && node.parentElement.closest('mark[' + HL_ATTR + ']')) continue;
      const idx = node.nodeValue.indexOf(rec.text);
      if (idx === -1) continue;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + rec.text.length);
      const mark = wrapRange(range, rec.id, rec.color);
      if (mark) break; // highlight each record once
    }
  }
}

/** Remove a highlight by id (unwraps the mark, keeps the text). */
function removeHighlight(id) {
  const mark = document.querySelector('mark[' + HL_ATTR + '="' + CSS.escape(id) + '"]');
  if (!mark) return false;
  const parent = mark.parentNode;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  parent.normalize();
  return true;
}

/** Remove every ChromaMark highlight on the page. */
function clearAll() {
  document.querySelectorAll('mark[' + HL_ATTR + ']').forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

// -- messages from popup / background ----------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'CM_HIGHLIGHT_SELECTION': {
        const rec = await highlightSelection(msg.color || 'yellow');
        sendResponse({ ok: !!rec, record: rec });
        break;
      }
      case 'CM_LIST': {
        const list = await loadAll();
        sendResponse({ ok: true, list });
        break;
      }
      case 'CM_JUMP': {
        const mark = document.querySelector('mark[' + HL_ATTR + '="' + CSS.escape(msg.id) + '"]');
        if (mark) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mark.style.outline = '2px solid #eab308';
          setTimeout(() => (mark.style.outline = ''), 1200);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false });
        }
        break;
      }
      case 'CM_DELETE': {
        removeHighlight(msg.id);
        const list = (await loadAll()).filter(r => r.id !== msg.id);
        await saveAll(list);
        sendResponse({ ok: true });
        break;
      }
      case 'CM_CLEAR': {
        clearAll();
        await saveAll([]);
        sendResponse({ ok: true });
        break;
      }
      case 'CM_GET_SELECTION': {
        const sel = window.getSelection();
        sendResponse({ has: !!(sel && !sel.isCollapsed && sel.toString().trim()) });
        break;
      }
    }
  })();
  return true; // async response
});

// Restore saved highlights after the page settles.
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(restore, 300);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(restore, 300));
}
