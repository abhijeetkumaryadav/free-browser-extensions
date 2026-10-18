"use strict";
/* Cable Radar — pure-local engine + simulated radar canvas UI.
 * Honest scope: an educational explainer with simulated blips plus
 * your own notes. No live backbone or traffic data. Zero network. */

// ==================== ENGINE-START ====================
// Pure functions — no DOM, no chrome APIs. Safe to unit-test in Node.

// Educational cable facts bundled with the extension.
const CABLE_FACTS = [
  { title: "The real backbone", text: "Around 99% of intercontinental internet traffic travels through undersea fiber-optic cables, not satellites." },
  { title: "How thin is it?", text: "A trans-oceanic cable is about as thick as a garden hose — the fiber strands inside are hair-thin glass." },
  { title: "How they get there", text: "Special cable ships lay them along the seabed, burying them near shores where fishing and anchors are a risk." },
  { title: "Landing points", text: "Cables come ashore at landing stations — heavily guarded buildings where fiber connects to terrestrial networks." },
  { title: "Built to be cut", text: "Sharks, anchors and earthquakes damage cables every year; repair ships splice them back together in days." },
  { title: "Shared by all", text: "One cable carries data for millions of users at once, split into wavelengths of light called channels." },
  { title: "This tool shows nothing live", text: "The radar below is a simulated doodle. Real cable maps and status are maintained by cable owners, not this tool." }
];

/** Simulate radar blips. Deterministic given (seed, t): each blip has a
 *  fixed polar position and a fade phase; sweep angle at time t (sec). */
function radarState(seed, t) {
  const rng = mulberry(seed);
  const blips = [];
  for (let i = 0; i < 7; i++) {
    blips.push({
      r: 0.25 + rng() * 0.65,          // fraction of radar radius
      a: rng() * Math.PI * 2,          // angle
      phase: rng() * Math.PI * 2       // fade phase
    });
  }
  return { blips, sweep: (t * 0.9) % (Math.PI * 2) };
}

/** Small deterministic PRNG (mulberry32). */
function mulberry(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/** Blip brightness 0..1: bright right after the sweep passes, fading after. */
function blipBrightness(blip, sweep) {
  let d = (sweep - blip.a) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return Math.max(0, 1 - d / (Math.PI * 1.2));
}

/** Validate and build a note. Returns {ok, note} or {ok:false, error}. */
function makeNote(title, body) {
  const t = String(title || "").trim();
  const b = String(body || "").trim();
  if (!t) return { ok: false, error: "Title is required." };
  if (t.length > 80) return { ok: false, error: "Title is too long (80 max)." };
  if (b.length > 2000) return { ok: false, error: "Note is too long (2000 max)." };
  return { ok: true, note: { id: "n" + Date.now() + Math.floor(Math.random() * 1e6), title: t, body: b, when: Date.now() } };
}

/** Newest-first, immutable sort. */
function sortNotes(notes) {
  return notes.slice().sort((a, b) => b.when - a.when);
}

/** Case-insensitive filter across title + body. */
function filterNotes(notes, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return notes.slice();
  return notes.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
}

/** Friendly date, local time. */
function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
// ==================== ENGINE-END ====================

// -------------------- UI --------------------
const canvas = document.getElementById("radar");
const ctx = canvas.getContext("2d");
const factsEl = document.getElementById("facts");
const titleIn = document.getElementById("titleIn");
const bodyIn = document.getElementById("bodyIn");
const addBtn = document.getElementById("addBtn");
const errEl = document.getElementById("err");
const searchIn = document.getElementById("searchIn");
const noteList = document.getElementById("noteList");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clearBtn");

let notes = [];
const state = radarState(20261017, 0);
let startT = Date.now();

/** Draw the simulated radar frame. */
function draw() {
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 12;
  const t = (Date.now() - startT) / 1000;
  const sweep = (t * 0.9) % (Math.PI * 2);
  ctx.clearRect(0, 0, W, H);

  // Rings + crosshair.
  ctx.strokeStyle = "rgba(245,158,11,.28)";
  ctx.lineWidth = 1;
  for (const f of [1, 0.66, 0.33]) {
    ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(245,158,11,.15)";
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

  // Sweep with trailing gradient (faked with two wedges).
  for (const [span, alpha] of [[0.5, 0.10], [0.12, 0.30]]) {
    ctx.fillStyle = `rgba(245,158,11,${alpha})`;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, sweep - span, sweep);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = "rgba(245,158,11,.9)";
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();

  // Simulated blips fade after the sweep passes.
  for (const b of state.blips) {
    const br = blipBrightness(b, sweep);
    if (br <= 0.01) continue;
    const x = cx + Math.cos(b.a) * b.r * R;
    const y = cy + Math.sin(b.a) * b.r * R;
    ctx.fillStyle = `rgba(245,158,11,${br.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  requestAnimationFrame(draw);
}

/** Render educational facts. */
function renderFacts() {
  factsEl.innerHTML = "";
  for (const f of CABLE_FACTS) {
    const li = document.createElement("li");
    const b = document.createElement("b"); b.textContent = f.title;
    const span = document.createElement("span"); span.textContent = f.text;
    li.append(b, span);
    factsEl.appendChild(li);
  }
}

/** Render notes. */
function renderNotes() {
  const items = sortNotes(filterNotes(notes, searchIn.value));
  countEl.textContent = notes.length;
  noteList.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="empty">No notes yet.</span>';
    noteList.appendChild(li);
    return;
  }
  for (const n of items) {
    const li = document.createElement("li");
    const head = document.createElement("div");
    head.className = "note-title";
    const t = document.createElement("span"); t.textContent = n.title;
    const del = document.createElement("button"); del.textContent = "Delete";
    del.addEventListener("click", () => {
      notes = notes.filter(x => x.id !== n.id);
      save(); renderNotes();
    });
    head.append(t, del);
    const body = document.createElement("p");
    body.className = "note-body"; body.textContent = n.body;
    const when = document.createElement("div");
    when.className = "note-when"; when.textContent = fmtWhen(n.when);
    li.append(head, body, when);
    noteList.appendChild(li);
  }
}

function save() {
  chrome.storage.local.set({ cableNotes: notes.slice(0, 500) });
}

addBtn.addEventListener("click", () => {
  const res = makeNote(titleIn.value, bodyIn.value);
  if (!res.ok) { errEl.textContent = res.error; errEl.hidden = false; return; }
  errEl.hidden = true;
  notes.unshift(res.note);
  titleIn.value = ""; bodyIn.value = "";
  save(); renderNotes();
});
searchIn.addEventListener("input", renderNotes);
clearBtn.addEventListener("click", () => {
  if (!notes.length) return;
  if (confirm("Delete all cable notes?")) { notes = []; save(); renderNotes(); }
});

// Load and start.
chrome.storage.local.get({ cableNotes: [] }, (data) => {
  notes = Array.isArray(data.cableNotes) ? data.cableNotes : [];
  renderFacts();
  renderNotes();
  requestAnimationFrame(draw);
});
