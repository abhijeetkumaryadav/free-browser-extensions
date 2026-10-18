/* MetaScrub — metadata privacy stripper.
 * PDF: deletes every key of the /Info dict via locally-bundled pdf-lib.
 * Images: re-encodes through <canvas> (drops EXIF/XMP segments).
 * Text: normalizes line endings / trailing whitespace.
 * Originals are never touched — only clean copies are downloaded. */
'use strict';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
function setStatus(msg, kind = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + kind;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

// ---- state ----
let file = null;          // original File
let kind = null;          // 'pdf' | 'image' | 'text'
let beforeRows = [];      // [{key, val}]
let cleanBlob = null;
let cleanName = '';

function renderRows(el, rows, after) {
  el.innerHTML = '';
  if (rows.length === 0) {
    el.innerHTML = '<div class="meta-row"><span class="meta-val none">No metadata detected.</span></div>';
    return;
  }
  rows.forEach((r) => {
    const div = document.createElement('div');
    div.className = 'meta-row';
    const valCls = after ? 'meta-val clean' : 'meta-val';
    div.innerHTML = `<span class="meta-key">${escapeHtml(r.key)}</span><span class="${valCls}">${escapeHtml(r.val)}</span>`;
    el.appendChild(div);
  });
}

// ---------- PDF ----------
function pdfInfoRows(pdfDoc) {
  const rows = [];
  const push = (k, v) => { if (v) rows.push({ key: k, val: String(v) }); };
  try {
    push('Title', pdfDoc.getTitle());
    push('Author', pdfDoc.getAuthor());
    push('Subject', pdfDoc.getSubject());
    push('Keywords', pdfDoc.getKeywords());
    push('Creator', pdfDoc.getCreator());
    push('Producer', pdfDoc.getProducer());
    const cd = pdfDoc.getCreationDate();
    if (cd) push('Created', cd.toLocaleString());
    const md = pdfDoc.getModificationDate();
    if (md) push('Modified', md.toLocaleString());
    // Custom /Info keys beyond the standard set
    const ti = pdfDoc.context.trailerInfo;
    if (ti && ti.Info) {
      const info = pdfDoc.context.lookup(ti.Info);
      if (info && typeof info.keys === 'function') {
        const standard = new Set(['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped']);
        info.keys().forEach((k) => {
          const name = String(k).replace('/', '');
          if (!standard.has(name)) push('Custom: ' + name, '(present)');
        });
      }
    }
  } catch (e) { console.warn('info read failed', e); }
  return rows;
}

async function stripPdf(bytes) {
  // updateMetadata:false keeps pdf-lib from stamping its own Producer/ModDate
  // into the file during load — we want the output truly clean.
  const pdfDoc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  // Delete every key of the /Info dictionary (names, dates, custom keys).
  const ti = pdfDoc.context.trailerInfo;
  if (ti && ti.Info) {
    const info = pdfDoc.context.lookup(ti.Info);
    if (info && typeof info.keys === 'function') {
      [...info.keys()].forEach((k) => { try { info.delete(k); } catch (e) { /* keep going */ } });
    }
  }
  const out = await pdfDoc.save();
  return new Blob([out], { type: 'application/pdf' });
}

// ---------- images ----------
function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(file).then(resolve, () => fallbackImg());
    } else fallbackImg();
    function fallbackImg() {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    }
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), mime, quality);
  });
}

async function stripImage(file) {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width || img.naturalWidth;
  canvas.height = img.height || img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Re-encoding drops EXIF/XMP/ICC segments. Keep the same format family.
  const srcType = file.type;
  let mime = 'image/png', ext = 'png', q;
  if (srcType === 'image/jpeg') { mime = 'image/jpeg'; ext = 'jpg'; q = 0.92; }
  else if (srcType === 'image/webp') { mime = 'image/webp'; ext = 'webp'; q = 0.92; }
  const blob = await canvasToBlob(canvas, mime, q);
  return { blob, ext, width: canvas.width, height: canvas.height };
}

// ---------- text ----------
async function stripText(file) {
  const raw = await file.text();
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/g, ''));
  // Drop trailing blank lines, keep a single final newline.
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
}

// ---------- flow ----------
async function loadFile(f) {
  if (!f) return;
  reset(false);
  file = f;
  const name = f.name.toLowerCase();
  if (/\.pdf$/i.test(name)) kind = 'pdf';
  else if (/\.(jpe?g|png|webp)$/i.test(name)) kind = 'image';
  else if (/\.txt$/i.test(name)) kind = 'text';
  else { setStatus('Unsupported type — PDF, JPG, PNG, WebP or TXT only.', 'err'); file = null; return; }

  $('fileName').textContent = f.name;
  $('fileMeta').textContent = `${fmtBytes(f.size)} · ${kind.toUpperCase()}`;
  $('fileSection').classList.remove('hidden');
  setStatus('Reading metadata…');

  try {
    if (kind === 'pdf') {
      const bytes = await f.arrayBuffer();
      // updateMetadata:false so reading never stamps pdf-lib defaults into the view
      const pdfDoc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      beforeRows = pdfInfoRows(pdfDoc);
      if (beforeRows.length === 0) beforeRows = [];
    } else if (kind === 'image') {
      const img = await loadImage(f);
      const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      beforeRows = [
        { key: 'Dimensions', val: `${w} × ${h}px` },
        { key: 'Type', val: f.type || 'unknown' },
        { key: 'EXIF / XMP', val: 'may be present — removed on strip' },
      ];
    } else {
      const raw = await f.text();
      const lineCount = raw.split(/\r\n|\r|\n/).length;
      beforeRows = [
        { key: 'Lines', val: String(lineCount) },
        { key: 'Characters', val: String(raw.length) },
        { key: 'Embedded metadata', val: 'none (plain text)' },
      ];
    }
    renderRows($('beforeList'), beforeRows, false);
    $('stripBtn').disabled = false;
    setStatus(beforeRows.length ? 'Metadata found. Review, then strip.' : 'No metadata detected — stripping still produces a clean copy.', beforeRows.length ? '' : 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Could not read this file (it may be encrypted or corrupted).', 'err');
    $('stripBtn').disabled = true;
  }
}

async function doStrip() {
  if (!file) return;
  $('stripBtn').disabled = true;
  setStatus('Stripping metadata…');
  try {
    const base = file.name.replace(/\.[^.]+$/, '');
    if (kind === 'pdf') {
      cleanBlob = await stripPdf(await file.arrayBuffer());
      cleanName = `${base}-clean.pdf`;
    } else if (kind === 'image') {
      const { blob, ext } = await stripImage(file);
      cleanBlob = blob;
      cleanName = `${base}-clean.${ext}`;
    } else {
      cleanBlob = await stripText(file);
      cleanName = `${base}-clean.txt`;
    }
    // After rows: every detected key is now clean.
    const afterRows = beforeRows.map((r) => ({ key: r.key, val: 'removed' }));
    renderRows($('afterList'), afterRows.length ? afterRows : [{ key: 'Result', val: 'no metadata remains' }], true);
    $('afterCard').classList.remove('hidden');
    $('downloadBtn').classList.remove('hidden');
    setStatus(`Done — clean copy ready (${fmtBytes(cleanBlob.size)}). Original untouched.`, 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Stripping failed for this file.', 'err');
    $('stripBtn').disabled = false;
  }
}

async function doDownload() {
  if (!cleanBlob) return;
  const url = URL.createObjectURL(cleanBlob);
  try {
    await chrome.downloads.download({ url, filename: cleanName, saveAs: true });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

function reset(clearStatus = true) {
  file = null; kind = null; beforeRows = []; cleanBlob = null; cleanName = '';
  $('fileSection').classList.add('hidden');
  $('afterCard').classList.add('hidden');
  $('downloadBtn').classList.add('hidden');
  $('fileInput').value = '';
  if (clearStatus) setStatus('');
}

// ---- events ----
const dropzone = $('dropzone');
dropzone.addEventListener('click', () => $('fileInput').click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); }
});
dropzone.addEventListener('dragover', (e) => e.preventDefault());
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFile(f);
});
$('fileInput').addEventListener('change', (e) => loadFile(e.target.files[0]));
$('closeBtn').addEventListener('click', () => reset());
$('stripBtn').addEventListener('click', doStrip);
$('downloadBtn').addEventListener('click', doDownload);
