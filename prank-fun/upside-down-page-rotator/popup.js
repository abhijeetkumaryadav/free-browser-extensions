/* FlipPage popup logic.
 * The flip state lives in the tab (window.__flipPageActive, set by
 * content.js in the same isolated world). This popup injects content.js
 * to toggle, and queries the state to keep the UI honest. */

const $ = (id) => document.getElementById(id);

// Self-contained state probe — runs in the tab's isolated world,
// the same world where content.js sets window.__flipPageActive.
const probeFlipped = () => !!window.__flipPageActive;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function refreshStatus() {
  const tab = await activeTab();
  let flipped = false;
  if (tab?.id) {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: probeFlipped
      });
      flipped = res?.[0]?.result === true;
    } catch (e) {
      // Restricted pages (chrome://, Web Store) — leave default state.
    }
  }
  $('statusText').textContent = flipped
    ? 'Page is currently upside-down 🙃'
    : 'Page is right-side up';
  $('flipLabel').textContent = flipped ? 'Restore page' : 'Flip page 180°';
  $('statusLine').classList.toggle('flipped', flipped);
}

// Restore the shake preference.
chrome.storage.local.get({ shake: false }, (s) => {
  $('shakeToggle').checked = s.shake === true;
});

$('shakeToggle').addEventListener('change', (e) => {
  chrome.storage.local.set({ shake: e.target.checked });
});

// Flip / restore.
$('flipBtn').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    $('statusText').textContent = 'Cannot flip this page (browser-restricted).';
    return;
  }
  // Give the toggle a beat, then re-read the real state.
  setTimeout(refreshStatus, 120);
});

refreshStatus();
