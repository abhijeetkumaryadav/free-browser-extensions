// Bookmark Dungeon Crawler — each of your bookmarks becomes a room.
// Doors open bookmarked pages you choose to visit. No crawling, no fetching.

// ENGINE-START

const RW = 8, RH = 6;   // room size in dungeon cells
const GX = 4, GY = 3;   // gaps between rooms
const COLS = 4;         // rooms per row

/** Deterministic pseudo-random generator (mulberry32). */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Recursively collect {title, url} bookmark nodes, up to `limit`. */
function flattenBookmarks(nodes, limit) {
  const out = [];
  function walk(list) {
    for (const n of list || []) {
      if (out.length >= limit) return;
      if (n.url) {
        out.push({ title: n.title || n.url, url: n.url });
      } else if (n.children) {
        walk(n.children);
      }
    }
  }
  walk(nodes);
  return out;
}

/**
 * Lay rooms out on a 4-column grid; link room i to room i+1 with
 * L-shaped corridors (horizontal then vertical).
 */
function buildDungeon(bookmarks, seed) {
  const n = bookmarks.length;
  const rooms = [];
  const corridors = [];
  const rnd = seededRandom(seed);
  for (let i = 0; i < n; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    rooms.push({
      i,
      x: col * (RW + GX),
      y: row * (RH + GY),
      w: RW, h: RH,
      title: bookmarks[i].title,
      url: bookmarks[i].url,
      tint: Math.floor(rnd() * 3) // cosmetic room variation
    });
  }
  for (let i = 0; i + 1 < n; i++) {
    const a = rooms[i], b = rooms[i + 1];
    const cax = a.x + a.w / 2, cay = a.y + a.h / 2;
    const cbx = b.x + b.w / 2, cby = b.y + b.h / 2;
    corridors.push({ x: Math.min(cax, cbx), y: cay - 0.6, w: Math.max(0.01, Math.abs(cbx - cax)), h: 1.2 });
    corridors.push({ x: cbx - 0.6, y: Math.min(cay, cby), w: 1.2, h: Math.max(0.01, Math.abs(cby - cay)) });
  }
  return { rooms, corridors, seed };
}

/** All rects the player may stand on. */
function walkRects(d) {
  return d.rooms.concat(d.corridors);
}

/** Point collision: true if (x,y) is inside any walkable rect. */
function isWalkable(d, x, y) {
  const eps = 0.01;
  return walkRects(d).some(r =>
    x >= r.x - eps && x <= r.x + r.w + eps &&
    y >= r.y - eps && y <= r.y + r.h + eps);
}

/** Room containing point (x,y), or null. */
function roomAt(d, x, y) {
  return d.rooms.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
}

/** Overall dungeon extents in cells. */
function mapSize(d) {
  let mx = 1, my = 1;
  for (const r of walkRects(d)) {
    mx = Math.max(mx, r.x + r.w);
    my = Math.max(my, r.y + r.h);
  }
  return { w: mx, h: my };
}

/** Tiny string hash for detecting bookmark-list changes. */
function bookmarkHash(list) {
  let h = 5381;
  const s = list.map(b => b.url).join('|');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return String(h);
}
// ENGINE-END

/* ------------------------------------------------------------------ */
/* UI: renders the dungeon, moves the player, opens doors.             */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('dungeon');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const ACCENT = '#f59e0b';
const MAX_ROOMS = 12;
const SEED = 20261017;

let dungeon = null;
let player = { x: 0, y: 0 };
let keys = {};
let bookmarkList = [];

// --- rendering --------------------------------------------------------

function drawDungeon() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = mapSize(dungeon);
  const s = Math.min(canvas.width / size.w, canvas.height / size.h);
  const ox = (canvas.width - size.w * s) / 2;
  const oy = (canvas.height - size.h * s) / 2;

  const X = (x) => ox + x * s;
  const Y = (y) => oy + y * s;

  // Corridors (dark floor paths).
  for (const c of dungeon.corridors) {
    ctx.fillStyle = '#1a1f2b';
    ctx.fillRect(X(c.x), Y(c.y), c.w * s, c.h * s);
  }

  // Rooms.
  dungeon.rooms.forEach((r, idx) => {
    const shades = ['#232a3a', '#26232f', '#20302a'];
    ctx.fillStyle = shades[r.tint % shades.length];
    roundRect(X(r.x), Y(r.y), r.w * s, r.h * s, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,158,11,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Room number label.
    ctx.fillStyle = 'rgba(232,236,244,0.55)';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText(String(idx + 1), X(r.x) + 4, Y(r.y) + 13);
  });

  // Player — glowing amber dot.
  const px = X(player.x), py = Y(player.y);
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245,158,11,0.25)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();

  // Current room status.
  const room = roomAt(dungeon, player.x, player.y);
  if (room) {
    statusEl.innerHTML =
      'Room <strong>' + (room.i + 1) + '/' + dungeon.rooms.length + '</strong> — ' +
      escapeHtml(room.title) + '<br><span class="door">Press E to open this door ↗</span>';
  } else {
    statusEl.textContent = 'Wandering the corridors… walk into a numbered room.';
  }
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// --- movement -----------------------------------------------------------

const SPEED = 6; // cells per second

function tryMove(dx, dy) {
  const nx = player.x + dx, ny = player.y + dy;
  // Slide: try each axis separately.
  if (isWalkable(dungeon, nx, player.y)) player.x = nx;
  if (isWalkable(dungeon, player.x, ny)) player.y = ny;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let dx = 0, dy = 0;
  if (keys.a || keys.arrowleft) dx -= 1;
  if (keys.d || keys.arrowright) dx += 1;
  if (keys.w || keys.arrowup) dy -= 1;
  if (keys.s || keys.arrowdown) dy += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    tryMove((dx / len) * SPEED * dt, (dy / len) * SPEED * dt);
    savePosition();
  }
  drawDungeon();
  requestAnimationFrame(frame);
}

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k === ' ' ? 'space' : k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'e' && dungeon) {
    const room = roomAt(dungeon, player.x, player.y);
    if (room && room.url) chrome.tabs.create({ url: room.url });
  }
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  keys[k === ' ' ? 'space' : k] = false;
});

// --- bookmarks + persistence ---------------------------------------------

function spawnPlayer() {
  const r0 = dungeon.rooms[0];
  player = { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2 };
}

function savePosition() {
  try {
    chrome.storage.local.set({
      dungeonPos: { x: player.x, y: player.y, hash: bookmarkHash(bookmarkList) }
    });
  } catch (err) { /* storage unavailable — non-fatal */ }
}

function restorePosition() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get('dungeonPos', (res) => {
        const p = res && res.dungeonPos;
        if (p && p.hash === bookmarkHash(bookmarkList) && isWalkable(dungeon, p.x, p.y)) {
          player = { x: p.x, y: p.y };
        } else {
          spawnPlayer();
        }
        resolve();
      });
    } catch (err) {
      spawnPlayer();
      resolve();
    }
  });
}

chrome.bookmarks.getTree((tree) => {
  bookmarkList = flattenBookmarks(tree, MAX_ROOMS);
  if (!bookmarkList.length) {
    statusEl.textContent = 'No bookmarks found — add some to your bookmarks bar and reopen to build a dungeon.';
    return;
  }
  dungeon = buildDungeon(bookmarkList, SEED);
  restorePosition().then(() => {
    drawDungeon();
    requestAnimationFrame(frame);
  });
});
