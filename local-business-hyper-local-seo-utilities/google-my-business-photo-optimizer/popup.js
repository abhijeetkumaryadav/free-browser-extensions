/* GBP Photo Optimizer — client-side photo prep for Google Business Profiles.
 * Checks JPG/PNG, >=720px per side, 10KB–5MB, then resizes/crops to the
 * chosen photo type and exports a compressed JPEG. Everything is local. */

'use strict';

// GBP public photo guidelines (documented in README)
const GUIDELINES = {
  formats: ['image/jpeg', 'image/png'],
  minSide: 720,
  minBytes: 10 * 1024,
  maxBytes: 5 * 1024 * 1024,
};

const PROFILES = {
  general: { label: 'General photo', target: null, ratio: null },        // keep aspect, cap longest side
  cover:   { label: 'Cover photo', target: [1024, 576], ratio: 16 / 9 }, // crop to 16:9
  logo:    { label: 'Logo', target: [720, 720], ratio: 1 },              // crop to 1:1
};

const MAX_SIDE = 1600;      // general photos are capped at 1600px longest side
const RATIO_TOLERANCE = 0.03; // aspect-ratio match tolerance

const $ = (id) => document.getElementById(id);
const dropzone = $('dropzone'), fileInput = $('fileInput');
const dropPanel = $('dropPanel'), reportPanel = $('reportPanel');

let original = null;   // { img, width, height, bytes, type, name }
let optimizedBlob = null;
let currentProfile = 'general';
let currentQuality = 0.85;

const ICONS = {
  pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  fail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 8v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
};

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function fmtRatio(w, h) {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(w, h) || 1;
  return `${w / d}:${h / d}`;
}

// ---------- Checks ----------
function runChecks() {
  const { width: w, height: h, bytes, type } = original;
  const profile = PROFILES[currentProfile];
  const items = [];

  items.push({
    label: 'Format is JPG or PNG',
    val: type === 'image/jpeg' ? 'JPG' : type === 'image/png' ? 'PNG' : type.split('/')[1] || 'unknown',
    status: GUIDELINES.formats.includes(type) ? 'pass' : 'fail',
  });

  const minSide = Math.min(w, h);
  items.push({
    label: `At least ${GUIDELINES.minSide}px on each side`,
    val: `${w}×${h}`,
    status: minSide >= GUIDELINES.minSide ? 'pass' : 'fail',
  });

  items.push({
    label: 'File size between 10 KB and 5 MB',
    val: fmtBytes(bytes),
    status: bytes >= GUIDELINES.minBytes && bytes <= GUIDELINES.maxBytes ? 'pass'
      : bytes < GUIDELINES.minBytes ? 'warn' : 'fail',
  });

  if (profile.ratio) {
    const actual = w / h;
    const ok = Math.abs(actual - profile.ratio) / profile.ratio <= RATIO_TOLERANCE;
    items.push({
      label: `${profile.label} aspect ratio (${fmtRatio(profile.target[0], profile.target[1])})`,
      val: fmtRatio(w, h),
      status: ok ? 'pass' : 'warn',
    });
  }

  $('checks').innerHTML = items.map((c) => `
    <li>
      <span class="dot ${c.status}">${ICONS[c.status]}</span>
      <span>${c.label}</span>
      <span class="val">${c.val}</span>
    </li>`).join('');
}

// ---------- Optimization ----------
function optimize() {
  const { img, width: w, height: h } = original;
  const profile = PROFILES[currentProfile];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (profile.target) {
    // Crop-to-fill the target box
    const [tw, th] = profile.target;
    canvas.width = tw; canvas.height = th;
    const scale = Math.max(tw / w, th / h);
    const dw = w * scale, dh = h * scale;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, (tw - dw) / 2, (th - dh) / 2, dw, dh);
  } else {
    // Keep aspect, cap longest side
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  canvas.toBlob((blob) => {
    optimizedBlob = blob;
    const url = URL.createObjectURL(blob);
    $('optImg').src = url;
    $('optMeta').textContent = `${canvas.width}×${canvas.height} · ${fmtBytes(blob.size)} · JPG`;
    const base = original.name.replace(/\.[^.]+$/, '');
    $('fileName').textContent = `${base}-optimized.jpg`;
  }, 'image/jpeg', currentQuality);
}

// ---------- File handling ----------
function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    original = { img, width: img.naturalWidth, height: img.naturalHeight, bytes: file.size, type: file.type, name: file.name };
    $('origImg').src = url;
    $('origMeta').textContent = `${original.width}×${original.height} · ${fmtBytes(original.bytes)} · ${file.type === 'image/png' ? 'PNG' : 'JPG'}`;
    dropPanel.classList.add('hidden');
    reportPanel.classList.remove('hidden');
    runChecks();
    optimize();
  };
  img.onerror = () => alert('Could not read that image file.');
  img.src = url;
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
['dragover', 'dragenter'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));

$('newPhotoBtn').addEventListener('click', () => {
  reportPanel.classList.add('hidden');
  dropPanel.classList.remove('hidden');
  fileInput.value = '';
  original = null; optimizedBlob = null;
});

$('profileSelect').addEventListener('change', (e) => {
  currentProfile = e.target.value;
  chrome.storage.local.set({ gbpProfile: currentProfile });
  runChecks(); optimize();
});

$('qualityRange').addEventListener('input', (e) => {
  currentQuality = e.target.value / 100;
  $('qualityVal').textContent = e.target.value;
  chrome.storage.local.set({ gbpQuality: currentQuality });
  optimize();
});

$('downloadBtn').addEventListener('click', () => {
  if (!optimizedBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(optimizedBlob);
  a.download = $('fileName').textContent;
  a.click();
});

// Restore preferences
chrome.storage.local.get(['gbpProfile', 'gbpQuality'], (prefs) => {
  if (prefs.gbpProfile && PROFILES[prefs.gbpProfile]) {
    currentProfile = prefs.gbpProfile;
    $('profileSelect').value = currentProfile;
  }
  if (typeof prefs.gbpQuality === 'number') {
    currentQuality = prefs.gbpQuality;
    $('qualityRange').value = Math.round(currentQuality * 100);
    $('qualityVal').textContent = Math.round(currentQuality * 100);
  }
});
