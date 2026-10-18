// Background service worker: mints a tabCapture stream id for the ACTIVE tab.
// The popup then opens the stream with getUserMedia. Nothing runs until the
// user clicks "Start recording" — no passive listening, no background capture.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'GET_TAB_STREAM_ID') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || tab.id === undefined) {
          sendResponse({ ok: false, error: 'No active tab found.' });
          return;
        }
        // Fails with an error when the tab is not currently playing audio.
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
        sendResponse({ ok: true, streamId, tabTitle: tab.title || 'Tab' });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true; // keep the message channel open for the async response
  }
});
