'use strict';
/* CBZ Reader — full-tab comic viewer.
 * CBZ files are plain ZIP archives. This reader parses the ZIP central
 * directory itself and decompresses entries with the browser's built-in
 * DecompressionStream('deflate-raw'). Stored (uncompressed) entries are
 * used as-is. CBR/RAR files are NOT supported — that is stated in the UI.
 * Everything is local; nothing is uploaded. */

// ================= ENGINE-START =================
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];

/** True if a zip entry name looks like an image page. */
function isImageName(name) {
  const ext = name.split('.').pop().toLowerCase();
  return IMG_EXTS.includes(ext) && !name.endsWith('/');
}

/** Natural sort key: splits digits so "page10" sorts after "page2". */
function naturalKey(name) {
  return name.toLowerCase().split(/(\d+)/).map(p => (/^\d+$/.test(p) ? [1, parseInt(p, 10)] : [0, p]));
}
function naturalCompare(a, b) {
  const ka = naturalKey(a), kb = naturalKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i] || [0, ''], y = kb[i] || [0, ''];
    if (x[0] !== y[0]) return x[0] - y[0];
    if (x[1] < y[1]) return -1;
    if (x[1] > y[1]) return 1;
  }
  return 0;
}

/**
 * Parse a ZIP buffer's central directory. Returns array of entries:
 * { name, method (0=stored, 8=deflate), compSize, localOffset }.
 * Throws on invalid archives. (Data-descriptor entries are rejected.)
 */
function parseZipEntries(buffer) {
  const dv = new DataView(buffer);
  const n = dv.byteLength;
  if (n < 22) throw new Error('File too small to be a ZIP archive.');
  // Find End-Of-Central-Directory by scanning the tail for its signature.
  let eocd = -1;
  const start = Math.max(0, n - 22 - 65536);
  for (let i = n - 22; i >= start; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive (no end-of-central-directory).');
  const count = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt central directory.');
    const method = dv.getUint16(p + 10, true);
    const flags = dv.getUint16(p + 8, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const nameBytes = new Uint8Array(buffer, p + 46, nameLen);
    const name = new TextDecoder().decode(nameBytes);
    if (flags & 0x08) throw new Error('Data-descriptor entries are not supported.');
    if (method !== 0 && method !== 8) throw new Error('Unsupported compression method ' + method + '.');
    entries.push({ name, method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Locate the compressed data bytes of one entry inside the buffer. */
function entryDataSlice(buffer, entry) {
  const dv = new DataView(buffer);
  const lh = entry.localOffset;
  if (dv.getUint32(lh, true) !== 0x04034b50) throw new Error('Bad local file header for ' + entry.name);
  const nameLen = dv.getUint16(lh + 26, true);
  const extraLen = dv.getUint16(lh + 28, true);
  const dataStart = lh + 30 + nameLen + extraLen;
  return new Uint8Array(buffer, dataStart, entry.compSize);
}
// ================= ENGINE-END =================

/** Decompress one entry's bytes into an ArrayBuffer. */
async function inflateEntry(buffer, entry) {
  const raw = entryDataSlice(buffer, entry);
  if (entry.method === 0) return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([raw]).stream().pipeThrough(ds);
  return await new Response(stream).arrayBuffer();
}

const state = { pages: [], idx: 0, fileName: '', urls: [] };

const $ = id => document.getElementById(id);
const emptyEl = $('empty'), pageImg = $('page'), errEl = $('err'),
      counterEl = $('counter'), thumbsEl = $('thumbs');

function showError(msg) {
  errEl.textContent = msg; errEl.hidden = false;
  pageImg.hidden = true; emptyEl.style.display = 'none';
}

function savePosition() {
  chrome.storage.local.set({ ['cbz-pos:' + state.fileName]: state.idx });
}

function render() {
  if (!state.pages.length) return;
  state.idx = Math.max(0, Math.min(state.idx, state.pages.length - 1));
  pageImg.src = state.urls[state.idx];
  pageImg.hidden = false; emptyEl.style.display = 'none'; errEl.hidden = true;
  counterEl.textContent = (state.idx + 1) + ' / ' + state.pages.length;
  [...thumbsEl.children].forEach((t, i) => t.classList.toggle('active', i === state.idx));
  thumbsEl.children[state.idx]?.scrollIntoView({ inline: 'center', block: 'nearest' });
  savePosition();
}

function go(delta) {
  if (!state.pages.length) return;
  state.idx = (state.idx + delta + state.pages.length) % state.pages.length;
  render();
}

$('prev').addEventListener('click', () => go(-1));
$('next').addEventListener('click', () => go(1));
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') go(-1);
  if (e.key === 'ArrowRight') go(1);
});
$('fs').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});

$('file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  errEl.hidden = true;
  state.urls.forEach(u => URL.revokeObjectURL(u));
  state.pages = []; state.urls = []; state.idx = 0; state.fileName = file.name;
  thumbsEl.innerHTML = ''; counterEl.textContent = '…';
  try {
    const buffer = await file.arrayBuffer();
    const entries = parseZipEntries(buffer).filter(en => isImageName(en.name));
    entries.sort((a, b) => naturalCompare(a.name, b.name));
    if (!entries.length) { showError('No image pages found in this archive.'); return; }
    if (entries.length > 400) throw new Error('Too many pages (' + entries.length + ') — 400 max.');
    for (const en of entries) {
      const bytes = await inflateEntry(buffer, en);
      const ext = en.name.split('.').pop().toLowerCase();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) }));
      state.urls.push(url);
      const th = document.createElement('img');
      th.src = url; th.alt = en.name; th.loading = 'lazy';
      th.addEventListener('click', () => { state.idx = state.pages.indexOf(en); render(); });
      thumbsEl.appendChild(th);
      state.pages.push(en);
    }
    const saved = await chrome.storage.local.get('cbz-pos:' + file.name);
    const pos = saved['cbz-pos:' + file.name];
    if (Number.isInteger(pos) && pos >= 0 && pos < state.pages.length) state.idx = pos;
    render();
  } catch (err) {
    showError('Could not open this file: ' + err.message);
  }
});
