/* VocalNote — popup controller.
 * Recording lives in an offscreen document (USER_MEDIA) so it survives the
 * popup closing. Notes (audio blobs + transcripts) live in IndexedDB.
 */
'use strict';

const recBtn = document.getElementById('recBtn');
const recLabel = document.getElementById('recLabel');
const timerEl = document.getElementById('timer');
const cancelBtn = document.getElementById('cancelBtn');
const titleInput = document.getElementById('titleInput');
const sttToggle = document.getElementById('sttToggle');
const liveEl = document.getElementById('liveTranscript');
const searchInput = document.getElementById('searchInput');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('emptyState');
const countBadge = document.getElementById('countBadge');
const toastEl = document.getElementById('toast');

let recording = false;
let notes = [];
let toastTimer = null;
const blobUrls = new Map();

/* ---------- helpers ---------- */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
const fmtDur = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const fmtDate = ts => new Date(ts).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
});
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Record voice notes with the microphone after the user presses Record.'
  });
}

async function loadSttPref() {
  const { stt = true } = await chrome.storage.local.get('stt');
  sttToggle.checked = !!stt;
}
async function saveSttPref() {
  await chrome.storage.local.set({ stt: sttToggle.checked });
}

/* ---------- recording ---------- */
async function startRecording() {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({
    type: 'VN_START', transcript: sttToggle.checked
  });
  if (!res || !res.ok) {
    toast(res && res.error === 'mic-denied'
      ? 'Microphone access denied'
      : 'Could not start recording');
    return;
  }
  recording = true;
  paintRecorder();
  if (!res.stt && sttToggle.checked) toast('Live transcription unavailable — audio only');
}

async function stopRecording() {
  const res = await chrome.runtime.sendMessage({
    type: 'VN_STOP', title: titleInput.value
  });
  recording = false;
  paintRecorder();
  if (res && res.ok) {
    titleInput.value = '';
    toast('Note saved');
    await refresh();
  }
}

async function cancelRecording() {
  await chrome.runtime.sendMessage({ type: 'VN_CANCEL' });
  recording = false;
  paintRecorder();
  toast('Recording discarded');
}

function paintRecorder() {
  recBtn.classList.toggle('recording', recording);
  recLabel.textContent = recording ? 'Stop' : 'Record';
  cancelBtn.hidden = !recording;
  timerEl.textContent = '0:00';
  liveEl.hidden = true;
  liveEl.textContent = '';
}

recBtn.addEventListener('click', () => recording ? stopRecording() : startRecording());
cancelBtn.addEventListener('click', cancelRecording);
sttToggle.addEventListener('change', saveSttPref);
titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') startRecording(); });

/* ---------- notes list ---------- */
async function refresh() {
  notes = (await NotesDB.all()).sort((a, b) => b.createdAt - a.createdAt);
  render();
}

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const visible = q
    ? notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (n.transcript || '').toLowerCase().includes(q))
    : notes;

  countBadge.textContent = notes.length;
  emptyEl.style.display = notes.length ? 'none' : 'flex';
  // Revoke stale object URLs.
  for (const [id, url] of blobUrls) {
    if (!visible.some(n => n.id === id)) { URL.revokeObjectURL(url); blobUrls.delete(id); }
  }
  listEl.innerHTML = '';

  for (const n of visible) {
    const card = document.createElement('div');
    card.className = 'note';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="note-head">
        <span class="note-title">${esc(n.title)}</span>
        <span class="note-meta">${fmtDate(n.createdAt)} · ${fmtDur(n.durationSec)}</span>
        <button class="icon-btn danger" data-act="del" title="Delete note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <audio controls preload="metadata"></audio>
      <textarea class="note-transcript" placeholder="No transcript — click to add one manually…">${esc(n.transcript || '')}</textarea>
      <div class="note-foot">
        <button class="mini-btn" data-act="audio">Download audio</button>
        <button class="mini-btn" data-act="txt">Export .txt</button>
        <button class="mini-btn" data-act="save">Save transcript</button>
      </div>`;

    const audioEl = card.querySelector('audio');
    let url = blobUrls.get(n.id);
    if (!url && n.audio) { url = URL.createObjectURL(n.audio); blobUrls.set(n.id, url); }
    if (url) audioEl.src = url;

    const ta = card.querySelector('.note-transcript');

    card.addEventListener('click', async ev => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'del') {
        if (!confirm('Delete this voice note?')) return;
        await NotesDB.del(n.id);
        if (blobUrls.has(n.id)) { URL.revokeObjectURL(blobUrls.get(n.id)); blobUrls.delete(n.id); }
        toast('Note deleted');
        await refresh();
      } else if (act === 'save') {
        n.transcript = ta.value.trim();
        await NotesDB.put(n);
        toast('Transcript saved');
      } else if (act === 'txt') {
        const text = `${n.title}\n${fmtDate(n.createdAt)} · ${fmtDur(n.durationSec)}\n\n${n.transcript || '(no transcript)'}\n`;
        download(n.title + '.txt', 'text/plain', text);
        toast('Exported .txt');
      } else if (act === 'audio') {
        if (!n.audio) { toast('No audio'); return; }
        const a = document.createElement('a');
        a.href = blobUrls.get(n.id);
        a.download = n.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.webm';
        a.click();
        toast('Audio downloading');
      }
    });
    listEl.appendChild(card);
  }
}

function download(filename, type, text) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/[^\w\-. ]+/g, '').trim() || 'note.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!notes.length) return;
  if (!confirm('Delete ALL voice notes? This cannot be undone.')) return;
  for (const [, url] of blobUrls) URL.revokeObjectURL(url);
  blobUrls.clear();
  await NotesDB.clear();
  toast('All notes deleted');
  await refresh();
});

searchInput.addEventListener('input', render);

/* ---------- live messages from offscreen ---------- */
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'VN_TICK') {
    timerEl.textContent = fmtDur(msg.elapsed);
  } else if (msg.type === 'VN_TRANSCRIPT') {
    liveEl.hidden = false;
    const combined = (msg.final + ' ' + msg.interim).trim();
    liveEl.textContent = combined || 'Listening…';
    liveEl.scrollTop = liveEl.scrollHeight;
  } else if (msg.type === 'VN_SAVED' || msg.type === 'VN_CANCELLED') {
    // Recording finished while the popup was closed — refresh if we reopen.
    recording = false;
    paintRecorder();
    refresh();
  }
});

/* ---------- init ---------- */
(async () => {
  await loadSttPref();
  try {
    const st = await chrome.runtime.sendMessage({ type: 'VN_STATUS' });
    recording = !!(st && st.recording);
  } catch { recording = false; }
  paintRecorder();
  await refresh();
})();
