/* TabGuard — Tower Defense game engine.
 * Canvas grid, fixed enemy path, 3 tower types with upgrades, wave economy.
 * No network, no tracking — best wave persists in chrome.storage.local.
 */
'use strict';

// ---------------- Config ----------------
const COLS = 12, ROWS = 8, CELL = 64;
const W = COLS * CELL, H = ROWS * CELL;

// Path waypoints in grid coordinates (ends run off-screen).
const GRID_PATH = [
  [-1, 3], [3, 3], [3, 6], [6, 6], [6, 2], [9, 2], [9, 6], [12, 6],
];
const PATH = GRID_PATH.map(([gx, gy]) => ({ x: (gx + 0.5) * CELL, y: (gy + 0.5) * CELL }));

const TOWER_TYPES = {
  arrow:  { name: 'Arrow',  cost: 50,  range: 2.6, dmg: 14, rate: 2.0, projSpeed: 430, color: '#f59e0b', desc: 'Fast single-target shots' },
  cannon: { name: 'Cannon', cost: 110, range: 2.1, dmg: 44, rate: 0.7, projSpeed: 300, splash: 1.15, color: '#ef4444', desc: 'Slow, heavy splash damage' },
  frost:  { name: 'Frost',  cost: 80,  range: 2.2, dmg: 6,  rate: 1.4, projSpeed: 370, slow: 0.5, slowDur: 2.2, color: '#38bdf8', desc: 'Chills enemies, slowing them' },
};
const MAX_LEVEL = 3;
const START_GOLD = 160, START_LIVES = 20;
const SELL_RATE = 0.7;

// Cells the enemy path passes through (towers cannot be built here).
const pathCells = new Set();
(function markPath() {
  for (let s = 0; s < PATH.length - 1; s++) {
    const a = PATH[s], b = PATH[s + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(len / (CELL / 4));
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps;
      const y = a.y + ((b.y - a.y) * i) / steps;
      pathCells.add(Math.floor(x / CELL) + ',' + Math.floor(y / CELL));
    }
  }
})();

// ---------------- State ----------------
let gold, lives, wave, towers, enemies, projectiles, particles;
let spawnQueue, spawnTimer, gameState; // 'build' | 'wave' | 'over'
let speedMul, paused, selectedType, selectedTower, hoverCell, bestWave;
let towerSeq;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function reset() {
  gold = START_GOLD; lives = START_LIVES; wave = 0;
  towers = []; enemies = []; projectiles = []; particles = [];
  spawnQueue = []; spawnTimer = 0; gameState = 'build';
  speedMul = 1; paused = false;
  selectedType = null; selectedTower = null; hoverCell = null; towerSeq = 0;
  document.getElementById('banner').classList.add('hidden');
  document.getElementById('startBtn').disabled = false;
  document.getElementById('pauseBtn').textContent = 'Pause';
  buildShop();
  renderTowerInfo();
  updateHUD();
}

// ---------------- Enemies ----------------
function makeEnemy(type, w) {
  const hpScale = Math.pow(1.22, w - 1);
  const base = {
    normal: { hp: 34,  speed: 62,  r: 11, color: '#f87171', rewardMul: 1.0, lives: 1 },
    fast:   { hp: 22,  speed: 102, r: 9,  color: '#fbbf24', rewardMul: 0.9, lives: 1 },
    tank:   { hp: 125, speed: 40,  r: 15, color: '#a78bfa', rewardMul: 2.2, lives: 2 },
  }[type];
  const hp = Math.round(base.hp * hpScale);
  return {
    type, x: PATH[0].x, y: PATH[0].y, wp: 1,
    hp, maxHp: hp, speed: base.speed, r: base.r, color: base.color,
    reward: Math.round((6 + w * 1.6) * base.rewardMul),
    lifeCost: base.lives, dist: 0,
    slowUntil: 0, slowFactor: 1,
  };
}

// Wave composition: count grows, runners/tanks mixed in.
function buildWaveQueue(w) {
  const q = [];
  const count = 5 + w * 2;
  for (let i = 0; i < count; i++) {
    let t = 'normal';
    if (w >= 3 && i % 5 === 4) t = 'tank';
    else if (i % 3 === 2) t = 'fast';
    q.push(t);
  }
  return q;
}

function startWave() {
  if (gameState !== 'build') return;
  wave++;
  gameState = 'wave';
  spawnQueue = buildWaveQueue(wave);
  spawnTimer = 0;
  if (wave > bestWave) {
    bestWave = wave;
    chrome.storage.local.set({ bestWave });
  }
  document.getElementById('startBtn').disabled = true;
  updateHUD();
}

// ---------------- Towers ----------------
function towerStats(type, level) {
  const b = TOWER_TYPES[type];
  const mul = Math.pow(1.7, level - 1);
  return {
    range: b.range + 0.25 * (level - 1),
    dmg: Math.round(b.dmg * mul),
    rate: b.rate * Math.pow(1.15, level - 1),
  };
}

function upgradeCost(tower) {
  if (tower.level >= MAX_LEVEL) return null;
  return Math.round(TOWER_TYPES[tower.type].cost * tower.level * 0.8);
}

function placeTower(gx, gy) {
  const type = selectedType;
  const cost = TOWER_TYPES[type].cost;
  if (gold < cost) return;
  gold -= cost;
  const t = { id: ++towerSeq, gx, gy, type, level: 1, cooldown: 0, angle: -Math.PI / 2, invested: cost };
  towers.push(t);
  selectedTower = t;
  renderTowerInfo();
  updateHUD();
}

function upgradeTower(t) {
  const cost = upgradeCost(t);
  if (cost === null || gold < cost) return;
  gold -= cost;
  t.invested += cost;
  t.level++;
  renderTowerInfo();
  updateHUD();
}

function sellTower(t) {
  gold += Math.round(t.invested * SELL_RATE);
  towers = towers.filter((x) => x !== t);
  selectedTower = null;
  renderTowerInfo();
  updateHUD();
}

// ---------------- Combat ----------------
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }

function towerXY(t) {
  return { x: (t.gx + 0.5) * CELL, y: (t.gy + 0.5) * CELL };
}

// Pick the in-range enemy furthest along the path.
function acquireTarget(t, st) {
  const { x, y } = towerXY(t);
  const rangePx = st.range * CELL;
  let best = null;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (dist(x, y, e.x, e.y) <= rangePx && (!best || e.dist > best.dist)) best = e;
  }
  return best;
}

function fireTower(t, target, st, now) {
  const base = TOWER_TYPES[t.type];
  const { x, y } = towerXY(t);
  projectiles.push({
    x, y, target,
    dmg: st.dmg, speed: base.projSpeed,
    splash: base.splash || 0,
    slow: base.slow || 0, slowDur: base.slowDur || 0,
    color: base.color, now,
  });
  t.angle = Math.atan2(target.y - y, target.x - x);
}

function damageEnemy(e, dmg, now) {
  e.hp -= dmg;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    gold += e.reward;
    // Death burst particles.
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.4, color: e.color });
    }
  }
}

function applyProjectileHit(p, now) {
  const e = p.target;
  if (p.splash > 0) {
    for (const o of enemies) {
      if (o.hp > 0 && dist(e.x, e.y, o.x, o.y) <= p.splash * CELL) damageEnemy(o, p.dmg, now);
    }
    particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.25, color: '#fdba74', ring: p.splash * CELL });
  } else {
    damageEnemy(e, p.dmg, now);
  }
  if (p.slow > 0 && e.hp > 0) {
    e.slowUntil = now + p.slowDur;
    e.slowFactor = 1 - p.slow;
  }
}

// ---------------- Update ----------------
let simNow = 0;

function update(dt) {
  simNow += dt;

  // Spawning.
  if (gameState === 'wave' && spawnQueue.length > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      enemies.push(makeEnemy(spawnQueue.shift(), wave));
      spawnTimer = 0.75;
    }
  }

  // Enemies: move along path.
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const slowed = simNow < e.slowUntil;
    const sp = e.speed * (slowed ? e.slowFactor : 1);
    let move = sp * dt;
    while (move > 0 && e.wp < PATH.length) {
      const t = PATH[e.wp];
      const d = dist(e.x, e.y, t.x, t.y);
      if (d <= move) {
        e.x = t.x; e.y = t.y; e.dist += d; move -= d; e.wp++;
      } else {
        e.x += ((t.x - e.x) / d) * move;
        e.y += ((t.y - e.y) / d) * move;
        e.dist += move; move = 0;
      }
    }
    if (e.wp >= PATH.length && e.hp > 0) {
      e.hp = 0; e.escaped = true;
      lives -= e.lifeCost;
      if (lives <= 0) { lives = 0; endGame(); }
    }
  }
  enemies = enemies.filter((e) => e.hp > 0);

  // Towers: cooldown + fire.
  for (const t of towers) {
    const st = towerStats(t.type, t.level);
    t.cooldown -= dt;
    if (t.cooldown <= 0) {
      const target = acquireTarget(t, st);
      if (target) {
        fireTower(t, target, st, simNow);
        t.cooldown = 1 / st.rate;
      } else {
        t.cooldown = 0.05; // re-scan soon
      }
    }
  }

  // Projectiles: home toward target.
  for (const p of projectiles) {
    if (p.target.hp <= 0) { p.done = true; continue; }
    const d = dist(p.x, p.y, p.target.x, p.target.y);
    const step = p.speed * dt;
    if (d <= Math.max(step, 10)) {
      applyProjectileHit(p, simNow);
      p.done = true;
    } else {
      p.x += ((p.target.x - p.x) / d) * step;
      p.y += ((p.target.y - p.y) / d) * step;
    }
  }
  projectiles = projectiles.filter((p) => !p.done);

  // Particles decay.
  for (const pt of particles) {
    pt.life -= dt;
    pt.x += (pt.vx || 0) * dt;
    pt.y += (pt.vy || 0) * dt;
  }
  particles = particles.filter((pt) => pt.life > 0);

  // Wave clear.
  if (gameState === 'wave' && spawnQueue.length === 0 && enemies.length === 0 && lives > 0) {
    gameState = 'build';
    const bonus = 20 + wave * 5;
    gold += bonus;
    document.getElementById('startBtn').disabled = false;
  }

  updateHUD();
}

function endGame() {
  gameState = 'over';
  const banner = document.getElementById('banner');
  banner.classList.remove('hidden');
  banner.innerHTML = `<h2>Game over</h2><p>You survived to wave ${wave}.</p>
    <button class="btn primary" id="againBtn">Play again</button>`;
  document.getElementById('againBtn').addEventListener('click', reset);
}

// ---------------- Render ----------------
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Board background + grid.
  ctx.fillStyle = '#0d1420';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(148,163,184,0.07)';
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke(); }
  for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke(); }

  // Path ribbon.
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = '#1a2436';
  ctx.lineWidth = CELL * 0.72;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(239,68,68,0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Placement ghost.
  if (hoverCell && selectedType && gameState !== 'over') {
    const { gx, gy } = hoverCell;
    const ok = cellBuildable(gx, gy) && gold >= TOWER_TYPES[selectedType].cost;
    const st = towerStats(selectedType, 1);
    ctx.fillStyle = ok ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.12)';
    ctx.fillRect(gx * CELL + 2, gy * CELL + 2, CELL - 4, CELL - 4);
    ctx.beginPath();
    ctx.arc((gx + 0.5) * CELL, (gy + 0.5) * CELL, st.range * CELL, 0, Math.PI * 2);
    ctx.strokeStyle = ok ? 'rgba(239,68,68,0.5)' : 'rgba(148,163,184,0.3)';
    ctx.stroke();
  }

  // Selected tower range.
  if (selectedTower && towers.includes(selectedTower)) {
    const st = towerStats(selectedTower.type, selectedTower.level);
    const { x, y } = towerXY(selectedTower);
    ctx.beginPath();
    ctx.arc(x, y, st.range * CELL, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,68,68,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239,68,68,0.5)';
    ctx.stroke();
  }

  // Towers.
  for (const t of towers) {
    const { x, y } = towerXY(t);
    const base = TOWER_TYPES[t.type];
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#141c2e'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = base.color; ctx.stroke();
    // Barrel aimed at last target.
    ctx.save();
    ctx.translate(x, y); ctx.rotate(t.angle);
    ctx.fillStyle = base.color;
    ctx.fillRect(8, -4, 18, 8);
    ctx.restore();
    // Core dot + level pips.
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = base.color; ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('●'.repeat(t.level), x, y + 32);
  }

  // Enemies (with frost tint when slowed).
  for (const e of enemies) {
    const slowed = simNow < e.slowUntil;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fillStyle = slowed ? '#7dd3fc' : e.color;
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    // HP bar.
    const w = e.r * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w, 5);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#4ade80' : e.hp / e.maxHp > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w * Math.max(e.hp / e.maxHp, 0), 5);
  }

  // Projectiles.
  for (const p of projectiles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.splash ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Particles.
  for (const pt of particles) {
    if (pt.ring) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.ring * (1 - pt.life / 0.25), 0, Math.PI * 2);
      ctx.strokeStyle = pt.color; ctx.globalAlpha = Math.max(pt.life / 0.25, 0); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = Math.max(pt.life / 0.4, 0);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------- Input ----------------
function cellBuildable(gx, gy) {
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return false;
  if (pathCells.has(gx + ',' + gy)) return false;
  return !towers.some((t) => t.gx === gx && t.gy === gy);
}

function canvasCell(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    gx: Math.floor(((ev.clientX - r.left) / r.width) * COLS),
    gy: Math.floor(((ev.clientY - r.top) / r.height) * ROWS),
  };
}

canvas.addEventListener('mousemove', (ev) => {
  const { gx, gy } = canvasCell(ev);
  hoverCell = (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) ? { gx, gy } : null;
});
canvas.addEventListener('mouseleave', () => { hoverCell = null; });

canvas.addEventListener('click', (ev) => {
  if (gameState === 'over') return;
  const { gx, gy } = canvasCell(ev);
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
  const existing = towers.find((t) => t.gx === gx && t.gy === gy);
  if (selectedType) {
    if (cellBuildable(gx, gy)) placeTower(gx, gy);
    else if (existing) { selectedType = null; selectedTower = existing; buildShop(); renderTowerInfo(); }
  } else if (existing) {
    selectedTower = existing;
    renderTowerInfo();
  } else {
    selectedTower = null;
    renderTowerInfo();
  }
});

// ---------------- UI ----------------
function updateHUD() {
  document.getElementById('gold').textContent = gold;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = 'Wave ' + wave;
  // Refresh affordability styling on shop buttons.
  document.querySelectorAll('.shop-btn').forEach((btn) => {
    const type = btn.dataset.type;
    btn.querySelector('.cost').classList.toggle('poor', gold < TOWER_TYPES[type].cost);
  });
}

function buildShop() {
  const shop = document.getElementById('shop');
  shop.innerHTML = '';
  for (const [type, b] of Object.entries(TOWER_TYPES)) {
    const btn = document.createElement('button');
    btn.className = 'shop-btn' + (selectedType === type ? ' active' : '');
    btn.dataset.type = type;
    btn.innerHTML = `<span class="swatch" style="background:${b.color}"></span>
      <span class="meta"><b>${b.name}</b><span>${b.desc}</span></span>
      <span class="cost">${b.cost}g</span>`;
    btn.addEventListener('click', () => {
      selectedType = selectedType === type ? null : type;
      selectedTower = null;
      buildShop();
      renderTowerInfo();
    });
    shop.appendChild(btn);
  }
}

function renderTowerInfo() {
  const box = document.getElementById('towerInfo');
  if (selectedType) {
    const b = TOWER_TYPES[selectedType];
    box.innerHTML = `<b>${b.name} tower</b> — ${b.cost}g<br>
      ${b.desc}<br><span style="color:#94a3b8">Click a free tile to build. Click again on the shop button to cancel.</span>`;
    return;
  }
  const t = selectedTower;
  if (!t || !towers.includes(t)) {
    box.innerHTML = '<p class="empty">Select a tower type, then click a free tile — or click a placed tower to manage it.</p>';
    return;
  }
  const b = TOWER_TYPES[t.type];
  const st = towerStats(t.type, t.level);
  const cost = upgradeCost(t);
  box.innerHTML = `
    <b>${b.name}</b> <span class="pips">${'●'.repeat(t.level)}${'○'.repeat(MAX_LEVEL - t.level)}</span><br>
    Damage ${st.dmg} · ${(st.rate).toFixed(1)}/s · Range ${st.range.toFixed(1)}<br>
    <div class="row">
      ${cost !== null
        ? `<button class="btn small primary" id="upBtn">Upgrade · ${cost}g</button>`
        : `<span style="align-self:center">Max level</span>`}
      <button class="btn small" id="sellBtn">Sell · ${Math.round(t.invested * SELL_RATE)}g</button>
    </div>`;
  const up = document.getElementById('upBtn');
  if (up) up.addEventListener('click', () => upgradeTower(t));
  document.getElementById('sellBtn').addEventListener('click', () => sellTower(t));
}

// ---------------- Boot ----------------
document.getElementById('startBtn').addEventListener('click', startWave);
document.getElementById('restartBtn').addEventListener('click', reset);
document.getElementById('pauseBtn').addEventListener('click', (ev) => {
  paused = !paused;
  ev.target.textContent = paused ? 'Resume' : 'Pause';
});
document.getElementById('speedBtn').addEventListener('click', (ev) => {
  speedMul = speedMul === 1 ? 2 : 1;
  ev.target.textContent = speedMul + '×';
});

chrome.storage.local.get({ bestWave: 0 }, (res) => {
  bestWave = res.bestWave || 0;
  reset();
  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused && gameState !== 'over') {
      // Apply speed multiplier in sub-steps for stability.
      for (let i = 0; i < speedMul; i++) update(dt);
    }
    draw();
  })(last);
});
