// Year-over-Year Growth Visualizer — popup logic.
// All state is on-device (chrome.storage.local). SVG charts are drawn by hand.

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

let state = { series: [], activeId: null, view: "values" };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const saved = await chrome.storage.local.get(["yoy"]);
  if (saved.yoy) state = { ...state, ...saved.yoy };
  if (!state.series.length) {
    const id = "s-" + Date.now();
    state.series = [{ id, name: "Revenue", points: [] }];
    state.activeId = id;
  }
  $("seriesSel").addEventListener("change", (e) => { state.activeId = e.target.value; save(); render(); });
  $("addSeries").addEventListener("click", addSeries);
  $("delSeries").addEventListener("click", deleteSeries);
  $("addPoint").addEventListener("click", addPoint);
  $("tabValues").addEventListener("click", () => setView("values"));
  $("tabYoy").addEventListener("click", () => setView("yoy"));
  render();
}

function active() {
  return state.series.find((s) => s.id === state.activeId) || state.series[0];
}
function save() {
  chrome.storage.local.set({ yoy: { series: state.series, activeId: state.activeId } });
}

function addSeries() {
  const name = $("newSeries").value.trim();
  if (!name) return;
  const id = "s-" + Date.now();
  state.series.push({ id, name, points: [] });
  state.activeId = id;
  $("newSeries").value = "";
  save(); render();
}

function deleteSeries() {
  if (state.series.length <= 1) return;
  state.series = state.series.filter((s) => s.id !== state.activeId);
  state.activeId = state.series[0].id;
  save(); render();
}

function addPoint() {
  const year = parseInt($("inYear").value, 10);
  const value = parseFloat($("inValue").value);
  if (isNaN(year) || isNaN(value)) return;
  const s = active();
  const existing = s.points.find((p) => p.year === year);
  if (existing) existing.value = value;         // re-logging a year updates it
  else s.points.push({ year, value });
  s.points.sort((a, b) => a.year - b.year);
  $("inYear").value = ""; $("inValue").value = "";
  save(); render();
}

function setView(v) {
  state.view = v;
  $("tabValues").classList.toggle("active", v === "values");
  $("tabYoy").classList.toggle("active", v === "yoy");
  renderChart();
}

/* ---------- math ---------- */

// YoY % for each point after the first: {year, value, yoy}
function withYoy(points) {
  return points.map((p, i) => {
    if (i === 0) return { ...p, yoy: null };
    const prev = points[i - 1].value;
    return { ...p, yoy: prev ? ((p.value - prev) / Math.abs(prev)) * 100 : null };
  });
}

function cagr(points) {
  if (points.length < 2) return null;
  const first = points[0], last = points[points.length - 1];
  const span = last.year - first.year;
  if (span <= 0 || first.value <= 0 || last.value <= 0) return null;
  return (Math.pow(last.value / first.value, 1 / span) - 1) * 100;
}

const fmtPct = (n) => (n == null || !isFinite(n) ? "—" : (n >= 0 ? "+" : "") + n.toFixed(1) + "%");

/* ---------- render ---------- */

function render() {
  const sel = $("seriesSel");
  sel.innerHTML = "";
  for (const s of state.series) {
    const o = document.createElement("option");
    o.value = s.id; o.textContent = s.name;
    sel.appendChild(o);
  }
  sel.value = state.activeId;
  renderChart();
  renderStats();
  renderPoints();
}

function renderStats() {
  const pts = withYoy(active().points);
  $("stCagr").textContent = fmtPct(cagr(active().points));
  if (pts.length >= 2 && pts[0].value) {
    const total = ((pts[pts.length - 1].value - pts[0].value) / Math.abs(pts[0].value)) * 100;
    $("stTotal").textContent = fmtPct(total);
  } else $("stTotal").textContent = "—";

  const yoyVals = pts.filter((p) => p.yoy != null);
  const best = $("stBest"), worst = $("stWorst");
  if (yoyVals.length) {
    const hi = yoyVals.reduce((a, b) => (b.yoy > a.yoy ? b : a));
    const lo = yoyVals.reduce((a, b) => (b.yoy < a.yoy ? b : a));
    best.textContent = hi.year; best.className = "badge up";
    worst.textContent = lo.year; worst.className = "badge down";
  } else {
    best.textContent = worst.textContent = "—";
    best.className = worst.className = "badge";
  }
}

function renderPoints() {
  const box = $("points");
  box.innerHTML = "";
  const pts = withYoy(active().points);
  for (const p of [...pts].reverse()) {
    const row = document.createElement("div");
    row.className = "pt-row";
    const yr = document.createElement("span"); yr.className = "yr"; yr.textContent = p.year;
    const val = document.createElement("span"); val.className = "val";
    val.textContent = p.value.toLocaleString();
    row.append(yr, val);
    if (p.yoy != null) {
      const y = document.createElement("span");
      y.className = "yoy " + (p.yoy >= 0 ? "up" : "down");
      y.textContent = fmtPct(p.yoy);
      row.appendChild(y);
    }
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Remove";
    x.addEventListener("click", () => {
      active().points = active().points.filter((q) => q.year !== p.year);
      save(); render();
    });
    row.appendChild(x);
    box.appendChild(row);
  }
}

/* ---------- SVG chart ---------- */

function el(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

function renderChart() {
  const svg = $("chart");
  svg.innerHTML = "";
  const pts = withYoy(active().points);
  const empty = pts.length < 2;
  svg.style.display = empty ? "none" : "block";
  $("chartEmpty").style.display = empty ? "" : "none";
  if (empty) return;

  const W = 340, H = 190, PAD_L = 8, PAD_R = 8, PAD_T = 26, PAD_B = 24;
  const cw = W - PAD_L - PAD_R, ch = H - PAD_T - PAD_B;
  const slot = cw / pts.length;

  if (state.view === "values") {
    // Bar chart of raw values, YoY % labels above each bar
    const max = Math.max(...pts.map((p) => p.value), 0);
    pts.forEach((p, i) => {
      const bw = Math.min(slot * 0.62, 44);
      const x = PAD_L + slot * i + (slot - bw) / 2;
      const h = max > 0 ? (p.value / max) * (ch - 10) : 0;
      const y = PAD_T + ch - h;
      svg.appendChild(el("rect", {
        x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: Math.max(h, 2).toFixed(1),
        rx: 5, fill: "#10b981", opacity: i === 0 ? 0.55 : 1,
      }));
      const lbl = el("text", {
        x: (PAD_L + slot * i + slot / 2).toFixed(1), y: (PAD_T + ch + 16).toFixed(1),
        "text-anchor": "middle", fill: "#93a39b", "font-size": 10,
      });
      lbl.textContent = p.year;
      svg.appendChild(lbl);
      if (p.yoy != null) {
        const tag = el("text", {
          x: (PAD_L + slot * i + slot / 2).toFixed(1), y: (y - 6).toFixed(1),
          "text-anchor": "middle", "font-size": 10.5, "font-weight": 700,
          fill: p.yoy >= 0 ? "#34d399" : "#f87171",
        });
        tag.textContent = fmtPct(p.yoy);
        svg.appendChild(tag);
      }
    });
  } else {
    // Diverging YoY % bars around a zero axis
    const vals = pts.slice(1);
    const peak = Math.max(...vals.map((p) => Math.abs(p.yoy || 0)), 1);
    const zeroY = PAD_T + ch / 2;
    const half = ch / 2 - 6;
    svg.appendChild(el("line", {
      x1: PAD_L, x2: W - PAD_R, y1: zeroY, y2: zeroY, stroke: "rgba(255,255,255,.18)", "stroke-width": 1,
    }));
    vals.forEach((p, i) => {
      const idx = i + 1;
      const bw = Math.min(slot * 0.62, 44);
      const x = PAD_L + slot * idx + (slot - bw) / 2;
      const h = (Math.abs(p.yoy) / peak) * half;
      const y = p.yoy >= 0 ? zeroY - h : zeroY;
      svg.appendChild(el("rect", {
        x: x.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: Math.max(h, 3).toFixed(1),
        rx: 5, fill: p.yoy >= 0 ? "#10b981" : "#f87171",
      }));
      const lbl = el("text", {
        x: (PAD_L + slot * idx + slot / 2).toFixed(1), y: (PAD_T + ch + 16).toFixed(1),
        "text-anchor": "middle", fill: "#93a39b", "font-size": 10,
      });
      lbl.textContent = p.year;
      svg.appendChild(lbl);
      const tag = el("text", {
        x: (PAD_L + slot * idx + slot / 2).toFixed(1),
        y: (p.yoy >= 0 ? y - 6 : y + Math.max(h, 3) + 13).toFixed(1),
        "text-anchor": "middle", "font-size": 10.5, "font-weight": 700,
        fill: p.yoy >= 0 ? "#34d399" : "#f87171",
      });
      tag.textContent = fmtPct(p.yoy);
      svg.appendChild(tag);
    });
    const lbl0 = el("text", {
      x: (PAD_L + slot / 2).toFixed(1), y: (PAD_T + ch + 16).toFixed(1),
      "text-anchor": "middle", fill: "#93a39b", "font-size": 10,
    });
    lbl0.textContent = pts[0].year;
    svg.appendChild(lbl0);
  }
}
