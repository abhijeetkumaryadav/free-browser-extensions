/* Floating Ping Pong Arcade — popup logic.
   Reads/saves settings + stats from chrome.storage.local,
   and toggles the floating game panel on the active tab. */

const DEFAULTS = { difficulty: 'medium', pointsToWin: 5, best: 0, wins: 0 };

// Load settings and stats into the popup UI.
chrome.storage.local.get(DEFAULTS, (s) => {
  document.querySelectorAll('#difficultySeg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.diff === s.difficulty);
  });
  document.querySelectorAll('#pointsSeg button').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.points) === s.pointsToWin);
  });
  document.getElementById('bestScore').textContent = s.best;
  document.getElementById('wins').textContent = s.wins;
});

// Segmented-control behaviour (single-select within a group).
document.querySelectorAll('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    seg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const patch = {};
    if (seg.id === 'difficultySeg') patch.difficulty = btn.dataset.diff;
    else patch.pointsToWin = Number(btn.dataset.points);
    chrome.storage.local.set(patch);
  });
});

// Toggle the floating game panel on the active tab (user-triggered only).
document.getElementById('toggleBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    console.error('Could not inject the game panel:', err);
  }
  window.close();
});
