// SlowSpeak content script — returns the current page selection on demand.
'use strict';

(() => {
  if (window.__slowSpeakInstalled) return;
  window.__slowSpeakInstalled = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.kind === 'slowspeak-ping') { sendResponse({ alive: true }); return true; }
    if (msg.kind === 'slowspeak-selection') {
      let text = '';
      try { text = window.getSelection().toString(); } catch { text = ''; }
      sendResponse({ text });
      return true;
    }
    return false;
  });
})();
