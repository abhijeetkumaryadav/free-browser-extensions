// SRT Shift — popup logic: parse, shift, preview, download SRT files locally.
// All processing happens in this popup; no network, no storage persistence.

// ---------- state ----------
const state = {
  files: [],      // { name, text, shifted, offsetMs }
  sign: 1,        // +1 forward, -1 backward
};

// ---------- SRT helpers ----------
const TS_RE = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/;

/** Convert an SRT timestamp string to milliseconds. Returns null if invalid. */
function tsToMs(ts) {
  const m = TS_RE.exec(ts);
  if (!m) return null;
  const [, hh, mm, ss, ms] = m.map(Number);
  return ((hh * 3600) + (mm * 60) + ss) * 1000 + ms;
}

/** Convert milliseconds back to an SRT timestamp string. Clamps at 00:00:00,000. */
function msToTs(ms) {
  ms = Math.max(0, Math.round(ms));
  const h = Math.floor(ms / 3600000); ms %= 3600000;
  const m = Math.floor(ms / 60000);   ms %= 60000;
  const s = Math.floor(ms / 1000);    ms %= 1000;
  const pad = (n, w) => String(n).padStart(w, '0');
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

/** Shift every timestamp line in SRT text by offsetMs. Returns { text, count }. */
function shiftSrt(text, offsetMs) {
  let count = 0;
  const shifted = text.split('\n').map((line) => {
    if (!line.includes('-->')) return line;
    const parts = line.split('-->');
    const start = tsToMs(parts[0].trim());
    const end = tsToMs(parts[1].trim());
    if (start === null || end === null) return line; // leave malformed lines alone
    count++;
    return `${msToTs(start + offsetMs)} --> ${msToTs(end + offsetMs)}`;
  }).join('\n');
  return { text: shifted, count };
}

/** Count cue blocks in SRT text for the meta line. */
function countCues(text) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  return blocks.length;
}

// ---------- DOM ----------
const fileInput = document.getElementById('fileInput');
const pasteArea = document.getElementById('pasteArea');
const addPasteBtn = document.getElementById('addPaste');
const signBtn = document.getElementById('signBtn');
const secondsInput = document.getElementById('seconds');
const millisInput = document.getElementById('millis');
const sameOffsetCheck = document.getElementById('sameOffset');
const shiftBtn = document.getElementById('shiftBtn');
const resultsCard = document.getElementById('resultsCard');
const fileList = document.getElementById('fileList');

fileInput.addEventListener('change', () => {
  for (const f of fileInput.files) {
    const reader = new FileReader();
    reader.onload = () => {
      state.files.push({ name: f.name, text: String(reader.result), shifted: null, offsetMs: 0 });
      renderPlaceholder();
    };
    reader.readAsText(f);
  }
  fileInput.value = ''; // allow re-adding the same file
});

addPasteBtn.addEventListener('click', () => {
  const text = pasteArea.value.trim();
  if (!text) return;
  state.files.push({ name: `pasted-${state.files.length + 1}.srt`, text, shifted: null, offsetMs: 0 });
  pasteArea.value = '';
  renderPlaceholder();
});

signBtn.addEventListener('click', () => {
  state.sign = state.sign === 1 ? -1 : 1;
  signBtn.textContent = state.sign === 1 ? '+' : '−';
});

function globalOffsetMs() {
  const s = Math.max(0, Number(secondsInput.value) || 0);
  const ms = Math.max(0, Math.min(999, Number(millisInput.value) || 0));
  return state.sign * (s * 1000 + ms);
}

shiftBtn.addEventListener('click', () => {
  if (state.files.length === 0) {
    const original = shiftBtn.innerHTML;
    shiftBtn.textContent = 'Add SRT files first';
    setTimeout(() => { shiftBtn.innerHTML = original; }, 1200);
    return;
  }
  const offset = globalOffsetMs();
  state.files.forEach((f, i) => {
    const perFile = sameOffsetCheck.checked ? offset : offset; // per-file UI could extend here
    const { text, count } = shiftSrt(f.text, perFile);
    f.shifted = text;
    f.offsetMs = perFile;
    f.count = count;
    f.cues = countCues(f.text);
  });
  renderResults();
});

function renderPlaceholder() {
  resultsCard.classList.remove('hidden');
  fileList.innerHTML = `<p class="file-meta">${state.files.length} file(s) loaded — set an offset and press Shift timestamps.</p>`;
}

function renderResults() {
  resultsCard.classList.remove('hidden');
  fileList.innerHTML = '';
  state.files.forEach((f) => {
    const div = document.createElement('div');
    div.className = 'file-item';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = f.name;
    div.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const dir = f.offsetMs >= 0 ? 'forward' : 'backward';
    meta.textContent = `${f.count} cues shifted ${dir} by ${Math.abs(f.offsetMs)} ms (${f.cues} blocks total).`;
    div.appendChild(meta);

    const preview = document.createElement('pre');
    preview.className = 'preview';
    preview.textContent = f.shifted.split('\n').slice(0, 12).join('\n');
    div.appendChild(preview);

    const dl = document.createElement('button');
    dl.className = 'btn secondary';
    dl.textContent = `Download ${f.name.replace(/\.srt$/i, '')}_shifted.srt`;
    dl.addEventListener('click', () => downloadShifted(f));
    div.appendChild(dl);

    fileList.appendChild(div);
  });

  // Download-all button
  const all = document.createElement('button');
  all.className = 'btn primary';
  all.style.marginTop = '10px';
  all.textContent = 'Download all shifted files';
  all.addEventListener('click', () => state.files.forEach(downloadShifted));
  fileList.appendChild(all);
}

/** Trigger a browser download of one shifted SRT file. */
function downloadShifted(f) {
  const blob = new Blob([f.shifted], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name.replace(/\.srt$/i, '') + '_shifted.srt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
