/* ShrinkLab — on-device image compression via canvas.
   Images only. Everything happens locally; zero network calls. */

'use strict';

const fileInput = document.getElementById('files');
const dropzone = document.getElementById('dropzone');
const listEl = document.getElementById('list');
const summaryEl = document.getElementById('summary');
const dlAllBtn = document.getElementById('downloadall');
const qSlider = document.getElementById('quality');

qSlider.addEventListener('input', () => {
  document.getElementById('qval').textContent = qSlider.value;
});

// Persist settings on-device.
async function loadSettings() {
  const s = await chrome.storage.local.get('shrinklab_settings');
  if (s.shrinklab_settings) {
    const { maxdim, format, quality } = s.shrinklab_settings;
    document.getElementById('maxdim').value = maxdim;
    document.getElementById('format').value = format;
    qSlider.value = quality;
    document.getElementById('qval').textContent = quality;
  }
}
async function saveSettings() {
  await chrome.storage.local.set({
    shrinklab_settings: {
      maxdim: document.getElementById('maxdim').value,
      format: document.getElementById('format').value,
      quality: qSlider.value,
    },
  });
}
['maxdim', 'format'].forEach(id =>
  document.getElementById(id).addEventListener('change', () => { saveSettings(); recompress(); }));
qSlider.addEventListener('change', () => { saveSettings(); recompress(); });

let originals = []; // [{file, url}]

function handleFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue; // images only
    originals.push({ file: f, url: URL.createObjectURL(f) });
  }
  recompress();
}

fileInput.addEventListener('change', () => handleFiles([...fileInput.files]));
['dragover', 'dragenter'].forEach(ev => dropzone.addEventListener(ev, e => {
  e.preventDefault(); dropzone.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => {
  e.preventDefault(); dropzone.classList.remove('dragover');
}));
dropzone.addEventListener('drop', e => handleFiles([...e.dataTransfer.files]));

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

// Compress one image per current settings. Returns {blob, url, w, h}.
async function compress(file) {
  const maxDim = +document.getElementById('maxdim').value;
  const format = document.getElementById('format').value;
  const quality = +qSlider.value / 100;
  const bmp = await createImageBitmap(file);
  let { width: w, height: h } = bmp;
  if (maxDim > 0 && Math.max(w, h) > maxDim) {
    const k = maxDim / Math.max(w, h);
    w = Math.round(w * k); h = Math.round(h * k);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  if (format === 'image/jpeg') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); } // flatten alpha
  c.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise(res => canvas.toBlob(res, format, format === 'image/png' ? undefined : quality));
  return { blob, url: URL.createObjectURL(blob), w, h };
}

function extFor(format) {
  return format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
}
function baseName(name) { return name.replace(/\.[^.]+$/, '') || 'image'; }

let results = []; // [{orig, out:{blob,url,w,h}}]

async function recompress() {
  results = [];
  listEl.innerHTML = '';
  summaryEl.classList.add('hidden');
  dlAllBtn.classList.add('hidden');
  if (!originals.length) return;
  const prog = document.createElement('div');
  prog.className = 'progress';
  listEl.appendChild(prog);
  for (let i = 0; i < originals.length; i++) {
    prog.textContent = `Compressing ${i + 1} of ${originals.length}…`;
    const orig = originals[i];
    try {
      const out = await compress(orig.file);
      results.push({ orig, out });
    } catch (err) {
      prog.textContent = `Skipped ${orig.file.name} (unreadable).`;
    }
  }
  render();
}

function render() {
  listEl.innerHTML = '';
  if (!results.length) return;
  let totalBefore = 0, totalAfter = 0;
  const format = document.getElementById('format').value;
  results.forEach(({ orig, out }, i) => {
    totalBefore += orig.file.size; totalAfter += out.blob.size;
    const saved = orig.file.size - out.blob.size;
    const pct = orig.file.size ? Math.round((saved / orig.file.size) * 100) : 0;
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<img alt=""><div class="meta"><div class="name"></div>
      <div class="sizes"></div></div><button>Save</button>`;
    el.querySelector('img').src = out.url;
    el.querySelector('.name').textContent = `${baseName(orig.file.name)}.${extFor(format)}`;
    el.querySelector('.sizes').innerHTML =
      `${fmtBytes(orig.file.size)} → <b class="saved">${fmtBytes(out.blob.size)} (−${pct}%)</b> · ${out.w}×${out.h}`;
    el.querySelector('button').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = out.url;
      a.download = `${baseName(orig.file.name)}-compressed.${extFor(format)}`;
      a.click();
    });
    listEl.appendChild(el);
  });
  const saved = totalBefore - totalAfter;
  const pct = totalBefore ? Math.round((saved / totalBefore) * 100) : 0;
  summaryEl.innerHTML = `<div class="stat"><b>${fmtBytes(totalBefore)}</b><span>original</span></div>
    <div class="stat"><b>${fmtBytes(totalAfter)}</b><span>compressed</span></div>
    <div class="stat"><b>−${pct}%</b><span>saved</span></div>`;
  summaryEl.classList.remove('hidden');
  dlAllBtn.classList.remove('hidden');
}

dlAllBtn.addEventListener('click', () => {
  const format = document.getElementById('format').value;
  results.forEach(({ orig, out }, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = out.url;
      a.download = `${baseName(orig.file.name)}-compressed.${extFor(format)}`;
      a.click();
    }, i * 400); // stagger so the browser doesn't block multiples
  });
});

loadSettings();
