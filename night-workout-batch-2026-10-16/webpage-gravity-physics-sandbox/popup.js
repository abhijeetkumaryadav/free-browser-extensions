// popup.js — Gravity Sandbox controls. Injects the physics toy on explicit click only.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const grav = $('grav'), bounce = $('bounce'), drop = $('drop'),
        restore = $('restore'), status = $('status');

  function refresh() {
    $('gravOut').textContent = grav.value + ' px/frame²';
    $('bounceOut').textContent = bounce.value + '%';
  }
  grav.addEventListener('input', refresh);
  bounce.addEventListener('input', refresh);

  // Remember settings locally.
  chrome.storage.local.get({ gravG: 9.8, gravB: 55 }, (s) => {
    grav.value = s.gravG; bounce.value = s.gravB; refresh();
  });
  grav.addEventListener('change', () => chrome.storage.local.set({ gravG: +grav.value }));
  bounce.addEventListener('change', () => chrome.storage.local.set({ gravB: +bounce.value }));

  async function activeTab() {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    return t;
  }

  drop.addEventListener('click', async () => {
    const tab = await activeTab();
    if (!tab || !/^https?:/.test(tab.url || '')) {
      status.textContent = 'Open a normal web page first — the toy cannot run on browser pages.';
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (g, b) => window.__gravSandboxDrop && window.__gravSandboxDrop(g, b),
      args: [+grav.value, +bounce.value / 100]
    });
    status.textContent = 'Everything is falling. Use “Restore page” to tidy up.';
    drop.disabled = true; restore.disabled = false;
  });

  restore.addEventListener('click', async () => {
    const tab = await activeTab();
    if (tab) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__gravSandboxRestore && window.__gravSandboxRestore()
      });
    }
    status.textContent = 'Page restored exactly.';
    drop.disabled = false; restore.disabled = true;
  });

  refresh();
})();
