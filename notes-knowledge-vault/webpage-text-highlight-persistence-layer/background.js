/* HighlightLayer — background service worker.
 * Registers the "Highlight" context-menu items (one per color).
 */
'use strict';

const MENU_COLORS = [
  { id: 'hlp-yellow', title: 'Yellow', color: 'yellow' },
  { id: 'hlp-lime', title: 'Lime', color: 'lime' },
  { id: 'hlp-cyan', title: 'Cyan', color: 'cyan' },
  { id: 'hlp-pink', title: 'Pink', color: 'pink' }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    const parent = chrome.contextMenus.create({
      id: 'hlp-parent',
      title: 'HighlightLayer',
      contexts: ['selection']
    });
    for (const c of MENU_COLORS) {
      chrome.contextMenus.create({
        id: c.id,
        parentId: parent,
        title: c.title,
        contexts: ['selection']
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const match = MENU_COLORS.find((c) => c.id === info.menuItemId);
  if (!match || !tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'HLP_HIGHLIGHT_SELECTION',
      color: match.color
    });
  } catch (err) {
    // Tab may not have the content script (e.g. chrome:// pages) — ignore.
  }
});
