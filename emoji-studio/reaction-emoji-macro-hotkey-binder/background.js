// MacroReact background service worker.
// Handles chrome.commands hotkeys: copies the slot's emoji via an offscreen
// document (service workers cannot touch the clipboard directly).
// Hotkey-to-copy only: no keystroke listening, no content scripts.
'use strict';

var OFFSCREEN_PATH = 'offscreen.html';
var creating = null;

function setupOffscreen() {
  // Reuse a single offscreen document; guard against concurrent creation.
  if (creating) return creating;
  creating = chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then(function (ctxs) {
    if (ctxs.length > 0) { creating = null; return; }
    return chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['CLIPBOARD'],
      justification: 'Copy the macro emoji to the clipboard when a hotkey is pressed.'
    }).finally(function () { creating = null; });
  }).catch(function () { creating = null; });
  return creating;
}

function notifyPopup(msg) {
  // Best-effort: popup may not be open; failure is fine.
  chrome.runtime.sendMessage(msg).catch(function () { /* popup closed */ });
}

chrome.commands.onCommand.addListener(function (command) {
  var idx = ['macro-1', 'macro-2', 'macro-3', 'macro-4', 'macro-5'].indexOf(command);
  if (idx === -1) return;
  chrome.storage.local.get({ macros: ['👍', '❤️', '🔥', '🎉', '✅'] }, function (res) {
    var emoji = (res.macros && res.macros[idx]) || '👍';
    setupOffscreen().then(function () {
      return chrome.runtime.sendMessage({ type: 'offscreen-copy', text: emoji });
    }).then(function (reply) {
      var ok = !!(reply && reply.ok);
      notifyPopup({ type: 'macro-fired', emoji: emoji, ok: ok });
      // Brief badge confirmation on the toolbar icon.
      chrome.action.setBadgeText({ text: ok ? '✓' : '!' });
      chrome.action.setBadgeBackgroundColor({ color: ok ? '#3b82f6' : '#ef4444' });
      setTimeout(function () { chrome.action.setBadgeText({ text: '' }); }, 1200);
    }).catch(function () {
      notifyPopup({ type: 'macro-fired', emoji: emoji, ok: false });
    });
  });
});
