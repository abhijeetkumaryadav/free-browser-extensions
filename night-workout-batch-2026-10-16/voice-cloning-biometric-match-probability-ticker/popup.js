/* Voice Cloning Awareness — popup logic (fully local, zero network) */

// ===================== ENGINE-START =====================
const RED_FLAGS = [
  { id: 'f1', title: 'Overly flat emotional delivery', desc: 'Clone often nails the words but misses natural emotional inflection; the feeling does not match the message.' },
  { id: 'f2', title: 'Metallic or robotic sibilants', desc: '"S" and "sh" sounds that buzz, smear, or sound artificial compared with the rest of the voice.' },
  { id: 'f3', title: 'Unnatural pacing and pauses', desc: 'Evenly spaced words, pauses in odd places, or a rhythm that never varies like real speech.' },
  { id: 'f4', title: 'Timbre shifts mid-sentence', desc: 'The voice quality changes partway through — a sign of concatenated or re-synthesized segments.' },
  { id: 'f5', title: 'Background that cuts in and out', desc: 'Room tone or noise that appears and disappears unnaturally between phrases.' },
  { id: 'f6', title: 'Urgency plus secrecy', desc: 'The message pressures you to act fast and keep it secret — the classic scam wrapper around a cloned voice.' },
  { id: 'f7', title: 'No way to verify the caller', desc: 'Unknown number, no callback option, or resistance when you propose calling back on a known line.' },
  { id: 'f8', title: 'Details that do not add up', desc: 'Facts, names, or shared memories that are slightly wrong — the script knows the voice, not the life.' }
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
// ===================== ENGINE-END =====================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const STATE_KEY = 'vc_awareness_state';
let state = { notes: [] };

async function loadState() {
  try {
    const res = await chrome.storage.local.get(STATE_KEY);
    if (res[STATE_KEY]) state = { ...state, ...res[STATE_KEY] };
  } catch (e) {}
}

async function saveState() {
  try { await chrome.storage.local.set({ [STATE_KEY]: state }); } catch (e) {}
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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

function renderFlags() {
  const wrap = $('#flags');
  wrap.innerHTML = '';
  RED_FLAGS.forEach((f) => {
    const el = document.createElement('div');
    el.className = 'flag';
    el.innerHTML = `<span class="flag-dot"></span><span><b>${esc(f.title)}</b><span>${esc(f.desc)}</span></span>`;
    wrap.appendChild(el);
  });
}

function renderNotes() {
  const list = $('#notes-list');
  list.innerHTML = '';
  const notes = sortNotes(state.notes);
  $('#note-count').textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}`;
  if (!notes.length) {
    list.innerHTML = '<div class="empty">No notes yet. Save a verification habit or family code-word plan above.</div>';
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
    const note = makeNote($('#note-title').value, $('#note-body').value);
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
  renderFlags();
  await loadState();
  initNotes();
  renderNotes();
});
