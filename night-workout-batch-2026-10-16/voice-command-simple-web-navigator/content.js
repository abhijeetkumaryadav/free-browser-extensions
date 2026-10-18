/* VoiceNav content script — executes page actions requested from the popup.
   Injected on demand via chrome.scripting; reads nothing unless asked. */
'use strict';

if (!window.__voicenavInstalled) {
  window.__voicenavInstalled = true;

  /* Find a clickable element whose visible text contains the query. */
  function findClickable(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const els = document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]');
    let best = null;
    for (const el of els) {
      if (el.disabled || el.offsetParent === null) continue;
      const label = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (!label) continue;
      if (label === q) return { el, label: label.slice(0, 60) }; // exact match wins
      if (!best && label.includes(q)) best = { el, label: label.slice(0, 60) };
    }
    return best;
  }

  /* Extract readable main text (headings + paragraphs, capped). */
  function readableText() {
    const parts = [];
    const nodes = document.querySelectorAll('h1, h2, h3, p, li');
    for (const n of nodes) {
      if (n.offsetParent === null) continue;
      const t = n.innerText.trim().replace(/\s+/g, ' ');
      if (t.length > 20) parts.push(t);
      if (parts.join(' ').length > 1800) break;
    }
    return parts.join('. ');
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      switch (msg.action) {
        case 'scroll':
          window.scrollBy({ top: msg.dy || 600, behavior: 'smooth' });
          sendResponse({ ok: true });
          break;
        case 'scrollTo':
          window.scrollTo({ top: msg.where === 'bottom' ? document.body.scrollHeight : 0, behavior: 'smooth' });
          sendResponse({ ok: true });
          break;
        case 'history':
          window.history.go(msg.dir || -1);
          sendResponse({ ok: true });
          break;
        case 'reload':
          window.location.reload();
          sendResponse({ ok: true });
          break;
        case 'clickText': {
          const hit = findClickable(msg.text || '');
          if (hit) { hit.el.click(); sendResponse({ found: true, label: hit.label }); }
          else sendResponse({ found: false });
          break;
        }
        case 'readText':
          sendResponse({ text: readableText() });
          break;
        default:
          sendResponse({ ok: false });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
    return true;
  });
}
