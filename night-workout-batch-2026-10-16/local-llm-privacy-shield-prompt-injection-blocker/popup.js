/* Prompt Injection Awareness — popup logic (fully local, zero network) */

// ===================== ENGINE-START =====================
const CHECKLIST_ITEMS = [
  { id: 'c1', title: 'Least-privilege data access', desc: 'Give AI tools only the files, inboxes, and accounts they truly need.' },
  { id: 'c2', title: 'Human confirmation for actions', desc: 'Require approval before the model sends, deletes, pays, or executes.' },
  { id: 'c3', title: 'Delimit untrusted content', desc: 'Wrap web pages, files, and emails in markers; tell the model it is data, not instructions.' },
  { id: 'c4', title: 'No secrets in prompts', desc: 'Never paste API keys, passwords, or private data into prompt text or shared chats.' },
  { id: 'c5', title: 'Validate model output', desc: 'Do not paste model output into terminals, admin panels, or payment forms unchecked.' },
  { id: 'c6', title: 'Watch for instruction smuggling', desc: 'Treat quoted "system messages" or fake tool outputs in content as suspicious.' },
  { id: 'c7', title: 'Separate duties', desc: 'Use one assistant for drafting and a human review before anything is published or sent.' },
  { id: 'c8', title: 'Log and review tool calls', desc: 'Keep an eye on what the assistant actually did — history beats hope.' }
];

function noteId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Build a note entry; returns null when invalid.
function makeNote(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t && !b) return null;
  if (t.length > 80 || b.length > 2000) return null;
  return { id: noteId(), title: t || '(untitled)', body: b, createdAt: Date.now() };
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => b.createdAt - a.createdAt);
}

function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
         d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function checklistProgress(checked) {
  return { done: checked.length, total: CHECKLIST_ITEMS.length };
}
// ===================== ENGINE-END =====================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const STATE_KEY = 'pi_shield_state';
let state = { checked: [], notes: [] };

async function loadState() {
  try {
    const res = await chrome.storage.local.get(STATE_KEY);
    if (res[STATE_KEY]) state = { ...state, ...res[STATE_KEY] };
  } catch (e) { /* storage unavailable; run with in-memory state */ }
}

async function saveState() {
  try { await chrome.storage.local.set({ [STATE_KEY]: state }); } catch (e) {}
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- tabs ----
function initTabs() {
  $$('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tabs button').forEach((b) => b.classList.remove('active'));
      $$('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('#tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ---- checklist ----
function renderChecklist() {
  const wrap = $('#checklist');
  wrap.innerHTML = '';
  CHECKLIST_ITEMS.forEach((item) => {
    const done = state.checked.includes(item.id);
    const label = document.createElement('label');
    label.className = 'check-item' + (done ? ' done' : '');
    label.innerHTML = `<input type="checkbox" data-id="${item.id}" ${done ? 'checked' : ''}>
      <span class="check-text"><b>${esc(item.title)}</b><span>${esc(item.desc)}</span></span>`;
    label.querySelector('input').addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) { if (!state.checked.includes(id)) state.checked.push(id); }
      else { state.checked = state.checked.filter((x) => x !== id); }
      await saveState();
      renderChecklist();
    });
    wrap.appendChild(label);
  });
  const p = checklistProgress(state.checked);
  $('#check-count').textContent = `${p.done} / ${p.total}`;
  $('#check-progress').style.width = (p.total ? (p.done / p.total) * 100 : 0) + '%';
}

// ---- notes ----
function renderNotes() {
  const list = $('#notes-list');
  list.innerHTML = '';
  const notes = sortNotes(state.notes);
  $('#note-count').textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}`;
  if (!notes.length) {
    list.innerHTML = '<div class="empty">No notes yet. Save a safe-prompting habit or lesson above.</div>';
    return;
  }
  notes.forEach((n) => {
    const el = document.createElement('div');
    el.className = 'note';
    el.innerHTML = `<div class="note-head">
        <span class="note-title">${esc(n.title)}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="note-date">${esc(fmtWhen(n.createdAt))}</span>
          <button class="icon-btn" title="Delete note">✕</button>
        </span>
      </div>
      <div class="note-body">${esc(n.body)}</div>`;
    el.querySelector('.icon-btn').addEventListener('click', async () => {
      state.notes = state.notes.filter((x) => x.id !== n.id);
      await saveState();
      renderNotes();
    });
    list.appendChild(el);
  });
}

function initNotes() {
  $('#add-note').addEventListener('click', async () => {
    const title = $('#note-title').value;
    const body = $('#note-body').value;
    const note = makeNote(title, body);
    if (!note) return;
    state.notes.push(note);
    $('#note-title').value = '';
    $('#note-body').value = '';
    await saveState();
    renderNotes();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadState();
  renderChecklist();
  initNotes();
  renderNotes();
});
