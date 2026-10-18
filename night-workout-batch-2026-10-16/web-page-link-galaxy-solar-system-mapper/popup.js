"use strict";
/* Link Galaxy — pure-local engine + canvas solar-system UI.
 * Honest scope: maps links YOU save as planets. It never extracts
 * links from web pages. Zero network calls. */

// ==================== ENGINE-START ====================
// Pure functions — no DOM, no chrome APIs. Safe to unit-test in Node.

/** Validate and build a link entry. Returns {ok, entry} or {ok:false, error}. */
function makeLink(title, url) {
  const t = String(title || "").trim();
  const u = String(url || "").trim();
  if (!t) return { ok: false, error: "Title is required." };
  if (t.length > 80) return { ok: false, error: "Title is too long (80 max)." };
  let parsed;
  try { parsed = new URL(u); } catch { return { ok: false, error: "URL is not valid." }; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http(s) URLs are allowed." };
  }
  return { ok: true, entry: { id: "l" + Date.now() + Math.floor(Math.random() * 1e6), title: t, url: parsed.href } };
}

/** Compute planet positions for N links at time t (seconds).
 *  Each link orbits the star with its own radius, speed and phase.
 *  Returns [{x, y, r (orbit radius), idx}]. Deterministic. */
function orbitPositions(count, t, cx, cy) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const orbitR = 46 + i * 15;                       // growing orbits
    const speed = 0.35 / (1 + i * 0.18);              // inner planets faster
    const phase = i * 2.4;                            // spread around the star
    const a = phase + t * speed;
    out.push({ x: cx + Math.cos(a) * orbitR, y: cy + Math.sin(a) * orbitR * 0.62, r: orbitR, idx: i });
  }
  return out;
}

/** Find which planet (link index) contains point (px,py). Radius = planet size. */
function planetAt(positions, px, py, planetSize) {
  for (const p of positions) {
    const dx = p.x - px, dy = p.y - py;
    if (dx * dx + dy * dy <= (planetSize + 4) * (planetSize + 4)) return p.idx;
  }
  return -1;
}

/** Case-insensitive filter of links by title or URL. */
function filterLinks(links, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return links.slice();
  return links.filter(l => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
}

/** Human host for display. */
function hostOf(url) {
  try { return new URL(url).host; } catch { return ""; }
}
// ==================== ENGINE-END ====================

// -------------------- UI --------------------
const canvas = document.getElementById("galaxy");
const ctx = canvas.getContext("2d");
const titleIn = document.getElementById("titleIn");
const urlIn = document.getElementById("urlIn");
const addBtn = document.getElementById("addBtn");
const errEl = document.getElementById("err");
const searchIn = document.getElementById("searchIn");
const linkList = document.getElementById("linkList");
const countEl = document.getElementById("count");

let links = [];          // [{id, title, url}]
let positions = [];      // last-rendered planet positions
let startT = Date.now();
let stars = [];

// Twinkling background stars (canvas-local, cosmetic).
function initStars() {
  stars = [];
  for (let i = 0; i < 46; i++) {
    stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.2 + 0.3, tw: Math.random() * Math.PI * 2 });
  }
}

/** Draw the galaxy for current links at animation time. */
function draw() {
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const t = (Date.now() - startT) / 1000;
  ctx.clearRect(0, 0, W, H);

  // Stars.
  for (const s of stars) {
    const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 1.4 + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }

  const n = Math.min(links.length, 8); // at most 8 visible orbits fit 220px canvas
  positions = orbitPositions(n, t, cx, cy);

  // Orbits.
  ctx.strokeStyle = "rgba(34,211,238,.18)";
  ctx.lineWidth = 1;
  for (const p of positions) {
    ctx.beginPath(); ctx.ellipse(cx, cy, p.r, p.r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // Star (sun).
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
  g.addColorStop(0, "rgba(34,211,238,.95)");
  g.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd76a";
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();

  // Planets for the visible links.
  const planetSize = 7;
  for (const p of positions) {
    const link = links[p.idx];
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath(); ctx.arc(p.x, p.y, planetSize, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#9beaff";
    ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(232,232,239,.85)";
    ctx.font = "9px system-ui";
    ctx.textAlign = "center";
    const label = link.title.length > 14 ? link.title.slice(0, 13) + "…" : link.title;
    ctx.fillText(label, p.x, p.y + planetSize + 11);
  }

  if (links.length > 8) {
    ctx.fillStyle = "rgba(232,232,239,.6)";
    ctx.font = "10px system-ui"; ctx.textAlign = "left";
    ctx.fillText(`+${links.length - 8} more in the list below`, 8, H - 8);
  }
  requestAnimationFrame(draw);
}

// Click a planet -> open its page in a new tab.
canvas.addEventListener("click", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const idx = planetAt(positions, (ev.clientX - rect.left) * scaleX, (ev.clientY - rect.top) * scaleY, 7);
  if (idx >= 0 && links[idx]) chrome.tabs.create({ url: links[idx].url });
});

/** Render the link list. */
function renderList() {
  const q = searchIn.value;
  const items = filterLinks(links, q);
  countEl.textContent = links.length;
  linkList.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="empty">No planets yet — add your first link above.</span>';
    linkList.appendChild(li);
    return;
  }
  for (const l of items) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#"; a.textContent = l.title; a.title = l.url;
    a.addEventListener("click", (e) => { e.preventDefault(); chrome.tabs.create({ url: l.url }); });
    const host = document.createElement("span");
    host.className = "host"; host.textContent = hostOf(l.url);
    const del = document.createElement("button");
    del.className = "del"; del.textContent = "Remove";
    del.addEventListener("click", () => {
      links = links.filter(x => x.id !== l.id);
      save(); renderList();
    });
    li.append(a, host, del);
    linkList.appendChild(li);
  }
}

function save() {
  chrome.storage.local.set({ galaxyLinks: links.slice(0, 500) });
}

addBtn.addEventListener("click", () => {
  const res = makeLink(titleIn.value, urlIn.value);
  if (!res.ok) { errEl.textContent = res.error; errEl.hidden = false; return; }
  errEl.hidden = true;
  links.unshift(res.entry);
  titleIn.value = ""; urlIn.value = "";
  save(); renderList();
});
searchIn.addEventListener("input", renderList);

// Load and start.
chrome.storage.local.get({ galaxyLinks: [] }, (data) => {
  links = Array.isArray(data.galaxyLinks) ? data.galaxyLinks : [];
  initStars();
  renderList();
  requestAnimationFrame(draw);
});
