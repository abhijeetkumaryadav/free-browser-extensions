// Concept Canvas — visual glossary popup logic (terms, SVG doodles, flashcards). 100% local.
"use strict";

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
const ACCENT = "#818cf8";
const VB_W = 300, VB_H = 180;

let terms = [];          // { id, term, definition, tag, shapes: [{id,type,x,y,label}] }
let editingId = null;    // term being edited (doodle editor)
let draftShapes = [];    // shapes in the editor
let selectedShapeId = null;
let reviewOrder = [];    // shuffled term ids
let reviewIdx = 0;
let flipped = false;

/* ---------- persistence ---------- */
async function load() {
  const { terms: saved } = await store.get("terms");
  terms = Array.isArray(saved) ? saved : [];
}
async function save() { await store.set({ terms }); }

/* ---------- tabs ---------- */
function bindTabs() {
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      document.querySelectorAll(".tabpage").forEach((p) => (p.hidden = true));
      $("tab-" + b.dataset.tab).hidden = false;
    });
  });
}

/* ---------- terms list ---------- */
function allTags() {
  return [...new Set(terms.map((t) => t.tag).filter(Boolean))].sort();
}
function refreshTagFilter() {
  const sel = $("tagFilter");
  const cur = sel.value;
  sel.innerHTML = '<option value="">All tags</option>';
  for (const tag of allTags()) {
    const o = document.createElement("option");
    o.value = tag; o.textContent = tag;
    sel.appendChild(o);
  }
  sel.value = cur;
}
function renderTerms() {
  refreshTagFilter();
  const q = $("search").value.trim().toLowerCase();
  const tag = $("tagFilter").value;
  const list = terms.filter((t) => {
    if (tag && t.tag !== tag) return false;
    if (q && !(t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q))) return false;
    return true;
  });
  $("termCount").textContent = terms.length + " term" + (terms.length === 1 ? "" : "s");
  const el = $("termList");
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = '<div class="empty">No terms yet — add your first on the Add tab.</div>';
    return;
  }
  for (const t of list) {
    const div = document.createElement("div");
    div.className = "term";
    const top = document.createElement("div");
    top.className = "term-top";
    const name = document.createElement("div");
    name.className = "term-name";
    name.textContent = t.term;
    top.appendChild(name);
    if (t.tag) {
      const pill = document.createElement("div");
      pill.className = "tagpill";
      pill.textContent = t.tag;
      top.appendChild(pill);
    }
    div.appendChild(top);
    const def = document.createElement("div");
    def.className = "term-def";
    def.textContent = t.definition.length > 140 ? t.definition.slice(0, 140) + "…" : t.definition;
    div.appendChild(def);
    const acts = document.createElement("div");
    acts.className = "term-actions";
    const edit = document.createElement("button");
    edit.className = "mini"; edit.textContent = "View / Edit";
    edit.addEventListener("click", () => startEdit(t.id));
    const del = document.createElement("button");
    del.className = "mini"; del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm("Delete “" + t.term + "”?")) return;
      terms = terms.filter((x) => x.id !== t.id);
      await save(); renderTerms();
    });
    acts.appendChild(edit); acts.appendChild(del);
    div.appendChild(acts);
    el.appendChild(div);
  }
}

/* ---------- SVG doodle engine ---------- */
function svgNS() { return "http://www.w3.org/2000/svg"; }
function el(tag, attrs) {
  const n = document.createElementNS(svgNS(), tag);
  for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k]);
  return n;
}
// Render a shape list into an <svg>; `interactive` enables selection classes.
function renderShapes(svgEl, shapes, interactive, selId) {
  svgEl.innerHTML = "";
  for (const s of shapes) {
    let node;
    if (s.type === "rect") {
      node = el("rect", {
        x: s.x - 45, y: s.y - 22, width: 90, height: 44, rx: 8,
        fill: "rgba(129,140,248,0.15)", stroke: "rgba(255,255,255,0.7)", "stroke-width": 1.5,
      });
    } else if (s.type === "circle") {
      node = el("circle", {
        cx: s.x, cy: s.y, r: 27,
        fill: "rgba(129,140,248,0.15)", stroke: "rgba(255,255,255,0.7)", "stroke-width": 1.5,
      });
    } else {
      node = el("text", {
        x: s.x, y: s.y, "text-anchor": "middle", "dominant-baseline": "middle",
        fill: "#f9fafb", "font-size": 13, "font-weight": 600, cursor: "move",
      });
      node.textContent = s.label || "text";
    }
    node.dataset.sid = s.id;
    if (interactive) {
      node.style.cursor = "move";
      if (s.id === selId) node.classList.add("sel");
    }
    svgEl.appendChild(node);
    if (s.type !== "text") {
      const t = el("text", {
        x: s.x, y: s.y, "text-anchor": "middle", "dominant-baseline": "middle",
        fill: "#f9fafb", "font-size": 11, "font-weight": 600, "pointer-events": "none",
      });
      t.textContent = s.label || "";
      svgEl.appendChild(t);
    }
  }
}
function svgPoint(svgEl, clientX, clientY) {
  const r = svgEl.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * VB_W,
    y: ((clientY - r.top) / r.height) * VB_H,
  };
}
function addShape(type) {
  draftShapes.push({
    id: "s" + Date.now().toString(36),
    type,
    x: 90 + Math.random() * 120,
    y: 50 + Math.random() * 80,
    label: type === "text" ? "label" : "node",
  });
  selectedShapeId = draftShapes[draftShapes.length - 1].id;
  syncShapeLabel();
  renderShapes($("doodle"), draftShapes, true, selectedShapeId);
}
function bindDoodle() {
  const svg = $("doodle");
  let dragId = null;
  svg.addEventListener("pointerdown", (e) => {
    const target = e.target.closest("[data-sid]");
    if (!target) { selectedShapeId = null; renderShapes(svg, draftShapes, true, null); return; }
    dragId = target.dataset.sid;
    selectedShapeId = dragId;
    svg.setPointerCapture(e.pointerId);
    renderShapes(svg, draftShapes, true, selectedShapeId);
    syncShapeLabel();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragId) return;
    const p = svgPoint(svg, e.clientX, e.clientY);
    const s = draftShapes.find((x) => x.id === dragId);
    if (s) {
      s.x = Math.max(0, Math.min(VB_W, p.x));
      s.y = Math.max(0, Math.min(VB_H, p.y));
      renderShapes(svg, draftShapes, true, selectedShapeId);
    }
  });
  svg.addEventListener("pointerup", () => { dragId = null; });
  $("addRect").addEventListener("click", () => addShape("rect"));
  $("addCircle").addEventListener("click", () => addShape("circle"));
  $("addText").addEventListener("click", () => addShape("text"));
  $("delShape").addEventListener("click", () => {
    if (!selectedShapeId) return;
    draftShapes = draftShapes.filter((x) => x.id !== selectedShapeId);
    selectedShapeId = null;
    renderShapes(svg, draftShapes, true, null);
  });
  $("shapeLabel").addEventListener("input", (e) => {
    const s = draftShapes.find((x) => x.id === selectedShapeId);
    if (s) { s.label = e.target.value; renderShapes(svg, draftShapes, true, selectedShapeId); }
  });
}
function syncShapeLabel() {
  const s = draftShapes.find((x) => x.id === selectedShapeId);
  $("shapeLabel").value = s ? s.label || "" : "";
}

/* ---------- add / edit ---------- */
function clearEditor() {
  editingId = null;
  $("addTitle").textContent = "New term";
  $("tTerm").value = ""; $("tDef").value = ""; $("tTag").value = "";
  draftShapes = []; selectedShapeId = null;
  renderShapes($("doodle"), draftShapes, true, null);
  syncShapeLabel();
}
function startEdit(id) {
  const t = terms.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  $("addTitle").textContent = "Edit term";
  $("tTerm").value = t.term; $("tDef").value = t.definition; $("tTag").value = t.tag || "";
  draftShapes = (t.shapes || []).map((s) => Object.assign({}, s));
  selectedShapeId = null;
  renderShapes($("doodle"), draftShapes, true, null);
  syncShapeLabel();
  document.querySelector('.tab[data-tab="add"]').click();
}
async function saveTerm() {
  const term = $("tTerm").value.trim();
  const definition = $("tDef").value.trim();
  if (!term) { alert("Give the term a name."); return; }
  const tag = $("tTag").value.trim();
  if (editingId) {
    const t = terms.find((x) => x.id === editingId);
    if (t) Object.assign(t, { term, definition, tag, shapes: draftShapes });
  } else {
    terms.push({
      id: "t" + Date.now().toString(36),
      term, definition, tag,
      shapes: draftShapes,
    });
  }
  await save();
  renderTerms();
  clearEditor();
  document.querySelector('.tab[data-tab="terms"]').click();
}

/* ---------- review ---------- */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function resetReview() {
  reviewOrder = shuffle(terms.map((t) => t.id));
  reviewIdx = 0; flipped = false;
  renderReview();
}
function renderReview() {
  if (!reviewOrder.length) {
    $("cardTerm").textContent = "No terms to review";
    $("cardDoodle").innerHTML = "";
    $("cardDef").hidden = true;
    $("reviewCount").textContent = "Add terms on the Add tab to start reviewing.";
    return;
  }
  const t = terms.find((x) => x.id === reviewOrder[reviewIdx]);
  if (!t) { reviewOrder = reviewOrder.filter((id) => id !== reviewOrder[reviewIdx]); renderReview(); return; }
  $("cardTerm").textContent = t.term;
  renderShapes($("cardDoodle"), t.shapes || [], false, null);
  $("cardDef").hidden = !flipped;
  const d = $("cardDef");
  d.innerHTML = "";
  const p = document.createElement("div");
  p.textContent = t.definition;
  d.appendChild(p);
  $("reviewCount").textContent = (reviewIdx + 1) + " / " + reviewOrder.length;
}

/* ---------- events ---------- */
function bind() {
  $("search").addEventListener("input", renderTerms);
  $("tagFilter").addEventListener("change", renderTerms);
  $("saveTerm").addEventListener("click", saveTerm);
  $("cancelAdd").addEventListener("click", clearEditor);
  $("flipCard").addEventListener("click", () => { flipped = !flipped; renderReview(); });
  $("nextCard").addEventListener("click", () => {
    if (!reviewOrder.length) return;
    reviewIdx = (reviewIdx + 1) % reviewOrder.length; flipped = false; renderReview();
  });
  $("prevCard").addEventListener("click", () => {
    if (!reviewOrder.length) return;
    reviewIdx = (reviewIdx - 1 + reviewOrder.length) % reviewOrder.length; flipped = false; renderReview();
  });
  $("shuffleCard").addEventListener("click", resetReview);
  // Rebuild review deck when the review tab is opened
  document.querySelector('.tab[data-tab="review"]').addEventListener("click", resetReview);
  bindDoodle();
}

/* ---------- init ---------- */
(async function init() {
  await load();
  bindTabs();
  bind();
  renderTerms();
  renderShapes($("doodle"), [], true, null);
  renderReview();
})();
