/* Property Notes — manual property record keeper.
 * 100% local: chrome.storage.local only. No network, no content script.
 * Honest scope: user's own notes — NOT official zoning records. */

// ---- Default document checklist ----
const DEFAULT_DOCS = [
  "Deed / title document",
  "Survey report",
  "Zoning certificate",
  "Property tax receipts",
  "Building permits",
  "Utility bills"
];

// ---- Storage helpers ----
async function loadProps() {
  const { properties = [] } = await chrome.storage.local.get("properties");
  return properties;
}
async function saveProps(properties) {
  await chrome.storage.local.set({ properties });
}
async function loadCustomDocs() {
  const { customDocs = [] } = await chrome.storage.local.get("customDocs");
  return customDocs;
}
async function saveCustomDocs(docs) {
  await chrome.storage.local.set({ customDocs: docs });
}

let editingId = null; // id of property being edited (null = adding)
let docState = {};    // doc label -> checked boolean for the form

// ---- Document checklist rendering ----
function renderChecklist(preselected = {}) {
  docState = {};
  loadCustomDocs().then(customDocs => {
    const all = [...DEFAULT_DOCS, ...customDocs];
    const box = document.getElementById("doc-checklist");
    box.innerHTML = "";
    all.forEach(label => {
      docState[label] = !!preselected[label];
      const row = document.createElement("label");
      row.className = "doc-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!preselected[label];
      cb.addEventListener("change", () => { docState[label] = cb.checked; });
      const span = document.createElement("span");
      span.textContent = label;
      row.append(cb, span);
      box.appendChild(row);
    });
  });
}

// ---- Property form ----
async function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Add property";
  document.getElementById("property-form").reset();
  document.getElementById("btn-cancel-edit").classList.add("hidden");
  renderChecklist();
}

async function onSubmit(e) {
  e.preventDefault();
  const address = document.getElementById("f-address").value.trim();
  if (!address) return;
  const lot = document.getElementById("f-lot").value.trim();
  const zoning = document.getElementById("f-zoning").value.trim();
  const docs = Object.entries(docState).map(([label, done]) => ({ label, done }));
  const properties = await loadProps();
  if (editingId) {
    const p = properties.find(x => x.id === editingId);
    if (p) { p.address = address; p.lot = lot; p.zoning = zoning; p.docs = docs; }
  } else {
    properties.push({
      id: "p" + Date.now(),
      address, lot, zoning, docs,
      sketch: null,
      createdAt: new Date().toISOString()
    });
  }
  await saveProps(properties);
  await resetForm();
  await renderProperties();
  await refreshSketchProps();
}

async function renderProperties() {
  const properties = await loadProps();
  const list = document.getElementById("property-list");
  list.innerHTML = "";
  document.getElementById("props-empty").style.display = properties.length ? "none" : "block";
  properties.forEach(p => {
    const card = document.createElement("div");
    card.className = "prop-card";

    const h = document.createElement("h3");
    h.textContent = p.address;
    card.appendChild(h);

    if (p.lot) {
      const m = document.createElement("div");
      m.className = "meta";
      m.textContent = "Lot: " + p.lot;
      card.appendChild(m);
    }
    if (p.zoning) {
      const m = document.createElement("div");
      m.className = "meta";
      m.textContent = "Zoning notes: " + p.zoning;
      card.appendChild(m);
    }
    if (p.docs && p.docs.length) {
      const d = document.createElement("div");
      d.className = "docs";
      const done = p.docs.filter(x => x.done).length;
      d.innerHTML = "";
      const b = document.createElement("b");
      b.textContent = `Documents: ${done}/${p.docs.length}`;
      d.appendChild(b);
      const ul = document.createElement("div");
      ul.textContent = p.docs.map(x => (x.done ? "✓ " : "○ ") + x.label).join("   ");
      d.appendChild(ul);
      card.appendChild(d);
    }
    if (p.sketch) {
      const img = document.createElement("img");
      img.className = "prop-thumb";
      img.src = p.sketch;
      img.alt = "Boundary sketch";
      card.appendChild(img);
    }

    const actions = document.createElement("div");
    actions.className = "prop-actions";

    const edit = document.createElement("button");
    edit.className = "btn small";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => startEdit(p.id));

    const sketch = document.createElement("button");
    sketch.className = "btn small";
    sketch.textContent = "Sketch";
    sketch.addEventListener("click", () => {
      switchTab("sketch");
      document.getElementById("sketch-prop").value = p.id;
      loadSketchFor(p.id);
    });

    const del = document.createElement("button");
    del.className = "btn small danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete "${p.address}" and its notes?`)) return;
      await saveProps((await loadProps()).filter(x => x.id !== p.id));
      await renderProperties();
      await refreshSketchProps();
    });

    actions.append(edit, sketch, del);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

async function startEdit(id) {
  const p = (await loadProps()).find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById("form-title").textContent = "Edit property";
  document.getElementById("f-address").value = p.address;
  document.getElementById("f-lot").value = p.lot || "";
  document.getElementById("f-zoning").value = p.zoning || "";
  document.getElementById("btn-cancel-edit").classList.remove("hidden");
  renderChecklist(Object.fromEntries((p.docs || []).map(d => [d.label, d.done])));
  switchTab("properties");
  window.scrollTo(0, 0);
}

// ---- Sketch canvas ----
const canvas = () => document.getElementById("sketch-canvas");
let drawing = false;
let hasStrokes = false;

function canvasPos(e) {
  const c = canvas();
  const r = c.getBoundingClientRect();
  const x = (e.clientX - r.left) * (c.width / r.width);
  const y = (e.clientY - r.top) * (c.height / r.height);
  return { x, y };
}

function initCanvas() {
  const c = canvas();
  const ctx = c.getContext("2d");
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#f59e0b";
  ctx.lineCap = "round";

  const start = e => {
    e.preventDefault();
    drawing = true;
    const { x, y } = canvasPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = e => {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = canvasPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes = true;
  };
  const stop = () => { drawing = false; };

  c.addEventListener("mousedown", start);
  c.addEventListener("mousemove", move);
  c.addEventListener("mouseup", stop);
  c.addEventListener("mouseleave", stop);
  // touch support
  c.addEventListener("touchstart", e => start(e.touches[0] && Object.assign(e, { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })), { passive: false });
  c.addEventListener("touchmove", e => move(Object.assign(e, { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY })), { passive: false });
  c.addEventListener("touchend", stop);
}

function clearCanvas() {
  const c = canvas();
  c.getContext("2d").clearRect(0, 0, c.width, c.height);
  hasStrokes = false;
  document.getElementById("sketch-saved-note").classList.add("hidden");
}

async function loadSketchFor(propId) {
  clearCanvas();
  const p = (await loadProps()).find(x => x.id === propId);
  if (p && p.sketch) {
    const img = new Image();
    img.onload = () => {
      canvas().getContext("2d").drawImage(img, 0, 0);
      hasStrokes = true;
    };
    img.src = p.sketch;
  }
}

async function refreshSketchProps() {
  const properties = await loadProps();
  const sel = document.getElementById("sketch-prop");
  const cur = sel.value;
  sel.innerHTML = "";
  if (!properties.length) {
    const o = document.createElement("option");
    o.textContent = "Add a property first";
    o.value = "";
    sel.appendChild(o);
  }
  properties.forEach(p => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.address;
    sel.appendChild(o);
  });
  if (properties.some(p => p.id === cur)) sel.value = cur;
  if (sel.value) loadSketchFor(sel.value);
  else clearCanvas();
}

// ---- Tabs ----
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === "tab-" + name));
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", async () => {
  initCanvas();
  renderChecklist();
  await renderProperties();
  await refreshSketchProps();

  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => switchTab(t.dataset.tab)));

  document.getElementById("property-form").addEventListener("submit", onSubmit);
  document.getElementById("btn-cancel-edit").addEventListener("click", resetForm);

  document.getElementById("btn-add-doc").addEventListener("click", async () => {
    const input = document.getElementById("f-doc-custom");
    const label = input.value.trim();
    if (!label) return;
    const custom = await loadCustomDocs();
    if (!custom.includes(label)) custom.push(label);
    await saveCustomDocs(custom);
    input.value = "";
    docState[label] = false;
    renderChecklist(docState);
  });

  document.getElementById("sketch-prop").addEventListener("change", e => loadSketchFor(e.target.value));
  document.getElementById("btn-sketch-clear").addEventListener("click", clearCanvas);
  document.getElementById("btn-sketch-save").addEventListener("click", async () => {
    const propId = document.getElementById("sketch-prop").value;
    if (!propId) return;
    const properties = await loadProps();
    const p = properties.find(x => x.id === propId);
    if (!p) return;
    p.sketch = hasStrokes ? canvas().toDataURL("image/png") : null;
    await saveProps(properties);
    const note = document.getElementById("sketch-saved-note");
    note.textContent = hasStrokes ? "Sketch saved." : "Sketch cleared.";
    note.classList.remove("hidden");
    await renderProperties();
  });
});
