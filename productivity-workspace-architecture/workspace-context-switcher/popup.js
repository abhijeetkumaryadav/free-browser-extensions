/* Workspace Context Switcher — popup logic.
 * Workspaces are stored in chrome.storage.local as:
 *   [{ id, name, createdAt, tabs: [{ url, title, pinned }] }]
 * Only http(s) pages are saved — browser-internal pages (chrome://, about:)
 * cannot be reopened programmatically, so they are skipped on save. */
'use strict';

const $ = (id) => document.getElementById(id);

/* ---------- storage helpers ---------- */
async function getWorkspaces() {
  const { workspaces = [] } = await chrome.storage.local.get('workspaces');
  return Array.isArray(workspaces) ? workspaces : [];
}
async function setWorkspaces(ws) {
  await chrome.storage.local.set({ workspaces: ws });
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Escape HTML so workspace names render as text, not markup. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ---------- render ---------- */
async function render() {
  const ws = await getWorkspaces();
  const list = $('wsList');
  list.innerHTML = '';
  $('wsCount').textContent = ws.length;
  $('empty').classList.toggle('hidden', ws.length > 0);

  for (const w of ws) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <span class="card-name" title="${esc(w.name)}">${esc(w.name)}</span>
        <span class="card-actions">
          <button class="btn icon" data-act="rename" title="Rename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn icon danger" data-act="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </span>
      </div>
      <div class="card-meta">${w.tabs.length} tab${w.tabs.length === 1 ? '' : 's'} &middot; saved ${fmtDate(w.createdAt)}</div>
      <button class="btn primary open-btn" data-act="open">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>
        Open workspace
      </button>`;
    card.addEventListener('click', (e) => onCardClick(e, w.id, card));
    list.appendChild(card);
  }
}

async function onCardClick(e, id, card) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'open') await openWorkspace(id);
  else if (act === 'delete') await deleteWorkspace(id, btn);
  else if (act === 'rename') startRename(id, card);
}

/* ---------- actions ---------- */

/** Snapshot the current window's openable tabs as a new workspace. */
async function saveCurrent() {
  const hint = $('saveHint');
  const nameInput = $('wsName');
  const name = nameInput.value.trim();

  if (!name) {
    hint.textContent = 'Give the workspace a name first.';
    hint.className = 'hint warn';
    nameInput.focus();
    return;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const openable = tabs
    .filter((t) => t.url && /^https?:\/\//i.test(t.url))
    .map((t) => ({ url: t.url, title: t.title || t.url, pinned: !!t.pinned }));

  if (!openable.length) {
    hint.textContent = 'No web pages in this window to save.';
    hint.className = 'hint warn';
    return;
  }

  const ws = await getWorkspaces();
  ws.unshift({ id: uid(), name, createdAt: Date.now(), tabs: openable });
  await setWorkspaces(ws);

  nameInput.value = '';
  hint.textContent = `Saved "${name}" with ${openable.length} tab${openable.length === 1 ? '' : 's'}.`;
  hint.className = 'hint ok';
  await render();
}

/** Open a workspace's tabs in a fresh window. */
async function openWorkspace(id) {
  const ws = await getWorkspaces();
  const w = ws.find((x) => x.id === id);
  if (!w || !w.tabs.length) return;
  await chrome.windows.create({ url: w.tabs.map((t) => t.url), focused: true });
}

/** Two-step delete: first click arms, second click confirms. */
async function deleteWorkspace(id, btn) {
  if (!btn.classList.contains('confirm')) {
    btn.classList.add('confirm');
    btn.title = 'Click again to confirm';
    setTimeout(() => { btn.classList.remove('confirm'); btn.title = 'Delete'; }, 3000);
    return;
  }
  const ws = (await getWorkspaces()).filter((x) => x.id !== id);
  await setWorkspaces(ws);
  await render();
}

/** Inline rename: swap the name label for an input, commit on Enter/blur. */
function startRename(id, card) {
  const label = card.querySelector('.card-name');
  const input = document.createElement('input');
  input.className = 'card-name-input';
  input.value = label.textContent;
  input.maxLength = 60;
  label.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const commit = async (save) => {
    if (done) return;
    done = true;
    const val = input.value.trim();
    if (save && val) {
      const ws = await getWorkspaces();
      const w = ws.find((x) => x.id === id);
      if (w) { w.name = val; await setWorkspaces(ws); }
    }
    await render();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit(true);
    else if (e.key === 'Escape') commit(false);
    e.stopPropagation();
  });
  input.addEventListener('blur', () => commit(true));
  input.addEventListener('click', (e) => e.stopPropagation());
}

/** Export all workspaces as a JSON download. */
async function exportAll() {
  const ws = await getWorkspaces();
  const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'workspaces-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Import workspaces from a JSON file; merges, skipping duplicate ids. */
function importFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('bad shape');
      const valid = data.filter(
        (w) => w && typeof w.name === 'string' && Array.isArray(w.tabs)
      ).map((w) => ({
        id: typeof w.id === 'string' ? w.id : uid(),
        name: w.name.slice(0, 60),
        createdAt: typeof w.createdAt === 'number' ? w.createdAt : Date.now(),
        tabs: w.tabs
          .filter((t) => t && typeof t.url === 'string' && /^https?:\/\//i.test(t.url))
          .map((t) => ({ url: t.url, title: String(t.title || t.url), pinned: !!t.pinned }))
      }));
      const ws = await getWorkspaces();
      const known = new Set(ws.map((w) => w.id));
      const merged = [...valid.filter((w) => !known.has(w.id)), ...ws];
      await setWorkspaces(merged);
      const hint = $('saveHint');
      hint.textContent = `Imported ${valid.length} workspace${valid.length === 1 ? '' : 's'}.`;
      hint.className = 'hint ok';
      await render();
    } catch {
      const hint = $('saveHint');
      hint.textContent = 'That file is not a valid workspaces backup.';
      hint.className = 'hint warn';
    }
  };
  reader.readAsText(file);
}

/* ---------- init ---------- */
$('saveBtn').addEventListener('click', saveCurrent);
$('wsName').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCurrent(); });
$('exportBtn').addEventListener('click', exportAll);
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
  if (e.target.files[0]) importFile(e.target.files[0]);
  e.target.value = '';
});
render();
