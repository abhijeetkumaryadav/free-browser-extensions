/* ReadGauge background service worker.
 * Text extraction runs on-demand via chrome.scripting; no persistent listeners
 * beyond the context menu. 100% local, zero network. */

/* Runs IN the page context: extracts readable text. Must be self-contained. */
function extractPageText() {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.innerText || '' : '';
  };
  // Prefer article/main content; fall back to body minus scripts/nav clutter.
  let text = pick('article') || pick('main') || pick('[role="main"]');
  if (text.trim().length < 200) {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,nav,header,footer,aside,form').forEach((n) => n.remove());
    text = clone.innerText || '';
  }
  return text.replace(/\s+/g, ' ').trim();
}

/* Heuristic analysis shared by background and popup (duplicated there for reuse). */
function analyzeText(raw) {
  const words = raw.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = Math.max(1, (raw.match(/[^.!?…]+[.!?…]+["')\]]?\s*/g) || []).length);
  let syllables = 0;
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) continue;
    if (clean.length <= 3) { syllables += 1; continue; }
    const groups = clean.replace(/e$/, '').match(/[aeiouy]+/g);
    syllables += Math.max(1, (groups || []).length);
  }
  const avgSentence = wordCount / sentences;
  const avgSyllables = wordCount ? syllables / wordCount : 0;
  // Flesch Reading Ease (heuristic): 206.835 - 1.015*ASL - 84.6*ASW
  const ease = Math.max(0, Math.min(100, 206.835 - 1.015 * avgSentence - 84.6 * avgSyllables));
  const wpm = 225; // typical adult reading speed
  const minutes = wordCount / wpm;
  return { wordCount, sentences, avgSentence, avgSyllables, ease, minutes };
}

/* Analyze the active tab's main text. */
async function analyzeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || /^chrome:\/\//.test(tab.url || '')) {
    return { error: 'Cannot analyze this page (browser internal page).' };
  }
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageText,
  });
  if (!result || result.length < 40) {
    return { error: 'Not enough readable text found on this page.' };
  }
  return { ...analyzeText(result), source: 'page' };
}

/* Message bridge so popup can request analysis. */
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === 'analyze-page') {
    analyzeTab().then(respond).catch((e) => respond({ error: String(e.message || e) }));
    return true;
  }
});

/* Context menu: analyze selected text. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'readgauge-selection',
    title: 'Analyze reading time of selection',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'readgauge-selection' || !info.selectionText) return;
  const result = { ...analyzeText(info.selectionText), source: 'selection' };
  await chrome.storage.local.set({ 'readgauge.last': { ...result, at: new Date().toISOString() } });
  chrome.action.openPopup().catch(() => {});
});
