/* Freight Cost Estimator — 100% on-device rate estimation.
   Rate models are simplified approximations for budgeting; not live carrier quotes. */

'use strict';

// ---------------------------------------------------------------- constants

/** Dimensional-weight divisor used by US domestic carriers (cubic inches per lb). */
const DIM_DIVISOR = 139;

/** Oversize trigger: length + 2*(width + height) in inches. */
const OVERSIZE_GIRTH_IN = 130;

/** Built-in rate models: per-carrier, per-speed. base = $ per zone step, perLb = $/lb.
    Values are approximations, tuned to typical 2026 domestic parcel pricing. */
const CARRIERS = [
  { name: 'UPS',       speeds: { economy: { base: 4.60, perLb: 0.95 }, ground: { base: 6.40, perLb: 1.12 }, express: { base: 18.90, perLb: 2.45 } } },
  { name: 'FedEx',     speeds: { economy: { base: 4.35, perLb: 0.92 }, ground: { base: 6.10, perLb: 1.08 }, express: { base: 18.20, perLb: 2.38 } } },
  { name: 'USPS',      speeds: { economy: { base: 3.90, perLb: 0.78 }, ground: { base: 5.30, perLb: 0.94 }, express: { base: 21.50, perLb: 2.10 } } },
];

/** Fuel surcharge applied to the base line-haul rate. */
const FUEL_SURCHARGE_RATE = 0.145;

/** Flat fees (USD). */
const FEES = { residential: 5.10, signature: 6.85, oversize: 32.50 };

/** Zone heuristic thresholds on |zipA - zipB| (US ZIPs increase roughly westward). */
const ZONE_BANDS = [
  [150, 2], [450, 3], [1100, 4], [2100, 5], [3200, 6], [4300, 7], [Infinity, 8],
];

const HISTORY_KEY = 'estimateHistory';
const INPUTS_KEY = 'lastInputs';
const HISTORY_LIMIT = 10;

// ---------------------------------------------------------------- helpers

/** @returns {number|null} validated 5-digit ZIP or null. */
function parseZip(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{5}$/.test(digits) ? Number(digits) : null;
}

/** Estimate shipping zone (2–8) from ZIP separation. */
function estimateZone(zipA, zipB) {
  const diff = Math.abs(zipA - zipB);
  for (const [maxDiff, zone] of ZONE_BANDS) {
    if (diff <= maxDiff) return zone;
  }
  return 8;
}

/** Dimensional weight in lbs, rounded up to 0.1. */
function dimWeight(l, w, h) {
  return Math.ceil(((l * w * h) / DIM_DIVISOR) * 10) / 10;
}

function girth(l, w, h) {
  return l + 2 * (w + h);
}

function money(n) {
  return '$' + n.toFixed(2);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- core estimate

/**
 * Build one carrier's full estimate.
 * @returns {{name, base, fuel, extras, total, lines}}
 */
function estimateCarrier(carrier, speed, zone, billable, opts) {
  const model = carrier.speeds[speed];
  const base = model.base * (1 + (zone - 2) * 0.22) + model.perLb * billable;
  const fuel = base * FUEL_SURCHARGE_RATE;
  const lines = [
    ['Line-haul', base],
    ['Fuel surcharge', fuel],
  ];
  let extras = 0;
  if (opts.residential) { extras += FEES.residential; lines.push(['Residential', FEES.residential]); }
  if (opts.signature) { extras += FEES.signature; lines.push(['Signature', FEES.signature]); }
  if (opts.oversize) { extras += FEES.oversize; lines.push(['Oversize handling', FEES.oversize]); }
  const total = base + fuel + extras;
  lines.push(['Total', total]);
  return { name: carrier.name, total, lines };
}

/** Run the full comparison. Returns null on invalid input (with error message). */
function computeEstimate(raw) {
  const from = parseZip(raw.fromZip);
  const to = parseZip(raw.toZip);
  const weight = Number(raw.weight);
  const l = Number(raw.len), w = Number(raw.wid), h = Number(raw.hgt);

  if (from === null || to === null) return { error: 'Enter valid 5-digit ZIP codes.' };
  if (!(weight > 0) || weight > 150) return { error: 'Weight must be between 0.1 and 150 lbs.' };
  if (![l, w, h].every((d) => d > 0 && d <= 108)) return { error: 'Dimensions must be 0–108 in.' };

  const zone = estimateZone(from, to);
  const dim = dimWeight(l, w, h);
  const billable = Math.max(weight, dim);
  const opts = {
    residential: Boolean(raw.residential),
    signature: Boolean(raw.signature),
    oversize: girth(l, w, h) > OVERSIZE_GIRTH_IN || weight > 70,
  };

  const carriers = CARRIERS.map((c) => estimateCarrier(c, raw.speed, zone, billable, opts))
    .sort((a, b) => a.total - b.total);

  return { zone, dim, billable, actual: weight, carriers, opts, speed: raw.speed,
           route: `${raw.fromZip} → ${raw.toZip}` };
}

// ---------------------------------------------------------------- rendering

const $ = (id) => document.getElementById(id);

function showError(msg) {
  const el = $('err');
  el.textContent = msg;
  el.hidden = !msg;
}

function renderResults(r) {
  $('resultsCard').hidden = false;
  $('zoneTag').textContent = `Zone ${r.zone} · billable ${r.billable.toFixed(1)} lb`;
  $('results').innerHTML = r.carriers.map((c, i) => `
    <div class="res-row">
      <div class="name"><b>${esc(c.name)} ${esc(speedLabel(r.speed))}</b>
        <span>${c.lines.length - 2} surcharge${c.lines.length - 2 === 1 ? '' : 's'} applied</span></div>
      ${i === 0 ? '<span class="best">Best</span>' : ''}
      <div class="price">${money(c.total)}</div>
    </div>`).join('');

  const cheapest = r.carriers[0];
  $('breakdownBody').innerHTML = `
    <table>
      <tr><td>Route</td><td>${esc(r.route)} (zone ${r.zone})</td></tr>
      <tr><td>Actual weight</td><td>${r.actual.toFixed(1)} lb</td></tr>
      <tr><td>Dimensional weight</td><td>${r.dim.toFixed(1)} lb</td></tr>
      <tr><td>Billable weight</td><td>${r.billable.toFixed(1)} lb</td></tr>
      ${cheapest.lines.map(([k, v]) => `<tr><td>${esc(k)} (${esc(cheapest.name)})</td><td>${money(v)}</td></tr>`).join('')}
    </table>`;
}

function speedLabel(speed) {
  return { economy: 'Economy', ground: 'Ground', express: 'Express' }[speed] || speed;
}

async function loadHistory() {
  const { [HISTORY_KEY]: hist = [] } = await chrome.storage.local.get(HISTORY_KEY);
  renderHistory(hist);
  return hist;
}

function renderHistory(hist) {
  const box = $('history');
  if (!hist.length) {
    box.innerHTML = '<p class="empty">No estimates yet.</p>';
    return;
  }
  box.innerHTML = hist.map((e) => `
    <div class="hist-row">
      <div class="t"><b>${esc(e.route)} · ${esc(speedLabel(e.speed))}</b>
        <span>${esc(e.carrier)} · billable ${Number(e.billable).toFixed(1)} lb · ${esc(e.when)}</span></div>
      <div class="p">${money(Number(e.total))}</div>
    </div>`).join('');
}

async function saveToHistory(r) {
  const hist = await loadHistory();
  hist.unshift({
    route: r.route, speed: r.speed, billable: r.billable,
    carrier: r.carriers[0].name, total: r.carriers[0].total,
    when: new Date().toLocaleString(),
  });
  await chrome.storage.local.set({ [HISTORY_KEY]: hist.slice(0, HISTORY_LIMIT) });
  renderHistory(hist.slice(0, HISTORY_LIMIT));
}

async function rememberInputs(raw) {
  await chrome.storage.local.set({ [INPUTS_KEY]: raw });
}

async function restoreInputs() {
  const { [INPUTS_KEY]: saved } = await chrome.storage.local.get(INPUTS_KEY);
  if (!saved) return;
  for (const key of ['fromZip', 'toZip', 'weight', 'len', 'wid', 'hgt']) {
    if (saved[key] !== undefined) $(key).value = saved[key];
  }
  for (const key of ['residential', 'signature']) {
    $(key).checked = Boolean(saved[key]);
  }
  if (saved.speed) setSpeed(saved.speed);
}

// ---------------------------------------------------------------- events

function currentSpeed() {
  return document.querySelector('.seg-btn.active').dataset.speed;
}

function setSpeed(speed) {
  document.querySelectorAll('.seg-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.speed === speed));
}

function readInputs() {
  return {
    fromZip: $('fromZip').value.trim(),
    toZip: $('toZip').value.trim(),
    weight: $('weight').value,
    len: $('len').value, wid: $('wid').value, hgt: $('hgt').value,
    speed: currentSpeed(),
    residential: $('residential').checked,
    signature: $('signature').checked,
  };
}

function init() {
  document.querySelectorAll('.seg-btn').forEach((b) =>
    b.addEventListener('click', () => setSpeed(b.dataset.speed)));

  $('calc').addEventListener('click', async () => {
    const raw = readInputs();
    const result = computeEstimate(raw);
    if (result.error) { showError(result.error); return; }
    showError('');
    renderResults(result);
    await saveToHistory(result);
    await rememberInputs(raw);
  });

  $('clearHist').addEventListener('click', async () => {
    await chrome.storage.local.set({ [HISTORY_KEY]: [] });
    renderHistory([]);
  });

  restoreInputs();
  loadHistory();
}

document.addEventListener('DOMContentLoaded', init);
