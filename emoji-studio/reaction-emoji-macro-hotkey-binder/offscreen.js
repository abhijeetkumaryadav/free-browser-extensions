// Offscreen clipboard writer for MacroReact.
// Lives only to call navigator.clipboard.writeText from a document context
// when a chrome.commands hotkey fires. No UI, no keystroke access.
'use strict';
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== 'offscreen-copy') return false;
  navigator.clipboard.writeText(msg.text).then(
    function () { sendResponse({ ok: true }); },
    function () { sendResponse({ ok: false }); }
  );
  return true; // keep the channel open for the async response
});
