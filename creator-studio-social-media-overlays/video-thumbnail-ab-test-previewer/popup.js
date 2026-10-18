/* Thumbnail A/B Studio — popup logic.
 * Pure client-side thumbnail comparison: uploads, canvas contrast check,
 * best-practice checklist, and an on-device test log. Nothing leaves the device. */

'use strict';

/* ---------- State ---------- */
const state = {
  A: { url: null, name: '', text: '', face: null, contrast: null },
  B: { url: null, name: '', text: '', face: null, contrast: null },
};

const $ = (id) => document.getElementById(id);
const LOG_KEY = 'tabStudioTestLog';

/* ---------- File loading ---------- */
function loadFile(slot, file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (state[slot].url) URL.revokeObjectURL(state[slot].url);
  const url = URL.createObjectURL(file);
  state[slot].url = url;
  state[slot].name = file.name;
  state[slot].contrast = null;
  // Show previews
  $(slot === 'A' ? 'imgA' : 'imgB').src = url;
  $(slot === 'A' ? 'imgA' : 'imgB').classList.remove('hidden');
  $(slot === 'A' ? 'placeholderA' : 'placeholderB').classList.add('hidden');
  refreshCompare();
}

$('fileA').addEventListener('change', (e) => loadFile('A', e.target.files[0]));
$('fileB').addEventListener('change', (e) => loadFile('B', e.target.files[0]));

$('swapBtn').addEventListener('click', () => {
  const tmp = { ...state.A };
  state.A = { ...state.B };
  state.B = tmp;
  syncUploadPreviews();
  refreshCompare();
});

$('clearBtn').addEventListener('click', () => {
  for (const slot of ['A', 'B']) {
    if (state[slot].url) URL.revokeObjectURL(state[slot].url);
    state[slot] = { url: null, name: '', text: '', face: null, contrast: null };
  }
  $('fileA').value = '';
  $('fileB').value = '';
  syncUploadPreviews();
  refreshCompare();
});

function syncUploadPreviews() {
  for (const slot of ['A', 'B']) {
    const img = $(slot === 'A' ? 'imgA' : 'imgB');
    const ph = $(slot === 'A' ? 'placeholderA' : 'placeholderB');
    if (state[slot].url) { img.src = state[slot].url; img.classList.remove('hidden'); ph.classList.add('hidden'); }
    else { img.classList.add('hidden'); ph.classList.remove('hidden'); }
  }
}

/* ---------- Comparison panel ---------- */
function refreshCompare() {
  const both = state.A.url && state.B.url;
  $('comparePanel').classList.toggle('hidden', !both);
  if (!both) return;
  $('cardA').src = state.A.url;
  $('cardB').src = state.B.url;
  $('zoomA').src = state.A.url;
  $('zoomB').src = state.B.url;
  renderChecklist();
  // Analyze contrast for any newly loaded image
  for (const slot of ['A', 'B']) {
    if (state[slot].contrast === null) analyzeContrast(slot);
  }
}

$('zoomBtn').addEventListener('click', () => $('zoomOverlay').classList.remove('hidden'));
$('zoomClose').addEventListener('click', () => $('zoomOverlay').classList.add('hidden'));

/* ---------- Contrast analysis (canvas, RMS contrast of luminance) ---------- */
function analyzeContrast(slot) {
  const img = new Image();
  img.onload = () => {
    try {
      const size = 48;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const lum = [];
      for (let i = 0; i < data.length; i += 4) {
        lum.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      }
      const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
      const variance = lum.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lum.length;
      const rms = mean > 1 ? Math.sqrt(variance) / mean : 0;
      // Normalize: typical thumbnails land 0.15–0.8; map to 0–100
      state[slot].contrast = Math.max(0, Math.min(100, Math.round((rms / 0.8) * 100)));
    } catch (err) {
      state[slot].contrast = -1; // unreadable
    }
    renderChecklist();
  };
  img.onerror = () => { state[slot].contrast = -1; renderChecklist(); };
  img.src = state[slot].url;
}

/* ---------- Checklist ---------- */
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function renderChecklist() {
  const wrap = $('checklist');
  wrap.innerHTML = '';
  for (const slot of ['A', 'B']) {
    const v = state[slot];
    const card = document.createElement('div');
    card.className = 'check-variant';

    const words = v.text.trim() ? wordCount(v.text) : null;
    const wordsPass = words === null ? null : words <= 4;
    const facePass = v.face === null ? null : v.face === true;
    const contrastPass = v.contrast === null || v.contrast < 0 ? null : v.contrast >= 35;
    const checks = [wordsPass, facePass, contrastPass].filter((x) => x !== null);
    const passed = checks.filter(Boolean).length;

    card.innerHTML = `
      <div class="check-head">
        <span class="check-title">Variant ${slot}</span>
        <span class="score">${passed}/${checks.length} passing</span>
      </div>
      <div class="check-row">
        <span class="lbl">Overlay text</span>
        <input class="text-input" data-slot="${slot}" data-field="text" placeholder="Words on thumbnail" value="${escapeHtml(v.text)}">
        ${badge(words === null ? 'not set' : words + (words === 1 ? ' word' : ' words'), wordsPass)}
      </div>
      <div class="check-row">
        <span class="lbl">Face visible</span>
        <button class="chip ${v.face === true ? 'active' : ''}" data-slot="${slot}" data-face="yes">Yes</button>
        <button class="chip ${v.face === false ? 'active' : ''}" data-slot="${slot}" data-face="no">No</button>
        ${badge(v.face === null ? 'not set' : (v.face ? 'face' : 'no face'), facePass)}
      </div>
      <div class="check-row">
        <span class="lbl">Contrast</span>
        <div class="contrast-wrap">
          <div class="contrast-bar"><div class="contrast-fill" style="width:${v.contrast > 0 ? v.contrast : 0}%"></div></div>
          ${badge(v.contrast === null ? '…' : (v.contrast < 0 ? 'n/a' : v.contrast + '%'), contrastPass)}
        </div>
      </div>`;
    wrap.appendChild(card);
  }

  // Wire inputs
  wrap.querySelectorAll('input[data-field="text"]').forEach((input) => {
    input.addEventListener('input', (e) => {
      state[e.target.dataset.slot].text = e.target.value;
      renderChecklist();
      // Restore focus + caret after re-render
      const fresh = wrap.querySelector(`input[data-slot="${e.target.dataset.slot}"]`);
      if (fresh) { fresh.focus(); fresh.setSelectionRange(fresh.value.length, fresh.value.length); }
    });
  });
  wrap.querySelectorAll('button[data-face]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const slot = e.currentTarget.dataset.slot;
      const val = e.currentTarget.dataset.face === 'yes';
      state[slot].face = (state[slot].face === val) ? null : val; // toggle off on repeat
      renderChecklist();
    });
  });
}

function badge(label, pass) {
  const cls = pass === null ? '' : (pass ? 'pass' : 'fail');
  const suffix = pass === null ? '' : (pass ? ' ✓' : ' ✕');
  return `<span class="badge ${cls}">${label}${suffix}</span>`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- Test log ---------- */
async function getLog() {
  const data = await chrome.storage.local.get(LOG_KEY);
  return data[LOG_KEY] || [];
}

async function setLog(log) {
  await chrome.storage.local.set({ [LOG_KEY]: log });
}

$('saveTestBtn').addEventListener('click', async () => {
  const title = $('logTitle').value.trim() || 'Untitled test';
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleDateString(),
    title,
    winner: $('logWinner').value,
    notes: $('logNotes').value.trim(),
    a: snapshot('A'),
    b: snapshot('B'),
  };
  const log = await getLog();
  log.unshift(entry);
  await setLog(log.slice(0, 50)); // keep last 50
  $('logTitle').value = '';
  $('logNotes').value = '';
  renderLog();
});

function snapshot(slot) {
  const v = state[slot];
  const words = v.text.trim() ? wordCount(v.text) : null;
  return {
    name: v.name || '—',
    words,
    face: v.face,
    contrast: v.contrast,
  };
}

async function renderLog() {
  const log = await getLog();
  const list = $('logList');
  list.innerHTML = '';
  if (!log.length) {
    list.innerHTML = '<div class="empty">No saved tests yet.</div>';
    return;
  }
  for (const entry of log) {
    const el = document.createElement('div');
    el.className = 'log-item';
    el.innerHTML = `
      <div class="log-top">
        <span class="log-title">${escapeHtml(entry.title)}</span>
        <button class="del-btn" data-id="${entry.id}" title="Delete">×</button>
      </div>
      <div class="log-meta">${escapeHtml(entry.date)} · <span class="winner">Winner: ${escapeHtml(entry.winner)}</span>${entry.notes ? ' · ' + escapeHtml(entry.notes) : ''}</div>`;
    list.appendChild(el);
  }
  list.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      await setLog((await getLog()).filter((x) => x.id !== id));
      renderLog();
    });
  });
}

$('copyLogBtn').addEventListener('click', async () => {
  const log = await getLog();
  if (!log.length) return;
  const lines = log.map((e) =>
    `• ${e.title} (${e.date}) — Winner: ${e.winner}${e.notes ? ' — ' + e.notes : ''}`
  );
  try {
    await navigator.clipboard.writeText('Thumbnail A/B test log\n' + lines.join('\n'));
    const btn = $('copyLogBtn');
    const old = btn.innerHTML;
    btn.innerHTML = 'Copied ✓';
    setTimeout(() => { btn.innerHTML = old; }, 1200);
  } catch (err) { /* clipboard unavailable */ }
});

/* ---------- Init ---------- */
renderLog();
