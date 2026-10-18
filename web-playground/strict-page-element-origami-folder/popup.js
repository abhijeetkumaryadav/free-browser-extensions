/* OrigamiFold popup — injects fold.js on explicit user click only. */
'use strict';

const $ = (id) => document.getElementById(id);
const status = $('status');

function setStatus(text, ok) {
  status.textContent = text;
  status.classList.toggle('ok', !!ok);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Ensure fold.js is present in the page, then call fnName in the page.
async function runOnPage(fnName) {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error('No active tab.');
  if (!/^https?:|^file:/.test(tab.url || '')) {
    throw new Error('Only works on regular web pages (not chrome:// pages).');
  }
  // Inject into the MAIN world so the fold functions live alongside
  // the follow-up call below (isolated-world window is a separate realm).
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    files: ['fold.js'],
  });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: (name) => (typeof window[name] === 'function' ? window[name]() : null),
    args: [fnName],
  });
  return result;
}

$('fold').addEventListener('click', async () => {
  setStatus('Folding…');
  try {
    const n = await runOnPage('__origamiFold');
    setStatus(n ? `Folded ${n} element${n === 1 ? '' : 's'}. Click “Unfold everything” (or the chip on the page) to restore.` : 'Nothing to fold on this page.', true);
  } catch (e) {
    setStatus(e.message || 'Could not fold this page.');
  }
});

$('unfold').addEventListener('click', async () => {
  setStatus('Unfolding…');
  try {
    await runOnPage('__origamiUnfold');
    setStatus('Page restored — not a single pixel harmed.', true);
  } catch (e) {
    setStatus(e.message || 'Could not unfold this page.');
  }
});
