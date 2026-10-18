/* ==========================================================================
   Virtual Clipboard Sandbox — background service worker
   Registers a context-menu entry so the user can explicitly save any
   selected text into the sandbox. Selection text comes from the menu
   event itself, so no page scripting is required for this path.
   ========================================================================== */

'use strict';

const MENU_ID = 'save-to-clipboard-sandbox';
const MAX_CLIPS = 50;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Save selection to Clipboard Sandbox',
    contexts: ['selection'],
  });
});

/** Shared clip-store writer (mirrors the popup's addClip logic). */
async function addClip(text, source) {
  text = (text || '').trim().slice(0, 5000);
  if (!text) return;
  const data = await chrome.storage.local.get({ clips: [] });
  let clips = Array.isArray(data.clips) ? data.clips : [];
  clips = clips.filter(c => c.text !== text);
  clips.unshift({
    id: 'c' + Date.now() + Math.floor(Math.random() * 1e6),
    text,
    source: source || 'context menu',
    ts: Date.now(),
    pinned: false,
  });
  const pinned = clips.filter(c => c.pinned);
  const unpinned = clips.filter(c => !c.pinned).slice(0, MAX_CLIPS);
  clips = [...pinned, ...unpinned].sort((a, b) => b.ts - a.ts);
  await chrome.storage.local.set({ clips });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  let source = 'context menu';
  try {
    if (tab && tab.url) source = new URL(tab.url).hostname;
  } catch (e) { /* keep fallback */ }
  addClip(info.selectionText, source);
});
