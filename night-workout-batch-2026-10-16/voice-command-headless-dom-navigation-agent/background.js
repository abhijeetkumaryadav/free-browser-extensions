// ─── Background service worker ───────────────────────────────────────────────
// The background worker is the action router: the popup (or content script)
// sends { type: 'exec-command', action } messages and the worker performs the
// corresponding tab/navigation action. Keeping execution here means a single
// trusted place mutates tab state.

/** Action name → handler. Handlers receive the tab id they should act on. */
const ACTIONS = {
  /** Scroll the tab down by ~80% of the viewport height. */
  'scroll-down': (tabId) => injectScroll(tabId, 0.8),
  /** Scroll the tab up by ~80% of the viewport height. */
  'scroll-up': (tabId) => injectScroll(tabId, -0.8),
  /** Go back in tab history. */
  'go-back': (tabId) => chrome.tabs.goBack(tabId),
  /** Go forward in tab history. */
  'go-forward': (tabId) => chrome.tabs.goForward(tabId),
  /** Reload the tab. */
  'reload': (tabId) => chrome.tabs.reload(tabId),
  /** Close the active tab. */
  'close-tab': (tabId) => chrome.tabs.remove(tabId),
  /** Scroll to the top of the page. */
  'top': (tabId) => injectEval(tabId, 'window.scrollTo({top:0,behavior:"smooth"})'),
  /** Scroll to the bottom of the page. */
  'bottom': (tabId) => injectEval(tabId, 'window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"})'),
};

/**
 * Inject a smooth scroll of `factor` × viewport height into a tab.
 * @param {number} tabId
 * @param {number} factor Signed multiple of innerHeight.
 */
async function injectScroll(tabId, factor) {
  await injectEval(tabId, `window.scrollBy({top: window.innerHeight * ${factor}, behavior: 'smooth'})`);
}

/**
 * Run a tiny script string in the page (MAIN world is unnecessary — isolated
 * world can still scroll and click; DOM reads happen in the content script).
 * @param {number} tabId
 * @param {string} code
 */
async function injectEval(tabId, code) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: (c) => { eval(c); }, args: [code] });
  } catch (err) {
    console.warn('[voice-nav] injection failed:', err?.message);
  }
}

// ─── Click-by-text: find and click the best text match in the page ───────────
/**
 * Attempt to click the visible clickable element whose text best matches.
 * @param {number} tabId
 * @param {string} phrase Spoken phrase after stripping the "click" prefix.
 * @returns {Promise<{matched: boolean, label: string}>}
 */
async function clickByText(tabId, phrase) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (needle) => {
        const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const want = norm(needle);
        if (!want) return { matched: false, label: '' };
        const els = [...document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]')];
        let best = null, bestScore = 0;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue; // invisible
          const text = norm(el.innerText || el.value || el.getAttribute('aria-label') || '');
          if (!text) continue;
          let score = 0;
          if (text === want) score = 3;
          else if (text.startsWith(want)) score = 2;
          else if (text.includes(want)) score = 1;
          if (score > bestScore) { bestScore = score; best = el; }
        }
        if (best) {
          best.scrollIntoView({ block: 'center' });
          best.click();
          return { matched: true, label: (best.innerText || best.value || '').trim().slice(0, 60) };
        }
        return { matched: false, label: '' };
      },
      args: [phrase],
    });
    return res?.result || { matched: false, label: '' };
  } catch (err) {
    return { matched: false, label: '' };
  }
}

// ─── Message router ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type !== 'exec-command') { sendResponse({ ok: false }); return; }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { sendResponse({ ok: false, error: 'no-active-tab' }); return; }

    if (msg.action === 'click-text') {
      const r = await clickByText(tab.id, msg.phrase || '');
      sendResponse({ ok: true, matched: r.matched, label: r.label });
      return;
    }
    const handler = ACTIONS[msg.action];
    if (!handler) { sendResponse({ ok: false, error: 'unknown-action' }); return; }
    try { await handler(tab.id); sendResponse({ ok: true }); }
    catch (err) { sendResponse({ ok: false, error: String(err?.message || err) }); }
  })();
  return true; // async response
});
