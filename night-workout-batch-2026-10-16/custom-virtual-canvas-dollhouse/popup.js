// Canvas Dollhouse — popup actions.
document.getElementById('open').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('house.html') });
});

document.getElementById('reset').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.dataset.armed) {
    await chrome.storage.local.remove('dollhouse');
    btn.textContent = 'All rooms reset';
    btn.dataset.armed = '';
    setTimeout(() => { btn.textContent = 'Reset all rooms'; }, 1500);
  } else {
    btn.dataset.armed = '1';
    btn.textContent = 'Click again to confirm reset';
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Reset all rooms'; }, 3000);
  }
});
