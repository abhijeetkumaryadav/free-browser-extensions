/* NovelPress — Light Novel EPUB Formatter (popup logic)
   Chapters + book metadata live in chrome.storage.local. EPUB bytes are built
   by epub.js (pure) and downloaded via chrome.downloads. All on-device. */

'use strict';

/* global buildEpub, wordCount */

const STORE_KEY = 'novelpress_state_v1';

// --- DOM refs ---------------------------------------------------------------
const bookTitleEl = document.getElementById('book-title');
const bookAuthorEl = document.getElementById('book-author');
const chapterListEl = document.getElementById('chapter-list');
const chapterCountEl = document.getElementById('chapter-count');
const addChapterBtn = document.getElementById('add-chapter');
const editorEl = document.getElementById('editor');
const editorTitleEl = document.getElementById('editor-title');
const editorTextEl = document.getElementById('editor-text');
const editorWordsEl = document.getElementById('editor-words');
const moveUpBtn = document.getElementById('move-up');
const moveDownBtn = document.getElementById('move-down');
const deleteChapterBtn = document.getElementById('delete-chapter');
const doneEditingBtn = document.getElementById('done-editing');
const emptyEl = document.getElementById('empty');
const totalWordsEl = document.getElementById('total-words');
const exportBtn = document.getElementById('export-epub');
const statusEl = document.getElementById('status');

let state = { title: '', author: '', chapters: [] };
let activeId = null;
let saveTimer = null;

// --- Storage ----------------------------------------------------------------
async function loadState() {
  const data = await chrome.storage.local.get(STORE_KEY);
  if (data[STORE_KEY] && Array.isArray(data[STORE_KEY].chapters)) {
    state = data[STORE_KEY];
  }
}

function saveState() {
  // Debounced: typing in the editor shouldn't hammer storage.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ [STORE_KEY]: state });
  }, 400);
}

function saveStateNow() {
  clearTimeout(saveTimer);
  return chrome.storage.local.set({ [STORE_KEY]: state });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Helpers ----------------------------------------------------------------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function activeChapter() {
  return state.chapters.find(c => c.id === activeId) || null;
}

function fmtWords(n) {
  return n.toLocaleString('en-US') + (n === 1 ? ' word' : ' words');
}

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', !!isError);
  statusEl.classList.remove('hidden');
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => statusEl.classList.add('hidden'), 4000);
}

// --- Rendering ---------------------------------------------------------------
function renderList() {
  chapterCountEl.textContent = state.chapters.length > 0 ? `(${state.chapters.length})` : '';
  emptyEl.classList.toggle('hidden', state.chapters.length > 0);

  chapterListEl.innerHTML = state.chapters.map((c, i) => `
    <div class="chapter-row${c.id === activeId ? ' active' : ''}" data-id="${c.id}">
      <span class="chapter-num">${i + 1}</span>
      <span class="chapter-name">${esc(c.title || 'Untitled chapter')}</span>
      <span class="chapter-words">${fmtWords(wordCount(c.text))}</span>
    </div>`).join('');

  const total = state.chapters.reduce((n, c) => n + wordCount(c.text), 0);
  totalWordsEl.textContent = fmtWords(total) + ' total';
}

function renderEditor() {
  const c = activeChapter();
  if (!c) {
    editorEl.classList.add('hidden');
    return;
  }
  editorEl.classList.remove('hidden');
  if (document.activeElement !== editorTitleEl) editorTitleEl.value = c.title || '';
  if (document.activeElement !== editorTextEl) editorTextEl.value = c.text || '';
  editorWordsEl.textContent = fmtWords(wordCount(c.text));
}

function render() {
  renderList();
  renderEditor();
}

// --- Mutations ---------------------------------------------------------------
function addChapter() {
  const ch = {
    id: newId(),
    title: 'Chapter ' + (state.chapters.length + 1),
    text: ''
  };
  state.chapters.push(ch);
  activeId = ch.id;
  saveState();
  render();
  editorTitleEl.focus();
  editorTitleEl.select();
}

function selectChapter(id) {
  activeId = id;
  render();
}

function moveActive(delta) {
  const i = state.chapters.findIndex(c => c.id === activeId);
  if (i < 0) return;
  const j = i + delta;
  if (j < 0 || j >= state.chapters.length) return;
  const [ch] = state.chapters.splice(i, 1);
  state.chapters.splice(j, 0, ch);
  saveState();
  render();
}

async function deleteActive() {
  const i = state.chapters.findIndex(c => c.id === activeId);
  if (i < 0) return;
  state.chapters.splice(i, 1);
  activeId = state.chapters.length > 0
    ? state.chapters[Math.min(i, state.chapters.length - 1)].id
    : null;
  await saveStateNow();
  render();
}

// --- EPUB export -------------------------------------------------------------
function slugify(s) {
  return String(s || 'novel').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'novel';
}

async function exportEpub() {
  const withText = state.chapters.filter(c => String(c.text || '').trim().length > 0);
  if (withText.length === 0) {
    showStatus('Add at least one chapter with text before exporting.', true);
    return;
  }
  let bytes;
  try {
    bytes = buildEpub({
      title: state.title,
      author: state.author,
      chapters: state.chapters
    });
  } catch (e) {
    showStatus('Could not build EPUB: ' + e.message, true);
    return;
  }

  const blob = new Blob([bytes], { type: 'application/epub+zip' });
  const url = URL.createObjectURL(blob);
  const filename = slugify(state.title || 'novel') + '.epub';
  try {
    await chrome.downloads.download({ url, filename, saveAs: false });
    showStatus(`Exported ${withText.length} chapter${withText.length === 1 ? '' : 's'} → ${filename}`);
  } catch (e) {
    showStatus('Download failed: ' + e.message, true);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

// --- Events ------------------------------------------------------------------
bookTitleEl.addEventListener('input', () => { state.title = bookTitleEl.value; saveState(); });
bookAuthorEl.addEventListener('input', () => { state.author = bookAuthorEl.value; saveState(); });

addChapterBtn.addEventListener('click', addChapter);

chapterListEl.addEventListener('click', (e) => {
  const row = e.target.closest('.chapter-row');
  if (row) selectChapter(row.dataset.id);
});

editorTitleEl.addEventListener('input', () => {
  const c = activeChapter();
  if (!c) return;
  c.title = editorTitleEl.value;
  saveState();
  renderList(); // keep the row name in sync
});

editorTextEl.addEventListener('input', () => {
  const c = activeChapter();
  if (!c) return;
  c.text = editorTextEl.value;
  editorWordsEl.textContent = fmtWords(wordCount(c.text));
  saveState();
  renderList();
});

moveUpBtn.addEventListener('click', () => moveActive(-1));
moveDownBtn.addEventListener('click', () => moveActive(1));
deleteChapterBtn.addEventListener('click', deleteActive);
doneEditingBtn.addEventListener('click', () => { activeId = null; render(); });

exportBtn.addEventListener('click', exportEpub);

// Persist immediately when the popup closes mid-typing.
window.addEventListener('pagehide', () => { saveStateNow(); });

// --- Init --------------------------------------------------------------------
(async function init() {
  await loadState();
  bookTitleEl.value = state.title || '';
  bookAuthorEl.value = state.author || '';
  render();
})();
