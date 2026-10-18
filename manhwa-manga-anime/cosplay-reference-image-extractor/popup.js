/* MoodBoard — Cosplay Reference Extractor (popup)
 * Read-only scan of images the active tab already loads; user pins images
 * to per-costume boards stored locally. Downloads happen only when the user
 * clicks "Download board images". Nothing is fetched in the background and
 * no hotlink protections are bypassed — the browser loads each image itself.
 */
'use strict';

const STORAGE_KEY = 'moodboard.v1';
const MIN_SIZE = 80; // skip tiny icons/tracking pixels below this px dimension

const scanBtn = document.getElementById('scan-btn');
const boardSelect = document.getElementById('board-select');
const newBoardBtn = document.getElementById('new-board-btn');
const deleteBoardBtn = document.getElementById('delete-board-btn');
const notesInput = document.getElementById('notes-input');
const scanGrid = document.getElementById('scan-grid');
const boardGrid = document.getElementById('board-grid');
const scanPill = document.getElementById('scan-pill');
const boardPill = document.getElementById('board-pill');
const downloadBtn = document.getElementById('download-btn');

// state: { boards: [{ id, name, notes, items: [{ url, w, h, alt }] }], activeId }
let state = { boards: [], activeId: null };
let scanned = []; // [{ url, w, h, alt }] from the last scan
let notesTimer = null;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function activeBoard() {
  return state.boards.find((b) => b.id === state.activeId) || null;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (data[STORAGE_KEY] && Array.isArray(data[STORAGE_KEY].boards)) {
    state = data[STORAGE_KEY];
  } else {
    const first = { id: uid(), name: 'My first costume', notes: '', items: [] };
    state = { boards: [first], activeId: first.id };
    await save();
  }
  if (!activeBoard() && state.boards.length) state.activeId = state.boards[0].id;
}

async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

/* ---------- scanning (read-only, user-initiated) ---------- */
function scanPage() {
  // Runs in the page's isolated world via chrome.scripting. Collects only
  // images the page itself already loaded — no network calls of our own.
  const imgs = Array.from(document.querySelectorAll('img'));
  const seen = new Set();
  const out = [];
  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w < 80 || h < 80) continue; // skip icons / tracking pixels
    out.push({ url: src, w, h, alt: (img.alt || '').slice(0, 120) });
    if (out.length >= 120) break; // cap for popup performance
  }
  return out;
}

async function handleScan() {
  scanBtn.disabled = true;
  scanPill.textContent = 'scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPage
    });
    scanned = (results && results[0] && results[0].result) || [];
    scanPill.textContent = `${scanned.length} found`;
  } catch (e) {
    scanned = [];
    scanPill.textContent = 'unsupported page';
  }
  scanBtn.disabled = false;
  renderScan();
}

/* ---------- boards ---------- */
async function createBoard() {
  const name = prompt('Board name (e.g. "Zelda — Twilight Princess"):');
  if (!name || !name.trim()) return;
  const board = { id: uid(), name: name.trim().slice(0, 60), notes: '', items: [] };
  state.boards.push(board);
  state.activeId = board.id;
  await save();
  renderBoards();
}

async function deleteBoard() {
  const b = activeBoard();
  if (!b) return;
  if (!confirm(`Delete board "${b.name}" and its ${b.items.length} pinned image(s)?`)) return;
  state.boards = state.boards.filter((x) => x.id !== b.id);
  if (!state.boards.length) {
    const fresh = { id: uid(), name: 'My first costume', notes: '', items: [] };
    state.boards.push(fresh);
  }
  state.activeId = state.boards[0].id;
  await save();
  renderBoards();
}

async function pinImage(item) {
  const b = activeBoard();
  if (!b) return;
  if (b.items.some((x) => x.url === item.url)) return; // already pinned
  b.items.push({ url: item.url, w: item.w, h: item.h, alt: item.alt });
  await save();
  renderBoards();
  renderScan();
}

async function unpinImage(url) {
  const b = activeBoard();
  if (!b) return;
  b.items = b.items.filter((x) => x.url !== url);
  await save();
  renderBoards();
  renderScan();
}

function scheduleNotesSave() {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(async () => {
    const b = activeBoard();
    if (b) { b.notes = notesInput.value; await save(); }
  }, 400);
}

/* ---------- rendering ---------- */
function thumbHtml(item, pinned, action) {
  const dims = item.w && item.h ? `${item.w}×${item.h}` : '';
  const actionBtn = action === 'add'
    ? `<button class="add" title="Pin to board" aria-label="Pin to board"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>`
    : `<button class="remove" title="Remove" aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12h14"/></svg></button>`;
  return `
    <div class="thumb${pinned ? ' pinned' : ''}" data-url="${escapeHtml(item.url)}" title="${escapeHtml(item.alt || item.url)}">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt || 'reference image')}" loading="lazy" referrerpolicy="no-referrer">
      <div class="meta">${escapeHtml(dims)}</div>
      ${actionBtn}
    </div>`;
}

function renderScan() {
  const pinnedUrls = new Set((activeBoard() || { items: [] }).items.map((x) => x.url));
  if (!scanned.length) {
    scanGrid.innerHTML = `<div class="empty-note">Click “Scan tab” to list images on the current page.</div>`;
    return;
  }
  scanGrid.innerHTML = scanned
    .map((item) => thumbHtml(item, pinnedUrls.has(item.url), 'add'))
    .join('');
  scanGrid.querySelectorAll('.thumb').forEach((el) => {
    const item = scanned.find((x) => x.url === el.dataset.url);
    el.querySelector('.add').addEventListener('click', (e) => {
      e.stopPropagation();
      pinImage(item);
    });
    // Clicking the thumbnail itself also pins it (touch-friendly).
    el.addEventListener('click', () => pinImage(item));
  });
}

function renderBoards() {
  const b = activeBoard();
  boardSelect.innerHTML = state.boards
    .map((x) => `<option value="${escapeHtml(x.id)}"${x.id === state.activeId ? ' selected' : ''}>${escapeHtml(x.name)} (${x.items.length})</option>`)
    .join('');
  notesInput.value = b ? b.notes : '';
  boardPill.textContent = `${b ? b.items.length : 0} pinned`;

  if (!b || !b.items.length) {
    boardGrid.innerHTML = `<div class="empty-note">Pin images from the scan above to build this board.</div>`;
  } else {
    boardGrid.innerHTML = b.items
      .map((item) => thumbHtml(item, true, 'remove'))
      .join('');
    boardGrid.querySelectorAll('.thumb').forEach((el) => {
      el.querySelector('.remove').addEventListener('click', (e) => {
        e.stopPropagation();
        unpinImage(el.dataset.url);
      });
    });
  }
  renderScan(); // refresh pinned highlights
}

async function handleDownload() {
  const b = activeBoard();
  if (!b || !b.items.length) return;
  let ok = 0;
  for (const item of b.items) {
    try {
      // Only http(s) URLs can be downloaded by chrome.downloads; data: and
      // blob: URLs are skipped honestly rather than worked around.
      if (!/^https?:\/\//i.test(item.url)) continue;
      const name = `${b.name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'board'}_${ok + 1}.jpg`;
      await chrome.downloads.download({ url: item.url, filename: `moodboard/${name}` });
      ok++;
    } catch (e) { /* skip failures individually */ }
  }
  downloadBtn.textContent = ok ? `Queued ${ok} download${ok === 1 ? '' : 's'}` : 'Nothing downloadable';
  setTimeout(() => {
    downloadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download board images`;
  }, 1800);
}

/* ---------- events ---------- */
scanBtn.addEventListener('click', handleScan);
newBoardBtn.addEventListener('click', createBoard);
deleteBoardBtn.addEventListener('click', deleteBoard);
downloadBtn.addEventListener('click', handleDownload);
notesInput.addEventListener('input', scheduleNotesSave);
boardSelect.addEventListener('change', async () => {
  state.activeId = boardSelect.value;
  await save();
  renderBoards();
});

/* ---------- init ---------- */
(async function init() {
  await load();
  renderBoards();
})();
