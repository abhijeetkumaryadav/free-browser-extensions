/* Grandpa Mode popup logic — per-site settings, on-demand apply/remove. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const masterToggle = $('masterToggle');
  const featuresEl = $('features');
  const featureToggles = [...document.querySelectorAll('.switch[data-f]')];
  const DEFAULT_FEATURES = { text: true, contrast: true, simplify: true, targets: true };

  let tabId = null;
  let hostname = '';

  init();

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) { $('siteName').textContent = 'unknown page'; return; }
    tabId = tab.id;
    try { hostname = new URL(tab.url).hostname; }
    catch (e) { hostname = ''; }
    $('siteName').textContent = hostname || 'this page';

    const { grandpaSites = {} } = await chrome.storage.local.get({ grandpaSites: {} });
    const saved = grandpaSites[hostname];
    const enabled = !!(saved && saved.enabled);
    const features = Object.assign({}, DEFAULT_FEATURES, (saved && saved.features) || {});
    paint(enabled, features);
  }

  function paint(enabled, features) {
    masterToggle.setAttribute('aria-checked', String(enabled));
    featuresEl.setAttribute('aria-hidden', String(!enabled));
    for (const t of featureToggles) {
      t.setAttribute('aria-checked', String(!!features[t.dataset.f]));
    }
  }

  async function current() {
    const { grandpaSites = {} } = await chrome.storage.local.get({ grandpaSites: {} });
    const saved = grandpaSites[hostname] || {};
    return {
      enabled: !!saved.enabled,
      features: Object.assign({}, DEFAULT_FEATURES, saved.features || {})
    };
  }

  async function saveAndApply(enabled, features) {
    const { grandpaSites = {} } = await chrome.storage.local.get({ grandpaSites: {} });
    grandpaSites[hostname] = { enabled, features };
    await chrome.storage.local.set({ grandpaSites });
    paint(enabled, features);
    if (tabId == null) return;
    try {
      // Re-inject (idempotent) then command the content script.
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, enabled
        ? { type: 'gm-apply', features }
        : { type: 'gm-remove' });
    } catch (e) {
      // Protected pages (chrome://, web store) reject injection — nothing to do.
    }
  }

  masterToggle.addEventListener('click', async () => {
    const { enabled, features } = await current();
    await saveAndApply(!enabled, features);
  });

  for (const t of featureToggles) {
    t.addEventListener('click', async () => {
      const { enabled, features } = await current();
      features[t.dataset.f] = !features[t.dataset.f];
      await saveAndApply(enabled, features);
    });
  }
})();
