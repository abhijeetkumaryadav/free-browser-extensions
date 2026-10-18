// Background worker: click on the toolbar button toggles the grid overlay.
// Guard internal pages where scripting is not allowed.
chrome.action.onClicked.addListener(function (tab) {
  if (!tab || !tab.id || !/^https?:|^file:|^ftp:/.test(tab.url || '')) {
    return;
  }
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).then(function (results) {
    var state = (results && results[0] && results[0].result && results[0].result.toggled) || 'on';
    chrome.storage.local.set({ overlayState: state }).catch(function () {});
  }).catch(function () {});
});
