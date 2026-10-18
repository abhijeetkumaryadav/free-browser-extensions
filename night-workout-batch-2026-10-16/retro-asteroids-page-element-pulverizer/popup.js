'use strict';
/* Popup: starts/stops the asteroids overlay; shows best score & games played.
 * The game itself lives in content.js and draws on a removable canvas.
 * Nothing on the page is ever modified. */

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const bestEl = document.getElementById('best');
const gamesEl = document.getElementById('games');

async function refreshStats() {
  const { stats } = await chrome.storage.local.get({ stats: { best: 0, games: 0 } });
  bestEl.textContent = stats.best;
  gamesEl.textContent = stats.games;
}

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

startBtn.addEventListener('click', async () => {
  const t = await activeTab();
  if (!t || !t.id || !/^https?:/.test(t.url || '')) {
    bestEl.textContent = '—';
    gamesEl.textContent = '—';
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['content.js'] });
  await chrome.tabs.sendMessage(t.id, { type: 'ASTEROIDS_START' }).catch(() => {});
  window.close();
});

stopBtn.addEventListener('click', async () => {
  const t = await activeTab();
  if (t && t.id) await chrome.tabs.sendMessage(t.id, { type: 'ASTEROIDS_STOP' }).catch(() => {});
  window.close();
});

refreshStats();
