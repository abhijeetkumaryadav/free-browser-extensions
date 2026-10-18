'use strict';
/* Image Canvas — load local images, rotate each, merge side-by-side or stacked, download.
   Honest scope: images only. No PDF page operations. */

const $ = (id) => document.getElementById(id);
const ROT_KEY = 'imagecanvas_rotations';

// ===== ENGINE-START =====
/** Rotated bounding box of a w×h rect rotated by deg (0/90/180/270 normalized). */
function rotatedSize(w, h, deg) {
  const d = ((Math.round(deg) % 360) + 360) % 360;
  return (d === 90 || d === 270) ? { w: h, h: w } : { w, h };
}

/** Compute the canvas size for a merge. items: [{w,h}], mode 'side'|'stack', gap. */
function mergeSize(items, mode, gap) {
  const g = Math.max(0, Math.min(100, Number(gap) || 0));
  if (!items.length) return { w: 0, h: 0, positions: [] };
  const positions = [];
  let W, H;
  if (mode === 'stack') {
    W = Math.max(...items.map((i) => i.w));
    H = items.reduce((s, i) => s + i.h, 0) + g * (items.length - 1);
    let y = 0;
    for (const i of items) { positions.push({ x: Math.round((W - i.w) / 2), y }); y += i.h + g; }
  } else {
    W = items.reduce((s, i) => s + i.w, 0) + g * (items.length - 1);
    H = Math.max(...items.map((i) => i.h));
    let x = 0;
    for (const i of items) { positions.push({ x, y: Math.round((H - i.h) / 2) }); x += i.w + g; }
  }
  return { w: W, h: H, positions };
}

/** Draw transform for rotating an image by deg around its center on ctx. */
function rotationSteps(deg) { return ((Math.round(deg / 90) % 4) + 4) % 4; }
// ===== ENGINE-END =====

const state = { imgs: [], mode: 'side' }; // imgs: {el, w, h, deg, url, name}
let rotations = {};

async function loadRot() {
  const d = await chrome.storage.local.get(ROT_KEY);
  rotations = d[ROT_KEY] || {};
}
async function saveRot() { await chrome.storage.local.set({ [ROT_KEY]: rotations }); }

$('files').addEventListener('change', (e) => {
  for (const f of e.target.files) {
    if (!f.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      state.imgs.push({ el: img, w: img.naturalWidth, h: img.naturalHeight, deg: rotations[f.name] || 0, url, name: f.name });
      URL.revokeObjectURL; // keep object URL live for drawing; freed on clear/remove
      renderThumbs(); renderPreview();
    };
    img.src = url;
  }
  e.target.value = '';
});

$('clearBtn').addEventListener('click', () => {
  state.imgs.forEach((i) => URL.revokeObjectURL(i.url));
  state.imgs = []; renderThumbs(); renderPreview();
});

function renderThumbs() {
  const box = $('thumbs');
  if (!state.imgs.length) { box.innerHTML = '<p class="empty">No images loaded.</p>'; return; }
  box.innerHTML = '';
  state.imgs.forEach((it, idx) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    const im = document.createElement('img'); im.src = it.url; im.style.transform = `rotate(${it.deg}deg)`;
    const rot = document.createElement('div'); rot.className = 'rot';
    const l = document.createElement('button'); l.textContent = '⟲'; l.title = 'Rotate left 90°';
    const r = document.createElement('button'); r.textContent = '⟳'; r.title = 'Rotate right 90°';
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.title = 'Remove';
    l.addEventListener('click', () => rotate(idx, -90));
    r.addEventListener('click', () => rotate(idx, 90));
    del.addEventListener('click', () => { URL.revokeObjectURL(it.url); state.imgs.splice(idx, 1); renderThumbs(); renderPreview(); });
    rot.append(l, r); d.append(im, rot, del); box.appendChild(d);
  });
}

async function rotate(idx, delta) {
  const it = state.imgs[idx]; if (!it) return;
  it.deg = ((it.deg + delta) % 360 + 360) % 360;
  rotations[it.name] = it.deg; await saveRot();
  renderThumbs(); renderPreview();
}

$('sideBtn').addEventListener('click', () => { state.mode = 'side'; renderPreview(); });
$('stackBtn').addEventListener('click', () => { state.mode = 'stack'; renderPreview(); });

function renderPreview() {
  const cv = $('canvas');
  const ctx = cv.getContext('2d');
  if (!state.imgs.length) { cv.width = 1; cv.height = 1; $('dlBtn').disabled = true; return; }
  const items = state.imgs.map((it) => rotatedSize(it.w, it.h, it.deg));
  const gap = Math.max(0, Math.min(100, Number($('gap').value) || 0));
  const { w, h, positions } = mergeSize(items, state.mode, gap);
  cv.width = w; cv.height = h;
  ctx.fillStyle = $('bg').value || '#141419';
  ctx.fillRect(0, 0, w, h);
  state.imgs.forEach((it, i) => {
    const p = positions[i];
    const steps = rotationSteps(it.deg);
    ctx.save();
    if (steps) {
      const cx = p.x + items[i].w / 2, cy = p.y + items[i].h / 2;
      ctx.translate(cx, cy); ctx.rotate((steps * Math.PI) / 2);
      ctx.drawImage(it.el, -it.w / 2, -it.h / 2, it.w, it.h);
    } else {
      ctx.drawImage(it.el, p.x, p.y, it.w, it.h);
    }
    ctx.restore();
  });
  $('dlBtn').disabled = false;
}

$('dlBtn').addEventListener('click', () => {
  const cv = $('canvas');
  const a = document.createElement('a');
  a.href = cv.toDataURL('image/png');
  a.download = 'image-canvas-' + new Date().toISOString().slice(0, 10) + '.png';
  a.click();
});

loadRot();
