// Download Queue — service worker.
// Bridges the popup and chrome.downloads. Keeps top-level download-event
// listeners so download changes wake the worker and persist into storage.

const STORE_KEY = 'queueItems';

// Mark the matching queue item when a chrome.downloads change arrives.
chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta || typeof delta.id !== 'number') return;
  const { [STORE_KEY]: items = [] } = await chrome.storage.local.get(STORE_KEY);
  const item = items.find((i) => i.downloadId === delta.id);
  if (!item) return;

  let changed = false;
  if (delta.state && delta.state.current) {
    if (delta.state.current === 'complete') {
      item.state = 'complete';
      item.progress = 100;
      item.doneAt = Date.now();
    } else if (delta.state.current === 'interrupted') {
      item.state = 'error';
      item.error = 'download interrupted';
    }
    changed = true;
  }
  if (delta.paused && typeof delta.paused.current === 'boolean') {
    item.state = delta.paused.current ? 'paused' : 'downloading';
    changed = true;
  }
  if (changed) await chrome.storage.local.set({ [STORE_KEY]: items });
});

// Messages from the popup: start/pause/resume a download.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'startDownload') {
    chrome.downloads.download({ url: msg.url }, async (downloadId) => {
      const { [STORE_KEY]: items = [] } = await chrome.storage.local.get(STORE_KEY);
      const item = items.find((i) => i.id === msg.id);
      if (!item) { sendResponse({ ok: false, error: 'Item no longer in queue.' }); return; }
      if (chrome.runtime.lastError || typeof downloadId !== 'number') {
        item.state = 'error';
        item.error = (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Download failed to start.';
        await chrome.storage.local.set({ [STORE_KEY]: items });
        sendResponse({ ok: false, error: item.error });
        return;
      }
      item.downloadId = downloadId;
      item.state = 'downloading';
      await chrome.storage.local.set({ [STORE_KEY]: items });
      sendResponse({ ok: true, downloadId });
    });
    return true; // async response
  }
  if (msg && (msg.type === 'pause' || msg.type === 'resume')) {
    const fn = msg.type === 'pause' ? chrome.downloads.pause : chrome.downloads.resume;
    fn(msg.downloadId, () => sendResponse({ ok: !chrome.runtime.lastError }));
    return true;
  }
  return false;
});
