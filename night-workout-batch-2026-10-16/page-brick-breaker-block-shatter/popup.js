/* Popup logic: load scores, start the game on the active tab via scripting. */
const startBtn = document.getElementById('startBtn');
const difficultySel = document.getElementById('difficulty');

// Restore saved scores + difficulty.
chrome.storage.local.get({ highScore: 0, lastScore: 0, difficulty: 'normal' }, (d) => {
  document.getElementById('highScore').textContent = d.highScore;
  document.getElementById('lastScore').textContent = d.lastScore;
  difficultySel.value = d.difficulty;
});

difficultySel.addEventListener('change', () => {
  chrome.storage.local.set({ difficulty: difficultySel.value });
});

// Ask the content script (injected on click) to start the game.
startBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const speed = { chill: 3.4, normal: 4.6, spicy: 6 }[difficultySel.value] ?? 4.6;
  await chrome.tabs.sendMessage(tab.id, { type: 'BRICK_START', ballSpeed: speed }).catch(() => {});
  window.close();
});
