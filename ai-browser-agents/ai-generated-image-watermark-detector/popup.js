/* ============================================================
   AI Watermark Detective — popup logic
   - File chosen via user gesture only; parsed locally with FileReader.
   - PNG text chunks (tEXt/iTXt/zTXt) + JPEG APP/COM segment strings
     are decoded and scanned for AI-generator keywords.
   - Visual tab: canvas zoom + grayscale/edge/negative views.
   - Honest labeling throughout: heuristics, not forensic proof.
   ============================================================ */
'use strict';

/* Known AI-generator markers: [pattern (lowercased), label, severity] */
const GENERATOR_PATTERNS = [
  ['midjourney', 'Midjourney', 'high'],
  ['dall-e', 'DALL-E (OpenAI)', 'high'],
  ['dall·e', 'DALL-E (OpenAI)', 'high'],
  ['stable diffusion', 'Stable Diffusion', 'high'],
  ['stability.ai', 'Stability AI', 'high'],
  ['sdxl', 'Stable Diffusion XL', 'high'],
  ['adobe firefly', 'Adobe Firefly', 'high'],
  ['firefly', 'Adobe Firefly', 'med'],
  ['ideogram', 'Ideogram', 'high'],
  ['leonardo', 'Leonardo AI', 'high'],
  ['runway', 'Runway', 'high'],
  ['imagen', 'Google Imagen', 'high'],
  ['gemini', 'Google Gemini', 'med'],
  ['flux', 'Black Forest Labs FLUX', 'med'],
  ['recraft', 'Recraft', 'high'],
  ['playground', 'Playground AI', 'high'],
  ['nightcafe', 'NightCafe', 'high'],
  ['krea', 'Krea AI', 'high'],
  ['pika', 'Pika Labs', 'high'],
  ['dreamstudio', 'DreamStudio', 'high'],
  ['craiyon', 'Craiyon', 'high'],
  ['photoshop generative', 'Photoshop Generative Fill', 'high'],
  ['generative fill', 'Generative Fill', 'med'],
  ['bing image creator', 'Bing Image Creator', 'high'],
  ['ai-generated', 'AI-generated flag', 'high'],
  ['ai generated', 'AI-generated flag', 'high'],
  ['aigc', 'AI-generated content tag', 'med'],
  ['c2pa', 'C2PA provenance manifest', 'high'],
  ['jumbf', 'JUMBF embedded manifest', 'med'],
  ['contentauthenticity', 'Content Authenticity Initiative', 'med'],
  ['ai:', 'AI metadata namespace', 'low']
];

const $ = (id) => document.getElementById(id);
const dropZone = $('dropZone'), fileInput = $('fileInput');
const resultArea = $('resultArea');
const verdictCard = $('verdictCard'), verdictScore = $('verdictScore');
const verdictTitle = $('verdictTitle'), verdictSub = $('verdictSub');
const hintList = $('hintList'), markerList = $('markerList'), fileMeta = $('fileMeta');

let imageEl = null;      // loaded Image for canvas
let currentView = 'color';
let currentZoom = 1;
let lastReport = '';     // for "copy report"

/* ---------- file intake ---------- */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
['dragover', 'dragenter'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
dropZone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
  fileInput.value = '';
});

function handleFile(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    alert('Please choose a PNG, JPEG or WebP image.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const buffer = reader.result;
    const textBlobs = extractTextBlobs(buffer, file.type);
    const analysis = analyze(buffer, file, textBlobs);
    renderReport(analysis);
    loadVisual(buffer);
    resultArea.hidden = false;
    resultArea.scrollIntoView({ block: 'nearest' });
  };
  reader.readAsArrayBuffer(file);
}

/* ---------- binary metadata extraction ---------- */

function bytesToAscii(bytes, start, end) {
  let s = '';
  for (let i = start; i < end; i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
    else if (c === 0) s += ' ';
    else if (s.length && !s.endsWith(' ')) s += ' ';
  }
  return s;
}

/** Pull printable strings + structured PNG text chunks out of the file. */
function extractTextBlobs(buffer, mime) {
  const bytes = new Uint8Array(buffer);
  const blobs = [];
  const push = (kind, text) => {
    text = (text || '').replace(/\s+/g, ' ').trim();
    if (text.length >= 4) blobs.push({ kind, text: text.slice(0, 1200) });
  };

  if (mime === 'image/png') {
    // PNG: 8-byte signature, then chunks: length(4) type(4) data crc(4)
    let pos = 8;
    while (pos + 12 <= bytes.length) {
      const len = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      if (len < 0 || len > 50_000_000 || pos + 12 + len > bytes.length) break;
      const d = pos + 8;
      if (type === 'tEXt' || type === 'zTXt') {
        push('PNG ' + type, bytesToAscii(bytes, d, d + len));
      } else if (type === 'iTXt') {
        push('PNG iTXt', bytesToAscii(bytes, d, d + len));
      } else if (type === 'eXIf') {
        push('PNG eXIf', bytesToAscii(bytes, d, d + len));
      }
      if (type === 'IEND') break;
      pos = d + len + 4;
    }
  } else if (mime === 'image/jpeg') {
    // JPEG: walk markers, grab printable runs from APPn + COM segments
    let pos = 2;
    while (pos + 4 <= bytes.length) {
      if (bytes[pos] !== 0xFF) break;
      const marker = bytes[pos + 1];
      pos += 2;
      if (marker === 0xD8 || marker === 0xD9) break;
      if (marker >= 0xD0 && marker <= 0xD7) continue; // restart markers have no length
      const segLen = (bytes[pos] << 8) | bytes[pos + 1];
      if (segLen < 2 || pos + segLen > bytes.length) break;
      const name = marker === 0xFE ? 'COM' : (marker >= 0xE0 && marker <= 0xEF ? 'APP' + (marker - 0xE0) : 'SEG');
      push('JPEG ' + name, bytesToAscii(bytes, pos + 2, pos + segLen));
      pos += segLen;
    }
  }
  // Whole-file printable fallback (catches XMP packets, C2PA/JUMBF headers)
  push('file-wide strings', bytesToAscii(bytes, 0, Math.min(bytes.length, 1_000_000)));
  return blobs;
}

/* ---------- analysis ---------- */

function analyze(buffer, file, blobs) {
  const hints = [];   // {severity,label,detail}
  const markers = []; // raw strings shown in "Raw markers found"
  const seen = new Set();

  for (const blob of blobs) {
    const lower = blob.text.toLowerCase();
    for (const [pattern, label, severity] of GENERATOR_PATTERNS) {
      if (lower.includes(pattern)) {
        const key = pattern + '|' + label;
        if (!seen.has(key)) {
          seen.add(key);
          // excerpt around the match
          const idx = lower.indexOf(pattern);
          const excerpt = blob.text.slice(Math.max(0, idx - 40), idx + pattern.length + 40);
          hints.push({ severity, label, detail: `${blob.kind}: "…${excerpt}…"`, weight: severity === 'high' ? 3 : severity === 'med' ? 2 : 1 });
          if (markers.length < 12) markers.push(`${blob.kind} → ${excerpt.slice(0, 120)}`);
        }
      }
    }
  }

  // filename heuristics
  const nameLower = file.name.toLowerCase();
  const fnameWords = ['midjourney', 'dall-e', 'stable-diffusion', 'firefly', 'ideogram', 'leonardo', 'imagen', 'generated', 'ai_image'];
  for (const w of fnameWords) {
    if (nameLower.includes(w)) {
      hints.push({ severity: 'low', label: 'Filename hint', detail: `filename contains "${w}" — weak signal on its own`, weight: 0 });
    }
  }

  const score = Math.min(100, hints.reduce((s, h) => s + h.weight * 12, 0));
  let verdict, verdictSub2;
  if (score >= 50) {
    verdict = 'AI hints found'; verdictSub2 = 'Strong markers suggest this image came from an AI generator.';
  } else if (score > 0) {
    verdict = 'Weak hints found'; verdictSub2 = 'A few faint markers — treat as a lead, not a conclusion.';
  } else {
    verdict = 'No hints found'; verdictSub2 = 'No known AI-generator markers in metadata. This proves nothing either way.';
  }

  const kb = (buffer.byteLength / 1024);
  const meta = [
    `<span>Name <b>${escapeHtml(file.name)}</b></span>`,
    `<span>Size <b>${kb > 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(1) + ' KB'}</b></span>`,
    `<span>Type <b>${escapeHtml(file.type)}</b></span>`,
    `<span>Chunks scanned <b>${blobs.length}</b></span>`
  ];

  lastReport =
    `AI Watermark Detective report (heuristic, not forensic proof)\n` +
    `File: ${file.name} (${file.type}, ${(buffer.byteLength / 1024).toFixed(1)} KB)\n` +
    `Verdict: ${verdict} — score ${score}/100\n\n` +
    (hints.length
      ? 'Hints:\n' + hints.map((h) => `  [${h.severity.toUpperCase()}] ${h.label} — ${h.detail}`).join('\n')
      : 'No known AI-generator markers found in metadata.\n');

  return { score, verdict, verdictSub: verdictSub2, hints, markers, meta };
}

/* ---------- report rendering ---------- */

function renderReport(a) {
  verdictScore.textContent = a.score;
  verdictScore.style.borderColor = a.score >= 50 ? '#ef4444' : a.score > 0 ? 'var(--accent)' : '#38bdf8';
  verdictScore.style.color = a.score >= 50 ? '#ef4444' : a.score > 0 ? 'var(--accent)' : '#38bdf8';
  verdictTitle.textContent = a.verdict;
  verdictSub.textContent = a.verdictSub;

  fileMeta.innerHTML = a.meta.join('');

  hintList.innerHTML = '';
  if (!a.hints.length) {
    hintList.innerHTML = '<li class="empty">No AI-generator hints detected in metadata.</li>';
  } else {
    for (const h of a.hints) {
      const li = document.createElement('li');
      li.className = 'hint';
      const head = document.createElement('div');
      head.className = 'hint-head';
      const dot = document.createElement('span');
      dot.className = 'dot ' + (h.severity === 'high' ? 'high' : h.severity === 'med' ? 'med' : 'low');
      head.appendChild(dot);
      head.appendChild(document.createTextNode(h.label + ' — ' + h.severity.toUpperCase()));
      const body = document.createElement('div');
      body.className = 'hint-body';
      body.appendChild(document.createTextNode(h.detail.split(':')[0] + ': '));
      const code = document.createElement('code');
      code.textContent = h.detail.slice(h.detail.indexOf(':') + 1).trim().replace(/^"|"$/g, '');
      body.appendChild(code);
      li.appendChild(head);
      li.appendChild(body);
      hintList.appendChild(li);
    }
  }

  markerList.innerHTML = '';
  if (!a.markers.length) {
    markerList.innerHTML = '<li class="empty">No raw marker strings to show.</li>';
  } else {
    for (const m of a.markers) {
      const li = document.createElement('li');
      li.textContent = m;
      markerList.appendChild(li);
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $('tab-meta').hidden = tab.dataset.tab !== 'meta';
    $('tab-visual').hidden = tab.dataset.tab !== 'visual';
    if (tab.dataset.tab === 'visual') renderCanvas();
  });
});

/* ---------- visual checker ---------- */

function loadVisual(buffer) {
  const blob = new Blob([buffer]);
  const url = URL.createObjectURL(blob);
  imageEl = new Image();
  imageEl.onload = () => { URL.revokeObjectURL(url); renderCanvas(); };
  imageEl.src = url;
}

const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function renderCanvas() {
  if (!imageEl || $('tab-visual').hidden) return;
  const maxW = 700, maxH = 460;
  const fit = Math.min(maxW / imageEl.naturalWidth, maxH / imageEl.naturalHeight, 1);
  const w = Math.round(imageEl.naturalWidth * fit * currentZoom);
  const h = Math.round(imageEl.naturalHeight * fit * currentZoom);
  canvas.width = w; canvas.height = h;
  ctx.imageSmoothingEnabled = currentZoom <= 1;
  ctx.drawImage(imageEl, 0, 0, w, h);

  if (currentView !== 'color') {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    if (currentView === 'gray') {
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = g;
      }
    } else if (currentView === 'neg') {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
      }
    } else if (currentView === 'edges') {
      // simple edge-contrast: difference from blurred neighbor approximation
      const src = new Uint8ClampedArray(d);
      const step = w * 4;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const avg = (src[i - step + c] + src[i + step + c] + src[i - 4 + c] + src[i + 4 + c]) / 4;
            const diff = Math.min(255, Math.abs(src[i + c] - avg) * 4);
            d[i + c] = diff;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentView = chip.dataset.view;
    renderCanvas();
  });
});

$('zoomRange').addEventListener('input', (e) => {
  currentZoom = parseFloat(e.target.value);
  $('zoomLabel').textContent = currentZoom.toFixed(2).replace(/\.?0+$/, '') + '×';
  renderCanvas();
});

/* ---------- actions ---------- */

$('clearBtn').addEventListener('click', () => {
  imageEl = null; lastReport = '';
  resultArea.hidden = true;
  verdictScore.textContent = '–';
});

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastReport);
    const btn = $('copyBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  } catch {
    alert('Clipboard write failed.');
  }
});
