/* SnippetStack — context-menu + message plumbing.
 * Captures the user's selected text (selectionText comes straight from the
 * context-menu click info — no page scraping) and stores it in the project. */

'use strict';

const MENU_ID = 'snippetstack-save';

// Build the menu on install / startup.
chrome.runtime.onInstalled.addListener(() => createMenu());
chrome.runtime.onStartup.addListener(() => createMenu());

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Save selection to SnippetStack',
      contexts: ['selection'],
    });
  });
}

// Save a snippet object into storage under the active project.
async function saveSnippet({ text, url, title }) {
  const data = await chrome.storage.local.get({ projects: [], activeProject: null });
  let projects = data.projects;
  if (projects.length === 0) {
    projects = [{ id: 'p1', name: 'Research', snippets: [] }];
  }
  const activeId = data.activeProject || projects[0].id;
  const project = projects.find((p) => p.id === activeId) || projects[0];
  project.snippets.push({
    id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    text,
    url,
    title,
    createdAt: Date.now(),
  });
  await chrome.storage.local.set({ projects, activeProject: project.id });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText || '').trim();
  if (!text) return;
  await saveSnippet({
    text,
    url: tab ? tab.url : '',
    title: tab ? tab.title : '',
  });
  // Quiet confirmation via badge flash.
  try {
    await chrome.action.setBadgeText({ text: '✓' });
    await chrome.action.setBadgeBackgroundColor({ color: '#14b8a6' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
  } catch (_) { /* badge is best-effort */ }
});

// The popup asks the background to grab the live selection from the tab
// (popup can't inject and read it directly without scripting — it delegates).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'grab-selection') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return sendResponse({ ok: false, error: 'No active tab.' });
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection ? window.getSelection().toString().trim() : '',
        });
        if (!result) return sendResponse({ ok: false, error: 'Nothing is selected on this page.' });
        await saveSnippet({ text: result, url: tab.url || '', title: tab.title || '' });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: 'Cannot read this page (try the right-click menu instead).' });
      }
    })();
    return true; // async response
  }
});
