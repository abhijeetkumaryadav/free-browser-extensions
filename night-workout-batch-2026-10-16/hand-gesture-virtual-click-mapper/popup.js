// Click Keys — popup logic.
// Stores key->selector mappings and injects the click engine into the tab.
// The engine is idempotent: re-injecting only refreshes the mappings.
// Fully local; no network.
'use strict';

const STORAGE_KEY = 'clickKeys.mappings.v1';

const keyInput = document.getElementById('keyInput');
const selInput = document.getElementById('selInput');
const addBtn = document.getElementById('addBtn');
const mapList = document.getElementById('mapList');
const emptyEl = document.getElementById('empty');
const hint = document.getElementById('hint');
const injectBtn = document.getElementById('injectBtn');

// ---------------------------------------------------------------------------
async function loadMappings() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function saveMappings(m) {
  await chrome.storage.local.set({ [STORAGE_KEY]: m });
}

function showHint(msg) {
  hint.textContent = msg;
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => { hint.textContent = ''; }, 3000);
}

function isValidSelector(sel) {
  try { document.querySelector(sel); return true; }
  catch { return false; }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function render() {
  const maps = await loadMappings();
  const keys = Object.keys(maps).sort();
  mapList.innerHTML = '';
  emptyEl.style.display = keys.length ? 'none' : 'block';
  for (const key of keys) {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div><span class="kbd">${escapeHtml(key)}</span><span class="sel">${escapeHtml(maps[key])}</span></div>
      <button class="btn danger small">Remove</button>`;
    li.querySelector('button').addEventListener('click', async () => {
      const m = await loadMappings();
      delete m[key];
      await saveMappings(m);
      await applyMappingsToActiveTab(false); // refresh without nagging
      render();
    });
    mapList.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Engine injection (MAIN world so clicks behave like real user clicks).
// Idempotent: if already installed, only the mappings are refreshed.
// ---------------------------------------------------------------------------
async function applyMappingsToActiveTab(announce) {
  const maps = await loadMappings();
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) { tab = null; }
  if (!tab || !tab.id || !/^https?:|^file:/.test(tab.url || '')) {
    if (announce) showHint('Cannot enable on this page (internal or restricted).');
    return false;
  }
  // Build engine source with mappings baked in (JSON-escaped).
  const engine = [
    'window.__clickKeysMappings = ' + JSON.stringify(maps) + ';',
    'if (!window.__clickKeysInstalled) {',
    '  window.__clickKeysInstalled = true;',
    '  document.addEventListener("keydown", function(e) {',
    '    var t = e.target;',
    '    if (t && (t.isContentEditable || ["INPUT","TEXTAREA","SELECT"].indexOf(t.tagName) >= 0)) return;',
    '    if (e.ctrlKey || e.metaKey || e.altKey) return;',
    '    var sel = window.__clickKeysMappings[e.key];',
    '    if (!sel) return;',
    '    var el; try { el = document.querySelector(sel); } catch (err) { return; }',
    '    if (!el) return;',
    '    if (el.tagName === "INPUT" && ["password","file","hidden"].indexOf(el.type) >= 0) return;',
    '    e.preventDefault();',
    '    try { el.focus({ preventScroll: true }); } catch (err) {}',
    '    el.click();',
    '  });',
    '}'
  ].join('\n');
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (src) => { (0, eval)(src); },
      args: [engine]
    });
    if (announce) showHint('Enabled on this tab — press your keys.');
    return true;
  } catch (e) {
    if (announce) showHint('Injection failed: ' + (e.message || e));
    return false;
  }
}

// ---------------------------------------------------------------------------
// Add mapping
// ---------------------------------------------------------------------------
addBtn.addEventListener('click', async () => {
  const key = keyInput.value;
  const sel = selInput.value.trim();
  if (!key) { showHint('Enter a single key.'); keyInput.focus(); return; }
  if (!sel) { showHint('Enter a CSS selector.'); selInput.focus(); return; }
  if (!isValidSelector(sel)) { showHint('That selector is not valid CSS.'); return; }
  const maps = await loadMappings();
  maps[key] = sel;
  await saveMappings(maps);
  keyInput.value = '';
  selInput.value = '';
  showHint(`Mapped "${key}" → ${sel}`);
  await applyMappingsToActiveTab(false);
  render();
});

injectBtn.addEventListener('click', () => applyMappingsToActiveTab(true));

render();
