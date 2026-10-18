// Forum-Only Filter — popup controller.
// Injects content.js into the active tab on explicit click only,
// then messages it to filter or restore search results.
'use strict';

// ---------- small DOM helpers ----------
const $ = (id) => document.getElementById(id);
const PREF_KEY = 'forumOnlyPrefs';

// ---------- preferences ----------
async function getPrefs() {
  const d = await chrome.storage.local.get(PREF_KEY);
  return Object.assign({ mode: 'dim', extraDomains: '' }, d[PREF_KEY] || {});
}
async function savePrefs(prefs) {
  await chrome.storage.local.set({ [PREF_KEY]: prefs });
}

// ---------- tab helpers ----------
async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}
function isWebPage(url) {
  return /^https?:\/\//i.test(url || '');
}
async function ensureEngine(tabId) {
  // Boot-once content script; safe to re-run (it self-guards).
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}
async function sendToPage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text;
  el.dataset.kind = kind || '';
}

function readUiPrefs() {
  return {
    mode: $('mode').value,
    extraDomains: $('domains').value,
  };
}

// ---------- wiring ----------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const prefs = await getPrefs();
    $('mode').value = prefs.mode;
    $('domains').value = prefs.extraDomains;
  } catch (e) { /* storage unavailable; defaults stand */ }

  $('filterBtn').addEventListener('click', async () => {
    setStatus('Scanning…');
    try {
      const tab = await activeTab();
      if (!tab || !isWebPage(tab.url)) {
        setStatus('Open a normal web page first.', 'warn');
        return;
      }
      const prefs = readUiPrefs();
      await savePrefs(prefs);
      await ensureEngine(tab.id);
      const res = await sendToPage(tab.id, {
        action: 'forum-filter',
        opts: {
          mode: prefs.mode,
          extraDomains: prefs.extraDomains.split('\n'),
        },
      });
      if (!res || !res.ok) {
        setStatus('The page did not respond.', 'warn');
        return;
      }
      if (res.total === 0) {
        setStatus('No search results detected on this page.', 'warn');
      } else {
        setStatus(
          `Kept ${res.kept} forum result${res.kept === 1 ? '' : 's'} · ` +
          `${res.dimmed} ${prefs.mode === 'hide' ? 'hidden' : 'dimmed'}.`,
          'ok'
        );
      }
    } catch (e) {
      setStatus('Could not run on this page.', 'warn');
    }
  });

  $('restoreBtn').addEventListener('click', async () => {
    try {
      const tab = await activeTab();
      if (!tab || !isWebPage(tab.url)) {
        setStatus('Open a normal web page first.', 'warn');
        return;
      }
      await ensureEngine(tab.id);
      const res = await sendToPage(tab.id, { action: 'forum-restore' });
      const n = res && res.ok ? res.restored : 0;
      setStatus(`Restored ${n} result${n === 1 ? '' : 's'}.`, 'ok');
    } catch (e) {
      setStatus('Could not reach the page.', 'warn');
    }
  });
});
