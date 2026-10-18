/* Tab Audio Muter — popup logic.
 * Lists tabs currently making sound; toggles mute per tab;
 * "mute all except this" action; auto-mute preference sync. */

const listEl = document.getElementById('audibleList');
const emptyEl = document.getElementById('emptyState');
const countBadge = document.getElementById('countBadge');
const autoMuteToggle = document.getElementById('autoMuteToggle');

// Lucide-style stroke icons (reused per row).
const ICON_SOUND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
const ICON_MUTED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;

/** Shorten a URL to its hostname for the row subtitle. */
function hostOf(url) {
  try { return new URL(url).hostname; } catch { return url || ''; }
}

/** Render the list of tabs that are currently audible. */
async function render() {
  const tabs = await chrome.tabs.query({});
  const audible = tabs.filter(t => t.audible);

  countBadge.textContent = audible.length;
  listEl.innerHTML = '';
  emptyEl.style.display = audible.length ? 'none' : 'block';

  for (const tab of audible) {
    const li = document.createElement('li');
    li.className = 'tab-row';

    const fav = document.createElement('img');
    fav.className = 'favicon';
    fav.alt = '';
    // Blank-pixel fallback if the tab has no favicon.
    fav.src = tab.favIconUrl || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    fav.onerror = () => { fav.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; };

    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = tab.title || '(untitled)';
    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = hostOf(tab.url);
    meta.append(title, url);

    const btn = document.createElement('button');
    btn.className = 'mute-btn' + (tab.mutedInfo && tab.mutedInfo.muted ? ' muted' : '');
    btn.innerHTML = (tab.mutedInfo && tab.mutedInfo.muted) ? ICON_MUTED : ICON_SOUND;
    btn.title = (tab.mutedInfo && tab.mutedInfo.muted) ? 'Unmute this tab' : 'Mute this tab';
    btn.addEventListener('click', async () => {
      const currentlyMuted = tab.mutedInfo && tab.mutedInfo.muted;
      await chrome.tabs.update(tab.id, { muted: !currentlyMuted });
      render(); // refresh state after toggle
    });

    li.append(fav, meta, btn);
    listEl.appendChild(li);
  }
}

// ---- Toolbar actions ----

document.getElementById('muteAllBtn').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter(t => t.audible).map(t => chrome.tabs.update(t.id, { muted: true })));
  render();
});

document.getElementById('exceptThisBtn').addEventListener('click', async () => {
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter(t => t.audible && t.id !== (current && current.id))
      .map(t => chrome.tabs.update(t.id, { muted: true }))
  );
  render();
});

// ---- Auto-mute preference ----

chrome.storage.sync.get({ autoMuteBackground: false }, (res) => {
  autoMuteToggle.checked = res.autoMuteBackground;
});
autoMuteToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ autoMuteBackground: autoMuteToggle.checked });
});

// Refresh when a tab's audible state changes while the popup is open.
chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if (changeInfo.audible !== undefined) render();
});

render();
