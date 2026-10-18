// Fine-Print Flagger — content script. Read-only text grabber.
// Injected on explicit click only; never modifies the page.
'use strict';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'GRAB_TEXT') {
    let text = '';
    const sel = window.getSelection ? String(window.getSelection()) : '';
    if (sel && sel.trim()) {
      text = sel;
    } else {
      const el = document.activeElement;
      if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /text|search|url|email/i.test(el.type || '')) || el.isContentEditable)) {
        text = el.value !== undefined ? el.value : el.innerText || '';
      }
    }
    sendResponse({ text: (text || '').slice(0, 200000) });
  }
  return true;
});
