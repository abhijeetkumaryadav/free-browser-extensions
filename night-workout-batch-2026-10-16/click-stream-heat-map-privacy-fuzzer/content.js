// Click Heatmap — content script
// Injected ONLY on the user's explicit click ("Start tracking") via
// chrome.scripting.executeScript. Records the user's OWN real clicks
// (coordinates + tiny element hint) into chrome.storage.local keyed by
// page URL. Never synthesizes clicks; never phones home.
(function () {
  'use strict';
  if (window.__clickHeatmapInstalled) return;
  window.__clickHeatmapInstalled = true;

  const STORAGE_KEY = 'clickheatmap_clicks_v1';
  const DISABLE_KEY = 'clickheatmap_disabled_sites_v1';

  function hostOf(url) {
    try { return new URL(url).hostname; } catch { return ''; }
  }

  async function isDisabledHere() {
    const data = await chrome.storage.local.get(DISABLE_KEY);
    const list = data[DISABLE_KEY] || [];
    return list.includes(hostOf(location.href));
  }

  function selectorHint(el) {
    if (!el || el === document.body || el === document.documentElement) return 'page';
    const tag = (el.tagName || 'el').toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const text = (el.innerText || '').trim().slice(0, 30);
    return `${tag}${id}${cls}${text ? ' "' + text + '"' : ''}`.slice(0, 80);
  }

  document.addEventListener('click', async (e) => {
    try {
      if (await isDisabledHere()) return;
      const pageKey = location.href.split('#')[0];
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const all = data[STORAGE_KEY] || {};
      const list = all[pageKey] || [];
      list.push({
        x: e.clientX + window.scrollX,
        y: e.clientY + window.scrollY,
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
        el: selectorHint(e.target),
        t: Date.now()
      });
      // Keep storage bounded: last 2000 clicks per page.
      all[pageKey] = list.slice(-2000);
      await chrome.storage.local.set({ [STORAGE_KEY]: all });
    } catch (err) {
      // Storage failures are non-fatal.
    }
  }, true);
})();
