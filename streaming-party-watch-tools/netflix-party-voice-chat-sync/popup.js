// PartySync popup — manual watch-party coordination, all local in chrome.storage.
'use strict';

let parties = [];       // [{id, name, notes:[{id,text}], stamps:[{id,time,label}]}]
let currentId = null;
let timer = null;

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

async function load() {
  const s = await chrome.storage.local.get(['parties', 'currentId']);
  parties = s.parties || [];
  currentId = s.currentId || (parties[0] && parties[0].id) || null;
  if (!parties.length) {
    const p = { id: uid(), name: 'Friday Movie Night', notes: [], stamps: [] };
    parties.push(p);
    currentId = p.id;
    await save();
  }
}
async function save() {
  await chrome.storage.local.set({ parties, currentId });
}
function current() {
  return parties.find(p => p.id === currentId) || parties[0];
}
const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderParties() {
  const sel = $('partySelect');
  sel.innerHTML = parties.map(p => `<option value="${p.id}"${p.id === currentId ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
}

function renderLists() {
  const p = current();
  if (!p) return;
  $('noteList').innerHTML = p.notes.length
    ? p.notes.map(n => `<li><span>${esc(n.text)}</span><button data-note="${n.id}" title="Delete">×</button></li>`).join('')
    : '<li class="empty">No notes yet.</li>';
  $('tsList').innerHTML = p.stamps.length
    ? p.stamps.map(t => `<li><span><span class="ts">${esc(t.time)}</span>${esc(t.label)}</span><button data-ts="${t.id}" title="Delete">×</button></li>`).join('')
    : '<li class="empty">No timestamps logged.</li>';
  $('noteList').querySelectorAll('[data-note]').forEach(b => b.addEventListener('click', async () => {
    p.notes = p.notes.filter(n => n.id !== b.dataset.note);
    await save(); renderLists();
  }));
  $('tsList').querySelectorAll('[data-ts]').forEach(b => b.addEventListener('click', async () => {
    p.stamps = p.stamps.filter(t => t.id !== b.dataset.ts);
    await save(); renderLists();
  }));
}

// --- Countdown ---
function stopCountdown(silent) {
  if (timer) { clearInterval(timer); timer = null; }
  if (!silent) { $('countdownDisplay').textContent = 'Ready'; $('countdownDisplay').classList.remove('go'); }
}
function startCountdown() {
  stopCountdown(true);
  let n = +$('countFrom').value;
  const disp = $('countdownDisplay');
  disp.classList.remove('go');
  disp.textContent = n;
  timer = setInterval(() => {
    n -= 1;
    if (n > 0) {
      disp.textContent = n;
    } else {
      clearInterval(timer); timer = null;
      disp.textContent = 'PLAY ▶';
      disp.classList.add('go');
    }
  }, 1000);
}

// --- Invite text ---
async function copyInvite() {
  const p = current();
  const text = `🎬 ${p ? p.name : 'Watch party'}\n` +
    `Everyone open the same video, then press play together on the countdown.\n` +
    `(Coordinated with PartySync — manual countdown, press play on "PLAY ▶".)`;
  try {
    await navigator.clipboard.writeText(text);
    $('copyInviteBtn').textContent = 'Copied!';
    setTimeout(() => { $('copyInviteBtn').innerHTML = 'Copy invite text'; }, 1500);
  } catch (e) {
    $('copyInviteBtn').textContent = 'Copy failed — clipboard blocked';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  renderParties();
  renderLists();

  $('partySelect').addEventListener('change', async (e) => {
    currentId = e.target.value;
    await save(); renderLists();
  });
  $('newPartyBtn').addEventListener('click', () => {
    $('newPartyRow').hidden = !$('newPartyRow').hidden;
    $('newPartyName').focus();
  });
  $('createPartyBtn').addEventListener('click', async () => {
    const name = $('newPartyName').value.trim();
    if (!name) return;
    const p = { id: uid(), name, notes: [], stamps: [] };
    parties.push(p); currentId = p.id;
    $('newPartyName').value = '';
    $('newPartyRow').hidden = true;
    await save(); renderParties(); renderLists();
  });
  $('deletePartyBtn').addEventListener('click', async () => {
    if (parties.length <= 1) return;
    parties = parties.filter(p => p.id !== currentId);
    currentId = parties[0].id;
    await save(); renderParties(); renderLists();
  });

  $('startCountBtn').addEventListener('click', startCountdown);
  $('stopCountBtn').addEventListener('click', () => stopCountdown(false));
  $('copyInviteBtn').addEventListener('click', copyInvite);

  $('addNoteBtn').addEventListener('click', async () => {
    const text = $('noteInput').value.trim();
    if (!text) return;
    current().notes.push({ id: uid(), text });
    $('noteInput').value = '';
    await save(); renderLists();
  });
  $('noteInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('addNoteBtn').click(); });

  $('addTsBtn').addEventListener('click', async () => {
    const label = $('tsLabel').value.trim() || 'Moment';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    current().stamps.push({ id: uid(), time, label });
    $('tsLabel').value = '';
    await save(); renderLists();
  });
});
