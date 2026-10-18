/**
 * Ingredient Allergen Highlighter — popup controller.
 * Manages the watched-allergen list (chrome.storage.local) and drives the
 * page-side scan/clear engine via chrome.scripting (user-triggered only).
 */
'use strict';

const DEFAULT_ALLERGENS = [
  'Milk', 'Eggs', 'Peanuts', 'Tree nuts', 'Soy', 'Wheat',
  'Fish', 'Shellfish', 'Sesame', 'Mustard', 'Celery',
  'Lupin', 'Sulfites', 'Gluten', 'Almonds', 'Walnuts', 'Cashews',
];

const STORAGE_KEY = 'allergenPrefsV1';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const listEl = $('allergenList');
const countLabel = $('countLabel');

let prefs = { items: DEFAULT_ALLERGENS.map((name) => ({ name, on: true, custom: false })) };

/* ---------- persistence ---------- */
async function loadPrefs() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY] && Array.isArray(data[STORAGE_KEY].items)) {
      prefs = data[STORAGE_KEY];
    }
  } catch (e) { /* storage unavailable — fall back to defaults */ }
}

async function savePrefs() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: prefs });
  } catch (e) { /* ignore */ }
}

/* ---------- allergen list UI ---------- */
function renderList() {
  listEl.innerHTML = '';
  const enabled = prefs.items.filter((i) => i.on).length;
  countLabel.textContent = `${enabled}/${prefs.items.length} on`;

  if (!prefs.items.length) {
    const empty = document.createElement('span');
    empty.className = 'chips-empty';
    empty.textContent = 'No allergens yet — add one below.';
    listEl.appendChild(empty);
    return;
  }

  prefs.items.forEach((item, idx) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (item.on ? ' on' : '') + (item.custom ? ' custom' : '');
    chip.title = item.on ? 'Click to turn off' : 'Click to turn on';

    const label = document.createElement('span');
    label.textContent = item.name;
    chip.appendChild(label);

    if (item.custom) {
      const x = document.createElement('span');
      x.className = 'x';
      x.textContent = '×';
      x.title = 'Remove';
      x.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        prefs.items.splice(idx, 1);
        await savePrefs();
        renderList();
      });
      chip.appendChild(x);
    }

    chip.addEventListener('click', async () => {
      item.on = !item.on;
      await savePrefs();
      renderList();
    });
    listEl.appendChild(chip);
  });
}

async function addCustom() {
  const input = $('customInput');
  const name = input.value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  const exists = prefs.items.some((i) => i.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    setStatus('Already in the list.', 'err');
    return;
  }
  prefs.items.push({ name, on: true, custom: true });
  await savePrefs();
  renderList();
  input.value = '';
  setStatus(`“${name}” added.`, 'ok');
}

/* ---------- page engine wiring ---------- */
function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function injectable(url) {
  return !!url && /^(https?|file|ftp):/i.test(url);
}

async function ensureEngine(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (e) {
    // Re-execution or non-scriptable pages: content script self-guards.
    throw e;
  }
}

async function scanPage() {
  const tab = await getActiveTab();
  if (!tab || !injectable(tab.url)) {
    setStatus('Can’t run here (e.g. chrome:// pages).', 'err');
    return;
  }
  const enabled = prefs.items.filter((i) => i.on).map((i) => i.name);
  if (!enabled.length) {
    setStatus('Turn on at least one allergen first.', 'err');
    return;
  }
  const btn = $('scanBtn');
  btn.disabled = true;
  setStatus('Scanning ingredient-like text…');
  try {
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'ALLERGEN_SCAN', allergens: enabled });
    if (res && res.ok) {
      setStatus(res.count === 0 ? 'No matches in ingredient-like text.' : `${res.count} match${res.count === 1 ? '' : 'es'} highlighted.`, 'ok');
    } else {
      setStatus('Scan failed: ' + ((res && res.error) || 'unknown error'), 'err');
    }
  } catch (e) {
    setStatus('Couldn’t reach the page. Try reloading it.', 'err');
  } finally {
    btn.disabled = false;
  }
}

async function clearPage() {
  const tab = await getActiveTab();
  if (!tab || !injectable(tab.url)) {
    setStatus('Nothing to clear on this page.', 'err');
    return;
  }
  try {
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'ALLERGEN_CLEAR' });
    setStatus(res && res.ok ? (res.cleared ? 'Highlights removed — page restored.' : 'No highlights to remove.') : 'Clear failed.', res && res.ok ? 'ok' : 'err');
  } catch (e) {
    setStatus('Couldn’t reach the page.', 'err');
  }
}

/* ---------- init ---------- */
$('scanBtn').addEventListener('click', scanPage);
$('clearBtn').addEventListener('click', clearPage);
$('addBtn').addEventListener('click', addCustom);
$('customInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addCustom();
});

(async function init() {
  await loadPrefs();
  renderList();
})();
