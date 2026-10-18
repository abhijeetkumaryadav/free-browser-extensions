/* Keyword Knowledge Graph — popup logic
   Notes with manual links + canvas graph + TF-ranked keyword search.
   Honest scope: keyword matching only, no embeddings / vector search. */

"use strict";

const $ = (id) => document.getElementById(id);
const STORE_KEY = "kg_notes_v1";

// ---------------------------------------------------------------- state
let notes = [];            // {id, title, body, links:[id], ts}
let positions = {};        // id -> {x, y} canvas positions

// ---------------------------------------------------------------- utils
const uid = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tokenize = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

async function loadNotes() {
  const res = await chrome.storage.local.get(STORE_KEY);
  notes = Array.isArray(res[STORE_KEY]) ? res[STORE_KEY] : [];
}
async function saveNotes() {
  await chrome.storage.local.set({ [STORE_KEY]: notes });
}

// ---------------------------------------------------------------- tabs
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".pane").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $("pane-" + t.dataset.tab).classList.add("active");
    if (t.dataset.tab === "graph") drawGraph();
  });
});

// ---------------------------------------------------------------- notes CRUD
function refreshLinkOptions() {
  const sel = $("selLinks");
  sel.innerHTML = "";
  notes.forEach((n) => {
    const o = document.createElement("option");
    o.value = n.id;
    o.textContent = n.title;
    sel.appendChild(o);
  });
}

function renderNotes() {
  const ul = $("noteList");
  ul.innerHTML = "";
  if (!notes.length) { ul.innerHTML = '<li class="empty">No notes yet — add your first above.</li>'; return; }
  const byId = Object.fromEntries(notes.map((n) => [n.id, n]));
  notes.slice().reverse().forEach((n) => {
    const linkNames = (n.links || []).map((id) => byId[id] && byId[id].title).filter(Boolean);
    const li = document.createElement("li");
    li.className = "note-card";
    li.innerHTML = `<h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>
      <div class="meta"><span>${linkNames.length ? "→ " + esc(linkNames.join(", ")) : "no links"}</span>
      <button class="del" data-id="${n.id}">Delete</button></div>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
    const id = b.dataset.id;
    notes = notes.filter((n) => n.id !== id);
    notes.forEach((n) => { n.links = (n.links || []).filter((l) => l !== id); });
    await saveNotes(); refreshLinkOptions(); renderNotes(); drawGraph(); updateCounts();
  }));
}

$("btnAddNote").addEventListener("click", async () => {
  const title = $("inTitle").value.trim();
  const body = $("inBody").value.trim();
  if (!title) { $("inTitle").focus(); return; }
  const links = [...$("selLinks").selectedOptions].map((o) => o.value);
  notes.push({ id: uid(), title, body, links, ts: Date.now() });
  await saveNotes();
  $("inTitle").value = ""; $("inBody").value = "";
  refreshLinkOptions(); renderNotes(); drawGraph(); updateCounts();
});
$("btnResetForm").addEventListener("click", () => {
  $("inTitle").value = ""; $("inBody").value = "";
  [...$("selLinks").options].forEach((o) => (o.selected = false));
});

// ---------------------------------------------------------------- graph canvas
function layoutNodes() {
  const W = 348, H = 240, cx = W / 2, cy = H / 2;
  if (notes.length === 1) { positions[notes[0].id] = { x: cx, y: cy }; return; }
  const R = Math.min(W, H) / 2 - 40;
  notes.forEach((n, i) => {
    if (!positions[n.id]) {
      const a = (2 * Math.PI * i) / notes.length - Math.PI / 2;
      positions[n.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    }
  });
}

function drawGraph() {
  const c = $("graphCanvas");
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  layoutNodes();
  const byId = Object.fromEntries(notes.map((n) => [n.id, n]));
  // edges
  ctx.strokeStyle = "rgba(129,140,248,.45)";
  ctx.lineWidth = 1.5;
  notes.forEach((n) => {
    (n.links || []).forEach((id) => {
      if (!byId[id] || !positions[n.id] || !positions[id]) return;
      ctx.beginPath();
      ctx.moveTo(positions[n.id].x, positions[n.id].y);
      ctx.lineTo(positions[id].x, positions[id].y);
      ctx.stroke();
    });
  });
  // nodes
  notes.forEach((n) => {
    const p = positions[n.id];
    if (!p) return;
    ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 7);
    ctx.fillStyle = "#818cf8"; ctx.fill();
    ctx.fillStyle = "#eef";
    ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n.title[0] || "?").toUpperCase(), p.x, p.y);
    ctx.fillStyle = "rgba(236,238,244,.85)";
    ctx.font = "9px sans-serif";
    ctx.fillText(n.title.slice(0, 14), p.x, p.y + 22);
  });
  if (!notes.length) {
    ctx.fillStyle = "rgba(154,160,180,.8)"; ctx.textAlign = "center";
    ctx.font = "12px sans-serif";
    ctx.fillText("Add notes to see the graph", W / 2, H / 2);
  }
}

$("btnShuffle").addEventListener("click", () => {
  positions = {};
  drawGraph();
});
$("btnClearAll").addEventListener("click", async () => {
  if (!confirm("Delete all notes and links?")) return;
  notes = []; positions = {};
  await saveNotes(); refreshLinkOptions(); renderNotes(); drawGraph(); updateCounts();
});

function updateCounts() {
  const links = notes.reduce((a, n) => a + (n.links || []).length, 0);
  $("statCounts").textContent = `${notes.length} notes · ${links} links`;
}

// ---------------------------------------------------------------- search (TF ranking)
function scoreNote(note, terms) {
  const titleT = tokenize(note.title);
  const bodyT = tokenize(note.body);
  let score = 0;
  const matched = new Set();
  terms.forEach((t) => {
    const inTitle = titleT.filter((w) => w === t).length;
    const inBody = bodyT.filter((w) => w === t).length;
    if (inTitle || inBody) { matched.add(t); score += inTitle * 3 + inBody; }
  });
  return { score, matched: [...matched] };
}

function highlight(text, terms) {
  const safe = esc(text);
  if (!terms.length) return safe;
  const re = new RegExp("(" + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  return safe.replace(re, "<mark>$1</mark>");
}

function runSearch() {
  const q = $("inQuery").value.trim();
  const ul = $("resultList");
  ul.innerHTML = "";
  if (!q) { ul.innerHTML = '<li class="empty">Type keywords and press Search.</li>'; return; }
  const terms = tokenize(q);
  const scored = notes
    .map((n) => ({ n, ...scoreNote(n, terms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) { ul.innerHTML = '<li class="empty">No matches.</li>'; return; }
  scored.slice(0, 20).forEach((r) => {
    const li = document.createElement("li");
    li.className = "result-card";
    li.innerHTML = `<h3>${highlight(r.n.title, r.matched)}</h3>
      <p>${highlight(r.n.body.slice(0, 160), r.matched)}</p>
      <div class="meta"><span class="score">score ${r.score}</span>
      <span>${r.matched.length} term${r.matched.length === 1 ? "" : "s"} matched</span></div>`;
    ul.appendChild(li);
  });
}
$("btnSearch").addEventListener("click", runSearch);
$("inQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

// ---------------------------------------------------------------- init
(async function init() {
  await loadNotes();
  refreshLinkOptions();
  renderNotes();
  updateCounts();
  drawGraph();
})();
