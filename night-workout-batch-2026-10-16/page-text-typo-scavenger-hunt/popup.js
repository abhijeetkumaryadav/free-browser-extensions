// Popup controller: reads best score, starts/stops the hunt on the active tab.
async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function refreshBest() {
  chrome.storage.local.get({ thBest: 0 }, (r) => {
    document.getElementById('best').textContent = r.thBest;
  });
}

document.getElementById('start').addEventListener('click', async () => {
  const tab = await getTab();
  if (!tab || !tab.id || /^chrome:/.test(tab.url || '')) return;
  const seconds = parseInt(document.getElementById('seconds').value, 10) || 120;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (s) => { window.__typoHuntOptions = { seconds: s }; },
    args: [seconds],
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
    func: () => { if (window.__typoHunt) window.__typoHunt.stop(); },
    world: 'MAIN'
  });
  window.close();
});

refreshBest();
