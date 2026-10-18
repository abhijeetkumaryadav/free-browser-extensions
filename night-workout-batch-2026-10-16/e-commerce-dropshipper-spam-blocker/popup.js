// Dropship Spam Blocker — popup controller.
// Injects content.js into the active tab on explicit click only,
// then messages it to scan or restore product cards.
'use strict';

const $ = (id) => document.getElementById(id);
const PREF_KEY = 'dropshipPrefs';

async function getPrefs() {
  const d = await chrome.storage.local.get(PREF_KEY);
  return Object.assign({ mode: 'dim' }, d[PREF_KEY] || {});
}
async function savePrefs(prefs) {
  await chrome.storage.local.set({ [PREF_KEY]: prefs });
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}
function isWebPage(url) {
  return /^https?:\/\//i.test(url || '');
}
async function ensureEngine(tabId) {
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

function renderReasons(items) {
  const ul = $('reasons');
  ul.innerHTML = '';
  (items || []).slice(0, 8).forEach((it) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = `${it.score} pts`;
    li.appendChild(strong);
    li.appendChild(document.createTextNode(` — ${it.why}`));
    ul.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const prefs = await getPrefs();
    $('mode').value = prefs.mode;
  } catch (e) { /* defaults stand */ }

  $('scanBtn').addEventListener('click', async () => {
    setStatus('Scanning…');
    renderReasons([]);
    try {
      const tab = await activeTab();
      if (!tab || !isWebPage(tab.url)) {
        setStatus('Open a normal web page first.', 'warn');
        return;
      }
      const prefs = { mode: $('mode').value };
      await savePrefs(prefs);
      await ensureEngine(tab.id);
      const res = await sendToPage(tab.id, { action: 'dropship-scan', opts: prefs });
      if (!res || !res.ok) {
        setStatus('The page did not respond.', 'warn');
        return;
      }
      if (res.total === 0) {
        setStatus('No product cards detected on this page.', 'warn');
      } else if (res.flagged === 0) {
        setStatus(`Checked ${res.total} product card${res.total === 1 ? '' : 's'} — none flagged.`, 'ok');
      } else {
        setStatus(
          `Checked ${res.total} cards · flagged ${res.flagged} ` +
          `(${prefs.mode === 'hide' ? 'hidden' : 'dimmed'}).`,
          'ok'
        );
        renderReasons(res.top || []);
      }
    } catch (e) {
      setStatus('Could not run on this page.', 'warn');
    }
  });

  $('restoreBtn').addEventListener('click', async () => {
    renderReasons([]);
    try {
      const tab = await activeTab();
      if (!tab || !isWebPage(tab.url)) {
        setStatus('Open a normal web page first.', 'warn');
        return;
      }
      await ensureEngine(tab.id);
      const res = await sendToPage(tab.id, { action: 'dropship-restore' });
      const n = res && res.ok ? res.restored : 0;
      setStatus(`Restored ${n} card${n === 1 ? '' : 's'}.`, 'ok');
    } catch (e) {
      setStatus('Could not reach the page.', 'warn');
    }
  });
});
