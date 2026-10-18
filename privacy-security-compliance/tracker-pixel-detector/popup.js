/* Tracker Pixel Detector — popup logic. */
'use strict';

const $ = id => document.getElementById(id);

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

/* Make sure the content script is present, then scan. */
async function scanTab(tab) {
  try {
    return await chrome.tabs.sendMessage(tab.id, { action: 'tpd-scan' });
  } catch (e) {
    // Not injected yet (or page blocks messaging) — inject on demand.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tab.id, { action: 'tpd-scan' });
  }
}

function showError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function render(items) {
  const list = $('list');
  list.innerHTML = '';
  $('count').textContent = items.length;
  $('domains').textContent = new Set(items.map(i => i.domain).filter(Boolean)).size;

  if (!items.length) { $('empty').classList.remove('hidden'); return; }
  $('empty').classList.add('hidden');

  // Riskiest first: hidden images, then 1x1, then plain tracker domains.
  const rank = t => t.includes('Hidden image') ? 0 : t.includes('1×1 pixel') ? 1 : 2;
  items.sort((a, b) => Math.min(...a.types.map(rank)) - Math.min(...b.types.map(rank)));

  for (const it of items) {
    const div = document.createElement('div');
    div.className = 'item';
    const dom = document.createElement('div');
    dom.className = 'dom';
    dom.textContent = it.domain || '(unknown host)';
    const src = document.createElement('div');
    src.className = 'src';
    try { src.textContent = decodeURIComponent(it.src); } catch (e) { src.textContent = it.src; }
    const badges = document.createElement('div');
    badges.className = 'badges';
    it.types.forEach(t => {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = t;
      badges.appendChild(b);
    });
    div.append(dom, src, badges);
    list.appendChild(div);
  }
}

async function setHide(on, tab) {
  $('hideToggle').setAttribute('aria-checked', String(on));
  await chrome.storage.local.set({ hidePixels: on });
  if (tab) {
    try { await chrome.tabs.sendMessage(tab.id, { action: 'tpd-hide', enable: on }); } catch (e) { /* page gone */ }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  let tab = null;
  try {
    tab = await activeTab();
    if (!tab || !/^https?:/.test(tab.url || '')) {
      showError('Open a regular web page (http/https), then open this popup to scan it.');
      $('count').textContent = '0'; $('domains').textContent = '0';
      return;
    }
    const { items } = await scanTab(tab);
    render(items || []);
  } catch (e) {
    showError('Could not scan this page. Some pages (store, settings) block extensions.');
    $('count').textContent = '0'; $('domains').textContent = '0';
  }

  const { hidePixels = false } = await chrome.storage.local.get('hidePixels');
  $('hideToggle').setAttribute('aria-checked', String(hidePixels));
  // Re-apply the saved preference to the freshly scanned page.
  if (tab && hidePixels) {
    try { await chrome.tabs.sendMessage(tab.id, { action: 'tpd-hide', enable: true }); } catch (e) {}
  }

  $('hideToggle').addEventListener('click', async () => {
    const cur = $('hideToggle').getAttribute('aria-checked') === 'true';
    await setHide(!cur, tab);
  });

  $('rescan').addEventListener('click', async () => {
    try {
      const t = await activeTab();
      const { items } = await scanTab(t);
      render(items || []);
      const { hidePixels: hp = false } = await chrome.storage.local.get('hidePixels');
      if (hp) { try { await chrome.tabs.sendMessage(t.id, { action: 'tpd-hide', enable: true }); } catch (e) {} }
    } catch (e) { showError('Rescan failed on this page.'); }
  });
});
