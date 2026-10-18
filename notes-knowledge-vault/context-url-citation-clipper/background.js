// CiteClip — background service worker.
// Creates the "Clip with citation" context-menu entry and saves the quote
// together with the page's title, URL and the access date. All on-device.

const MENU_ID = 'citeclip-clip-selection';

// Create the context menu on install / startup.
chrome.runtime.onInstalled.addListener(() => createMenu());
chrome.runtime.onStartup.addListener(() => createMenu());

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Clip with citation',
      contexts: ['selection']
    });
  });
}

// Handle the click: grab the selection text from the menu event, plus the
// tab's title/URL (activeTab grants temporary access to the tab where the
// menu was opened).
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;

  const quote = info.selectionText.trim().slice(0, 2000);
  const title = (tab && tab.title ? tab.title : 'Untitled page').trim();
  const url = (tab && tab.url ? tab.url : '').trim();
  const accessedAt = new Date().toISOString();

  const clip = {
    id: 'clip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    quote,
    title,
    url,
    accessedAt
  };

  const { clips = [] } = await chrome.storage.local.get('clips');
  clips.unshift(clip); // newest first
  // Keep the library bounded so storage never grows without limit.
  await chrome.storage.local.set({ clips: clips.slice(0, 500) });

  // Update the toolbar badge with the clip count as a subtle confirmation.
  chrome.action.setBadgeText({ text: String(Math.min(clips.length, 99)) });
  chrome.action.setBadgeBackgroundColor({ color: '#22d3ee' });
});

// Keep the badge in sync when clips are deleted from the popup.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.clips) {
    const n = (changes.clips.newValue || []).length;
    chrome.action.setBadgeText({ text: n ? String(Math.min(n, 99)) : '' });
  }
});
