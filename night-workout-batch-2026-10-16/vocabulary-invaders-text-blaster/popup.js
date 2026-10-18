// Popup controller: reads best score, starts/stops the game on the active tab.
const DIFF = { easy: 'easy', normal: 'normal', hard: 'hard' };

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function refreshBest() {
  chrome.storage.local.get({ viBest: 0 }, (r) => {
    document.getElementById('best').textContent = r.viBest;
  });
}

document.getElementById('start').addEventListener('click', async () => {
  const tab = await getTab();
  if (!tab || !tab.id || /^chrome:/.test(tab.url || '')) return;
  const difficulty = document.getElementById('difficulty').value;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (diff) => { window.__vocabOptions = { difficulty: diff }; },
    args: [DIFF[difficulty] || 'normal'],
    world: 'MAIN'
  });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  window.close();
});

document.getElementById('stop').addEventListener('click', async () => {
  const tab = await getTab();
  if (!tab || !tab.id || /^chrome:/.test(tab.url || '')) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { if (window.__vocabInvaders) window.__vocabInvaders.stop(); },
    world: 'MAIN'
  });
  window.close();
});

refreshBest();
