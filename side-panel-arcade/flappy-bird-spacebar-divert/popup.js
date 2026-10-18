/* FlapDash — flappy-style arcade game.
 * Smooth physics, day/night tint cycling, score + best score in chrome.storage.local.
 * Controls: Spacebar / ArrowUp / click to flap.
 */
'use strict';

// ---------- Config ----------
const W = 348, H = 400;
const GRAVITY = 0.45, FLAP_V = -7.6, MAX_FALL = 11;
const BIRD_X = 92, BIRD_R = 12;
const PIPE_W = 58, PIPE_GAP = 118, PIPE_SPACING = 205, PIPE_SPEED = 2.2;
const GROUND_H = 46;
const DAY_MS = 40000; // full day/night cycle

// Sky palettes: [top, bottom] lerp between day and night.
const DAY = { top: [125, 211, 252], bot: [224, 242, 254] };
const NIGHT = { top: [10, 18, 38], bot: [30, 48, 84] };

// Fixed star field (generated once, twinkles at night).
const STARS = Array.from({ length: 40 }, () => ({
  x: Math.random() * W,
  y: Math.random() * (H - GROUND_H - 60),
  r: Math.random() * 1.6 + 0.6,
  p: Math.random() * Math.PI * 2,
}));

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

// ---------- State ----------
let state; // 'ready' | 'play' | 'over'
let bird, pipes, score, best, frame, wingPhase, deathTimer;

function reset() {
  state = 'ready';
  bird = { y: H / 2 - 40, v: 0, rot: 0 };
  pipes = [];
  score = 0;
  frame = 0;
  wingPhase = 0;
  deathTimer = 0;
  scoreEl.textContent = '0';
}

function startPlay() {
  state = 'play';
  flap();
}

function flap() {
  bird.v = FLAP_V;
  wingPhase = 0;
}

function gameOver() {
  state = 'over';
  deathTimer = 0;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    chrome.storage.local.set({ best });
  }
}

function spawnPipe() {
  const margin = 60;
  const gapY = margin + Math.random() * (H - GROUND_H - PIPE_GAP - margin * 2) + PIPE_GAP / 2;
  pipes.push({ x: W + 10, gapY, scored: false });
}

// ---------- Update ----------
function update() {
  frame++;
  if (state === 'ready') {
    // Gentle hover while waiting.
    bird.y = H / 2 - 40 + Math.sin(frame / 18) * 8;
    bird.rot = Math.sin(frame / 18 + 1) * 0.08;
    return;
  }
  if (state === 'over') {
    deathTimer++;
    // Let the bird tumble to the ground.
    if (bird.y < H - GROUND_H - BIRD_R) {
      bird.v = Math.min(bird.v + GRAVITY, MAX_FALL);
      bird.y += bird.v;
      bird.rot = Math.min(bird.rot + 0.12, Math.PI / 2.2);
    }
    return;
  }

  // Physics.
  bird.v = Math.min(bird.v + GRAVITY, MAX_FALL);
  bird.y += bird.v;
  bird.rot = Math.max(-0.35, Math.min(Math.PI / 3, bird.v * 0.09));
  wingPhase += 0.35;

  // Pipes.
  if (pipes.length === 0 || pipes[pipes.length - 1].x < W - PIPE_SPACING) spawnPipe();
  for (const p of pipes) {
    p.x -= PIPE_SPEED;
    if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
      p.scored = true;
      score++;
      scoreEl.textContent = score;
    }
  }
  if (pipes.length && pipes[0].x < -PIPE_W - 10) pipes.shift();

  // Collisions: ceiling, ground, pipes.
  if (bird.y - BIRD_R <= 0 || bird.y + BIRD_R >= H - GROUND_H) {
    bird.y = Math.min(Math.max(bird.y, BIRD_R), H - GROUND_H - BIRD_R);
    gameOver();
    return;
  }
  for (const p of pipes) {
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    if (inX) {
      const topBottom = p.gapY - PIPE_GAP / 2;
      const botTop = p.gapY + PIPE_GAP / 2;
      if (bird.y - BIRD_R < topBottom || bird.y + BIRD_R > botTop) {
        gameOver();
        return;
      }
    }
  }
}

// ---------- Render ----------
function lerp(a, b, t) { return a + (b - a) * t; }
function mixCol(c1, c2, t) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}

function draw() {
  // Day/night phase: 0 = noon, 0.5 = midnight.
  const phase = (Date.now() % DAY_MS) / DAY_MS;
  const nightAmt = (1 - Math.cos(phase * Math.PI * 2)) / 2; // smooth 0..1..0

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, mixCol(DAY.top, NIGHT.top, nightAmt));
  sky.addColorStop(1, mixCol(DAY.bot, NIGHT.bot, nightAmt));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars fade in at night.
  if (nightAmt > 0.25) {
    ctx.save();
    ctx.globalAlpha = (nightAmt - 0.25) / 0.75;
    for (const s of STARS) {
      const tw = 0.5 + 0.5 * Math.sin(frame / 20 + s.p);
      ctx.globalAlpha = ((nightAmt - 0.25) / 0.75) * tw;
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Sun/moon arc across the sky.
  const orbA = phase * Math.PI * 2 - Math.PI / 2;
  const orbX = W / 2 + Math.cos(orbA) * (W / 2 + 20);
  const orbY = H / 2 - Math.sin(orbA) * 150;
  const isNight = nightAmt > 0.5;
  ctx.beginPath();
  ctx.arc(orbX, orbY, isNight ? 14 : 20, 0, Math.PI * 2);
  ctx.fillStyle = isNight ? '#e2e8f0' : '#fde68a';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;
  if (isNight) {
    ctx.beginPath();
    ctx.arc(orbX - 6, orbY - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = mixCol(DAY.top, NIGHT.top, nightAmt);
    ctx.fill();
  }

  // Pipes.
  for (const p of pipes) {
    const topH = p.gapY - PIPE_GAP / 2;
    const botY = p.gapY + PIPE_GAP / 2;
    drawPipe(p.x, 0, topH, true);
    drawPipe(p.x, botY, H - GROUND_H - botY, false);
  }

  // Ground.
  ctx.fillStyle = nightAmt > 0.5 ? '#16233a' : '#3f6212';
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
  ctx.fillStyle = nightAmt > 0.5 ? '#1e3a5f' : '#65a30d';
  ctx.fillRect(0, H - GROUND_H, W, 8);
  // Scrolling ground stripes.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  const off = state === 'play' ? (frame * PIPE_SPEED) % 36 : 0;
  for (let x = -36 + off; x < W; x += 36) ctx.fillRect(x, H - GROUND_H + 14, 18, 6);

  drawBird();

  // Overlays.
  if (state === 'ready') {
    overlay('FlapDash', 'Spacebar or click to start');
  } else if (state === 'over' && deathTimer > 25) {
    overlay('Game over', `Score ${score} · Best ${best} — flap to retry`);
  }
}

function drawPipe(x, y, h, isTop) {
  if (h <= 0) return;
  const grad = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  grad.addColorStop(0, '#166534');
  grad.addColorStop(0.5, '#22c55e');
  grad.addColorStop(1, '#14532d');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, PIPE_W, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y - 2, PIPE_W - 2, h + 4);
  // Cap lip.
  const lipH = 18, lipX = x - 4, lipW = PIPE_W + 8;
  const lipY = isTop ? y + h - lipH : y;
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(lipX, lipY, lipW, lipH);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(lipX + 1, lipY + 1, lipW - 2, lipH - 2);
}

function drawBird() {
  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate(bird.rot);
  // Body.
  const body = ctx.createLinearGradient(0, -BIRD_R, 0, BIRD_R);
  body.addColorStop(0, '#7dd3fc');
  body.addColorStop(1, '#0284c7');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wing (flaps).
  const w = Math.sin(wingPhase) * 6;
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.ellipse(-3, 2 + w * 0.4, 9, 5 + w * 0.3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Eye.
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(6, -4, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(7.5, -4, 2.2, 0, Math.PI * 2); ctx.fill();
  // Beak.
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.moveTo(BIRD_R + 1, -1);
  ctx.lineTo(BIRD_R + 8, 2);
  ctx.lineTo(BIRD_R + 1, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function overlay(title, sub) {
  ctx.fillStyle = 'rgba(5,8,15,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '800 30px -apple-system, Segoe UI, sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 60);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 13px -apple-system, Segoe UI, sans-serif';
  ctx.fillText(sub, W / 2, H / 2 - 32);
  // Pulsing flap hint bird icon.
  const s = 1 + Math.sin(frame / 12) * 0.08;
  ctx.save();
  ctx.translate(W / 2, H / 2 + 10);
  ctx.scale(s, s);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b0f1a';
  ctx.font = '800 13px sans-serif';
  ctx.fillText('␣', 0, 5);
  ctx.restore();
}

// ---------- Input ----------
function press() {
  if (state === 'ready') startPlay();
  else if (state === 'play') flap();
  else if (state === 'over' && deathTimer > 25) { reset(); startPlay(); }
}

canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (!e.repeat) press();
  }
});

// ---------- Boot ----------
chrome.storage.local.get({ best: 0 }, (res) => {
  best = res.best || 0;
  bestEl.textContent = best;
  reset();
  (function loop() {
    requestAnimationFrame(loop);
    update();
    draw();
  })();
});
