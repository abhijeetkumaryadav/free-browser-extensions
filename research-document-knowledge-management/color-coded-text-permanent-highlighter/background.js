/* ChromaMark service worker — context menus only. No persistent state. */
'use strict';

const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'];
const COLOR_LABEL = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink', orange: 'Orange' };

chrome.runtime.onInstalled.addListener(() => {
  const parent = chrome.contextMenus.create({
    id: 'cm-root',
    title: 'ChromaMark',
    contexts: ['selection']
  });
  for (const color of COLORS) {
    chrome.contextMenus.create({
      id: 'cm-hl-' + color,
      parentId: parent,
      title: 'Highlight ' + COLOR_LABEL[color],
      contexts: ['selection']
    });
  }
  chrome.contextMenus.create({
    id: 'cm-clear-page',
    title: 'Clear all ChromaMark highlights on this page',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === 'cm-clear-page') {
    chrome.tabs.sendMessage(tab.id, { type: 'CM_CLEAR' }).catch(() => {});
    return;
  }
  if (info.menuItemId.startsWith('cm-hl-')) {
    const color = info.menuItemId.replace('cm-hl-', '');
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'CM_HIGHLIGHT_SELECTION', color });
    } catch (e) {
      // Content script not ready on this page (e.g. chrome://) — ignore.
    }
  }
});
