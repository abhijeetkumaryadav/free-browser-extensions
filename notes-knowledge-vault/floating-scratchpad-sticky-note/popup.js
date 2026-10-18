/* StickyPad popup — page actions + library of all notes. */
(() => {
  'use strict';

  const STORAGE_KEY = 'stickypad.notes';
  const COLOR_HEX = { yellow: '#eab308', pink: '#f43f5e', green: '#22c55e', blue: '#3b82f6', purple: '#8b5cf6' };

  const $ = (id) => document.getElementById(id);
  const toggleBtn = $('toggleBtn'), refreshBtn = $('refreshBtn'), clearPageBtn = $('clearPageBtn');
  const notesList = $('notesList'), noteCount = $('noteCount'), pageLabel = $('pageLabel');

  let currentTab = null;

  /** Send a message to the content script, injecting it first if needed. */
  async function ensureContent(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'ping' });
      return true;
    } catch {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        // Give the script a moment to install its listener.
        await new Promise((r) => setTimeout(r, 150));
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  async function refreshLibrary() {
    const all = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    const ids = Object.keys(all);
    const pageIds = ids.filter((id) => all[id].url === currentTab?.url);

    noteCount.textContent = `${pageIds.length} note${pageIds.length === 1 ? '' : 's'}`;
    notesList.innerHTML = '';

    if (!ids.length) {
      notesList.innerHTML = '<p class="empty">No notes anywhere yet.</p>';
      return;
    }

    // Group by origin for readability.
    const groups = {};
    for (const id of ids) {
      let origin;
      try { origin = new URL(all[id].url).origin; } catch { origin = '(unknown page)'; }
      (groups[origin] = groups[origin] || []).push(id);
    }

    for (const origin of Object.keys(groups).sort()) {
      const title = document.createElement('div');
      title.className = 'group-title';
      title.textContent = origin;
      title.title = origin;
      notesList.appendChild(title);

      for (const id of groups[origin]) {
        const n = all[id];
        const card = document.createElement('div');
        card.className = 'note-card';
        card.style.borderLeftColor = COLOR_HEX[n.color] || COLOR_HEX.yellow;

        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = COLOR_HEX[n.color] || COLOR_HEX.yellow;

        const preview = document.createElement('span');
        preview.className = 'preview' + (n.text?.trim() ? '' : ' empty-text');
        preview.textContent = n.text?.trim() ? n.text.trim().slice(0, 60) : '(empty note)';

        const jump = document.createElement('button');
        jump.className = 'icon-btn';
        jump.title = 'Open this page';
        jump.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>';
        jump.addEventListener('click', () => chrome.tabs.create({ url: n.url }));

        const del = document.createElement('button');
        del.className = 'icon-btn danger';
        del.title = 'Delete note';
        del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
        del.addEventListener('click', async () => {
          const fresh = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
          delete fresh[id];
          await chrome.storage.local.set({ [STORAGE_KEY]: fresh });
          // If it's on the current page, tell the overlay to reload.
          if (n.url === currentTab?.url) {
            try { await chrome.tabs.sendMessage(currentTab.id, { type: 'reload' }); } catch {}
          }
          refreshLibrary();
        });

        card.append(dot, preview, jump, del);
        notesList.appendChild(card);
      }
    }
  }

  toggleBtn.addEventListener('click', async () => {
    if (!currentTab) return;
    if (!/^https?:/.test(currentTab.url || '')) {
      pageLabel.textContent = 'Notes need an http(s) page';
      return;
    }
    toggleBtn.disabled = true;
    try {
      const ok = await ensureContent(currentTab.id);
      if (ok) {
        await chrome.tabs.sendMessage(currentTab.id, { type: 'add' });
        window.close();
      } else {
        pageLabel.textContent = 'Could not attach to this page';
      }
    } finally {
      toggleBtn.disabled = false;
    }
  });

  refreshBtn.addEventListener('click', async () => {
    if (!currentTab) return;
    const ok = await ensureContent(currentTab.id);
    if (ok) {
      try { await chrome.tabs.sendMessage(currentTab.id, { type: 'reload' }); } catch {}
    }
    refreshLibrary();
  });

  clearPageBtn.addEventListener('click', async () => {
    if (!currentTab?.url) return;
    const all = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    let removed = 0;
    for (const id of Object.keys(all)) {
      if (all[id].url === currentTab.url) { delete all[id]; removed++; }
    }
    if (removed) {
      await chrome.storage.local.set({ [STORAGE_KEY]: all });
      try { await chrome.tabs.sendMessage(currentTab.id, { type: 'reload' }); } catch {}
      refreshLibrary();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) refreshLibrary();
  });

  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab || null;
    if (tab?.url && /^https?:/.test(tab.url)) {
      try { pageLabel.textContent = new URL(tab.url).hostname; }
      catch { pageLabel.textContent = tab.url.slice(0, 40); }
    } else {
      pageLabel.textContent = 'Not a web page';
    }
    refreshLibrary();
  })();
})();
