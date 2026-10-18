/* CrackScreen popup logic.
 * Saves prank settings, then injects the crack overlay content script
 * into the active tab. The overlay itself is fully reversible. */

const $ = (id) => document.getElementById(id);
const DEFAULTS = { sound: true, density: 'medium' };

// Restore saved settings into the UI.
chrome.storage.local.get(DEFAULTS, (s) => {
  $('soundToggle').checked = s.sound === true;
  document.querySelectorAll('#densitySeg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.val === s.density);
  });
});

// Segmented density control.
document.querySelectorAll('#densitySeg button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#densitySeg button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
  });
});

// Fire the prank.
$('shatterBtn').addEventListener('click', async () => {
  const density = document.querySelector('#densitySeg button.active')?.dataset.val || 'medium';
  const sound = $('soundToggle').checked;
  await chrome.storage.local.set({ sound, density });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Inject the overlay script; it reads settings from storage and toggles itself.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
  window.close();
});
