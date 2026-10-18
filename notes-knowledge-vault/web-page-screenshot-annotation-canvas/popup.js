// SnapMark popup — captures the visible tab and hands the PNG data URL to
// the full-page annotation editor via chrome.storage.session (cleared right
// after the editor picks it up). User-initiated only; nothing is uploaded.

const captureBtn = document.getElementById('captureBtn');
const toastEl = document.getElementById('toast');

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  try {
    // activeTab (granted by the popup click) allows captureVisibleTab.
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    if (!dataUrl) throw new Error('empty capture');

    // Stash for the editor tab; session storage is cleared when the
    // browser closes, so no screenshot lingers in persistent storage.
    await chrome.storage.session.set({
      snapmarkShot: {
        dataUrl,
        capturedAt: new Date().toISOString()
      }
    });

    await chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    window.close();
  } catch (err) {
    console.error('[SnapMark] capture failed:', err);
    toast('Capture failed on this page (e.g. chrome:// pages)');
    captureBtn.disabled = false;
  }
});
