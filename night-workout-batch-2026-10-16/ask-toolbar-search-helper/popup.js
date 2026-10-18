/* Ask Toolbar — Multi-Engine Search Helper
 * MV3 popup. All logic local; the only network traffic is the browser
 * opening a search page at the user's explicit request.
 * Honest scope: opens search pages — not an Ask.com revival. */

'use strict';

// --- Classics preloaded on first run ---------------------------------------
const CLASSICS = [
  { name: 'Google', template: 'https://www.google.com/search?q=%s', enabled: true },
  { name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q=%s', enabled: true },
  { name: 'Bing', template: 'https://www.bing.com/search?q=%s', enabled: true },
  { name: 'Brave Search', template: 'https://search.brave.com/search?q=%s', enabled: false },
  { name: 'Mojeek', template: 'https://www.mojeek.com/search?q=%s', enabled: false }
];

const STORAGE_KEY = 'engines';
const $ = (id) => document.getElementById(id);

// --- Persistence ------------------------------------------------------------
async function loadEngines() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (Array.isArray(data[STORAGE_KEY]) && data[STORAGE_KEY].length) {
    return data[STORAGE_KEY];
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: CLASSICS });
  return CLASSICS.slice();
}

async function saveEngines(engines) {
  await chrome.storage.local.set({ [STORAGE_KEY]: engines });
}

// --- Search -----------------------------------------------------------------
function buildUrl(template, query) {
  return template.replace('%s', encodeURIComponent(query));
}

function searchWith(engine) {
  const q = $('q').value.trim();
  if (!q) { $('q').focus(); return; }
  if (!engine.template.includes('%s')) return;
  chrome.tabs.create({ url: buildUrl(engine.template, q) });
}

function searchAll(engines) {
  const q = $('q').value.trim();
  if (!q) { $('q').focus(); return; }
  for (const e of engines) {
    if (e.enabled && e.template.includes('%s')) {
      chrome.tabs.create({ url: buildUrl(e.template, q) });
    }
  }
}

// --- Rendering --------------------------------------------------------------
function engineRow(engine, index, onToggle, onDelete, onSearch) {
  const row = document.createElement('div');
  row.className = 'engine';

  const dot = document.createElement('button');
  dot.className = 'icon-btn';
  dot.title = engine.enabled ? 'Enabled for "All" — click to disable' : 'Disabled — click to enable';
  dot.innerHTML =
    `<svg viewBox="0 0 24 24" fill="${engine.enabled ? '#f97316' : 'none'}" stroke="#f97316" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>`;
  dot.addEventListener('click', (ev) => { ev.stopPropagation(); onToggle(index); });

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = engine.name;

  const tpl = document.createElement('span');
  tpl.className = 'tpl';
  try { tpl.textContent = new URL(engine.template).hostname; }
  catch { tpl.textContent = 'invalid URL'; }

  const del = document.createElement('button');
  del.className = 'icon-btn';
  del.title = 'Delete engine';
  del.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
  del.addEventListener('click', (ev) => { ev.stopPropagation(); onDelete(index); });

  row.append(dot, name, tpl, del);
  row.style.cursor = 'pointer';
  row.title = 'Click to search with ' + engine.name;
  row.addEventListener('click', () => onSearch(index));
  return row;
}

// --- Init -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  let engines = await loadEngines();

  const render = () => {
    const list = $('engines');
    list.innerHTML = '';
    if (!engines.length) {
      list.innerHTML = '<p class="hint">No engines yet — add one below.</p>';
      return;
    }
    engines.forEach((e, i) => list.append(engineRow(e, i,
      async (idx) => { engines[idx].enabled = !engines[idx].enabled; await saveEngines(engines); render(); },
      async (idx) => { engines.splice(idx, 1); await saveEngines(engines); render(); },
      (idx) => searchWith(engines[idx])
    )));
  };
  render();

  $('q').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      const first = engines.find((e) => e.enabled);
      if (first) searchWith(first);
    }
  });

  $('goAll').addEventListener('click', () => searchAll(engines));

  $('add').addEventListener('click', async () => {
    const name = $('newName').value.trim();
    const tpl = $('newTpl').value.trim();
    if (!name || !tpl.includes('%s')) return;
    try { new URL(tpl.replace('%s', 'test')); } catch { return; }
    engines.push({ name, template: tpl, enabled: true });
    await saveEngines(engines);
    $('newName').value = '';
    $('newTpl').value = '';
    render();
  });

  $('reset').addEventListener('click', async () => {
    engines = CLASSICS.slice();
    await saveEngines(engines);
    render();
  });
});
