/* ChartForge — hand-written canvas chart renderer for pasted CSV data.
 * No chart libraries, no network. Everything runs locally in the popup. */
'use strict';

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const csvInput = $('csvInput'), hasHeader = $('hasHeader');
const loadSample = $('loadSample'), clearData = $('clearData'), dataNote = $('dataNote');
const titleInput = $('titleInput'), xSelect = $('xSelect'), paletteSelect = $('paletteSelect');
const yList = $('yList');
const typeBar = $('typeBar'), typeLine = $('typeLine'), typePie = $('typePie');
const canvas = $('chart'), emptyNote = $('emptyNote');
const downloadBtn = $('downloadBtn'), pointStat = $('pointStat');

/* ---------- State ---------- */
let table = [];
let chartType = 'bar'; // 'bar' | 'line' | 'pie'
let ySelected = new Set();

/* Palettes — one accent family per palette, no remote assets. */
const PALETTES = {
  emerald: ['#10b981', '#34d399', '#6ee7b7', '#059669', '#a7f3d0', '#047857'],
  sunset:  ['#f59e0b', '#f97316', '#ef4444', '#fbbf24', '#fb7185', '#eab308'],
  ocean:   ['#0ea5e9', '#38bdf8', '#6366f1', '#22d3ee', '#818cf8', '#0284c7'],
  mono:    ['#e5e7eb', '#9ca3af', '#6b7280', '#d1d5db', '#4b5563', '#374151']
};

/* ---------- CSV parsing (local, RFC4180-ish) ---------- */
function splitLine(line, d) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === d) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseTable(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const candidates = [',', '\t', ';', '|'];
  let best = ',', bestScore = -1;
  for (const d of candidates) {
    const counts = lines.slice(0, 8).map((l) => splitLine(l, d).length);
    const unique = new Set(counts).size;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const score = unique === 1 ? avg * 10 : avg - unique;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return lines.map((l) => splitLine(l, best));
}

function isNumericColumn(colIdx) {
  let seen = 0;
  for (const row of dataRows()) {
    const v = (row[colIdx] ?? '').trim();
    if (v === '') continue;
    if (!/^[-+]?[\d,]*\.?\d+([eE][-+]?\d+)?%?$/.test(v)) return false;
    seen++;
  }
  return seen > 0;
}

function numVal(s) {
  const v = String(s ?? '').trim().replace(/,/g, '');
  if (v.endsWith('%')) return parseFloat(v) / 100;
  return parseFloat(v);
}

function dataRows() {
  return (hasHeader.checked && table.length > 1) ? table.slice(1) : table;
}

function colName(c) {
  if (hasHeader.checked && table.length && table[0][c]) return table[0][c];
  return 'Column ' + (c + 1);
}

/* ---------- Column config UI ---------- */
function rebuildColumns() {
  const prevX = xSelect.value, prevY = new Set(ySelected);
  xSelect.innerHTML = '';
  yList.innerHTML = '';
  ySelected = new Set();
  if (!table.length) return;

  const colCount = Math.max(...table.map((r) => r.length));
  for (let c = 0; c < colCount; c++) {
    const o = document.createElement('option');
    o.value = String(c);
    o.textContent = colName(c);
    xSelect.appendChild(o);

    if (isNumericColumn(c)) {
      const label = document.createElement('label');
      label.className = 'y-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = String(c);
      cb.checked = prevY.has(String(c)) || (prevY.size === 0 && ySelected.size < 2);
      cb.addEventListener('change', () => {
        if (cb.checked) ySelected.add(String(c)); else ySelected.delete(String(c));
        if (chartType === 'pie' && ySelected.size > 1) {
          // Pie uses the first series only; keep selection but note it.
        }
        saveConfig();
        render();
      });
      if (cb.checked) ySelected.add(String(c));
      const name = document.createElement('span');
      name.textContent = colName(c);
      const sw = document.createElement('span');
      sw.className = 'swatch';
      label.append(cb, name, sw);
      yList.appendChild(label);
    }
  }
  if ([...xSelect.options].some((o) => o.value === prevX)) xSelect.value = prevX;
  else if (colCount > 1 && isNumericColumn(1)) xSelect.value = '0';
  tintSwatches();
}

function tintSwatches() {
  const pal = PALETTES[paletteSelect.value] || PALETTES.emerald;
  const items = [...yList.querySelectorAll('.y-item')];
  items.forEach((item, i) => {
    const sw = item.querySelector('.swatch');
    if (sw) sw.style.background = pal[i % pal.length];
  });
}

/* ---------- Chart data prep ---------- */
function chartData() {
  const rows = dataRows();
  const xCol = Number(xSelect.value || 0);
  const yCols = [...ySelected].map(Number).sort((a, b) => a - b);
  if (!rows.length || !yCols.length) return null;
  const labels = rows.map((r) => String(r[xCol] ?? '').trim() || '(blank)');
  const series = yCols.map((c) => ({
    name: colName(c),
    values: rows.map((r) => {
      const v = numVal(r[c]);
      return Number.isFinite(v) ? v : 0;
    })
  }));
  return { labels, series };
}

function niceNum(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(v * 100) / 100);
}

/* ---------- Canvas setup ---------- */
const W = 640, H = 400;
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/* ---------- Renderers ---------- */
function drawChrome(ctx, title, legend) {
  // Background
  ctx.fillStyle = '#101014';
  ctx.fillRect(0, 0, W, H);
  // Title
  if (title) {
    ctx.fillStyle = '#f4f4f6';
    ctx.font = '700 20px -apple-system, "Segoe UI", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, 30);
  }
  // Legend (bottom)
  if (legend && legend.length) {
    ctx.font = '12px -apple-system, "Segoe UI", Inter, sans-serif';
    ctx.textAlign = 'left';
    let x = 24;
    const y = H - 14;
    legend.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(x, y - 10, 12, 12, 3);
      ctx.fill();
      ctx.fillStyle = '#c9c9d1';
      const w = ctx.measureText(item.name).width;
      ctx.fillText(item.name, x + 17, y);
      x += 17 + w + 18;
      if (x > W - 80) return; // stop if overflowing
    });
  }
}

function drawAxes(ctx, max, plot) {
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.fillStyle = '#9a9aa5';
  ctx.font = '11px -apple-system, "Segoe UI", Inter, sans-serif';
  ctx.lineWidth = 1;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = (max / steps) * i;
    const y = plot.y + plot.h - (v / max) * plot.h;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); ctx.stroke();
    ctx.fillStyle = '#9a9aa5';
    ctx.textAlign = 'right';
    ctx.fillText(niceNum(v), plot.x - 8, y + 4);
  }
  // Baseline
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.moveTo(plot.x, plot.y + plot.h); ctx.lineTo(plot.x + plot.w, plot.y + plot.h); ctx.stroke();
}

function drawBar(ctx, data, pal, title) {
  const plot = { x: 56, y: 56, w: W - 80, h: H - 130 };
  drawChrome(ctx, title, data.series.map((s, i) => ({ name: s.name, color: pal[i % pal.length] })));
  const max = Math.max(1, ...data.series.flatMap((s) => s.values));
  drawAxes(ctx, max, plot);

  const n = data.labels.length;
  const groupW = plot.w / Math.max(n, 1);
  const barW = Math.min(34, (groupW * 0.7) / Math.max(data.series.length, 1));
  data.labels.forEach((label, i) => {
    const gx = plot.x + i * groupW + groupW / 2;
    data.series.forEach((s, si) => {
      const v = s.values[i];
      const h = (v / max) * plot.h;
      const bw = barW;
      const bx = gx + (si - (data.series.length - 1) / 2) * bw - bw / 2;
      ctx.fillStyle = pal[si % pal.length];
      ctx.beginPath();
      ctx.roundRect(bx, plot.y + plot.h - h, bw, h, [4, 4, 0, 0]);
      ctx.fill();
    });
    // X label
    ctx.fillStyle = '#9a9aa5';
    ctx.font = '10px -apple-system, "Segoe UI", Inter, sans-serif';
    ctx.textAlign = 'center';
    const short = label.length > 10 ? label.slice(0, 9) + '…' : label;
    ctx.fillText(short, gx, plot.y + plot.h + 16);
  });
}

function drawLine(ctx, data, pal, title) {
  const plot = { x: 56, y: 56, w: W - 80, h: H - 130 };
  drawChrome(ctx, title, data.series.map((s, i) => ({ name: s.name, color: pal[i % pal.length] })));
  const max = Math.max(1, ...data.series.flatMap((s) => s.values));
  const min = Math.min(0, ...data.series.flatMap((s) => s.values));
  const span = max - min || 1;
  drawAxes(ctx, max, plot);

  const n = data.labels.length;
  const xFor = (i) => plot.x + (n === 1 ? plot.w / 2 : (i / (n - 1)) * plot.w);
  const yFor = (v) => plot.y + plot.h - ((v - min) / span) * plot.h;

  data.series.forEach((s, si) => {
    const color = pal[si % pal.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = xFor(i), y = yFor(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Points
    ctx.fillStyle = color;
    s.values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xFor(i), yFor(v), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101014';
      ctx.beginPath();
      ctx.arc(xFor(i), yFor(v), 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
    });
  });
  // X labels
  ctx.fillStyle = '#9a9aa5';
  ctx.font = '10px -apple-system, "Segoe UI", Inter, sans-serif';
  ctx.textAlign = 'center';
  data.labels.forEach((label, i) => {
    const short = label.length > 10 ? label.slice(0, 9) + '…' : label;
    ctx.fillText(short, xFor(i), plot.y + plot.h + 16);
  });
}

function drawPie(ctx, data, pal, title) {
  // Pie uses the first Y series only.
  const s = data.series[0];
  const total = s.values.reduce((a, b) => a + b, 0) || 1;
  const legend = data.labels.map((label, i) => ({ name: label, color: pal[i % pal.length] }));
  drawChrome(ctx, title, legend.slice(0, 8));

  const cx = W / 2, cy = (H - 60) / 2 + 20, r = Math.min(W, H - 120) / 2 - 10;
  let angle = -Math.PI / 2;
  data.labels.forEach((label, i) => {
    const frac = s.values[i] / total;
    const a2 = angle + frac * Math.PI * 2;
    ctx.fillStyle = pal[i % pal.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, a2);
    ctx.closePath();
    ctx.fill();
    // Slice label for meaningful slices
    if (frac >= 0.06) {
      const mid = (angle + a2) / 2;
      const lx = cx + Math.cos(mid) * r * 0.65;
      const ly = cy + Math.sin(mid) * r * 0.65;
      ctx.fillStyle = '#0b0b0f';
      ctx.font = '700 13px -apple-system, "Segoe UI", Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(frac * 100) + '%', lx, ly + 5);
    }
    angle = a2;
  });
}

/* ---------- Render orchestration ---------- */
function render() {
  tintSwatches();
  const data = chartData();
  const has = !!data;
  emptyNote.style.display = has ? 'none' : 'block';
  canvas.style.display = has ? 'block' : 'none';
  downloadBtn.disabled = !has;

  if (!has) {
    pointStat.textContent = '';
    if (!table.length) dataNote.textContent = 'Paste numeric data to build a chart.';
    return;
  }

  const pal = PALETTES[paletteSelect.value] || PALETTES.emerald;
  const title = titleInput.value.trim();
  const ctx = setupCanvas();
  if (chartType === 'bar') drawBar(ctx, data, pal, title);
  else if (chartType === 'line') drawLine(ctx, data, pal, title);
  else drawPie(ctx, data, pal, title);

  const pts = data.labels.length * data.series.length;
  pointStat.textContent = `${data.labels.length} categories · ${data.series.length} series`;
  dataNote.textContent = chartType === 'pie'
    ? 'Pie chart uses the first selected Y series.'
    : '';
  dataNote.classList.toggle('warn', false);
}

/* ---------- Persistence ---------- */
function saveConfig() {
  chrome.storage.local.set({
    cf_title: titleInput.value,
    cf_palette: paletteSelect.value,
    cf_type: chartType,
    cf_x: xSelect.value,
    cf_y: [...ySelected]
  }).catch(() => {});
}

/* ---------- Actions ---------- */
function downloadPNG() {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = (titleInput.value.trim() || 'chartforge-chart')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- Events ---------- */
let debounce = null;
function scheduleRebuild() {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    table = parseTable(csvInput.value);
    rebuildColumns();
    render();
  }, 250);
}

csvInput.addEventListener('input', scheduleRebuild);
hasHeader.addEventListener('change', scheduleRebuild);
titleInput.addEventListener('input', () => { saveConfig(); render(); });
paletteSelect.addEventListener('change', () => { saveConfig(); render(); });
xSelect.addEventListener('change', () => { saveConfig(); render(); });

function setType(t) {
  chartType = t;
  [typeBar, typeLine, typePie].forEach((b) => b.classList.remove('active'));
  ({ bar: typeBar, line: typeLine, pie: typePie })[t].classList.add('active');
  saveConfig();
  render();
}
typeBar.addEventListener('click', () => setType('bar'));
typeLine.addEventListener('click', () => setType('line'));
typePie.addEventListener('click', () => setType('pie'));

downloadBtn.addEventListener('click', downloadPNG);

loadSample.addEventListener('click', () => {
  csvInput.value = [
    'month,revenue,expenses',
    'Jan,12000,8000',
    'Feb,15000,9000',
    'Mar,13500,8500',
    'Apr,17200,9800',
    'May,16800,10200',
    'Jun,19000,11000'
  ].join('\n');
  scheduleRebuild();
});
clearData.addEventListener('click', () => { csvInput.value = ''; scheduleRebuild(); });

/* ---------- Init ---------- */
(async function init() {
  try {
    const saved = await chrome.storage.local.get(['cf_title', 'cf_palette', 'cf_type']);
    if (saved.cf_title) titleInput.value = saved.cf_title;
    if (saved.cf_palette && PALETTES[saved.cf_palette]) paletteSelect.value = saved.cf_palette;
    if (saved.cf_type && ['bar', 'line', 'pie'].includes(saved.cf_type)) chartType = saved.cf_type;
  } catch { /* non-fatal */ }
  [typeBar, typeLine, typePie].forEach((b) => b.classList.remove('active'));
  ({ bar: typeBar, line: typeLine, pie: typePie })[chartType].classList.add('active');
  table = parseTable(csvInput.value);
  rebuildColumns();
  render();
})();
