/* Word Killer — popup logic.
 * On explicit click: injects content.js into the active tab, then sends
 * WK_START. Guards browser-internal pages. Persists difficulty + best score. */

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  const st = await chrome.storage.local.get({ wkHigh: 0, wkDifficulty: 'normal' });
  $('high').textContent = st.wkHigh;
  $('diff').value = st.wkDifficulty;
  $('diff').addEventListener('change', () =>
    chrome.storage.local.set({ wkDifficulty: $('diff').value }));
  $('start').addEventListener('click', startGame);
});

async function startGame() {
  const msg = $('msg');
  msg.textContent = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab found.');
    if (/^(chrome|chrome-extension|devtools|edge|about):/.test(tab.url || '')) {
      msg.textContent = 'Cannot run on browser internal pages.';
      return;
    }
    await chrome.storage.local.set({ wkDifficulty: $('diff').value });
    // Inject the game (boot-once guard lives inside content.js).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await chrome.tabs.sendMessage(tab.id, {
      type: 'WK_START',
      difficulty: $('diff').value
    });
    window.close();
  } catch (e) {
    msg.textContent = 'Could not start: ' + (e.message || e);
  }
}
