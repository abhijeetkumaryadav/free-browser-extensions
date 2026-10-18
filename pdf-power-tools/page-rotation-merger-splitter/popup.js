/* PageForge — PDF rotate / merge / split.
 * All processing runs locally via the bundled pdf-lib (MIT).
 * Files are user-chosen only; nothing is uploaded anywhere. */

'use strict';

const { PDFDocument, degrees } = PDFLib;

// ---------- state ----------
/** @type {{id:number, name:string, bytes:Uint8Array, pageCount:number}[]} */
let files = [];
let nextId = 1;

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const fileList = $('fileList');
const statusEl = $('status');

function setStatus(msg, kind = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + kind;
}

/**
 * Parse a page-range string like "1-3, 5, 8-" into 0-based page indices.
 * "1-" means from page 1 to the last page. Dedupes and sorts.
 * @throws {Error} on invalid syntax
 */
function parsePageRange(str, maxPages) {
  const out = new Set();
  const parts = str.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('Enter at least one page.');
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d*))?$/);
    if (!m) throw new Error(`Invalid range: "${part}". Use e.g. 1-3, 5.`);
    const start = parseInt(m[1], 10);
    const end = m[2] === undefined ? start : (m[2] === '' ? maxPages : parseInt(m[2], 10));
    if (start < 1 || end > maxPages || start > end) {
      throw new Error(`Pages must be between 1 and ${maxPages}.`);
    }
    for (let p = start; p <= end; p++) out.add(p - 1);
  }
  return [...out].sort((a, b) => a - b);
}

/** Trigger a download of raw bytes via chrome.downloads. */
async function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: false });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

// ---------- file list UI ----------
function renderFiles() {
  fileList.innerHTML = '';
  if (files.length === 0) {
    const note = document.createElement('div');
    note.className = 'empty-note';
    note.innerHTML = 'No PDFs yet — add files to begin.<br>Everything is processed locally on your device.';
    fileList.appendChild(note);
  }
  files.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'file-row';

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = f.name;
    name.title = f.name;
    const pages = document.createElement('div');
    pages.className = 'file-pages';
    pages.textContent = `${f.pageCount} page${f.pageCount === 1 ? '' : 's'}`;
    meta.append(name, pages);

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    const up = document.createElement('button');
    up.className = 'icon-btn';
    up.title = 'Move up (merge order)';
    up.disabled = i === 0;
    up.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
    up.addEventListener('click', () => moveFile(i, -1));

    const down = document.createElement('button');
    down.className = 'icon-btn';
    down.title = 'Move down (merge order)';
    down.disabled = i === files.length - 1;
    down.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    down.addEventListener('click', () => moveFile(i, 1));

    const del = document.createElement('button');
    del.className = 'icon-btn danger';
    del.title = 'Remove';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', () => {
      files.splice(i, 1);
      renderFiles();
      refreshFileSelects();
    });

    actions.append(up, down, del);
    row.append(icon, meta, actions);
    fileList.appendChild(row);
  });
}

function moveFile(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= files.length) return;
  [files[i], files[j]] = [files[j], files[i]];
  renderFiles();
}

/** Keep the rotate/split <select> elements in sync with the file list. */
function refreshFileSelects() {
  for (const selId of ['rotateFile', 'splitFile']) {
    const sel = $(selId);
    sel.innerHTML = '';
    files.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = `${f.name} (${f.pageCount}p)`;
      sel.appendChild(opt);
    });
  }
  // Persist preferred output names.
  chrome.storage.local.get(['mergeName', 'rotateName', 'splitName'], (prefs) => {
    if (prefs.mergeName) $('mergeName').value = prefs.mergeName;
    if (prefs.rotateName) $('rotateName').value = prefs.rotateName;
    if (prefs.splitName) $('splitName').value = prefs.splitName;
  });
}

function savePrefs() {
  chrome.storage.local.set({
    mergeName: $('mergeName').value,
    rotateName: $('rotateName').value,
    splitName: $('splitName').value,
  });
}

/** Add chosen PDFs: read bytes, load page counts, append to list. */
async function addFiles(fileList_) {
  const picked = [...fileList_];
  if (picked.length === 0) return;
  setStatus(`Loading ${picked.length} file${picked.length === 1 ? '' : 's'}…`, 'working');
  for (const file of picked) {
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      files.push({ id: nextId++, name: file.name, bytes, pageCount: doc.getPageCount() });
    } catch (err) {
      setStatus(`Could not read "${file.name}" — is it a valid PDF?`, 'err');
      return;
    }
  }
  renderFiles();
  refreshFileSelects();
  setStatus(`${picked.length} file${picked.length === 1 ? '' : 's'} added.`, 'ok');
}

function getSelectedFile(selId) {
  const id = parseInt($(selId).value, 10);
  return files.find((f) => f.id === id);
}

// ---------- operations ----------
async function doMerge() {
  if (files.length === 0) return setStatus('Add at least one PDF first.', 'err');
  setStatus('Merging…', 'working');
  try {
    const out = await PDFDocument.create();
    for (const f of files) {
      const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    const bytes = await out.save();
    const name = $('mergeName').value.trim() || 'merged.pdf';
    savePrefs();
    await downloadBytes(bytes, name.endsWith('.pdf') ? name : name + '.pdf');
    setStatus(`Merged ${files.length} file(s) — download started.`, 'ok');
  } catch (err) {
    setStatus('Merge failed: ' + err.message, 'err');
  }
}

async function doRotate() {
  const f = getSelectedFile('rotateFile');
  if (!f) return setStatus('Add a PDF first.', 'err');
  const deg = parseInt($('rotateDeg').value, 10);
  let indices;
  try {
    indices = parsePageRange($('rotateRange').value, f.pageCount);
  } catch (err) {
    return setStatus(err.message, 'err');
  }
  setStatus(`Rotating ${indices.length} page(s)…`, 'working');
  try {
    // Reload fresh so repeated rotations don't stack on stale state.
    const doc = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
    for (const i of indices) {
      const page = doc.getPage(i);
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + deg) % 360));
    }
    const bytes = await doc.save();
    const name = $('rotateName').value.trim() || 'rotated.pdf';
    savePrefs();
    await downloadBytes(bytes, name.endsWith('.pdf') ? name : name + '.pdf');
    setStatus(`Rotated ${indices.length} page(s) by ${deg}° — download started.`, 'ok');
  } catch (err) {
    setStatus('Rotate failed: ' + err.message, 'err');
  }
}

async function doSplit() {
  const f = getSelectedFile('splitFile');
  if (!f) return setStatus('Add a PDF first.', 'err');
  let indices;
  try {
    indices = parsePageRange($('splitRange').value, f.pageCount);
  } catch (err) {
    return setStatus(err.message, 'err');
  }
  setStatus(`Extracting ${indices.length} page(s)…`, 'working');
  try {
    const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    const name = $('splitName').value.trim() || 'extracted.pdf';
    savePrefs();
    await downloadBytes(bytes, name.endsWith('.pdf') ? name : name + '.pdf');
    setStatus(`Extracted ${indices.length} page(s) — download started.`, 'ok');
  } catch (err) {
    setStatus('Split failed: ' + err.message, 'err');
  }
}

// ---------- wiring ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.op-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $('op-' + tab.dataset.op).classList.add('active');
    setStatus('');
  });
});

fileInput.addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = ''; // allow re-adding the same file
});

$('mergeBtn').addEventListener('click', doMerge);
$('rotateBtn').addEventListener('click', doRotate);
$('splitBtn').addEventListener('click', doSplit);

renderFiles();
refreshFileSelects();
