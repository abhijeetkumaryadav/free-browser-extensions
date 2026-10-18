// ============================================================================
// popup.js — SVG path parsing, Chaikin corner smoothing, canvas preview.
// Pure client-side tool: no page access, no network, nothing stored.
// ============================================================================
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// 1. Path parsing: tokenize commands, sample curves into point polylines.
//    Supports M, L, H, V, C, S, Q, T, Z (absolute + relative).
// ---------------------------------------------------------------------------
function parsePathData(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const subpaths = [];
  let cur = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  let cmd = null, i = 0;
  let prevCx = null, prevCy = null; // for smooth curves

  const push = (px, py) => { cur.push({ x: px, y: py }); x = px; y = py; };
  const num = () => parseFloat(tokens[i++]);

  function sampleCubic(x0, y0, x1, y1, x2, y2, x3, y3, n = 12) {
    for (let k = 1; k <= n; k++) {
      const t = k / n, mt = 1 - t;
      push(
        mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
        mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3
      );
    }
  }
  function sampleQuad(x0, y0, x1, y1, x2, y2, n = 10) {
    for (let k = 1; k <= n; k++) {
      const t = k / n, mt = 1 - t;
      push(mt * mt * x0 + 2 * mt * t * x1 + t * t * x2, mt * mt * y0 + 2 * mt * t * y1 + t * t * y2);
    }
  }

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; } else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    const pt = (ax, ay) => ({ x: rel ? x + ax : ax, y: rel ? y + ay : ay });

    if (C === "M") {
      if (cur.length > 1) subpaths.push(cur);
      cur = [];
      const p = pt(num(), num()); push(p.x, p.y); sx = x; sy = y;
      cmd = rel ? "l" : "L"; // subsequent pairs are implicit linetos
    } else if (C === "L") { const p = pt(num(), num()); push(p.x, p.y); }
    else if (C === "H") { const nx = rel ? x + num() : num(); push(nx, y); }
    else if (C === "V") { const ny = rel ? y + num() : num(); push(x, ny); }
    else if (C === "C") {
      const p1 = pt(num(), num()), p2 = pt(num(), num()), p3 = pt(num(), num());
      sampleCubic(x, y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      prevCx = p2.x; prevCy = p2.y;
    } else if (C === "S") {
      const x1 = prevCx !== null ? 2 * x - prevCx : x, y1 = prevCy !== null ? 2 * y - prevCy : y;
      const p2 = pt(num(), num()), p3 = pt(num(), num());
      sampleCubic(x, y, x1, y1, p2.x, p2.y, p3.x, p3.y);
      prevCx = p2.x; prevCy = p2.y;
    } else if (C === "Q") {
      const p1 = pt(num(), num()), p2 = pt(num(), num());
      sampleQuad(x, y, p1.x, p1.y, p2.x, p2.y);
      prevCx = p1.x; prevCy = p1.y;
    } else if (C === "T") {
      const x1 = prevCx !== null ? 2 * x - prevCx : x, y1 = prevCy !== null ? 2 * y - prevCy : y;
      const p = pt(num(), num());
      sampleQuad(x, y, x1, y1, p.x, p.y);
      prevCx = x1; prevCy = y1;
    } else if (C === "Z") {
      if (cur.length > 1) { cur.push({ x: sx, y: sy }); x = sx; y = sy; }
      prevCx = prevCy = null;
    } else { i++; }
    if (!"CSQT".includes(C)) { prevCx = prevCy = null; }
  }
  if (cur.length > 1) subpaths.push(cur);
  return subpaths;
}

// ---------------------------------------------------------------------------
// 2. Chaikin corner-cutting: each iteration replaces every segment with two
//    points at 1/4 and 3/4, rounding corners while preserving endpoints.
// ---------------------------------------------------------------------------
function chaikin(points, iterations) {
  let pts = points.slice();
  for (let n = 0; n < iterations; n++) {
    if (pts.length < 3) break;
    const out = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function subpathsToPath(subpaths) {
  const f = n => Math.round(n * 100) / 100;
  return subpaths.map(sp => "M" + sp.map(p => `${f(p.x)},${f(p.y)}`).join(" L")).join(" ");
}

// ---------------------------------------------------------------------------
// 3. Canvas preview: fit all points, draw original (gray) + smoothed (pink).
// ---------------------------------------------------------------------------
function drawPreview(original, smoothed) {
  const canvas = $("preview");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const all = [...original.flat(), ...smoothed.flat()];
  if (!all.length) return;
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 14;
  const sx = (canvas.width - pad * 2) / Math.max(maxX - minX, 1);
  const sy = (canvas.height - pad * 2) / Math.max(maxY - minY, 1);
  const s = Math.min(sx, sy);
  const ox = pad + ((canvas.width - pad * 2) - (maxX - minX) * s) / 2 - minX * s;
  const oy = pad + ((canvas.height - pad * 2) - (maxY - minY) * s) / 2 - minY * s;
  const T = p => [ox + p.x * s, oy + p.y * s];

  const stroke = (subpaths, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const sp of subpaths) {
      ctx.beginPath();
      sp.forEach((p, k) => { const [cx, cy] = T(p); k ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy); });
      ctx.stroke();
    }
  };
  stroke(original, "#8b8b96", 1.5);
  stroke(smoothed, "#ec4899", 2.5);
}

// ---------------------------------------------------------------------------
// 4. UI wiring
// ---------------------------------------------------------------------------
const SAMPLE = "M20,120 C60,20 100,20 140,120 S220,200 260,120 C290,60 320,60 350,120";

function refresh() {
  const raw = $("pathInput").value.trim();
  const iters = parseInt($("iterRange").value, 10);
  $("iterVal").textContent = iters;
  if (!raw) {
    $("ptsBefore").textContent = "0"; $("ptsAfter").textContent = "0";
    $("pathOutput").value = "";
    const ctx = $("preview").getContext("2d");
    ctx.clearRect(0, 0, 332, 170);
    return;
  }
  try {
    const subpaths = parsePathData(raw);
    const before = subpaths.reduce((n, sp) => n + sp.length, 0);
    const smoothed = subpaths.map(sp => chaikin(sp, iters));
    const after = smoothed.reduce((n, sp) => n + sp.length, 0);
    $("ptsBefore").textContent = before;
    $("ptsAfter").textContent = after;
    $("pathOutput").value = subpathsToPath(smoothed);
    drawPreview(subpaths, smoothed);
    $("status").textContent = "";
  } catch (e) {
    $("status").textContent = "Could not parse path: " + e.message;
  }
}

$("pathInput").addEventListener("input", refresh);
$("iterRange").addEventListener("input", refresh);
$("sampleBtn").addEventListener("click", () => { $("pathInput").value = SAMPLE; refresh(); });
$("clearBtn").addEventListener("click", () => { $("pathInput").value = ""; refresh(); });
$("copyBtn").addEventListener("click", async () => {
  const out = $("pathOutput").value;
  if (!out) { $("status").textContent = "Nothing to copy yet."; return; }
  try {
    await navigator.clipboard.writeText(out);
    $("status").textContent = "Copied to clipboard ✓";
  } catch {
    $("pathOutput").select();
    document.execCommand("copy");
    $("status").textContent = "Copied to clipboard ✓";
  }
  setTimeout(() => { $("status").textContent = ""; }, 2000);
});
