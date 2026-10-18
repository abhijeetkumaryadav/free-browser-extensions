// Clickstream Heatmap — popup logic
// Coordinates explicit, user-triggered injection; reads local stats;
// manages per-site opt-out. Nothing runs without the user's click.
(function () {
  'use strict';

  const STORAGE_KEY = 'clickheatmap_clicks_v1';
  const DISABLE_KEY = 'clickheatmap_disabled_sites_v1';
  const ACTIVE_KEY = 'clickheatmap_active_tab_v1';

  const $ = (id) => document.getElementById(id);

  function hostOf(url) {
    try { return new URL(url).hostname; } catch { return ''; }
  }
  function pageKey(url) {
    return (url || '').split('#')[0];
  }

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Can we inject here? (skip chrome://, edge://, web store pages)
  function injectable(url) {
    return !!url && /^(https?|file):/.test(url);
  }

  async function refreshStats() {
    const tab = await activeTab();
    const data = await chrome.storage.local.get([STORAGE_KEY, DISABLE_KEY]);
    const all = data[STORAGE_KEY] || {};
    const disabled = data[DISABLE_KEY] || [];

    const pk = pageKey(tab && tab.url);
    $('clicksPage').textContent = (all[pk] || []).length;
    $('clicksTotal').textContent = Object.values(all).reduce((n, l) => n + l.length, 0);
    $('pagesTracked').textContent = Object.keys(all).length;
    $('siteName').textContent = hostOf(tab && tab.url) || 'this site';

    const active = (await chrome.storage.local.get(ACTIVE_KEY))[ACTIVE_KEY] || {};
    $('trackToggle').checked = tab ? !!active[tab.id] : false;
    $('trackToggle').disabled = !(tab && injectable(tab.url));
    $('siteDisable').checked = disabled.includes(hostOf(tab && tab.url));
  }

  async function injectListener(tab) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    const data = await chrome.storage.local.get(ACTIVE_KEY);
    const active = data[ACTIVE_KEY] || {};
    active[tab.id] = true;
    await chrome.storage.local.set({ [ACTIVE_KEY]: active });
  }

  $('trackToggle').addEventListener('change', async (e) => {
    const tab = await activeTab();
    if (!tab || !injectable(tab.url)) { e.target.checked = false; return; }
    if (e.target.checked) {
      try { await injectListener(tab); } catch (err) { e.target.checked = false; }
    } else {
      // The listener is page-bound; it stops applying once the page is left.
      // Clearing the flag is enough — no background keeps it alive.
      const data = await chrome.storage.local.get(ACTIVE_KEY);
      const active = data[ACTIVE_KEY] || {};
      delete active[tab.id];
      await chrome.storage.local.set({ [ACTIVE_KEY]: active });
    }
  });

  $('siteDisable').addEventListener('change', async (e) => {
    const tab = await activeTab();
    const host = hostOf(tab && tab.url);
    if (!host) return;
    const data = await chrome.storage.local.get(DISABLE_KEY);
    const list = new Set(data[DISABLE_KEY] || []);
    if (e.target.checked) list.add(host); else list.delete(host);
    await chrome.storage.local.set({ [DISABLE_KEY]: [...list] });
  });

  $('showMap').addEventListener('click', async () => {
    const tab = await activeTab();
    if (!tab || !injectable(tab.url)) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['heatmap.js']
    });
    window.close();
  });

  $('clearPage').addEventListener('click', async () => {
    const tab = await activeTab();
    const pk = pageKey(tab && tab.url);
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const all = data[STORAGE_KEY] || {};
    delete all[pk];
    await chrome.storage.local.set({ [STORAGE_KEY]: all });
    refreshStats();
  });

  $('clearAll').addEventListener('click', async () => {
    if (!confirm('Delete all recorded click data?')) return;
    await chrome.storage.local.remove(STORAGE_KEY);
    refreshStats();
  });

  refreshStats();
})();
