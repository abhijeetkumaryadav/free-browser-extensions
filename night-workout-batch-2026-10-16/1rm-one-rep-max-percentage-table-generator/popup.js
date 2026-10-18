// 1RM Table — estimation engine + popup logic. Estimates only, not medical advice.
'use strict';

/* ---------- estimation engine (testable) ---------- */
// ENGINE-START
function epley1RM(weight, reps) { return weight * (1 + reps / 30); }
function brzycki1RM(weight, reps) { return weight / (1.0278 - 0.0278 * reps); }
/** Percentage table rows: 100% down to 50% in 5% steps, values rounded to 1dp. */
function pctTable(oneRM) {
  const rows = [];
  for (let p = 100; p >= 50; p -= 5) rows.push({ pct: p, value: Math.round(oneRM * p / 100 * 10) / 10 });
  return rows;
}
// ENGINE-END

const $ = (id) => document.getElementById(id);
let unit = 'kg';
let lastRM = null;

function round1(v) { return Math.round(v * 10) / 10; }

function setUnit(u) {
  unit = u;
  $('unitKg').classList.toggle('active', u === 'kg');
  $('unitLb').classList.toggle('active', u === 'lb');
  chrome.storage.local.set({ rm_unit: u });
  if (lastRM) renderResults();
}

function renderResults() {
  const w = parseFloat($('weight').value);
  const r = parseInt($('reps').value, 10);
  if (!(w > 0) || !(r >= 1)) return;
  const e = epley1RM(w, r), b = brzycki1RM(w, r);
  const avg = round1((e + b) / 2);
  lastRM = { epley: round1(e), brzycki: round1(b), avg };
  $('epley').textContent = `${lastRM.epley} ${unit}`;
  $('brzycki').textContent = `${lastRM.brzycki} ${unit}`;
  $('baseTh').textContent = `avg 1RM ${lastRM.avg}`;
  const tb = $('pctTable').querySelector('tbody');
  tb.innerHTML = '';
  for (const row of pctTable(avg)) {
    const tr = document.createElement('tr');
    if (row.pct === 100) tr.classList.add('hl');
    tr.innerHTML = `<td>${row.pct}%</td><td></td><td>${row.value} ${unit}</td>`;
    tb.appendChild(tr);
  }
  $('results').classList.remove('hidden');
}

async function copyTable() {
  if (!lastRM) return;
  const lines = pctTable(lastRM.avg).map((r) => `${r.pct}%\t${r.value} ${unit}`);
  try {
    await navigator.clipboard.writeText(`1RM ≈ ${lastRM.avg} ${unit}\n` + lines.join('\n'));
    $('copyMsg').textContent = 'Table copied.';
  } catch {
    $('copyMsg').textContent = 'Copy blocked — select the table manually.';
  }
  setTimeout(() => { $('copyMsg').textContent = ''; }, 2000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const saved = await chrome.storage.local.get(['rm_weight', 'rm_reps', 'rm_unit']);
  if (saved.rm_weight) $('weight').value = saved.rm_weight;
  if (saved.rm_reps) $('reps').value = saved.rm_reps;
  if (saved.rm_unit) setUnit(saved.rm_unit); else setUnit('kg');
  $('calc').addEventListener('click', () => {
    chrome.storage.local.set({ rm_weight: $('weight').value, rm_reps: $('reps').value });
    renderResults();
  });
  $('unitKg').addEventListener('click', () => setUnit('kg'));
  $('unitLb').addEventListener('click', () => setUnit('lb'));
  $('copyTable').addEventListener('click', copyTable);
});
