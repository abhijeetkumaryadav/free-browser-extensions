/* Tab vs Tab Fighter — popup logic.
   Lets the user pick a side (Player 1 or Player 2) and join the arena
   on the active tab. Roles and scores live in chrome.storage.local,
   which is how the two tabs sync (same browser only, no network). */

// Remember the chosen role between popup opens.
chrome.storage.local.get({ role: 'p1' }, (s) => {
  document.querySelectorAll('#roleSeg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.role === s.role);
  });
});

document.getElementById('roleSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#roleSeg button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  chrome.storage.local.set({ role: btn.dataset.role });
});

// Join the arena on this tab (user-triggered, explicit click only).
document.getElementById('joinBtn').addEventListener('click', async () => {
  const role = document.querySelector('#roleSeg button.active').dataset.role;
  await chrome.storage.local.set({ role });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    console.error('Could not open the arena:', err);
  }
  window.close();
});

// Reset wins/rounds for both players.
document.getElementById('resetBtn').addEventListener('click', () => {
  chrome.storage.local.get({ fighterArena: null }, (s) => {
    const a = s.fighterArena || {};
    a.p1 = { ...(a.p1 || {}), wins: 0 };
    a.p2 = { ...(a.p2 || {}), wins: 0 };
    a.roundOver = false;
    chrome.storage.local.set({ fighterArena: a });
  });
});
