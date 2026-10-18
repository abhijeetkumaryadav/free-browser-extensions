/* StickyNote PDF — popup logic.
 * Flow: user picks a PDF (kept in memory only) -> pdf-lib reads real page
 * sizes -> schematic page preview on canvas -> click to place sticky notes ->
 * notes persist per-document in chrome.storage.local -> download draws the
 * notes onto a copy of the PDF with pdf-lib. No network, all on-device. */
'use strict';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

// Sticky-note color palette (name + hex). First entry is the default.
const NOTE_COLORS = [
  { name: 'Amber',  hex: '#fbbf24' },
  { name: 'Pink',   hex: '#f472b6' },
  { name: 'Blue',   hex: '#60a5fa' },
  { name: 'Green',  hex: '#34d399' },
  { name: 'Purple', hex: '#a78bfa' },
];

// Drawn note size on the exported PDF (in PDF points).
const STICKY_PT = 22;      // sticky square side
const TEXT_PT = 8;         // note text size
const TEXT_MAX_W_PT = 200; // text wrap width

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let pdfBytes = null;        // ArrayBuffer of the loaded PDF (memory only)
let pageSizes = [];         // [{width, height}] in PDF points, per page
let docKey = null;          // identity key for persisting notes
let docName = '';
let notes = [];             // [{id, page, x, y, text, color}]
let currentPage = 0;        // 0-based
let editingNoteId = null;   // note being edited, or null for a new note
let pendingXY = null;       // click position for a brand-new note

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const els = {
  emptyState: $('empty-state'),
  editor: $('editor'),
  dropzone: $('dropzone'),
  pick: $('btn-pick'),
  fileInput: $('file-input'),
  newDoc: $('btn-new-doc'),
  docName: $('doc-name'),
  noteCount: $('note-count'),
  pageStrip: $('page-strip'),
  canvas: $('page-canvas'),
  canvasHint: document.querySelector('.canvas-hint'),
  noteEditor: $('note-editor'),
  editorTitle: $('editor-title'),
  noteText: $('note-text'),
  colorRow: $('color-row'),
  btnEditorClose: $('btn-editor-close'),
  btnNoteSave: $('btn-note-save'),
  btnNoteDelete: $('btn-note-delete'),
  notesList: $('notes-list'),
  btnDownload: $('btn-download'),
};

const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

/* ------------------------------------------------------------------ */
/* Document loading                                                    */
/* ------------------------------------------------------------------ */

async function loadFile(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    alert('Please choose a PDF file.');
    return;
  }
  try {
    pdfBytes = await file.arrayBuffer();
    // Read real page dimensions with the locally bundled pdf-lib.
    const doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pageSizes = doc.getPages().map((p) => p.getSize());
    if (pageSizes.length === 0) throw new Error('No pages found');
  } catch (err) {
    console.error(err);
    alert('Could not read that PDF. It may be encrypted or corrupted.');
    pdfBytes = null;
    return;
  }

  docName = file.name;
  // Identity for note persistence: name + size + last-modified. Good enough
  // to re-attach notes when the same file is opened again.
  docKey = 'stickynote:' + [file.name, file.size, file.lastModified].join('|');
  currentPage = 0;
  editingNoteId = null;
  pendingXY = null;

  await loadNotes();
  showEditor();
  renderPageStrip();
  renderCanvas();
  renderNotesList();
  updateBadge();
}

async function loadNotes() {
  try {
    const data = await chrome.storage.local.get(docKey);
    notes = Array.isArray(data[docKey]) ? data[docKey] : [];
  } catch {
    notes = [];
  }
}

async function saveNotes() {
  if (!docKey) return;
  try {
    await chrome.storage.local.set({ [docKey]: notes });
  } catch (err) {
    console.error('Failed to persist notes', err);
  }
}

function showEditor() {
  els.emptyState.hidden = true;
  els.editor.hidden = false;
  els.newDoc.hidden = false;
  els.docName.textContent = docName;
  els.docName.title = docName;
}

/* ------------------------------------------------------------------ */
/* Page strip + schematic canvas                                       */
/* ------------------------------------------------------------------ */

function notesOnPage(pageIdx) {
  return notes.filter((n) => n.page === pageIdx);
}

function renderPageStrip() {
  els.pageStrip.innerHTML = '';
  pageSizes.forEach((_, i) => {
    const chip = document.createElement('button');
    chip.className = 'page-chip' + (i === currentPage ? ' active' : '');
    chip.setAttribute('role', 'tab');
    chip.textContent = 'Page ' + (i + 1);
    if (notesOnPage(i).length > 0) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      chip.appendChild(dot);
    }
    chip.addEventListener('click', () => {
      currentPage = i;
      closeEditor();
      renderPageStrip();
      renderCanvas();
      renderNotesList();
    });
    els.pageStrip.appendChild(chip);
  });
}

function renderCanvas() {
  const canvas = els.canvas;
  const { width: pw, height: ph } = pageSizes[currentPage];

  // Fit page width into the canvas box, keep aspect ratio.
  const cssW = canvas.clientWidth || 328;
  const scale = cssW / pw;
  const cssH = ph * scale;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.height = cssH + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Page background.
  ctx.fillStyle = '#2a2a33';
  ctx.fillRect(0, 0, cssW, cssH);
  // Subtle "text lines" so it reads as a document schematic.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  const lineH = Math.max(3, cssH * 0.012);
  for (let y = cssH * 0.08; y < cssH * 0.92; y += lineH * 2.4) {
    const w = cssW * (0.75 + Math.random() * 0.15);
    ctx.fillRect(cssW * 0.08, y, w, lineH);
  }
  // Page number watermark.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = `600 ${Math.max(11, cssW * 0.05)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(currentPage + 1), cssW / 2, cssH - 12);

  // Draw note pins.
  notesOnPage(currentPage).forEach((note) => {
    const x = note.x * cssW;
    const y = note.y * cssH;
    const r = 9;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = note.color;
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = '700 10px sans-serif';
    ctx.fillText('!', x, y + 3.5);
  });
}

// Convert a canvas click into fractional page coordinates (origin top-left).
els.canvas.addEventListener('click', (ev) => {
  const rect = els.canvas.getBoundingClientRect();
  pendingXY = {
    x: Math.min(0.98, Math.max(0.02, (ev.clientX - rect.left) / rect.width)),
    y: Math.min(0.98, Math.max(0.02, (ev.clientY - rect.top) / rect.height)),
  };
  editingNoteId = null;
  openEditor('New note');
});

/* ------------------------------------------------------------------ */
/* Note editor                                                         */
/* ------------------------------------------------------------------ */

function buildColorRow() {
  els.colorRow.innerHTML = '';
  NOTE_COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'color-swatch' + (i === 0 ? ' selected' : '');
    b.style.background = c.hex;
    b.title = c.name;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.name);
    b.dataset.hex = c.hex;
    b.addEventListener('click', () => {
      els.colorRow.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
      b.classList.add('selected');
    });
    els.colorRow.appendChild(b);
  });
}

function selectedColor() {
  const sel = els.colorRow.querySelector('.color-swatch.selected');
  return sel ? sel.dataset.hex : NOTE_COLORS[0].hex;
}

function openEditor(title, note) {
  els.editorTitle.textContent = title;
  els.noteText.value = note ? note.text : '';
  els.btnNoteDelete.hidden = !note;
  // Pre-select the note's color when editing.
  if (note) {
    els.colorRow.querySelectorAll('.color-swatch').forEach((s) => {
      s.classList.toggle('selected', s.dataset.hex === note.color);
    });
  } else {
    els.colorRow.querySelectorAll('.color-swatch').forEach((s, i) => {
      s.classList.toggle('selected', i === 0);
    });
  }
  els.noteEditor.hidden = false;
  els.noteText.focus();
}

function closeEditor() {
  els.noteEditor.hidden = true;
  editingNoteId = null;
  pendingXY = null;
}

els.btnEditorClose.addEventListener('click', closeEditor);

els.btnNoteSave.addEventListener('click', async () => {
  const text = els.noteText.value.trim();
  if (!text) {
    els.noteText.focus();
    return;
  }
  const color = selectedColor();
  if (editingNoteId) {
    const note = notes.find((n) => n.id === editingNoteId);
    if (note) {
      note.text = text;
      note.color = color;
    }
  } else if (pendingXY) {
    notes.push({ id: uid(), page: currentPage, x: pendingXY.x, y: pendingXY.y, text, color });
  }
  await saveNotes();
  closeEditor();
  renderPageStrip();
  renderCanvas();
  renderNotesList();
  updateBadge();
});

els.btnNoteDelete.addEventListener('click', async () => {
  if (!editingNoteId) return;
  notes = notes.filter((n) => n.id !== editingNoteId);
  await saveNotes();
  closeEditor();
  renderPageStrip();
  renderCanvas();
  renderNotesList();
  updateBadge();
});

/* ------------------------------------------------------------------ */
/* Notes list                                                          */
/* ------------------------------------------------------------------ */

function renderNotesList() {
  const list = notesOnPage(currentPage);
  els.notesList.innerHTML = '';
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-notes';
    empty.textContent = 'No notes on this page yet — click the page above to add one.';
    els.notesList.appendChild(empty);
    return;
  }
  list.forEach((note) => {
    const card = document.createElement('div');
    card.className = 'note-card';

    const pin = document.createElement('span');
    pin.className = 'note-pin';
    pin.style.background = note.color;

    const body = document.createElement('div');
    body.className = 'note-body';
    const txt = document.createElement('div');
    txt.className = 'note-text';
    txt.textContent = note.text; // textContent: no HTML injection
    const meta = document.createElement('div');
    meta.className = 'note-meta';
    meta.textContent = `Page ${note.page + 1}`;
    body.appendChild(txt);
    body.appendChild(meta);

    const del = document.createElement('button');
    del.className = 'note-del';
    del.title = 'Delete note';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      notes = notes.filter((n) => n.id !== note.id);
      await saveNotes();
      renderPageStrip();
      renderCanvas();
      renderNotesList();
      updateBadge();
    });

    card.appendChild(pin);
    card.appendChild(body);
    card.appendChild(del);
    card.addEventListener('click', () => {
      editingNoteId = note.id;
      pendingXY = null;
      openEditor('Edit note', note);
    });
    els.notesList.appendChild(card);
  });
}

function updateBadge() {
  els.noteCount.textContent = notes.length === 1 ? '1 note' : `${notes.length} notes`;
}

/* ------------------------------------------------------------------ */
/* Export: draw notes onto a copy of the PDF                            */
/* ------------------------------------------------------------------ */

// Simple greedy word wrap using the embedded font's metrics.
function wrapText(font, text, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      line = trial;
    } else {
      if (line) lines.push(line);
      // A single very long word: hard-split it.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function downloadAnnotated() {
  if (!pdfBytes || notes.length === 0) return;
  const originalHTML = els.btnDownload.innerHTML;
  els.btnDownload.disabled = true;
  els.btnDownload.textContent = 'Building PDF…';
  try {
    const doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = doc.getPages();

    for (const note of notes) {
      const page = pages[note.page];
      if (!page) continue;
      const { width, height } = page.getSize();
      // Fractional coords (top-left origin) -> PDF points (bottom-left origin).
      const cx = note.x * width;
      const cyTop = note.y * height;
      const [r, g, b] = hexToRgb(note.color);
      const color = PDFLib.rgb(r, g, b);

      // Sticky square marker.
      const sx = Math.min(Math.max(cx - STICKY_PT / 2, 4), width - STICKY_PT - 4);
      const sy = Math.min(Math.max(cyTop - STICKY_PT / 2, 4), height - STICKY_PT - 4);
      page.drawRectangle({
        x: sx, y: height - sy - STICKY_PT,
        width: STICKY_PT, height: STICKY_PT,
        color, borderWidth: 0,
      });

      // Note text next to the square, wrapped and clamped to the page.
      const lines = wrapText(font, note.text, TEXT_PT, TEXT_MAX_W_PT);
      const maxLines = 12;
      const shown = lines.slice(0, maxLines);
      let tx = sx + STICKY_PT + 6;
      if (tx + TEXT_MAX_W_PT > width - 8) tx = Math.max(8, width - TEXT_MAX_W_PT - 8);
      let ty = height - sy - 6; // start near the top of the square
      const lineH = TEXT_PT + 3;
      for (const line of shown) {
        if (ty - TEXT_PT < 8) break; // don't run off the bottom
        page.drawText(line, { x: tx, y: ty - TEXT_PT, size: TEXT_PT, font, color: PDFLib.rgb(0.12, 0.12, 0.14) });
        ty -= lineH;
      }
    }

    const out = await doc.save();
    const blob = new Blob([out], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const base = docName.replace(/\.pdf$/i, '');
    await chrome.downloads.download({
      url,
      filename: `${base}-annotated.pdf`,
      saveAs: true,
    });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    console.error(err);
    alert('Could not build the annotated PDF: ' + err.message);
  } finally {
    els.btnDownload.disabled = false;
    els.btnDownload.innerHTML = originalHTML;
  }
}

els.btnDownload.addEventListener('click', downloadAnnotated);

/* ------------------------------------------------------------------ */
/* File input wiring                                                   */
/* ------------------------------------------------------------------ */

els.pick.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => loadFile(els.fileInput.files[0]));

els.newDoc.addEventListener('click', () => {
  els.fileInput.value = '';
  els.fileInput.click();
});

els.dropzone.addEventListener('dragover', (ev) => {
  ev.preventDefault();
  els.dropzone.classList.add('drag');
});
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('drag'));
els.dropzone.addEventListener('drop', (ev) => {
  ev.preventDefault();
  els.dropzone.classList.remove('drag');
  const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
  loadFile(file);
});

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

buildColorRow();
