// Performance Memory Leak Monitor — popup logic.
// sampleHeap() is injected into the page; it must stay self-contained.

function sampleHeap() {
  if (performance && performance.memory && typeof performance.memory.usedJSHeapSize === "number") {
    return {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
    };
  }
  return null;
}

const $ = (id) => document.getElementById(id);
const SAMPLE_MS = 2000;
const MAX_SAMPLES = 120;   // 4 minutes at 2s cadence
const LEAK_WINDOW = 20;    // samples used for the growth heuristic
const LEAK_SLOPE_MB = 0.15; // MB per sample
const LEAK_GROWTH_MB = 2;   // net MB over the window

let timer = null;
let samples = []; // {t, mb}
let running = false;

document.addEventListener("DOMContentLoaded", () => {
  $("toggle").addEventListener("click", toggle);
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab && tab.url) { try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {} }
  });
});

async function readHeap() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return "no-tab";
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: sampleHeap });
    return (res && res.result) || null;
  } catch (e) {
    return "no-tab";
  }
}

async function toggle() {
  if (running) { stop(); return; }
  const btn = $("toggle");
  btn.disabled = true; btn.textContent = "…";
  const first = await readHeap();
  if (first === "no-tab") {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t reach this tab — try a regular web page.";
    btn.disabled = false; btn.textContent = "Start";
    return;
  }
  if (first === null) {
    $("empty").style.display = "none";
    $("unsupported").hidden = false;
    btn.disabled = true; btn.textContent = "Start";
    return;
  }
  running = true;
  samples = [];
  $("empty").style.display = "none";
  $("dash").hidden = false;
  $("leakWarn").hidden = true;
  btn.disabled = false;
  btn.textContent = "Stop";
  btn.classList.add("stop");
  await tick();
  timer = setInterval(tick, SAMPLE_MS);
}

function stop() {
  running = false;
  clearInterval(timer);
  timer = null;
  const btn = $("toggle");
  btn.textContent = "Start";
  btn.classList.remove("stop");
}

async function tick() {
  if (!running) return;
  const h = await readHeap();
  if (h === "no-tab" || h === null) { stop(); return; }
  samples.push({ t: Date.now(), mb: h.used / 1048576 });
  if (samples.length > MAX_SAMPLES) samples = samples.slice(-MAX_SAMPLES);
  render();
}

// Least-squares slope (MB per sample) over the last LEAK_WINDOW samples.
function slopeOf(vals) {
  const n = vals.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += vals[i]; sxx += i * i; sxy += i * vals[i]; }
  const denom = n * sxx - sx * sx;
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
}

function render() {
  const mbs = samples.map((s) => s.mb);
  const cur = mbs[mbs.length - 1];
  const min = Math.min(...mbs), max = Math.max(...mbs);
  const growth = cur - mbs[0];
  const f = (n) => n.toFixed(1) + " MB";
  $("curMb").textContent = cur.toFixed(1);
  $("stMin").textContent = f(min);
  $("stMax").textContent = f(max);
  const g = $("stGrowth");
  g.textContent = (growth >= 0 ? "+" : "") + growth.toFixed(1) + " MB";
  g.style.color = growth > 2 ? "#fb718c" : "";
  $("stN").textContent = samples.length;

  // leak heuristic: steady climb over the recent window
  let leak = false;
  if (samples.length >= LEAK_WINDOW) {
    const win = mbs.slice(-LEAK_WINDOW);
    const slope = slopeOf(win);
    const net = win[win.length - 1] - win[0];
    leak = slope > LEAK_SLOPE_MB && net > LEAK_GROWTH_MB;
  }
  $("leakWarn").hidden = !leak;

  // chart
  const svg = $("chart");
  svg.innerHTML = "";
  const W = 340, H = 110, PAD = 8;
  const lo = Math.min(...mbs), hi = Math.max(...mbs);
  const span = hi - lo || 1;
  const pts = mbs.map((v, i) => {
    const x = PAD + (i / Math.max(mbs.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - lo) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const NS = "http://www.w3.org/2000/svg";
  const base = document.createElementNS(NS, "line");
  base.setAttribute("x1", PAD); base.setAttribute("x2", W - PAD);
  base.setAttribute("y1", H - PAD + 0.5); base.setAttribute("y2", H - PAD + 0.5);
  base.setAttribute("stroke", "rgba(255,255,255,.15)");
  svg.appendChild(base);
  if (pts.length > 1) {
    const poly = document.createElementNS(NS, "polyline");
    poly.setAttribute("points", pts.join(" "));
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", leak ? "#fb718c" : "#f43f5e");
    poly.setAttribute("stroke-width", "2.5");
    poly.setAttribute("stroke-linejoin", "round");
    svg.appendChild(poly);
    const last = pts[pts.length - 1].split(",");
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", last[0]); dot.setAttribute("cy", last[1]);
    dot.setAttribute("r", "4"); dot.setAttribute("fill", leak ? "#fb718c" : "#f43f5e");
    svg.appendChild(dot);
  }
}
