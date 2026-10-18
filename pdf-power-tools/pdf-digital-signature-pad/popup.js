/* SignStamp — signature pad + PDF stamping (image stamp only, NOT cryptographic).
   All processing is local: pdf-lib is bundled in vendor/, no network calls. */

'use strict';

// ---------- Signature pad ----------
const pad = document.getElementById('pad');
const ctx = pad.getContext('2d');
let drawing = false, mode = 'draw';

function setupPad() {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
setupPad();

function padPos(e) {
  const r = pad.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return [x * (pad.width / r.width), y * (pad.height / r.height)];
}
pad.addEventListener('pointerdown', e => {
  if (mode !== 'draw') return;
  drawing = true; ctx.beginPath(); const [x, y] = padPos(e); ctx.moveTo(x, y);
  pad.setPointerCapture(e.pointerId);
});
pad.addEventListener('pointermove', e => {
  if (!drawing || mode !== 'draw') return;
  const [x, y] = padPos(e); ctx.lineTo(x, y); ctx.stroke();
});
pad.addEventListener('pointerup', () => { drawing = false; });

document.getElementById('mode-draw').addEventListener('click', () => setMode('draw'));
document.getElementById('mode-type').addEventListener('click', () => setMode('type'));
function setMode(m) {
  mode = m;
  document.getElementById('mode-draw').classList.toggle('active', m === 'draw');
  document.getElementById('mode-type').classList.toggle('active', m === 'type');
  document.getElementById('typewrap').classList.toggle('hidden', m === 'draw');
  pad.style.cursor = m === 'draw' ? 'crosshair' : 'default';
  clearPad();
}
function clearPad() { ctx.clearRect(0, 0, pad.width, pad.height); }
document.getElementById('clearpad').addEventListener('click', clearPad);

// Render typed name onto the pad so the saved PNG is WYSIWYG.
function renderTyped() {
  clearPad();
  const name = document.getElementById('typename').value.trim();
  if (!name) return;
  ctx.fillStyle = '#ffffff';
  ctx.font = `52px ${document.getElementById('typefont').value}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 16, pad.height / 2);
}
document.getElementById('typename').addEventListener('input', renderTyped);
document.getElementById('typefont').addEventListener('change', renderTyped);

// ---------- Presets ----------
const presetsEl = document.getElementById('presets');
const activeSigSel = document.getElementById('activesig');
let presets = [];   // [{name, dataUrl}]
let activeIdx = -1;

async function loadPresets() {
  const s = await chrome.storage.local.get('signstamp_presets');
  presets = s.signstamp_presets || [];
  renderPresets();
}
function renderPresets() {
  presetsEl.innerHTML = '';
  activeSigSel.innerHTML = '';
  if (!presets.length) {
    presetsEl.innerHTML = '<span class="empty">No signatures saved yet.</span>';
  }
  presets.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'preset' + (i === activeIdx ? ' selected' : '');
    d.innerHTML = `<img alt="signature"><button class="del" title="Delete">×</button>`;
    d.querySelector('img').src = p.dataUrl;
    d.title = p.name;
    d.addEventListener('click', () => { activeIdx = i; renderPresets(); });
    d.querySelector('.del').addEventListener('click', e => {
      e.stopPropagation();
      presets.splice(i, 1);
      if (activeIdx === i) activeIdx = -1;
      else if (activeIdx > i) activeIdx--;
      chrome.storage.local.set({ signstamp_presets: presets });
      renderPresets();
    });
    presetsEl.appendChild(d);
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    if (i === activeIdx) opt.selected = true;
    activeSigSel.appendChild(opt);
  });
  if (!presets.length) {
    const opt = document.createElement('option');
    opt.textContent = '— save a signature first —';
    activeSigSel.appendChild(opt);
  }
}
activeSigSel.addEventListener('change', () => { activeIdx = +activeSigSel.value; renderPresets(); });

document.getElementById('savepreset').addEventListener('click', async () => {
  if (mode === 'type') renderTyped();
  const dataUrl = pad.toDataURL('image/png');
  const name = `Signature ${presets.length + 1}`;
  presets.push({ name, dataUrl });
  activeIdx = presets.length - 1;
  await chrome.storage.local.set({ signstamp_presets: presets });
  renderPresets();
});

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('tab-sign').classList.toggle('hidden', t.dataset.tab !== 'sign');
  document.getElementById('tab-stamp').classList.toggle('hidden', t.dataset.tab !== 'stamp');
}));

// ---------- PDF stamping ----------
const { PDFDocument } = PDFLib; // bundled locally in vendor/
let pdfBytes = null, pageCount = 0, pageW = 0, pageH = 0;
let markX = 0.5, markY = 0.75; // fractions of schematic preview

document.getElementById('pdffile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  document.getElementById('pdfname').textContent = f.name;
  pdfBytes = await f.arrayBuffer();
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
    const size = doc.getPage(0).getSize();
    pageW = size.width; pageH = size.height;
    document.getElementById('pdfinfo').textContent =
      `${pageCount} page${pageCount > 1 ? 's' : ''} · first page ${Math.round(pageW)}×${Math.round(pageH)} pts`;
    document.getElementById('pagepreview').style.aspectRatio = `${pageW} / ${pageH}`;
    placeMark(markX, markY);
    document.getElementById('stampbtn').disabled = activeIdx < 0;
  } catch (err) {
    document.getElementById('pdfinfo').textContent = 'Could not read this PDF (may be encrypted).';
    pdfBytes = null;
    document.getElementById('stampbtn').disabled = true;
  }
});

const preview = document.getElementById('pagepreview');
const sigmark = document.getElementById('sigmark');
function placeMark(fx, fy) {
  markX = fx; markY = fy;
  sigmark.style.left = (fx * 100) + '%';
  sigmark.style.top = (fy * 100) + '%';
  sigmark.classList.remove('hidden');
}
preview.addEventListener('click', e => {
  const r = preview.getBoundingClientRect();
  placeMark((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
});

const widthRange = document.getElementById('sigwidth');
widthRange.addEventListener('input', () => {
  document.getElementById('sigwidthval').textContent = widthRange.value;
});

function parsePages(spec) {
  spec = spec.trim().toLowerCase();
  if (!spec || spec === 'all') return Array.from({ length: pageCount }, (_, i) => i);
  const out = new Set();
  for (const part of spec.split(',')) {
    const n = parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n >= 1 && n <= pageCount) out.add(n - 1);
  }
  return [...out].sort((a, b) => a - b);
}

document.getElementById('stampbtn').addEventListener('click', async () => {
  const btn = document.getElementById('stampbtn');
  if (!pdfBytes || activeIdx < 0) return;
  btn.disabled = true; btn.textContent = 'Stamping…';
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const p = presets[activeIdx];
    const b64 = p.dataUrl.split(',')[1];
    const img = await doc.embedPng(b64);
    const sigW = +widthRange.value;
    const sigH = sigW * (img.height / img.width);
    const targets = parsePages(document.getElementById('pages').value);
    if (!targets.length) throw new Error('No valid pages selected.');
    for (const pi of targets) {
      const page = doc.getPage(pi);
      const { width, height } = page.getSize();
      // markX/markY are fractions measured from the top-left of the preview;
      // PDF origin is bottom-left.
      const x = markX * width - sigW / 2;
      const y = (1 - markY) * height - sigH / 2;
      page.drawImage(img, { x, y, width: sigW, height: sigH });
    }
    const out = await doc.save();
    const blob = new Blob([out], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'signed.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    btn.textContent = 'Stamped — downloading';
    setTimeout(() => { btn.textContent = 'Stamp & download PDF'; btn.disabled = false; }, 2000);
  } catch (err) {
    btn.textContent = 'Error: ' + (err.message || err);
    setTimeout(() => { btn.textContent = 'Stamp & download PDF'; btn.disabled = false; }, 2500);
  }
});

loadPresets();
