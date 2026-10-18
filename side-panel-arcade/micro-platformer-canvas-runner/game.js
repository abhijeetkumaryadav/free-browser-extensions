// ============================================================================
// PixelRun — micro canvas platformer.
// Tile engine: 24x13 grid, 40px tiles. Legend:
//   # solid   C coin   S spike   G goal (pass-through)   P player spawn
// Movers (moving platforms) are defined per level in `movers`.
// No network, no analytics — best times live in chrome.storage.local.
// ============================================================================

"use strict";

// ---------- Constants ----------
const TILE = 40;
const COLS = 24;
const ROWS = 13;
const W = COLS * TILE; // 960
const H = ROWS * TILE; // 520 (+20px HUD strip drawn at top of 540px canvas)
const GRAVITY = 0.55;
const JUMP_V = -12.4;
const MOVE_SPEED = 4.2;
const COYOTE_FRAMES = 6;
const BUFFER_FRAMES = 6;
const STORE_KEY = "pixelrun_best";

// ---------- Levels ----------
// Each level: name, tiles (13 rows x 24 cols), movers [{x,y tiles, w tiles, axis, from, to, speed(px/frame)}]
const LEVELS = [
  {
    name: "First Steps",
    movers: [],
    tiles: [
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "      C C C             ",
      "   P            C C   G ",
      "                        ",
      "##########  ############",
      "##########  ############",
    ],
  },
  {
    name: "Coin Row",
    movers: [],
    tiles: [
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "     C C C              ",
      "                        ",
      "         C C C          ",
      "   P                 C  ",
      "                        ",
      "########    ######    ##",
      "########    ######    G#",
      "########    ######    ##",
    ],
  },
  {
    name: "Spike Alley",
    movers: [],
    tiles: [
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "          C C C         ",
      "                        ",
      "                        ",
      "   P            C    G  ",
      "                        ",
      "####   ###SSS####    ###",
      "####   ##########    ###",
      "####   ##########    ###",
    ],
  },
  {
    name: "Gap Jumps",
    movers: [],
    tiles: [
      "                        ",
      "                        ",
      "                        ",
      "                        ",
      "        C               ",
      "       ###              ",
      "                    C   ",
      "                   ###  ",
      "   P        C           ",
      "                        ",
      "###     ####     ####   ",
      "###     ####     ####  G",
      "###     ####     ####   ",
    ],
  },
  {
    name: "High Road",
    movers: [
      // horizontal shuttle bridging the gap at row 8
      { col: 14.5, row: 8, w: 3, axis: "x", from: 14 * TILE, to: 17 * TILE, speed: 1.6 },
    ],
    tiles: [
      "                        ",
      "              C C C     ",
      "             #######    ",
      "                        ",
      "      C C               ",
      "     #######    ####### ",
      "                        ",
      "                        ",
      "   P                    ",
      "                        ",
      "##############          ",
      "##############        G ",
      "##############          ",
    ],
  },
  {
    name: "Final Gauntlet",
    movers: [
      { col: 11, row: 6, w: 2, axis: "y", from: 5 * TILE, to: 8 * TILE, speed: 1.4 },
    ],
    tiles: [
      "                        ",
      "        C C             ",
      "       #####            ",
      "                    C   ",
      "                   ###  ",
      "         SS             ",
      "        ######          ",
      "                        ",
      "   P      C        C    ",
      "                        ",
      "####  ######  ######    ",
      "####  ######  ######  G ",
      "####  ######  ######    ",
    ],
  },
];

// ---------- DOM ----------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");

// ---------- State ----------
let levelIndex = 0;
let grid;            // 2D array of chars (mutable copy)
let coins = [];      // {cx, cy, taken}
let spikes = [];     // {x, y} tile coords
let goal = null;     // {x, y} px rect
let spawn = { x: 80, y: 400 };
let movers = [];     // {x,y,w,h,axis,from,to,speed,dir,dx,dy}
let player;
let keys = {};
let state = "play";  // play | paused | dead-anim | complete | gameover
let lives = 3;
let frames = 0;      // level timer (frames at 60fps)
let coyote = 0;
let jumpBuf = 0;
let totalCoins = 0;
let cameraX = 0;

// ---------- Level loading ----------
function loadLevel(idx, resetLives) {
  levelIndex = idx;
  const def = LEVELS[idx];
  grid = def.tiles.map((r) => r.split(""));
  coins = [];
  spikes = [];
  goal = null;
  movers = def.movers.map((m) => ({
    x: m.col * TILE,
    y: m.row * TILE,
    w: m.w * TILE,
    h: TILE * 0.5,
    axis: m.axis,
    from: m.from,
    to: m.to,
    speed: m.speed,
    dir: 1,
    dx: 0,
    dy: 0,
  }));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      if (ch === "P") { spawn = { x: c * TILE + 7, y: r * TILE + 2 }; grid[r][c] = " "; }
      else if (ch === "C") { coins.push({ cx: c * TILE + TILE / 2, cy: r * TILE + TILE / 2, taken: false }); grid[r][c] = " "; }
      else if (ch === "S") { spikes.push({ x: c * TILE, y: r * TILE }); grid[r][c] = " "; }
      else if (ch === "G") { goal = { x: c * TILE, y: r * TILE, w: TILE, h: TILE }; grid[r][c] = " "; }
    }
  }
  totalCoins = coins.length;
  player = { x: spawn.x, y: spawn.y, w: 26, h: 36, vx: 0, vy: 0, grounded: false, face: 1, standMover: null };
  if (resetLives) lives = 3;
  frames = 0;
  coyote = 0;
  jumpBuf = 0;
  cameraX = 0;
  state = "play";
  hideOverlay();
}

// ---------- Collision helpers ----------
function tileSolid(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  return grid[r][c] === "#";
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function solidRectAt(x, y, w, h) {
  // Check static tiles.
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (tileSolid(c, r)) return true;
  // Check movers.
  const p = { x, y, w, h };
  for (const m of movers) if (rectsOverlap(p, m)) return true;
  return false;
}

// ---------- Player update ----------
function updatePlayer() {
  const p = player;
  p.vx = 0;
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) { p.vx = -MOVE_SPEED; p.face = -1; }
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) { p.vx = MOVE_SPEED; p.face = 1; }

  // Horizontal move + resolve (step back out of any solid, tile or mover).
  p.x += p.vx;
  if (solidRectAt(p.x, p.y, p.w, p.h)) {
    const step = p.vx > 0 ? -1 : 1;
    let guard = 0;
    while (solidRectAt(p.x, p.y, p.w, p.h) && guard < 24) { p.x += step; guard++; }
    if (guard >= 24) p.x -= p.vx; // give up: revert the move
  }
  p.x = Math.max(0, Math.min(W - p.w, p.x));

  // Ride mover horizontally if standing on one.
  if (p.standMover) p.x += p.standMover.dx;

  // Gravity.
  p.vy = Math.min(p.vy + GRAVITY, 16);

  // Jump buffering + coyote time.
  if (jumpBuf > 0) jumpBuf--;
  if (coyote > 0) coyote--;
  if (jumpBuf > 0 && (p.grounded || coyote > 0)) {
    p.vy = JUMP_V;
    p.grounded = false;
    coyote = 0;
    jumpBuf = 0;
  }

  // Vertical move + resolve against landing surfaces (tiles + movers).
  const wasGrounded = p.grounded;
  p.grounded = false;
  p.standMover = null;
  const oldBottom = p.y + p.h;
  p.y += p.vy;
  if (p.vy >= 0) {
    // Falling: find the highest surface top between old bottom and new bottom.
    let landY = Infinity;
    let landMover = null;
    const c0 = Math.floor(p.x / TILE);
    const c1 = Math.floor((p.x + p.w - 1) / TILE);
    const newBottom = p.y + p.h;
    for (let c = c0; c <= c1; c++) {
      const r = Math.floor(newBottom / TILE);
      if (tileSolid(c, r)) {
        const top = r * TILE;
        if (top >= oldBottom - 0.5 && top < landY) { landY = top; landMover = null; }
      }
    }
    for (const m of movers) {
      if (p.x + p.w > m.x && p.x < m.x + m.w) {
        const top = m.y;
        if (top >= oldBottom - 0.5 && top <= newBottom && top < landY) {
          landY = top; landMover = m;
        }
      }
    }
    if (landY !== Infinity) {
      p.y = landY - p.h - 0.01;
      p.grounded = true;
      p.standMover = landMover;
      p.vy = 0;
    }
  } else {
    // Rising: back out of whatever we hit (tile or mover underside).
    if (solidRectAt(p.x, p.y, p.w, p.h)) {
      let guard = 0;
      while (solidRectAt(p.x, p.y, p.w, p.h) && guard < 24) { p.y += 1; guard++; }
      p.vy = 0;
    }
  }
  // Ride mover vertically if standing on one.
  if (p.standMover) {
    p.y += p.standMover.dy;
    if (solidRectAt(p.x, p.y, p.w, p.h)) p.y -= p.standMover.dy; // don't get crushed into tiles
  }
  if (p.grounded) coyote = COYOTE_FRAMES;
  else if (wasGrounded) coyote = COYOTE_FRAMES;

  // Interactions.
  const pr = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const c of coins) {
    if (!c.taken && Math.hypot(c.cx - (p.x + p.w / 2), c.cy - (p.y + p.h / 2)) < 30) c.taken = true;
  }
  for (const s of spikes) {
    // Shrunk hitbox so near-misses feel fair.
    const sr = { x: s.x + 8, y: s.y + 16, w: TILE - 16, h: TILE - 16 };
    if (rectsOverlap(pr, sr)) { die(); return; }
  }
  if (p.y > H + 40) { die(); return; }
  if (goal && rectsOverlap(pr, goal)) completeLevel();
}

function updateMovers() {
  for (const m of movers) {
    m.dx = 0; m.dy = 0;
    if (m.axis === "x") {
      const nx = m.x + m.speed * m.dir;
      if (nx > m.to) { m.dir = -1; }
      else if (nx < m.from) { m.dir = 1; }
      const applied = m.speed * m.dir;
      m.x += applied; m.dx = applied;
    } else {
      const ny = m.y + m.speed * m.dir;
      if (ny > m.to) { m.dir = -1; }
      else if (ny < m.from) { m.dir = 1; }
      const applied = m.speed * m.dir;
      m.y += applied; m.dy = applied;
    }
  }
}

function die() {
  lives--;
  if (lives <= 0) {
    state = "gameover";
    showOverlay(
      "Game Over",
      `Out of lives on <b>${LEVELS[levelIndex].name}</b>.`,
      "",
      [
        { label: "Retry level", cls: "primary", fn: () => loadLevel(levelIndex, true) },
        { label: "Level select", cls: "ghost", fn: () => window.close() },
      ]
    );
  } else {
    // Respawn at spawn; coins collected stay collected.
    player.x = spawn.x; player.y = spawn.y;
    player.vx = 0; player.vy = 0;
  }
}

async function completeLevel() {
  state = "complete";
  const seconds = frames / 60;
  const data = await chrome.storage.local.get(STORE_KEY);
  const best = data[STORE_KEY] || {};
  const prev = best[levelIndex];
  const isRecord = prev === undefined || seconds < prev;
  if (isRecord) {
    best[levelIndex] = Math.round(seconds * 10) / 10;
    await chrome.storage.local.set({ [STORE_KEY]: best });
  }
  const collected = coins.filter((c) => c.taken).length;
  const hasNext = levelIndex < LEVELS.length - 1;
  showOverlay(
    "Level Complete!",
    `${LEVELS[levelIndex].name} — coins ${collected}/${totalCoins}`,
    `${seconds.toFixed(1)}s${isRecord ? " — new best!" : ""}`,
    [
      ...(hasNext ? [{ label: "Next level", cls: "primary", fn: () => loadLevel(levelIndex + 1, true) }] : []),
      { label: "Replay", cls: hasNext ? "ghost" : "primary", fn: () => loadLevel(levelIndex, true) },
      { label: "Close", cls: "ghost", fn: () => window.close() },
    ]
  );
}

// ---------- Overlay ----------
function showOverlay(title, sub, time, buttons) {
  overlay.innerHTML =
    `<h2>${title}</h2>` +
    (sub ? `<p>${sub}</p>` : "") +
    (time ? `<div class="time">${time}</div>` : "") +
    `<div class="row"></div>`;
  const row = overlay.querySelector(".row");
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.className = b.cls;
    btn.textContent = b.label;
    btn.addEventListener("click", b.fn);
    row.appendChild(btn);
  }
  overlay.classList.remove("hidden");
}
function hideOverlay() {
  overlay.classList.add("hidden");
  overlay.innerHTML = "";
}

// ---------- Input ----------
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if ((e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") && state === "play") {
    jumpBuf = BUFFER_FRAMES;
  }
  if (e.key === "p" || e.key === "P") {
    if (state === "play") {
      state = "paused";
      showOverlay("Paused", "Take a breather.", "", [
        { label: "Resume", cls: "primary", fn: () => { hideOverlay(); state = "play"; } },
        { label: "Restart level", cls: "ghost", fn: () => loadLevel(levelIndex, true) },
      ]);
    } else if (state === "paused") {
      hideOverlay(); state = "play";
    }
  }
  if ((e.key === "r" || e.key === "R") && (state === "play" || state === "paused")) {
    loadLevel(levelIndex, true);
  }
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

// ---------- Rendering ----------
function drawTile(c, r) {
  const x = c * TILE, y = r * TILE;
  const grad = ctx.createLinearGradient(x, y, x, y + TILE);
  grad.addColorStop(0, "#2a2f3a");
  grad.addColorStop(1, "#1c2029");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(x, y, TILE, 4);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y + TILE - 4, TILE, 4);
  // Grass tufts on exposed tops.
  if (!tileSolid(c, r - 1)) {
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(x, y, TILE, 5);
    ctx.fillStyle = "#22c55e";
    for (let i = 0; i < 4; i++) {
      const gx = x + 5 + i * 9;
      ctx.fillRect(gx, y - 4, 3, 5);
    }
  }
}

function draw(t) {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0d1220");
  sky.addColorStop(1, "#131a2e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Parallax dots.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < 60; i++) {
    const sx = (i * 173 + cameraX * 0.2) % (W + 40) - 20;
    const sy = (i * 97) % H;
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.save();
  ctx.translate(-Math.round(cameraX), 0);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (tileSolid(c, r)) drawTile(c, r);

  // Movers.
  for (const m of movers) {
    ctx.fillStyle = "#f97316";
    ctx.globalAlpha = 0.9;
    roundRect(m.x, m.y, m.w, m.h, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundRect(m.x + 4, m.y + 3, m.w - 8, 6, 3);
    ctx.fill();
  }

  // Coins.
  for (const c of coins) {
    if (c.taken) continue;
    const squash = Math.abs(Math.sin(t / 300 + c.cx));
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.ellipse(c.cx, c.cy + Math.sin(t / 400 + c.cx) * 2, 9 * (0.4 + 0.6 * squash), 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.ellipse(c.cx, c.cy + Math.sin(t / 400 + c.cx) * 2, 4.5 * (0.4 + 0.6 * squash), 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spikes.
  for (const s of spikes) {
    ctx.fillStyle = "#e2e8f0";
    const baseY = s.y + TILE;
    for (let i = 0; i < 4; i++) {
      const sx = s.x + i * 10;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx + 5, s.y + 10);
      ctx.lineTo(sx + 10, baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(s.x, baseY - 4, TILE, 4);
  }

  // Goal flag.
  if (goal) {
    const wave = Math.sin(t / 200) * 4;
    ctx.fillStyle = "#64748b";
    ctx.fillRect(goal.x + TILE / 2 - 2, goal.y - 10, 4, TILE + 10);
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.moveTo(goal.x + TILE / 2 + 2, goal.y - 10);
    ctx.lineTo(goal.x + TILE / 2 + 34 + wave, goal.y - 2);
    ctx.lineTo(goal.x + TILE / 2 + 2, goal.y + 8);
    ctx.closePath();
    ctx.fill();
  }

  // Player.
  const p = player;
  const bob = p.grounded ? Math.abs(Math.sin(t / 120)) * 2 : 0;
  ctx.fillStyle = "#f97316";
  roundRect(p.x, p.y - bob, p.w, p.h + bob, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(p.x + 4, p.y - bob + 4, p.w - 8, 8, 4);
  ctx.fill();
  // Eyes face movement direction.
  ctx.fillStyle = "#0b0d12";
  const ex = p.face === 1 ? p.x + p.w - 13 : p.x + 7;
  ctx.beginPath(); ctx.arc(ex, p.y + 12 - bob, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ex + 6, p.y + 12 - bob, 3, 0, Math.PI * 2); ctx.fill();

  ctx.restore();

  // HUD.
  ctx.fillStyle = "rgba(7,9,13,0.55)";
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "600 14px -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(LEVELS[levelIndex].name, 14, 18);
  const collected = coins.filter((c) => c.taken).length;
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(`● ${collected}/${totalCoins}`, 220, 18);
  ctx.fillStyle = "#f87171";
  ctx.fillText("♥".repeat(Math.max(0, lives)) || "", 340, 18);
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "right";
  ctx.fillText((frames / 60).toFixed(1) + "s", W - 14, 18);
  ctx.textAlign = "left";
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Main loop ----------
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (state === "play") {
    updateMovers();
    updatePlayer();
    frames++;
    // Camera follows player (level fits 960px wide, so mostly static).
    cameraX = Math.max(0, Math.min(W - 960, player.x + player.w / 2 - 480));
  }
  draw(t || 0);
}

// ---------- Boot ----------
(function init() {
  const params = new URLSearchParams(location.search);
  const lvl = Math.max(0, Math.min(LEVELS.length - 1, parseInt(params.get("level") || "0", 10) || 0));
  loadLevel(lvl, true);
  requestAnimationFrame(loop);
})();
