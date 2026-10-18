// Plate Math — greedy plate solver + canvas barbell diagram. Math helper only.
'use strict';

/* ---------- solver engine (testable) ---------- */
// ENGINE-START
/** Colors by plate size rank for the diagram. */
const PLATE_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#a78bfa', '#f97316', '#22d3ee', '#f472b6'];

/**
 * Greedy plates-per-side solver (largest first).
 * @returns {{ perSide: [{plate, count}], loaded: number, remainder: number }}
 */
function solvePlates(target, bar, plates) {
  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  let remaining = Math.max(0, target - bar);
  const perSide = [];
  for (const p of sorted) {
    let count = 0;
    while (remaining >= 2 * p - 1e-9 && count < 12) {
      remaining -= 2 * p;
      count++;
    }
    if (count > 0) perSide.push({ plate: p, count });
  }
  const loaded = Math.round((target - remaining) * 100) / 100;
  return { perSide, loaded, remainder: Math.round(remaining * 100) / 100 };
}
// ENGINE-END

const $ = (id) => document.getElementById(id);
let unit = 'kg';

function parsePlates(str) {
  return str.split(/[,\s]+/).map(Number).filter((n) => n > 0 && isFinite(n));
}

function drawDiagram(ctx, perSide) {
  const W = 348, H = 120, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  // bar
  ctx.fillStyle = '#8a8a99';
  ctx.fillRect(20, cy - 3, W - 40, 6);
  // sleeves (left side = mirror)
  const drawSide = (x0, dir) => {
    let x = x0;
    perSide.forEach(({ plate, count }, rank) => {
      const h = Math.max(26, 88 - rank * 12); // bigger plates first
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = PLATE_COLORS[rank % PLATE_COLORS.length];
        const w = 14;
        ctx.fillRect(dir > 0 ? x : x - w, cy - h / 2, w, h);
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(dir > 0 ? x : x - w, cy - h / 2, w, 3);
        x += dir * (w + 3);
      }
    });
  };
  drawSide(40, 1);
  drawSide(W - 40, -1);
  // collars
  ctx.fillStyle = '#55555f';
  ctx.fillRect(40 - 6, cy - 20, 6, 40);
  ctx.fillRect(W - 40, cy - 20, 6, 40);
}

function calculate() {
  const target = parseFloat($('target').value);
  const bar = parseFloat($('bar').value) || 0;
  const plates = parsePlates($('plates').value);
  if (!(target > 0) || plates.length === 0) return;
  const { perSide, loaded, remainder } = solvePlates(target, bar, plates);
  const ul = $('breakdown');
  ul.innerHTML = '';
  perSide.forEach(({ plate, count }, rank) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="swatch" style="background:${PLATE_COLORS[rank % PLATE_COLORS.length]}"></span>` +
      `<span><strong>${count}×</strong> ${plate} ${unit} per side</span>`;
    ul.appendChild(li);
  });
  const r = $('remainder');
  if (remainder > 1e-6) {
    r.className = 'remainder';
    r.textContent = `⚠ Can't hit ${target} ${unit} exactly — ${remainder} ${unit} short. Closest: ${loaded} ${unit}.`;
  } else {
    r.className = 'remainder ok';
    r.textContent = `✓ Exact load: ${loaded} ${unit} (${bar} ${unit} bar + plates).`;
  }
  drawDiagram($('diagram').getContext('2d'), perSide);
  $('results').classList.remove('hidden');
  chrome.storage.local.set({ pm_target: $('target').value, pm_bar: $('bar').value, pm_plates: $('plates').value, pm_unit: unit });
}

function setUnit(u) {
  unit = u;
  $('unitKg').classList.toggle('active', u === 'kg');
  $('unitLb').classList.toggle('active', u === 'lb');
}

document.addEventListener('DOMContentLoaded', async () => {
  const s = await chrome.storage.local.get(['pm_target', 'pm_bar', 'pm_plates', 'pm_unit']);
  if (s.pm_target) $('target').value = s.pm_target;
  if (s.pm_bar) $('bar').value = s.pm_bar;
  if (s.pm_plates) $('plates').value = s.pm_plates;
  setUnit(s.pm_unit || 'kg');
  if (!$('plates').value) $('plates').value = '25, 20, 15, 10, 5, 2.5, 1.25';
  $('calc').addEventListener('click', calculate);
  $('unitKg').addEventListener('click', () => setUnit('kg'));
  $('unitLb').addEventListener('click', () => setUnit('lb'));
});
