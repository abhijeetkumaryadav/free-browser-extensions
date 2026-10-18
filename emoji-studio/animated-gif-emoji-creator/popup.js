'use strict';
/**
 * FrameFX — canvas emoji animation studio.
 * Honest scope: renders animation frames on a canvas and exports them as
 * a PNG sequence via blob download. No GIF encoding, no network.
 */

// ---------- state ----------
const state = {
  emoji: '🎉',
  anim: 'bounce',
  fps: 12,
  frames: 12,
  size: 96,
  playing: true,
  frameIndex: 0,
  lastTick: 0,
};

const SWATCHES = ['🎉', '🔥', '⭐', '💡', '🚀', '🎨', '😎', '❤️'];

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const statusEl = $('status');

// ---------- persistence ----------
function saveSettings() {
  chrome.storage.local.set({ framefx: state }, () => {});
}
async function loadSettings() {
  try {
    const { framefx } = await chrome.storage.local.get('framefx');
    if (framefx) Object.assign(state, framefx);
  } catch (e) { /* storage unavailable — defaults stand */ }
}

// ---------- animation math ----------
// Each animation is a pure function of normalized time t in [0,1),
// returning {dx, dy, rot, scale} for the emoji transform.
const ANIMATIONS = {
  bounce(t) {
    const y = -Math.abs(Math.sin(t * Math.PI * 2)) * 34;
    return { dx: 0, dy: y, rot: 0, scale: 1 };
  },
  spin(t) {
    return { dx: 0, dy: 0, rot: t * Math.PI * 2, scale: 1 };
  },
  pulse(t) {
    const s = 1 + 0.25 * Math.sin(t * Math.PI * 2);
    return { dx: 0, dy: 0, rot: 0, scale: s };
  },
  shake(t) {
    const x = Math.sin(t * Math.PI * 2 * 3) * 12;
    return { dx: x, dy: 0, rot: 0, scale: 1 };
  },
};

// ---------- rendering ----------
function drawFrame(t) {
  const { dx, dy, rot, scale } = ANIMATIONS[state.anim](t);
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 + dx, H / 2 + dy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.font = `${state.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.emoji, 0, 0);
  ctx.restore();
}

// ---------- preview loop ----------
function loop(ts) {
  if (!state.playing) return;
  const interval = 1000 / state.fps;
  if (ts - state.lastTick >= interval) {
    state.lastTick = ts;
    drawFrame(state.frameIndex / state.frames);
    state.frameIndex = (state.frameIndex + 1) % state.frames;
  }
  requestAnimationFrame(loop);
}
function replay() {
  state.frameIndex = 0;
  state.lastTick = 0;
  if (!state.playing) { state.playing = true; requestAnimationFrame(loop); }
}

// ---------- export ----------
function flash(msg, ok = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (ok ? ' ok' : '');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status'; }, 4000);
}

// Download helper: blob URL + temporary anchor click (no `downloads` permission needed).
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportFrames() {
  if (!state.emoji.trim()) { flash('Pick an emoji first.'); return; }
  flash(`Rendering ${state.frames} frames…`);
  // Render each frame deterministically, then convert to blob one at a time
  // with a small delay between downloads so the browser accepts them.
  for (let i = 0; i < state.frames; i++) {
    drawFrame(i / state.frames);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (blob) downloadBlob(blob, `framefx-${state.anim}-${String(i + 1).padStart(3, '0')}.png`);
    // Yield to the browser so downloads register reliably.
    await new Promise((res) => setTimeout(res, 120));
  }
  drawFrame(state.frameIndex / state.frames);
  flash(`Exported ${state.frames} PNG frames.`, true);
}

// ---------- wiring ----------
function setAnim(name, btn) {
  state.anim = name;
  document.querySelectorAll('.anim-btn').forEach((b) => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
  state.frameIndex = 0;
  saveSettings();
}

function syncControls() {
  $('emojiInput').value = state.emoji;
  $('fpsRange').value = state.fps;
  $('framesRange').value = state.frames;
  $('sizeRange').value = state.size;
  $('fpsVal').textContent = `${state.fps} fps`;
  $('framesVal').textContent = state.frames;
  $('sizeVal').textContent = `${state.size} px`;
  const btn = document.querySelector(`.anim-btn[data-anim="${state.anim}"]`);
  if (btn) setAnim(state.anim, btn);
}

async function init() {
  await loadSettings();

  // emoji input + swatches
  const sw = $('swatches');
  SWATCHES.forEach((e) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.title = `Use ${e}`;
    b.addEventListener('click', () => {
      state.emoji = e;
      $('emojiInput').value = e;
      saveSettings();
    });
    sw.appendChild(b);
  });
  $('emojiInput').addEventListener('input', (ev) => {
    state.emoji = [...ev.target.value][0] || '';
    saveSettings();
  });

  // animation buttons
  document.querySelectorAll('.anim-btn').forEach((b) => {
    b.addEventListener('click', () => setAnim(b.dataset.anim, b));
  });

  // sliders
  $('fpsRange').addEventListener('input', (e) => { state.fps = +e.target.value; $('fpsVal').textContent = `${state.fps} fps`; saveSettings(); });
  $('framesRange').addEventListener('input', (e) => { state.frames = +e.target.value; $('framesVal').textContent = state.frames; saveSettings(); });
  $('sizeRange').addEventListener('input', (e) => { state.size = +e.target.value; $('sizeVal').textContent = `${state.size} px`; saveSettings(); });

  // actions
  $('playBtn').addEventListener('click', replay);
  $('exportBtn').addEventListener('click', exportFrames);

  syncControls();
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', init);
