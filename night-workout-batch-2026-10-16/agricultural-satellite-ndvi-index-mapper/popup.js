/* NDVI Grid — local NDVI toolkit.
   All computation is client-side; results are educational estimates,
   NOT live satellite observations. */

/* ---- NDVI interpretation bands (standard agronomy references) ---- */
const BANDS = [
  { min: -1.0, max: -0.01, label: "Water / non-vegetation", desc: "Negative values — water bodies, clouds, snow.", color: "#3b82f6" },
  { min: 0.0, max: 0.2, label: "Bare soil / rock", desc: "Little to no vegetation cover.", color: "#a16207" },
  { min: 0.2, max: 0.4, label: "Sparse vegetation", desc: "Stressed crops, young plants, sparse cover.", color: "#eab308" },
  { min: 0.4, max: 0.6, label: "Moderate vegetation", desc: "Healthy growing crops, typical mid-season.", color: "#84cc16" },
  { min: 0.6, max: 1.0, label: "Dense healthy vegetation", desc: "Lush canopy, peak biomass.", color: "#22c55e" },
];

/* Bundled sample NIR/Red readings (typical surface reflectances). */
const SAMPLES = [
  { name: "Healthy wheat", nir: 0.55, red: 0.08 },
  { name: "Stressed maize", nir: 0.32, red: 0.16 },
  { name: "Bare soil", nir: 0.24, red: 0.20 },
  { name: "Water pond", nir: 0.05, red: 0.06 },
  { name: "Dense forest", nir: 0.62, red: 0.05 },
];

const GRID_SIZE = 8;               // 8x8 = 64 cells
const STORAGE_KEY = "ndviFieldGrid";

/* ---------- pure helpers ---------- */

/** NDVI = (NIR - Red) / (NIR + Red); returns null when undefined (NIR+Red == 0). */
function computeNDVI(nir, red) {
  if (typeof nir !== "number" || typeof red !== "number" || isNaN(nir) || isNaN(red)) return null;
  if (nir < 0 || nir > 1 || red < 0 || red > 1) return null;
  const denom = nir + red;
  if (denom === 0) return null;
  return (nir - red) / denom;
}

/** Find the interpretation band for an NDVI value. */
function bandFor(ndvi) {
  if (ndvi === null) return null;
  return BANDS.find(b => ndvi >= b.min && ndvi <= b.max) || BANDS[BANDS.length - 1];
}

/** Map an NDVI value (-1..1) to a display color. */
function ndviColor(ndvi) {
  if (ndvi === null || ndvi === undefined) return "rgba(255,255,255,.06)";
  // piecewise: -1 brown -> 0 tan -> 0.4 yellow-green -> 1 green
  const stops = [
    [-1.0, [139, 69, 19]], [0.0, [210, 180, 120]], [0.4, [190, 200, 60]], [1.0, [34, 197, 94]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (ndvi >= stops[i][0] && ndvi <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = Math.min(1, Math.max(0, (ndvi - a[0]) / (b[0] - a[0] || 1)));
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ---------- tab navigation ---------- */
function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

/* ---------- calculator tab ---------- */
function renderSamples() {
  const wrap = document.getElementById("samples");
  wrap.innerHTML = "";
  SAMPLES.forEach(s => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = s.name;
    chip.addEventListener("click", () => {
      document.getElementById("nir").value = s.nir;
      document.getElementById("red").value = s.red;
      runCalculation();
    });
    wrap.appendChild(chip);
  });
}

function runCalculation() {
  const nir = parseFloat(document.getElementById("nir").value);
  const red = parseFloat(document.getElementById("red").value);
  const card = document.getElementById("resultCard");
  const valEl = document.getElementById("ndviVal");
  const bandEl = document.getElementById("ndviBand");
  const ndvi = computeNDVI(nir, red);
  card.hidden = false;
  if (ndvi === null) {
    valEl.textContent = "—";
    bandEl.textContent = "Enter valid NIR/Red values (0–1).";
    bandEl.style.color = "var(--danger)";
    return;
  }
  const band = bandFor(ndvi);
  valEl.textContent = ndvi.toFixed(3);
  valEl.style.color = band.color;
  bandEl.textContent = band.label;
  bandEl.style.color = band.color;
}

/* ---------- field grid tab ---------- */
let grid = new Array(GRID_SIZE * GRID_SIZE).fill(null);
let painting = false;

function cellIndex(r, c) { return r * GRID_SIZE + c; }

function renderGrid() {
  const el = document.getElementById("fieldGrid");
  el.innerHTML = "";
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const i = cellIndex(r, c);
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.background = ndviColor(grid[i]);
      cell.title = grid[i] === null ? "unpainted" : `NDVI ${grid[i].toFixed(2)}`;
      cell.addEventListener("pointerdown", e => { painting = true; paint(i); e.preventDefault(); });
      cell.addEventListener("pointerenter", () => { if (painting) paint(i); });
      el.appendChild(cell);
    }
  }
  document.addEventListener("pointerup", () => { painting = false; }, { once: false });
  updateStats();
  saveGrid();
}

function brushValue() {
  return parseFloat(document.getElementById("brushVal").value);
}

function paint(i) {
  grid[i] = brushValue();
  renderGrid();
}

function updateStats() {
  const painted = grid.filter(v => v !== null);
  document.getElementById("cellCount").textContent = `${painted.length} / ${GRID_SIZE * GRID_SIZE}`;
  const avgEl = document.getElementById("avgNdvi");
  if (painted.length === 0) { avgEl.textContent = "—"; return; }
  const avg = painted.reduce((a, b) => a + b, 0) / painted.length;
  avgEl.textContent = avg.toFixed(2);
  avgEl.style.color = ndviColor(avg);
}

function saveGrid() {
  chrome.storage.local.set({ [STORAGE_KEY]: grid }).catch(() => {});
}

function loadGrid() {
  chrome.storage.local.get(STORAGE_KEY).then(res => {
    if (Array.isArray(res[STORAGE_KEY]) && res[STORAGE_KEY].length === grid.length) {
      grid = res[STORAGE_KEY];
    }
    renderGrid();
  }).catch(renderGrid);
}

function exportCSV() {
  const rows = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    rows.push(grid.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE).map(v => v === null ? "" : v.toFixed(2)).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ndvi-field-grid.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = String(reader.result).trim().split(/\r?\n/).slice(0, GRID_SIZE);
      const next = new Array(GRID_SIZE * GRID_SIZE).fill(null);
      rows.forEach((row, r) => {
        row.split(",").slice(0, GRID_SIZE).forEach((tok, c) => {
          const v = parseFloat(tok.trim());
          if (!isNaN(v) && v >= -1 && v <= 1) next[cellIndex(r, c)] = v;
        });
      });
      grid = next;
      renderGrid();
    } catch { /* malformed CSV — keep current grid */ }
  };
  reader.readAsText(file);
}

function renderPresets() {
  const wrap = document.getElementById("presets");
  const presets = [
    { name: "Water −0.3", v: -0.3 }, { name: "Soil 0.1", v: 0.1 },
    { name: "Sparse 0.3", v: 0.3 }, { name: "Healthy 0.7", v: 0.7 },
  ];
  presets.forEach(p => {
    const b = document.createElement("button");
    b.className = "preset";
    b.textContent = p.name;
    b.style.borderColor = ndviColor(p.v);
    b.addEventListener("click", () => {
      document.getElementById("brushVal").value = p.v;
      document.getElementById("brushNum").textContent = p.v.toFixed(2);
    });
    wrap.appendChild(b);
  });
}

/* ---------- bands reference tab ---------- */
function renderBands() {
  const wrap = document.getElementById("bandList");
  BANDS.forEach(b => {
    const item = document.createElement("div");
    item.className = "band-item";
    item.innerHTML = `<div class="band-swatch" style="background:${b.color}"></div>
      <div><div class="range">${b.min.toFixed(1)} → ${b.max.toFixed(1)} · ${b.label}</div>
      <div class="desc">${b.desc}</div></div>`;
    wrap.appendChild(item);
  });
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  renderSamples();
  renderBands();
  renderPresets();

  document.getElementById("calcBtn").addEventListener("click", runCalculation);

  const brush = document.getElementById("brushVal");
  brush.addEventListener("input", () => {
    document.getElementById("brushNum").textContent = parseFloat(brush.value).toFixed(2);
  });

  document.getElementById("exportBtn").addEventListener("click", exportCSV);
  document.getElementById("clearBtn").addEventListener("click", () => {
    grid = new Array(GRID_SIZE * GRID_SIZE).fill(null);
    renderGrid();
  });
  const fileInput = document.getElementById("csvFile");
  document.getElementById("importBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) importCSV(fileInput.files[0]);
    fileInput.value = "";
  });

  loadGrid();
});
