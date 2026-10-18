/* CleanSweep — PDF annotation cleaner.
 * Reads /Annots arrays via pdf-lib (bundled locally, no network) and lets the
 * user selectively remove annotations (comments, stamps, highlights...).
 * Baked-in watermarks (page content) are NOT removable — stated honestly. */
'use strict';

const { PDFName } = window.PDFLib;

// ---- state ----
let pdfDoc = null;
let fileName = '';
let dirty = false;
let pages = []; // { index, annots: [{id, subtype, author, contents, date}], open }

/** Safely decode a PDF string/hex object to text. */
function decodeText(obj) {
  if (!obj || typeof obj.decodeText !== 'function') return '';
  try { return obj.decodeText(); } catch { return ''; }
}

/** Read annotations from a single page. Returns array of descriptors. */
function readAnnotations(pdfDoc, page) {
  const annotsRef = page.node.get(PDFName.of('Annots'));
  if (!annotsRef) return [];
  let annots;
  try { annots = pdfDoc.context.lookup(annotsRef); } catch { return []; }
  if (!annots || typeof annots.size !== 'function') return [];
  const out = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    let dict;
    try { dict = pdfDoc.context.lookup(ref); } catch { continue; }
    if (!dict || typeof dict.get !== 'function') continue;
    const subtypeObj = dict.get(PDFName.of('Subtype'));
    const subtype = subtypeObj ? String(subtypeObj).replace('/', '') : 'Unknown';
    out.push({
      id: String(ref),
      subtype,
      author: decodeText(dict.get(PDFName.of('T'))),
      contents: decodeText(dict.get(PDFName.of('Contents'))),
      date: decodeText(dict.get(PDFName.of('M'))),
      selected: false,
    });
  }
  return out;
}

/** Remove the given annotation refs (by id string) from a page's /Annots. */
function removeAnnotsFromPage(pdfDoc, page, idSet) {
  const annotsRef = page.node.get(PDFName.of('Annots'));
  if (!annotsRef) return 0;
  const annots = pdfDoc.context.lookup(annotsRef);
  const kept = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    if (!idSet.has(String(ref))) kept.push(ref);
  }
  const removed = annots.size() - kept.length;
  if (kept.length === 0) page.node.delete(PDFName.of('Annots'));
  else page.node.set(PDFName.of('Annots'), pdfDoc.context.obj(kept));
  return removed;
}

// ---- UI ----
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
function setStatus(msg, kind = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + kind;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function totalAnnots() { return pages.reduce((n, p) => n + p.annots.length, 0); }
function selectedCount() { return pages.reduce((n, p) => n + p.annots.filter((a) => a.selected).length, 0); }

function refreshActions() {
  const total = totalAnnots();
  $('removeSelectedBtn').disabled = selectedCount() === 0;
  $('removeSelectedBtn').textContent = `Remove selected (${selectedCount()})`;
  $('removeAllBtn').disabled = total === 0;
  $('downloadBtn').disabled = !pdfDoc || !dirty;
  $('docMeta').textContent = `${pages.length} pages · ${total} annotation${total === 1 ? '' : 's'}${dirty ? ' · modified' : ''}`;
}

function renderPages() {
  const list = $('pageList');
  list.innerHTML = '';
  pages.forEach((p, pi) => {
    const card = document.createElement('div');
    card.className = 'page-card glass' + (p.open ? ' open' : '');
    const n = p.annots.length;
    card.innerHTML = `
      <div class="page-head">
        <span class="chev">▶</span>
        <span class="page-title">Page ${p.index + 1}</span>
        <span class="count-badge ${n === 0 ? 'zero' : ''}">${n}</span>
      </div>
      <div class="annot-list"></div>
      <div class="empty-note ${n === 0 ? 'show' : ''}">No annotations on this page.</div>`;
    card.querySelector('.page-head').addEventListener('click', () => {
      p.open = !p.open;
      card.classList.toggle('open', p.open);
    });
    const annotList = card.querySelector('.annot-list');
    p.annots.forEach((a) => {
      const row = document.createElement('label');
      row.className = 'annot';
      const label = a.contents || a.author || '(no text)';
      row.innerHTML = `
        <input type="checkbox" ${a.selected ? 'checked' : ''}>
        <div class="annot-body">
          <span class="annot-type">${escapeHtml(a.subtype)}</span>
          <div class="annot-text">${escapeHtml(label)}</div>
          <div class="annot-meta">${escapeHtml(a.author ? 'by ' + a.author + ' · ' : '')}${escapeHtml(a.date || '')}</div>
        </div>`;
      row.querySelector('input').addEventListener('change', (e) => {
        a.selected = e.target.checked;
        refreshActions();
      });
      annotList.appendChild(row);
    });
    list.appendChild(card);
  });
  refreshActions();
}

async function loadFile(file) {
  if (!file || !/\.pdf$/i.test(file.name)) {
    setStatus('Please choose a PDF file.', 'err');
    return;
  }
  setStatus('Reading PDF…');
  try {
    const bytes = await file.arrayBuffer();
    // updateMetadata:false — loading must not stamp pdf-lib defaults; we only remove.
    pdfDoc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (e) {
    console.error(e);
    setStatus('Could not open this PDF (it may be encrypted or corrupted).', 'err');
    return;
  }
  fileName = file.name.replace(/\.pdf$/i, '');
  dirty = false;
  const pdfPages = pdfDoc.getPages();
  pages = pdfPages.map((page, index) => ({
    index,
    annots: readAnnotations(pdfDoc, page),
    open: false,
  }));
  if (pages.length > 0) pages[0].open = pages[0].annots.length > 0;
  $('docName').textContent = file.name;
  $('docSection').classList.remove('hidden');
  renderPages();
  const total = totalAnnots();
  setStatus(total === 0 ? 'No annotations found — nothing to clean.' : `Found ${total} annotation${total === 1 ? '' : 's'}. Select and remove.`, total === 0 ? '' : 'ok');
}

function doRemove(idSet) {
  if (!pdfDoc || idSet.size === 0) return;
  const pdfPages = pdfDoc.getPages();
  let removed = 0;
  pages.forEach((p, pi) => {
    removed += removeAnnotsFromPage(pdfDoc, pdfPages[pi], idSet);
    p.annots = p.annots.filter((a) => !idSet.has(a.id));
  });
  dirty = true;
  renderPages();
  setStatus(`Removed ${removed} annotation${removed === 1 ? '' : 's'}. Download the cleaned PDF to save.`, 'ok');
}

async function downloadCleaned() {
  if (!pdfDoc) return;
  setStatus('Building cleaned PDF…');
  try {
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: `${fileName}-cleaned.pdf`, saveAs: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus('Cleaned PDF downloaded.', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Failed to build the PDF.', 'err');
  }
}

function reset() {
  pdfDoc = null; pages = []; dirty = false; fileName = '';
  $('docSection').classList.add('hidden');
  $('fileInput').value = '';
  setStatus('');
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
$('closeBtn').addEventListener('click', reset);
$('removeSelectedBtn').addEventListener('click', () => {
  const ids = new Set();
  pages.forEach((p) => p.annots.forEach((a) => { if (a.selected) ids.add(a.id); }));
  doRemove(ids);
});
$('removeAllBtn').addEventListener('click', () => {
  const ids = new Set();
  pages.forEach((p) => p.annots.forEach((a) => ids.add(a.id)));
  doRemove(ids);
});
$('downloadBtn').addEventListener('click', downloadCleaned);
