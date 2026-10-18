/* W&B Envelope — weight & balance calculator.
   Pure engine (testable) between ENGINE-START/ENGINE-END; UI wiring below. */

// ENGINE-START
/**
 * Parse envelope text: one "weight,cg" per line, in polygon order.
 * @param {string} text
 * @returns {Array<{w:number,cg:number}>|null} null when unusable (<3 points or bad numbers)
 */
function parseEnvelope(text) {
  if (typeof text !== 'string') return null;
  const pts = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.split(',');
    if (m.length !== 2) return null;
    const w = parseFloat(m[0]);
    const cg = parseFloat(m[1]);
    if (!isFinite(w) || !isFinite(cg) || w <= 0 || cg <= 0) return null;
    pts.push({ w, cg });
  }
  return pts.length >= 3 ? pts : null;
}

/**
 * Compute totals from empty weight/CG and a list of {w, arm} loads.
 * @returns {{gross:number, cg:number, moment:number}|null}
 */
function computeWB(emptyW, emptyCG, loads) {
  if (!isFinite(emptyW) || !isFinite(emptyCG) || emptyW <= 0 || emptyCG <= 0) return null;
  let gross = emptyW;
  let moment = emptyW * emptyCG;
  for (const l of loads) {
    const w = parseFloat(l.w) || 0;
    const arm = parseFloat(l.arm) || 0;
    if (w < 0 || arm < 0) return null;
    gross += w;
    moment += w * arm;
  }
  if (gross <= 0) return null;
  return { gross, cg: moment / gross, moment };
}

/**
 * Ray-casting point-in-polygon on (cg, weight) plane.
 * @param {Array<{w:number,cg:number}>} poly
 * @param {{w:number,cg:number}} pt
 * @returns {boolean}
 */
function pointInEnvelope(poly, pt) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].cg, yi = poly[i].w;
    const xj = poly[j].cg, yj = poly[j].w;
    const x = pt.cg, y = pt.w;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Project (cg, weight) into canvas pixels given envelope bounds.
 * @returns {{px:number, py:number}}
 */
function projectPoint(cg, w, bounds, W, H, pad) {
  const x0 = pad, x1 = W - pad, y0 = H - pad, y1 = pad;
  const px = x0 + (cg - bounds.cgMin) / Math.max(1e-9, bounds.cgMax - bounds.cgMin) * (x1 - x0);
  const py = y0 - (w - bounds.wMin) / Math.max(1e-9, bounds.wMax - bounds.wMin) * (y0 - y1);
  return { px, py };
}

/** @returns {{cgMin:number,cgMax:number,wMin:number,wMax:number}} padded bounds covering envelope + point */
function envelopeBounds(poly, pt) {
  const cgs = poly.map(p => p.cg).concat([pt.cg]);
  const ws = poly.map(p => p.w).concat([pt.w]);
  let cgMin = Math.min(...cgs), cgMax = Math.max(...cgs);
  let wMin = Math.min(...ws), wMax = Math.max(...ws);
  const cgPad = Math.max(1, (cgMax - cgMin) * 0.15);
  const wPad = Math.max(10, (wMax - wMin) * 0.15);
  return { cgMin: cgMin - cgPad, cgMax: cgMax + cgPad, wMin: wMin - wPad, wMax: wMax + wPad };
}

function fmt(n, d) { return (n === null || n === undefined || !isFinite(n)) ? '—' : n.toFixed(d); }
// ENGINE-END

/* ---------- UI wiring ---------- */
const $ = id => document.getElementById(id);
const LS_KEY = 'wbEnvelopeStateV1';

const DEFAULT_ENVELOPE = '2200,80\n2200,88\n1900,92\n1600,88\n1600,80';

function readLoads() {
  return [0, 1, 2, 3].map(i => ({ w: $('l' + i + 'w').value, arm: $('l' + i + 'a').value }));
}

function saveState() {
  const state = {
    emptyW: $('emptyW').value, emptyCG: $('emptyCG').value,
    envelope: $('envelope').value,
    loads: readLoads()
  };
  chrome.storage.local.set({ [LS_KEY]: state });
}

function restoreState() {
  chrome.storage.local.get(LS_KEY, res => {
    const s = res[LS_KEY];
    if (!s) return;
    $('emptyW').value = s.emptyW || '';
    $('emptyCG').value = s.emptyCG || '';
    $('envelope').value = s.envelope || '';
    (s.loads || []).forEach((l, i) => {
      if (i < 4) { $('l' + i + 'w').value = l.w || ''; $('l' + i + 'a').value = l.arm || ''; }
    });
  });
}

function drawPlot(poly, pt) {
  const cv = $('plot');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const b = envelopeBounds(poly, pt);
  const pad = 26;

  // envelope polygon
  ctx.beginPath();
  poly.forEach((p, i) => {
    const { px, py } = projectPoint(p.cg, p.w, b, W, H, pad);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(56,189,248,.12)';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // CG point
  const { px, py } = projectPoint(pt.cg, pt.w, b, W, H, pad);
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.strokeStyle = '#0b0d12';
  ctx.lineWidth = 2;
  ctx.stroke();

  // axis labels
  ctx.fillStyle = '#9aa3b2';
  ctx.font = '9px sans-serif';
  ctx.fillText('CG (in) →', W - 64, H - 8);
  ctx.fillText('WT (lb)', 4, 12);
  ctx.fillText(fmt(b.cgMin, 0), pad - 12, H - 8);
  ctx.fillText(fmt(b.cgMax, 0), W - pad - 12, H - 8);
  ctx.fillText(fmt(b.wMax, 0), 4, pad + 4);
}

function calculate() {
  const emptyW = parseFloat($('emptyW').value);
  const emptyCG = parseFloat($('emptyCG').value);
  const env = parseEnvelope($('envelope').value);
  const res = computeWB(emptyW, emptyCG, readLoads());

  const card = $('resultCard');
  const verdict = $('verdict');

  if (!res || !env) {
    card.hidden = false;
    $('rW').textContent = '—'; $('rCG').textContent = '—'; $('rM').textContent = '—';
    verdict.className = 'verdict warn';
    verdict.textContent = 'Check inputs: need valid empty weight/CG, loads, and ≥3 envelope corners.';
    return;
  }

  card.hidden = false;
  $('rW').textContent = fmt(res.gross, 1) + ' lb';
  $('rCG').textContent = fmt(res.cg, 2) + ' in';
  $('rM').textContent = fmt(res.moment, 0) + ' lb·in';

  const inside = pointInEnvelope(env, { w: res.gross, cg: res.cg });
  verdict.className = 'verdict ' + (inside ? 'ok' : 'bad');
  verdict.textContent = inside
    ? '✓ CG is inside the envelope (estimate — verify against POH).'
    : '✗ CG is OUTSIDE the envelope (estimate — verify against POH).';

  drawPlot(env, { w: res.gross, cg: res.cg });
  saveState();
}

$('calc').addEventListener('click', calculate);
$('loadDefault').addEventListener('click', () => { $('envelope').value = DEFAULT_ENVELOPE; });
document.querySelectorAll('input,textarea').forEach(el =>
  el.addEventListener('change', saveState));

restoreState();
