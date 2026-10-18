/* SRT Timestamp Studio — popup logic.
 * Parse, validate, shift, renumber and export SRT subtitles.
 * 100% client-side. Nothing leaves the device. */

'use strict';

const $ = (id) => document.getElementById(id);

/* Original parsed cues (immutable baseline) and working copy */
let originalCues = [];
let cues = [];
let totalShiftMs = 0;

/* ---------- Timestamp helpers ---------- */
const TS_RE = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/;

function tsToMs(ts) {
  const m = TS_RE.exec(ts.trim());
  if (!m) return null;
  const [, hh, mm, ss, ms] = m.map(Number);
  if (mm > 59 || ss > 59) return null;
  return ((hh * 3600 + mm * 60 + ss) * 1000) + ms;
}

function msToTs(ms) {
  ms = Math.max(0, Math.round(ms));
  const hh = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const mmm = String(ms % 1000).padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

function msToShort(ms) {
  const s = Math.round(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  return `${mm}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- Parser ---------- */
function parseSrt(text) {
  const cues = [];
  const errors = [];
  // Normalize newlines, split into blocks on blank lines
  const blocks = text.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  if (!blocks.length || (blocks.length === 1 && !blocks[0])) {
    return { cues, errors: [{ msg: 'No subtitle blocks found. Paste valid SRT content.', warn: false }] };
  }

  blocks.forEach((block, bi) => {
    const lines = block.split('\n');
    const label = `Block ${bi + 1}`;
    if (lines.length < 2) {
      errors.push({ msg: `${label}: too few lines (need number + timestamp).`, warn: false });
      return;
    }
    const num = Number(lines[0].trim());
    if (!Number.isInteger(num) || num < 1) {
      errors.push({ msg: `${label}: invalid cue number "${lines[0].trim()}".`, warn: false });
      return;
    }
    const tsMatch = lines[1].trim().match(/^(.+?)\s*-->\s*(.+)$/);
    if (!tsMatch) {
      errors.push({ msg: `${label}: malformed timestamp line "${lines[1].trim()}".`, warn: false });
      return;
    }
    const start = tsToMs(tsMatch[1]);
    const end = tsToMs(tsMatch[2]);
    if (start === null || end === null) {
      errors.push({ msg: `${label}: bad timestamp format (want HH:MM:SS,mmm).`, warn: false });
      return;
    }
    if (start >= end) {
      errors.push({ msg: `${label} (#${num}): start time is not before end time.`, warn: false });
    }
    const body = lines.slice(2).join('\n').trim();
    if (!body) {
      errors.push({ msg: `${label} (#${num}): empty subtitle text.`, warn: true });
    }
    cues.push({ num, start, end, text: body });
  });

  // Cross-cue checks: ordering + overlaps
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      errors.push({ msg: `Cue #${sorted[i].num} overlaps cue #${sorted[i - 1].num}.`, warn: true });
    }
  }
  const nums = cues.map((c) => c.num);
  const expected = [...Array(cues.length)].map((_, i) => i + 1);
  if (nums.join(',') !== expected.join(',')) {
    errors.push({ msg: 'Cue numbering is not sequential — use "Fix numbering".', warn: true });
  }

  return { cues, errors };
}

/* ---------- Serialize ---------- */
function toSrt(cueList) {
  return cueList
    .map((c) => `${c.num}\n${msToTs(c.start)} --> ${msToTs(c.end)}\n${c.text}`)
    .join('\n\n') + '\n';
}

/* ---------- Rendering ---------- */
function showPanels(visible) {
  for (const id of ['validationPanel', 'adjustPanel', 'previewPanel', 'exportPanel']) {
    $(id).classList.toggle('hidden', !visible);
  }
}

function renderValidation(errors) {
  const list = $('errorList');
  list.innerHTML = '';
  if (!errors.length) {
    list.innerHTML = '<div class="ok-msg">✓ Valid SRT — no issues found.</div>';
    return;
  }
  for (const e of errors) {
    const el = document.createElement('div');
    el.className = 'err' + (e.warn ? ' warn' : '');
    el.textContent = (e.warn ? '⚠ ' : '✕ ') + e.msg;
    list.appendChild(el);
  }
}

function renderStats() {
  $('statCues').textContent = cues.length;
  if (cues.length) {
    const last = Math.max(...cues.map((c) => c.end));
    $('statDur').textContent = msToShort(last);
  } else {
    $('statDur').textContent = '—';
  }
  const sign = totalShiftMs >= 0 ? '+' : '−';
  $('statShift').textContent = `${sign}${Math.abs(totalShiftMs)} ms`;
}

function renderPreview() {
  const list = $('cueList');
  list.innerHTML = '';
  if (!cues.length) {
    list.innerHTML = '<div class="empty">No cues parsed yet.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const c of cues) {
    const el = document.createElement('div');
    el.className = 'cue';
    el.innerHTML = `
      <div class="cue-top">
        <span class="cue-num">${c.num}</span>
        <span class="cue-time">${msToTs(c.start)} → ${msToTs(c.end)}</span>
      </div>
      <div class="cue-text">${escapeHtml(c.text).replace(/\n/g, '<br>')}</div>`;
    frag.appendChild(el);
  }
  list.appendChild(frag);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- Actions ---------- */
function doParse() {
  const text = $('srtInput').value;
  const { cues: parsed, errors } = parseSrt(text);
  originalCues = parsed.map((c) => ({ ...c }));
  cues = parsed.map((c) => ({ ...c }));
  totalShiftMs = 0;
  // Persist last input on-device
  chrome.storage.local.set({ srtLastInput: text }).catch(() => {});
  const ok = parsed.length > 0;
  showPanels(ok);
  if (ok) {
    renderValidation(errors);
    renderStats();
    renderPreview();
  } else {
    showPanels(false);
    $('validationPanel').classList.remove('hidden');
    renderValidation(errors);
  }
}

$('parseBtn').addEventListener('click', doParse);

$('applyShiftBtn').addEventListener('click', () => {
  if (!cues.length) return;
  const sec = Number($('shiftSec').value) || 0;
  const ms = Number($('shiftMs').value) || 0;
  const delta = sec * 1000 + ms;
  if (!delta) return;
  cues = cues.map((c) => ({ ...c, start: Math.max(0, c.start + delta), end: Math.max(0, c.end + delta) }));
  totalShiftMs += delta;
  // Re-validate overlaps after shifting
  const { errors } = parseSrt(toSrt(cues));
  renderValidation(errors);
  renderStats();
  renderPreview();
});

$('fixNumBtn').addEventListener('click', () => {
  if (!cues.length) return;
  cues.forEach((c, i) => { c.num = i + 1; });
  const { errors } = parseSrt(toSrt(cues));
  renderValidation(errors);
  renderPreview();
});

$('resetBtn').addEventListener('click', () => {
  cues = originalCues.map((c) => ({ ...c }));
  totalShiftMs = 0;
  $('shiftSec').value = 0;
  $('shiftMs').value = 0;
  const { errors } = parseSrt(toSrt(cues));
  renderValidation(errors);
  renderStats();
  renderPreview();
});

$('downloadBtn').addEventListener('click', () => {
  if (!cues.length) return;
  const blob = new Blob([toSrt(cues)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subtitles.srt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

$('copyBtn').addEventListener('click', async (e) => {
  if (!cues.length) return;
  try {
    await navigator.clipboard.writeText(toSrt(cues));
    flash(e.currentTarget, 'Copied ✓');
  } catch (err) { /* clipboard unavailable */ }
});

function flash(btn, label) {
  const old = btn.innerHTML;
  btn.innerHTML = label;
  setTimeout(() => { btn.innerHTML = old; }, 1200);
}

/* ---------- File input ---------- */
$('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { $('srtInput').value = String(reader.result || ''); doParse(); };
  reader.readAsText(file);
});

/* ---------- Sample ---------- */
const SAMPLE = `1
00:00:01,000 --> 00:00:03,500
Welcome to the studio.

2
00:00:04,000 --> 00:00:06,000
This is a sample subtitle.

4
00:00:07,000 --> 00:00:09,250
Numbering jumps on purpose —
try "Fix numbering".
`;
$('sampleBtn').addEventListener('click', () => {
  $('srtInput').value = SAMPLE;
  doParse();
});

/* ---------- Init: restore last input ---------- */
chrome.storage.local.get('srtLastInput').then((data) => {
  if (data.srtLastInput) $('srtInput').value = data.srtLastInput;
}).catch(() => {});
