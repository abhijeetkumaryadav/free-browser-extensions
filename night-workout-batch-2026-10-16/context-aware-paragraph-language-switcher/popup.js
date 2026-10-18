// Script Labeler — popup logic.
// Injects content.js (click-only) and relays "label"/"clear" messages.
// Honest scope: script-family guess by Unicode ranges. Not language detection,
// not translation. Page text is never modified — only removable badge elements.

const $ = id => document.getElementById(id);

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isInjectable(tab) {
  return tab && tab.url && /^https?:\/\//.test(tab.url);
}

// Inject content script (boot-once guarded) via file-based injection.
async function ensureInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

$('label').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!isInjectable(tab)) {
    $('stats').hidden = false;
    $('stats').textContent = 'This page cannot be labeled (internal or non-web page).';
    return;
  }
  try {
    await ensureInjected(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'label' });
    $('stats').hidden = false;
    if (res && res.ok) {
      const parts = Object.entries(res.counts || {})
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${v}`);
      $('stats').textContent = `Labeled ${res.total} paragraphs. ` + (parts.join(' · ') || 'No text found.');
      $('clear').disabled = false;
      chrome.storage.local.set({ lastResult: res });
    } else {
      $('stats').textContent = 'Labeling failed on this page.';
    }
  } catch (e) {
    $('stats').hidden = false;
    $('stats').textContent = 'Could not label this page.';
  }
});

$('clear').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!isInjectable(tab)) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'clear' });
  } catch (e) { /* content script may not be loaded — nothing to clear */ }
  $('stats').hidden = true;
  $('clear').disabled = true;
});

// Restore last-result summary when the popup reopens.
chrome.storage.local.get('lastResult', ({ lastResult }) => {
  if (lastResult && lastResult.total > 0) {
    $('stats').hidden = false;
    $('stats').textContent = `Last run labeled ${lastResult.total} paragraphs. Click “Label paragraphs” to re-run.`;
    $('clear').disabled = false;
  }
});
