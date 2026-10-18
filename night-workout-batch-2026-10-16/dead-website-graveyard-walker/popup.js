// ============================================================================
// Dead Website Graveyard Walker — engine + UI
// A manual memorial list for dead websites, with a moonlit graveyard doodle.
// ============================================================================

// ENGINE-START
'use strict';

/** Deterministic PRNG (LCG). Same seed -> same sequence. */
function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Check a URL is an http(s) URL (or empty = allowed, optional field). */
function isValidUrl(u) {
  if (!u) return true;
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(u).trim());
}

/** Create a grave record. Returns {error} on invalid input, else {grave}. */
function makeGrave(name, url, died, eulogy) {
  const n = String(name || '').trim().slice(0, 60);
  if (!n) return { error: 'Give the fallen site a name.' };
  const u = String(url || '').trim().slice(0, 300);
  if (!isValidUrl(u)) return { error: 'URL must start with http:// or https:// (or leave it blank).' };
  return {
    grave: {
      id: 'd' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
      name: n,
      url: u,
      died: String(died || '').trim().slice(0, 20),
      eulogy: String(eulogy || '').trim().slice(0, 500),
      buriedAt: Date.now()
    }
  };
}

/** Newest burials first. Pure — does not mutate the input. */
function sortGraves(graves) {
  return graves.slice().sort((a, b) => b.buriedAt - a.buriedAt);
}

/** Case-insensitive search over name, url, died, eulogy. Empty query -> all. */
function filterGraves(graves, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return graves.slice();
  return graves.filter(g =>
    (g.name + ' ' + g.url + ' ' + g.died + ' ' + g.eulogy).toLowerCase().includes(q)
  );
}

/** Deterministic tombstone layout. Up to 12 shown; all stay inside the canvas. */
function tombstoneLayout(graves, w, h, seed) {
  const shown = graves.slice(0, 12);
  const rand = seededRandom(seed);
  const cols = 4;
  const cellW = w / cols;
  return shown.map((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jx = (rand() - 0.5) * (cellW - 56);
    const jy = (rand() - 0.5) * 14;
    return Object.assign({}, g, {
      x: Math.min(w - 30, Math.max(30, col * cellW + cellW / 2 + jx)),
      y: Math.min(h - 20, Math.max(h * 0.45, h * 0.55 + row * 44 + jy)),
      tw: 46,   // tombstone width
      th: 56    // tombstone height
    });
  });
}

/** Hit-test a click against tombstones (front-most first). Returns grave or null. */
function hitTombstone(laidOut, x, y) {
  for (let i = laidOut.length - 1; i >= 0; i--) {
    const t = laidOut[i];
    if (x >= t.x - t.tw / 2 && x <= t.x + t.tw / 2 && y >= t.y - t.th && y <= t.y) return t;
  }
  return null;
}

/** Validate an imported array; keep only well-formed graves. */
function validateImport(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const g of arr) {
    if (!g || typeof g !== 'object') continue;
    if (typeof g.name !== 'string' || !g.name.trim()) continue;
    if (g.url && !isValidUrl(g.url)) continue;
    out.push({
      id: typeof g.id === 'string' ? g.id : 'd' + Math.random().toString(36).slice(2),
      name: g.name.trim().slice(0, 60),
      url: typeof g.url === 'string' ? g.url.trim().slice(0, 300) : '',
      died: typeof g.died === 'string' ? g.died.trim().slice(0, 20) : '',
      eulogy: typeof g.eulogy === 'string' ? g.eulogy.trim().slice(0, 500) : '',
      buriedAt: typeof g.buriedAt === 'number' ? g.buriedAt : Date.now()
    });
  }
  return out.slice(0, 200);
}
// ENGINE-END

/* ---------------------------------------------------------------------------
   UI layer (DOM + chrome APIs). Not part of the headless engine.
--------------------------------------------------------------------------- */
const STORE_KEY = 'dwgw_state_v1';

const yard = document.getElementById('yard');
const ctx = yard.getContext('2d');
const hintEl = document.getElementById('eulogyHint');
const graveListEl = document.getElementById('graveList');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('graveCount');
const notesEl = document.getElementById('notes');

let graves = [];
let laidOut = [];
let notesTimer = null;

function loadState() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORE_KEY], res => {
      const s = res[STORE_KEY] || {};
      graves = Array.isArray(s.graves) ? s.graves : [];
      notesEl.value = typeof s.notes === 'string' ? s.notes : '';
      resolve();
    });
  });
}

function saveState() {
  chrome.storage.local.set({ [STORE_KEY]: { graves, notes: notesEl.value } });
}

function refreshLayout() {
  laidOut = tombstoneLayout(sortGraves(graves), yard.width, yard.height, 4242);
}

function renderList() {
  const shown = filterGraves(sortGraves(graves), searchEl.value);
  countEl.textContent = graves.length ? '(' + graves.length + ' buried)' : '';
  graveListEl.innerHTML = '';
  if (!shown.length) {
    graveListEl.innerHTML = '<li class="empty">' +
      (graves.length ? 'No fallen match your search.' : 'The graveyard is empty. Bury your first dead site above.') +
      '</li>';
    return;
  }
  for (const g of shown) {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'ghead';
    const nm = document.createElement('span');
    nm.className = 'gname';
    nm.textContent = g.name;
    head.appendChild(nm);
    if (g.died) {
      const d = document.createElement('span');
      d.className = 'gdied';
      d.textContent = '† ' + g.died;
      head.appendChild(d);
    }
    const del = document.createElement('button');
    del.className = 'iconbtn';
    del.title = 'Exhume (delete)';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      graves = graves.filter(x => x.id !== g.id);
      saveState(); refreshLayout(); renderList();
    });
    head.appendChild(del);
    li.appendChild(head);
    if (g.eulogy) {
      const eu = document.createElement('div');
      eu.className = 'geulogy';
      eu.textContent = '“' + g.eulogy + '”';
      li.appendChild(eu);
    }
    if (g.url) {
      const a = document.createElement('a');
      a.className = 'gurl';
      a.textContent = g.url;
      a.href = g.url;
      a.target = '_blank';
      a.rel = 'noopener';
      li.appendChild(a);
    }
    graveListEl.appendChild(li);
  }
}

/* --- Moonlit graveyard doodle --- */
const stars = [];
(function initStars() {
  const rand = seededRandom(777);
  for (let i = 0; i < 40; i++) stars.push({ x: rand() * 348, y: rand() * 110, r: rand() * 1.3 + 0.4, tw: rand() * Math.PI * 2 });
})();

let fogX = 0;

function drawYard(t) {
  const w = yard.width, h = yard.height;

  // Night sky gradient.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a0714');
  sky.addColorStop(0.55, '#141028');
  sky.addColorStop(1, '#1c1a2e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars.
  for (const s of stars) {
    const a = 0.35 + 0.35 * Math.sin(t / 900 + s.tw);
    ctx.globalAlpha = Math.max(0.1, a);
    ctx.fillStyle = '#cfd6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon.
  ctx.fillStyle = '#f4f1e4';
  ctx.shadowColor = '#f4f1e4';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(w - 52, 44, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(10, 7, 20, 0.16)';
  ctx.beginPath(); ctx.arc(w - 58, 38, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w - 46, 50, 4, 0, Math.PI * 2); ctx.fill();

  // Ground.
  ctx.fillStyle = '#141a12';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  // Tombstones.
  for (const g of laidOut) {
    ctx.fillStyle = '#3d3a52';
    ctx.strokeStyle = '#5a5678';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const x0 = g.x - g.tw / 2, y0 = g.y - g.th;
    ctx.moveTo(x0, g.y);
    ctx.lineTo(x0, y0 + 12);
    ctx.quadraticCurveTo(x0, y0, x0 + g.tw / 2, y0);
    ctx.quadraticCurveTo(x0 + g.tw, y0, x0 + g.tw, y0 + 12);
    ctx.lineTo(x0 + g.tw, g.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cross engraving.
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x, y0 + 12); ctx.lineTo(g.x, y0 + 30);
    ctx.moveTo(g.x - 7, y0 + 19); ctx.lineTo(g.x + 7, y0 + 19);
    ctx.stroke();
    // Name initial.
    ctx.fillStyle = 'rgba(232, 234, 240, 0.75)';
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(g.name).slice(0, 10), g.x, y0 + 44);
  }

  // Drifting fog.
  fogX = (fogX + 0.25) % (w + 120);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.06)';
  ctx.beginPath();
  ctx.ellipse(w / 2 - fogX + 60, h * 0.78, 120, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(fogX - 60, h * 0.7, 100, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(drawYard);
}

yard.addEventListener('click', ev => {
  const rect = yard.getBoundingClientRect();
  const sx = yard.width / rect.width, sy = yard.height / rect.height;
  const g = hitTombstone(laidOut, (ev.clientX - rect.left) * sx, (ev.clientY - rect.top) * sy);
  if (g) {
    hintEl.textContent = '🪦 ' + g.name +
      (g.died ? ' († ' + g.died + ')' : '') +
      (g.eulogy ? ' — “' + g.eulogy + '”' : ' — no eulogy carved yet.');
  } else {
    hintEl.textContent = 'Click a tombstone to read its eulogy.';
  }
});

document.getElementById('addGrave').addEventListener('click', () => {
  const res = makeGrave(
    document.getElementById('gName').value,
    document.getElementById('gUrl').value,
    document.getElementById('gDied').value,
    document.getElementById('gEulogy').value
  );
  if (res.error) {
    hintEl.textContent = '⚠ ' + res.error;
    return;
  }
  graves.push(res.grave);
  document.getElementById('gName').value = '';
  document.getElementById('gUrl').value = '';
  document.getElementById('gDied').value = '';
  document.getElementById('gEulogy').value = '';
  hintEl.textContent = '🪦 ' + res.grave.name + ' laid to rest.';
  saveState(); refreshLayout(); renderList();
});

searchEl.addEventListener('input', renderList);

notesEl.addEventListener('input', () => {
  clearTimeout(notesTimer);
  notesTimer = setTimeout(saveState, 600);
});

async function init() {
  await loadState();
  refreshLayout();
  renderList();
  requestAnimationFrame(drawYard);
}

init();
