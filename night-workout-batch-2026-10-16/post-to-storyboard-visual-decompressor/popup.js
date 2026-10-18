// Storyboard Decompressor — popup logic.
// Frame CRUD + reordering, local persistence, outline/JSON export.

'use strict';

// ---- constants -----------------------------------------------------------
const TYPES = ['hook', 'beat', 'cta', 'note'];
const TYPE_LABEL = { hook: 'Hook', beat: 'Beat', cta: 'CTA', note: 'Note' };
const STORAGE_KEY = 'sbdBoard';

// ---- state ---------------------------------------------------------------
let board = { title: '', frames: [] }; // frames: [{id, type, shot, notes, secs}]

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

function setStatus(msg) {
  $('status').textContent = msg;
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => { $('status').textContent = ''; }, 2500);
}

// ---- persistence ---------------------------------------------------------
async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (data[STORAGE_KEY]) board = data[STORAGE_KEY];
}

async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: board });
}

// ---- rendering -----------------------------------------------------------
function icon(path) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
const ICON_UP = icon('<path d="M18 15l-6-6-6 6"/>');
const ICON_DOWN = icon('<path d="M6 9l6 6 6-6"/>');
const ICON_X = icon('<path d="M18 6L6 18M6 6l12 12"/>');

function render() {
  const list = $('frames');
  list.innerHTML = '';

  if (!board.frames.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No frames yet. Pick a type and hit “Add frame” to start decompressing your idea.';
    list.appendChild(li);
  }

  board.frames.forEach((f, i) => {
    const li = document.createElement('li');
    li.className = 'frame';
    li.dataset.type = f.type;

    const top = document.createElement('div');
    top.className = 'frame-top';
    top.innerHTML = `<span class="frame-num">#${i + 1}</span>`;

    const typeSel = document.createElement('select');
    typeSel.setAttribute('aria-label', 'Frame type');
    TYPES.forEach((t) => {
      const o = document.createElement('option');
      o.value = t; o.textContent = TYPE_LABEL[t];
      if (t === f.type) o.selected = true;
      typeSel.appendChild(o);
    });
    typeSel.addEventListener('change', () => {
      f.type = typeSel.value; li.dataset.type = f.type; save();
    });

    const moves = document.createElement('div');
    moves.className = 'moves';
    const up = document.createElement('button');
    up.className = 'iconbtn'; up.title = 'Move up'; up.innerHTML = ICON_UP;
    up.disabled = i === 0; up.style.opacity = i === 0 ? 0.3 : 1;
    up.addEventListener('click', () => move(i, -1));
    const down = document.createElement('button');
    down.className = 'iconbtn'; down.title = 'Move down'; down.innerHTML = ICON_DOWN;
    down.disabled = i === board.frames.length - 1;
    down.style.opacity = i === board.frames.length - 1 ? 0.3 : 1;
    down.addEventListener('click', () => move(i, 1));
    const del = document.createElement('button');
    del.className = 'iconbtn danger'; del.title = 'Delete frame'; del.innerHTML = ICON_X;
    del.addEventListener('click', () => {
      board.frames.splice(i, 1); save(); render();
    });
    moves.append(up, down, del);

    const shot = document.createElement('input');
    shot.className = 'shot'; shot.placeholder = 'Shot title…'; shot.maxLength = 80;
    shot.value = f.shot || '';
    shot.addEventListener('input', () => { f.shot = shot.value; save(); });

    const notes = document.createElement('textarea');
    notes.placeholder = 'Visual notes, dialogue, camera direction…';
    notes.value = f.notes || '';
    notes.addEventListener('input', () => { f.notes = notes.value; save(); });

    const secsRow = document.createElement('label');
    secsRow.className = 'secsrow';
    secsRow.innerHTML = '<span>Est. seconds</span>';
    const secs = document.createElement('input');
    secs.type = 'number'; secs.min = 0; secs.max = 600; secs.value = f.secs ?? 5;
    secs.addEventListener('input', () => {
      f.secs = Math.max(0, parseInt(secs.value, 10) || 0); updateStats(); save();
    });
    secsRow.appendChild(secs);

    top.append(typeSel, moves);
    li.append(top, shot, notes, secsRow);
    list.appendChild(li);
  });

  $('boardTitle').value = board.title || '';
  updateStats();
}

function updateStats() {
  $('stFrames').textContent = board.frames.length;
  const total = board.frames.reduce((s, f) => s + (f.secs || 0), 0);
  $('stSecs').textContent = total >= 60
    ? `${Math.floor(total / 60)}m ${total % 60}s`
    : `${total}s`;
}

// ---- actions -------------------------------------------------------------
function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= board.frames.length) return;
  [board.frames[i], board.frames[j]] = [board.frames[j], board.frames[i]];
  save(); render();
}

function addFrame() {
  board.frames.push({ id: uid(), type: $('newType').value, shot: '', notes: '', secs: 5 });
  save(); render(); setStatus('Frame added.');
}

function buildOutline() {
  const lines = [`# ${board.title || 'Untitled storyboard'}`, ''];
  board.frames.forEach((f, i) => {
    lines.push(`## ${i + 1}. [${TYPE_LABEL[f.type]}] ${f.shot || '(untitled shot)'}${f.secs ? ` (~${f.secs}s)` : ''}`);
    if (f.notes) lines.push('', f.notes);
    lines.push('');
  });
  return lines.join('\n').trim() || '# Untitled storyboard';
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`${label} copied to clipboard.`);
  } catch {
    setStatus('Clipboard blocked — select and copy manually.');
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = (board.title || 'storyboard').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  a.download = `${slug || 'storyboard'}.storyboard.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('JSON exported.');
}

// ---- init ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  render();

  $('boardTitle').addEventListener('input', (e) => {
    board.title = e.target.value; save();
  });
  $('addFrame').addEventListener('click', addFrame);
  $('copyOutline').addEventListener('click', () => copyText(buildOutline(), 'Outline'));
  $('exportJson').addEventListener('click', exportJson);
  $('clearBoard').addEventListener('click', () => {
    if (board.frames.length && confirm('Delete all frames?')) {
      board = { title: board.title, frames: [] };
      save(); render(); setStatus('Board cleared.');
    }
  });
});
