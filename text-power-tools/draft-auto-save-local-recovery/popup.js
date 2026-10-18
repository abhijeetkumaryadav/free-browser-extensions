// DraftVault — local draft autosave + crash recovery.
// Everything lives in chrome.storage.local. No network, no accounts.

'use strict';

const AUTOSAVE_DELAY = 1200; // ms after last keystroke
const els = {};
let drafts = [];        // [{id, title, body, updatedAt}]
let currentId = null;   // draft being edited
let saveTimer = null;

function uid() {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Toast / status ----------

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function setStatus(mode, text) {
  els.saveStatus.className = 'status ' + mode;
  els.saveStatus.textContent = text;
}

function updateMeta() {
  const body = els.draftBody.value;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  els.wordCount.textContent = words + (words === 1 ? ' word' : ' words');
}

// ---------- Persistence ----------

async function load() {
  const data = await chrome.storage.local.get({ drafts: [], currentId: null });
  drafts = Array.isArray(data.drafts) ? data.drafts : [];
  currentId = data.currentId;
  // Sort newest first for display; current draft stays selected.
  drafts.sort((a, b) => b.updatedAt - a.updatedAt);

  if (!drafts.length) {
    // First run: create a welcome draft so autosave has somewhere to go.
    const d = { id: uid(), title: '', body: '', updatedAt: Date.now() };
    drafts.push(d);
    currentId = d.id;
  } else if (!drafts.some(d => d.id === currentId)) {
    currentId = drafts[0].id; // recovered: pick the most recent draft
  }

  const cur = getCurrent();
  els.draftTitle.value = cur.title || '';
  els.draftBody.value = cur.body || '';
  els.lastSaved.textContent = cur.body || cur.title
    ? 'Recovered · saved ' + timeAgo(cur.updatedAt)
    : 'Not saved yet';
  setStatus('saved', 'recovered');
  renderList();
  updateMeta();
}

async function persist() {
  await chrome.storage.local.set({ drafts, currentId });
}

function getCurrent() {
  return drafts.find(d => d.id === currentId) || drafts[0];
}

// ---------- Autosave ----------

function scheduleSave() {
  setStatus('saving', 'typing…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, AUTOSAVE_DELAY);
}

async function saveNow() {
  const cur = getCurrent();
  if (!cur) return;
  cur.title = els.draftTitle.value.trim();
  cur.body = els.draftBody.value;
  cur.updatedAt = Date.now();
  await persist();
  drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  els.lastSaved.textContent = 'Saved ' + new Date(cur.updatedAt).toLocaleTimeString();
  setStatus('saved', 'saved');
  renderList();
  updateMeta();
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ---------- Draft list ----------

function renderList() {
  els.draftList.innerHTML = '';
  els.draftEmpty.style.display = drafts.length ? 'none' : 'block';
  drafts.forEach(d => {
    const words = d.body.trim() ? d.body.trim().split(/\s+/).length : 0;
    const row = document.createElement('div');
    row.className = 'draft-item' + (d.id === currentId ? ' active' : '');
    const label = d.title || d.body.split('\n')[0].slice(0, 40) || 'Untitled draft';
    row.innerHTML =
      '<div class="draft-info">' +
        '<div class="draft-title">' + esc(label) + '</div>' +
        '<div class="draft-meta">' + timeAgo(d.updatedAt) + ' · ' + words +
          (words === 1 ? ' word' : ' words') + '</div>' +
      '</div>' +
      '<button class="draft-del" title="Delete draft">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>';
    row.querySelector('.draft-info').addEventListener('click', async () => {
      await saveNow(); // flush current edits before switching
      currentId = d.id;
      const sel = getCurrent();
      els.draftTitle.value = sel.title || '';
      els.draftBody.value = sel.body || '';
      await persist();
      renderList();
      updateMeta();
      els.lastSaved.textContent = sel.body ? 'Saved ' + timeAgo(sel.updatedAt) : 'Not saved yet';
      toast('Draft opened');
    });
    row.querySelector('.draft-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this draft?')) return;
      drafts = drafts.filter(x => x.id !== d.id);
      if (currentId === d.id) {
        if (!drafts.length) {
          const fresh = { id: uid(), title: '', body: '', updatedAt: Date.now() };
          drafts.push(fresh);
        }
        currentId = drafts[0].id;
        const sel = getCurrent();
        els.draftTitle.value = sel.title || '';
        els.draftBody.value = sel.body || '';
      }
      await persist();
      renderList();
      updateMeta();
      toast('Draft deleted');
    });
    els.draftList.appendChild(row);
  });
}

// ---------- Actions ----------

async function newDraft() {
  await saveNow();
  const d = { id: uid(), title: '', body: '', updatedAt: Date.now() };
  drafts.unshift(d);
  currentId = d.id;
  els.draftTitle.value = '';
  els.draftBody.value = '';
  els.lastSaved.textContent = 'Not saved yet';
  await persist();
  renderList();
  updateMeta();
  els.draftTitle.focus();
  toast('New draft');
}

function exportDraft() {
  const cur = getCurrent();
  const title = cur.title || 'draft';
  const blob = new Blob([cur.body || ''], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'draft';
  a.download += '.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Exported as .txt');
}

async function clearAll() {
  if (!confirm('Delete ALL drafts? This cannot be undone.')) return;
  const fresh = { id: uid(), title: '', body: '', updatedAt: Date.now() };
  drafts = [fresh];
  currentId = fresh.id;
  els.draftTitle.value = '';
  els.draftBody.value = '';
  els.lastSaved.textContent = 'Not saved yet';
  await persist();
  renderList();
  updateMeta();
  toast('All drafts deleted');
}

// ---------- Init ----------

function init() {
  ['draftTitle','draftBody','wordCount','lastSaved','newDraftBtn','exportBtn',
   'draftList','draftEmpty','clearAllBtn','saveStatus','toast']
    .forEach(id => { els[id] = document.getElementById(id); });

  els.draftTitle.addEventListener('input', scheduleSave);
  els.draftBody.addEventListener('input', scheduleSave);
  els.newDraftBtn.addEventListener('click', newDraft);
  els.exportBtn.addEventListener('click', exportDraft);
  els.clearAllBtn.addEventListener('click', clearAll);

  // Flush a pending autosave if the popup closes mid-typing.
  window.addEventListener('beforeunload', () => {
    const cur = getCurrent();
    if (cur) {
      cur.title = els.draftTitle.value.trim();
      cur.body = els.draftBody.value;
      cur.updatedAt = Date.now();
      chrome.storage.local.set({ drafts, currentId });
    }
  });

  load();
}

document.addEventListener('DOMContentLoaded', init);
