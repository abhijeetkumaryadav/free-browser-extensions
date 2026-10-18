/* Sponsor Read Time Tracker — popup logic
 * Manual per-sponsor timer. Running timer persists via a timestamp in storage,
 * so it keeps counting while the popup is closed. All data stays on-device. */

'use strict';

const ACCENT = '#f59e0b';

/* ---------- storage helpers ---------- */
async function loadState() {
  const { sponsors = [], sessions = [], active = null } = await chrome.storage.local.get(['sponsors', 'sessions', 'active']);
  return { sponsors, sessions, active };
}
async function saveState(patch) {
  await chrome.storage.local.set(patch);
}

/* ---------- formatting ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function fmtHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function fmtShort(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}
function fmtDate(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function totalsBySponsor(sponsors, sessions) {
  const map = {};
  for (const sp of sponsors) map[sp.id] = 0;
  for (const se of sessions) if (map[se.sponsorId] !== undefined) map[se.sponsorId] += se.seconds;
  return map;
}

/* ---------- rendering ---------- */
let tickInterval = null;

function renderTimer(active) {
  const card = document.getElementById('activeCard');
  if (!active) {
    card.hidden = true;
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    return;
  }
  card.hidden = false;
  document.getElementById('activeSponsor').textContent = active.sponsorName;
  const update = () => {
    const elapsed = Math.floor((Date.now() - active.startedAt) / 1000);
    document.getElementById('timerDisplay').textContent = fmtHMS(elapsed);
  };
  update();
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(update, 1000);
}

function sponsorNameById(sponsors, id) {
  const sp = sponsors.find(s => s.id === id);
  return sp ? sp.name : 'Deleted sponsor';
}

function renderSponsors(sponsors, sessions, active) {
  const list = document.getElementById('sponsorList');
  const totals = totalsBySponsor(sponsors, sessions);
  if (sponsors.length === 0) {
    list.innerHTML = '<div class="empty">No sponsors yet — add one above.</div>';
    return;
  }
  list.innerHTML = '';
  for (const sp of sponsors) {
    const row = document.createElement('div');
    row.className = 'sponsor-row' + (active && active.sponsorId === sp.id ? ' running' : '');
    const name = document.createElement('span');
    name.className = 'sponsor-name';
    name.textContent = sp.name;
    const total = document.createElement('span');
    total.className = 'sponsor-total';
    total.textContent = fmtShort(totals[sp.id] || 0) + ' total';
    row.append(name, total);
    if (active && active.sponsorId === sp.id) {
      const live = document.createElement('span');
      live.className = 'sponsor-total';
      live.textContent = '● running';
      live.style.color = ACCENT;
      row.appendChild(live);
    } else if (!active) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-mini';
      btn.textContent = 'Start';
      btn.addEventListener('click', () => startTimer(sp));
      row.appendChild(btn);
    }
    const del = document.createElement('button');
    del.className = 'btn btn-del';
    del.title = 'Delete sponsor (keeps logged sessions)';
    del.textContent = '✕';
    del.addEventListener('click', () => deleteSponsor(sp.id));
    row.appendChild(del);
    list.appendChild(row);
  }
}

function renderSessions(sponsors, sessions) {
  const list = document.getElementById('sessionList');
  const sorted = [...sessions].sort((a, b) => b.endedAt - a.endedAt).slice(0, 30);
  if (sorted.length === 0) {
    list.innerHTML = '<div class="empty">No sessions logged yet.</div>';
    return;
  }
  list.innerHTML = '';
  for (const se of sorted) {
    const row = document.createElement('div');
    row.className = 'session-row';
    const top = document.createElement('div');
    top.className = 'session-top';
    const nm = document.createElement('span');
    nm.className = 'session-sponsor';
    nm.textContent = sponsorNameById(sponsors, se.sponsorId);
    const tm = document.createElement('span');
    tm.className = 'session-time';
    tm.textContent = fmtHMS(se.seconds);
    top.append(nm, tm);
    row.appendChild(top);
    if (se.note) {
      const note = document.createElement('div');
      note.className = 'session-note';
      note.textContent = se.note;
      row.appendChild(note);
    }
    const date = document.createElement('div');
    date.className = 'session-date';
    date.textContent = fmtDate(se.endedAt);
    row.appendChild(date);
    list.appendChild(row);
  }
}

/* ---------- actions ---------- */
async function startTimer(sponsor) {
  const { active } = await loadState();
  if (active) return; // one timer at a time
  await saveState({ active: { sponsorId: sponsor.id, sponsorName: sponsor.name, startedAt: Date.now() } });
  document.getElementById('sessionNote').value = '';
  await refresh();
}

async function stopTimer() {
  const { sessions, active } = await loadState();
  if (!active) return;
  const seconds = Math.max(1, Math.floor((Date.now() - active.startedAt) / 1000));
  const note = document.getElementById('sessionNote').value.trim();
  const entry = {
    id: 'se_' + Date.now(),
    sponsorId: active.sponsorId,
    startedAt: active.startedAt,
    endedAt: Date.now(),
    seconds,
    note
  };
  await saveState({ sessions: [...sessions, entry], active: null });
  await refresh();
}

async function addSponsor() {
  const input = document.getElementById('sponsorName');
  const name = input.value.trim();
  if (!name) return;
  const { sponsors } = await loadState();
  sponsors.push({ id: 'sp_' + Date.now(), name });
  await saveState({ sponsors });
  input.value = '';
  await refresh();
}

async function deleteSponsor(id) {
  if (!confirm('Delete this sponsor? Logged sessions are kept.')) return;
  const { sponsors, active } = await loadState();
  if (active && active.sponsorId === id) {
    alert('Stop the running timer before deleting its sponsor.');
    return;
  }
  await saveState({ sponsors: sponsors.filter(s => s.id !== id) });
  await refresh();
}

async function exportCSV() {
  const { sponsors, sessions } = await loadState();
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['sponsor,started_at,ended_at,duration_seconds,duration_hms,note'];
  for (const se of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    lines.push([
      esc(sponsorNameById(sponsors, se.sponsorId)),
      esc(new Date(se.startedAt).toISOString()),
      esc(new Date(se.endedAt).toISOString()),
      se.seconds,
      esc(fmtHMS(se.seconds)),
      esc(se.note)
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sponsor-time-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function refresh() {
  const { sponsors, sessions, active } = await loadState();
  renderTimer(active);
  renderSponsors(sponsors, sessions, active);
  renderSessions(sponsors, sessions);
}

/* ---------- init ---------- */
document.getElementById('addSponsorBtn').addEventListener('click', addSponsor);
document.getElementById('sponsorName').addEventListener('keydown', e => { if (e.key === 'Enter') addSponsor(); });
document.getElementById('stopBtn').addEventListener('click', stopTimer);
document.getElementById('exportBtn').addEventListener('click', exportCSV);
refresh();
