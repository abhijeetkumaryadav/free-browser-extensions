/* CursorCraft popup logic.
   Applies a cursor to the active tab only on explicit user click.
   Per-site choice is remembered in chrome.storage.local; restore removes it. */
'use strict';

/** Cursor catalog: id, display name, hotspot (x, y) inside the 32x32 image. */
const CURSORS = [
  { id: 'arrow',     name: 'Neon Arrow', hot: [2, 2]   },
  { id: 'glow-dot',  name: 'Glow Dot',   hot: [16, 16] },
  { id: 'crosshair', name: 'Crosshair',  hot: [16, 16] },
  { id: 'star',      name: 'Star',       hot: [16, 16] },
  { id: 'diamond',   name: 'Diamond',    hot: [16, 16] },
  { id: 'ring',      name: 'Ring',       hot: [16, 16] },
  { id: 'ibeam',     name: 'I-Beam',     hot: [16, 16] },
  { id: 'sparkle',   name: 'Sparkle',    hot: [16, 16] },
];

const STYLE_ID = 'cursorcraft-style';
const STORE_KEY = 'sites';

let selected = CURSORS[0].id;
let currentHost = '';

const $ = (id) => document.getElementById(id);

/* --- Fully self-contained injected functions (no popup-scope references) --- */

/** Inject a <style> forcing every element to use the given cursor data-URL. */
function applyCursorInPage(dataUrl, hx, hy) {
  var old = document.getElementById('cursorcraft-style');
  if (old) old.remove();
  var css = '*{cursor:url("' + dataUrl + '") ' + hx + ' ' + hy + ',auto !important}';
  var el = document.createElement('style');
  el.id = 'cursorcraft-style';
  el.textContent = css;
  document.documentElement.appendChild(el);
}

/** Remove the injected cursor style, restoring the page default. */
function removeCursorInPage() {
  var old = document.getElementById('cursorcraft-style');
  if (old) old.remove();
}

/* --- helpers --- */

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function hostOf(url) {
  try { return new URL(url).hostname || ''; } catch { return ''; }
}

async function cursorDataUrl(id) {
  const url = chrome.runtime.getURL(`cursors/${id}.png`);
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function getSites() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return data[STORE_KEY] || {};
}

async function setSiteCursor(host, id) {
  const sites = await getSites();
  if (id) sites[host] = id; else delete sites[host];
  await chrome.storage.local.set({ [STORE_KEY]: sites });
}

/* --- UI --- */

function renderGrid() {
  const grid = $('grid');
  grid.textContent = '';
  for (const c of CURSORS) {
    const cell = document.createElement('button');
    cell.className = 'cell' + (c.id === selected ? ' active' : '');
    cell.type = 'button';
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(`cursors/${c.id}.png`);
    img.alt = c.name;
    const label = document.createElement('span');
    label.textContent = c.name;
    cell.append(img, label);
    cell.addEventListener('click', () => select(c.id));
    grid.appendChild(cell);
  }
}

function select(id) {
  selected = id;
  const c = CURSORS.find((x) => x.id === id);
  $('previewImg').src = chrome.runtime.getURL(`cursors/${id}.png`);
  $('previewName').textContent = c.name;
  // Hovering the preview tests the real cursor via the data URL.
  cursorDataUrl(id).then((url) => {
    $('preview').style.cursor = `url("${url}") ${c.hot[0]} ${c.hot[1]}, auto`;
  }).catch(() => {});
  renderGrid();
}

async function applySelected() {
  const tab = await activeTab();
  if (!tab || !tab.id) return;
  const c = CURSORS.find((x) => x.id === selected);
  const url = await cursorDataUrl(selected);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: applyCursorInPage,
    args: [url, c.hot[0], c.hot[1]],
  });
  if (currentHost) await setSiteCursor(currentHost, selected);
  $('savedBadge').hidden = false;
}

async function restoreDefault() {
  const tab = await activeTab();
  if (tab && tab.id) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: removeCursorInPage,
    });
  }
  if (currentHost) await setSiteCursor(currentHost, null);
  $('savedBadge').hidden = true;
}

async function init() {
  const tab = await activeTab();
  currentHost = tab && tab.url ? hostOf(tab.url) : '';
  $('host').textContent = currentHost || '—';
  const sites = await getSites();
  if (currentHost && sites[currentHost]) {
    selected = sites[currentHost];
    $('savedBadge').hidden = false;
  }
  select(selected);
  $('applyBtn').addEventListener('click', applySelected);
  $('restoreBtn').addEventListener('click', restoreDefault);
}

init().catch(console.error);
