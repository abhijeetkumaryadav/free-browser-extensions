'use strict';

// ================= ENGINE-START =================
// SRT time format: hh:mm:ss,mmm. Millisecond precision, times are floats (seconds).

function parseTime(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim().replace('.', ',');
  // full form: [hh:]mm:ss,mmm
  let m = s.match(/^(?:(\d+):)?([0-5]?\d):([0-5]\d),(\d{1,3})$/);
  if (m) {
    const h = m[1] ? parseInt(m[1], 10) : 0;
    return h * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4].padEnd(3, '0'), 10) / 1000;
  }
  // plain seconds
  m = s.match(/^\d+(?:,\d{1,3})?$/);
  if (m) return parseFloat(s.replace(',', '.'));
  return null;
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return null;
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' +
         String(s).padStart(2, '0') + ',' + String(r).padStart(3, '0');
}

function makeCue(id, startSec, durationSec, text) {
  if (!Number.isFinite(startSec) || startSec < 0) return null;
  if (!Number.isFinite(durationSec) || durationSec < 0.2 || durationSec > 120) return null;
  const t = (text || '').trim();
  if (!t || t.length > 500) return null;
  return { id, start: startSec, end: startSec + durationSec, text: t };
}

function sortCues(cues) {
  return [...cues].sort((a, b) => a.start - b.start || a.id - b.id);
}

// Render cues (unsorted or sorted) to a standard .srt document.
function buildSrt(cues) {
  return sortCues(cues)
    .map((c, i) => `${i + 1}\n${fmtTime(c.start)} --> ${fmtTime(c.end)}\n${c.text}\n`)
    .join('\n');
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
// ================= ENGINE-END =================

const timeEl = document.getElementById('time');
const durEl = document.getElementById('dur');
const textEl = document.getElementById('text');
const cuesEl = document.getElementById('cues');
const countEl = document.getElementById('count');
const srtEl = document.getElementById('srtout');
const dlBtn = document.getElementById('download');

const STORE_KEY = 'srt-cues';
let cues = [];
let nextId = 1;

function render() {
  cues = sortCues(cues);
  countEl.textContent = cues.length;
  if (!cues.length) {
    cuesEl.innerHTML = '<li class="empty">No cues yet — add one above.</li>';
  } else {
    cuesEl.innerHTML = cues.map(c =>
      `<li><span class="idx">${escHtml(c.id)}</span>` +
      `<span class="body"><span class="t">${escHtml(fmtTime(c.start))} → ${escHtml(fmtTime(c.end))}</span><br>${escHtml(c.text)}</span>` +
      `<button class="x" data-id="${c.id}" title="Remove">×</button></li>`
    ).join('');
  }
  srtEl.textContent = cues.length ? buildSrt(cues) : '(add cues to see the .srt output)';
  dlBtn.disabled = cues.length === 0;
  chrome.storage.local.set({ [STORE_KEY]: { cues, nextId } }).catch(() => {});
}

document.getElementById('add').addEventListener('click', () => {
  const start = parseTime(timeEl.value);
  const dur = parseFloat(durEl.value);
  if (start === null) { timeEl.focus(); return; }
  const cue = makeCue(nextId, start, dur, textEl.value);
  if (!cue) { textEl.focus(); return; }
  cues.push(cue);
  nextId++;
  // Chain: default next start to this cue's end for fast entry.
  timeEl.value = fmtTime(cue.end);
  textEl.value = '';
  textEl.focus();
  render();
});

document.getElementById('now').addEventListener('click', () => { timeEl.value = '00:00:00,000'; });

document.getElementById('clear').addEventListener('click', () => {
  if (!cues.length || !confirm('Clear all cues?')) return;
  cues = [];
  render();
});

cuesEl.addEventListener('click', e => {
  const btn = e.target.closest('.x');
  if (!btn) return;
  cues = cues.filter(c => String(c.id) !== btn.dataset.id);
  render();
});

dlBtn.addEventListener('click', () => {
  const blob = new Blob([buildSrt(cues)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'telemetry.srt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chrome.storage.local.get(STORE_KEY).then(res => {
  const s = res[STORE_KEY];
  if (s && Array.isArray(s.cues)) {
    cues = s.cues.filter(c => makeCue(c.id, c.start, c.end - c.start, c.text));
    nextId = s.nextId || cues.length + 1;
  }
  render();
}).catch(render);

render();
