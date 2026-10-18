/* Lecture Note Timestamps — manual timestamped lecture-notes logbook.
 * No audio access, no AI sync. Timestamps are captured from a live stopwatch
 * when the user presses "Add @ now". All state in chrome.storage.local. */

const $ = (id) => document.getElementById(id);
const store = {
  async get(keys) { try { return await chrome.storage.local.get(keys); } catch { return {}; } },
  async set(obj) { try { await chrome.storage.local.set(obj); } catch {} },
};

/* ---------- Time helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');
function fmtHMS(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function fmtMS(ms) { // short MM:SS used for note stamps
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/* ---------- Live session ---------- */
let session = null;   // { name, startedAt (wall ms), notes: [{t, text}] }
let tick = null;

function startSession() {
  const name = $('sessionName').value.trim() || 'Untitled lecture';
  session = { name, startedAt: Date.now(), notes: [] };
  $('liveName').textContent = name;
  $('liveBar').classList.remove('hidden');
  $('capture').classList.remove('hidden');
  tick = setInterval(() => { $('liveClock').textContent = fmtHMS(Date.now() - session.startedAt); }, 500);
  $('noteText').focus();
  renderTimeline();
}

function elapsed() { return session ? Date.now() - session.startedAt : 0; }

function stopSession() {
  if (!session) return;
  clearInterval(tick);
  // Archive into past sessions (only if it has notes or we keep empty too)
  store.get(['sessions']).then(({ sessions = [] }) => {
    sessions.unshift({ name: session.name, startedAt: session.startedAt, notes: session.notes });
    store.set({ sessions: sessions.slice(0, 30) }).then(renderSessions);
  });
  session = null;
  $('liveBar').classList.add('hidden');
  $('capture').classList.add('hidden');
  $('noteText').value = '';
  renderTimeline();
}

function addNote(text) {
  if (!session) return;
  const t = text.trim();
  if (!t) return;
  session.notes.push({ t: elapsed(), text: t });
  $('noteText').value = '';
  renderTimeline();
  $('timeline').scrollTop = $('timeline').scrollHeight;
}

function renderTimeline() {
  const box = $('timeline');
  const notes = session ? session.notes : [];
  if (!notes.length) {
    box.innerHTML = '<p class="empty">No notes yet. Start a session and add notes as the lecture plays.</p>';
    return;
  }
  box.innerHTML = '';
  notes.forEach((n, i) => {
    const row = document.createElement('div');
    row.className = 'note';
    const stamp = document.createElement('button');
    stamp.className = 'stamp';
    stamp.title = 'Copy timestamp';
    stamp.textContent = fmtMS(n.t);
    stamp.addEventListener('click', () => navigator.clipboard.writeText(fmtMS(n.t)));
    const txt = document.createElement('div');
    txt.className = 'ntxt';
    txt.textContent = n.text;
    const del = document.createElement('button');
    del.className = 'ndel';
    del.textContent = '×';
    del.title = 'Delete note';
    del.addEventListener('click', () => { session.notes.splice(i, 1); renderTimeline(); });
    row.append(stamp, txt, del);
    box.appendChild(row);
  });
}

/* ---------- Past sessions ---------- */
function renderSessions() {
  store.get(['sessions']).then(({ sessions = [] }) => {
    const box = $('sessions');
    if (!sessions.length) { box.innerHTML = '<p class="empty">None yet.</p>'; return; }
    box.innerHTML = '';
    sessions.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'sess';
      const nm = document.createElement('span'); nm.className = 'sname'; nm.textContent = s.name;
      const ct = document.createElement('span'); ct.className = 'scount';
      ct.textContent = `${s.notes.length} note${s.notes.length === 1 ? '' : 's'} · ${new Date(s.startedAt).toLocaleDateString()}`;
      const load = document.createElement('button'); load.className = 'sload'; load.textContent = 'View';
      load.addEventListener('click', () => {
        // Load as read-only snapshot in the timeline view
        const box2 = $('timeline');
        box2.innerHTML = s.notes.length ? '' : '<p class="empty">This session has no notes.</p>';
        s.notes.forEach((n) => {
          const row2 = document.createElement('div');
          row2.className = 'note';
          const stamp = document.createElement('span'); stamp.className = 'stamp'; stamp.textContent = fmtMS(n.t);
          const txt = document.createElement('div'); txt.className = 'ntxt'; txt.textContent = n.text;
          row2.append(stamp, txt);
          box2.appendChild(row2);
        });
      });
      const del = document.createElement('button'); del.className = 'ndel'; del.textContent = '×'; del.title = 'Delete session';
      del.addEventListener('click', () => {
        store.get(['sessions']).then(({ sessions: cur = [] }) => {
          cur.splice(i, 1);
          store.set({ sessions: cur }).then(renderSessions);
        });
      });
      row.append(nm, ct, load, del);
      box.appendChild(row);
    });
  });
}

/* ---------- Export ---------- */
function currentNotes() {
  return session ? { name: session.name, notes: session.notes } : null;
}
function toMarkdown({ name, notes }) {
  let md = `# ${name}\n\n_Exported ${new Date().toLocaleString()} — manual timestamps_\n\n`;
  if (!notes.length) md += '_No notes._\n';
  notes.forEach((n) => { md += `- **${fmtMS(n.t)}** — ${n.text}\n`; });
  return md;
}

$('exportBtn').addEventListener('click', () => {
  const cur = currentNotes();
  if (!cur || !cur.notes.length) return;
  const blob = new Blob([toMarkdown(cur)], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${cur.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'lecture'}-notes.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

$('copyBtn').addEventListener('click', () => {
  const cur = currentNotes();
  if (!cur || !cur.notes.length) return;
  navigator.clipboard.writeText(toMarkdown(cur));
});

$('clearBtn').addEventListener('click', () => {
  if (session) { session.notes = []; renderTimeline(); }
});

/* ---------- Wire up ---------- */
$('startBtn').addEventListener('click', startSession);
$('stopBtn').addEventListener('click', stopSession);
$('addBtn').addEventListener('click', () => addNote($('noteText').value));
$('noteText').addEventListener('keydown', (e) => { if (e.key === 'Enter') addNote($('noteText').value); });
document.querySelectorAll('.chip').forEach((c) =>
  c.addEventListener('click', () => addNote(`${c.dataset.q}: ${$('noteText').value.trim()}`.replace(/: $/, '')))
);
window.addEventListener('beforeunload', () => clearInterval(tick));

renderTimeline();
renderSessions();
