/* Battery drain / safety-return estimator — popup logic + pure engine */

// ENGINE-START //
/**
 * Simplified drone battery model (estimates only).
 * capacityMah  - battery capacity in mAh
 * hoverA       - average current draw in hover (A)
 * windMs       - headwind component outbound (m/s)
 * cruiseMs     - airspeed in calm air (m/s)
 * distM        - one-way distance (m)
 * reservePct   - reserve margin kept after the round trip (% of capacity)
 *
 * Returns an object with endurance, leg times, energy use and a verdict,
 * or null when inputs are invalid.
 */
function estimateBattery(capacityMah, hoverA, windMs, cruiseMs, distM, reservePct) {
  const nums = [capacityMah, hoverA, windMs, cruiseMs, distM, reservePct];
  if (nums.some(n => typeof n !== 'number' || !isFinite(n) || n < 0)) return null;
  if (capacityMah <= 0 || hoverA <= 0 || cruiseMs <= 0 || distM <= 0) return null;
  if (reservePct > 60) return null;

  // Hover endurance in still air (minutes)
  const hoverMin = (capacityMah / 1000 / hoverA) * 60;

  // Heuristic: headwind raises current draw quadratically with the
  // wind-to-cruise ratio. Tailwind on the return leg helps slightly.
  const ratio = Math.min(windMs / cruiseMs, 1.5);
  const outFactor = 1 + 0.6 * ratio * ratio;
  const backFactor = Math.max(1 - 0.3 * ratio, 0.7);

  // Ground speeds; if wind beats cruise, the outbound leg is impossible.
  const gOut = cruiseMs - windMs;
  if (gOut <= 0.5) {
    return { hoverMin, impossible: true, verdict: 'UNSAFE', reason: 'wind' };
  }
  const gBack = cruiseMs + windMs;

  const tOutMin = (distM / gOut) / 60;
  const tBackMin = (distM / gBack) / 60;

  // Energy used in Ah (current * hours per leg)
  const usedAh = (hoverA * outFactor * tOutMin + hoverA * backFactor * tBackMin) / 60;
  const capAh = capacityMah / 1000;
  const usedPct = (usedAh / capAh) * 100;
  const remPct = 100 - usedPct;
  const marginPct = remPct - reservePct;

  let verdict;
  if (marginPct >= 10) verdict = 'SAFE';
  else if (marginPct >= 0) verdict = 'MARGINAL';
  else verdict = 'UNSAFE';

  return {
    hoverMin, impossible: false,
    tOutMin, tBackMin,
    usedPct, remPct, marginPct,
    verdict
  };
}

function fmtMin(min) {
  if (!isFinite(min) || min < 0) return '—';
  const m = Math.floor(min), s = Math.round((min - m) * 60);
  return s === 60 ? `${m + 1}m 00s` : `${m}m ${String(s).padStart(2, '0')}s`;
}
// ENGINE-END //

/* ---------- UI wiring ---------- */
const $ = id => document.getElementById(id);
const FIELDS = ['cap', 'cur', 'wind', 'spd', 'dist', 'resv'];

function readInputs() {
  return [
    parseFloat($('cap').value),
    parseFloat($('cur').value),
    parseFloat($('wind').value),
    parseFloat($('spd').value),
    parseFloat($('dist').value),
    parseFloat($('resv').value)
  ];
}

function save() {
  const v = {};
  FIELDS.forEach(f => v[f] = $(f).value);
  chrome.storage.local.set({ bdInputs: v });
}

function render(r) {
  $('results').hidden = false;
  const setV = (id, cls) => {
    const el = $(id);
    el.classList.remove('ok', 'warn', 'bad');
    if (cls) el.classList.add(cls);
  };

  if (!r) {
    $('rHover').textContent = 'check your inputs';
    $('rLegs').textContent = '—'; $('rUse').textContent = '—';
    $('rRem').textContent = '—'; $('rVerdict').textContent = '—';
    return;
  }
  $('rHover').textContent = fmtMin(r.hoverMin);

  if (r.impossible) {
    $('rLegs').textContent = 'headwind beats cruise speed — outbound leg impossible';
    $('rUse').textContent = '—'; $('rRem').textContent = '—';
    $('rVerdict').textContent = 'UNSAFE — do not fly';
    setV('rVerdict', 'bad');
    return;
  }
  $('rLegs').textContent = `out ${fmtMin(r.tOutMin)} · back ${fmtMin(r.tBackMin)}`;
  $('rUse').textContent = `${r.usedPct.toFixed(1)}% of pack`;
  $('rRem').textContent = `${r.remPct.toFixed(1)}% left (reserve ${$('resv').value || 0}%)`;
  $('rVerdict').textContent =
    r.verdict === 'SAFE' ? `SAFE — ${r.marginPct.toFixed(1)}% above reserve` :
    r.verdict === 'MARGINAL' ? `MARGINAL — only ${r.marginPct.toFixed(1)}% above reserve` :
    `UNSAFE — ${Math.abs(r.marginPct).toFixed(1)}% below reserve`;
  setV('rVerdict', r.verdict === 'SAFE' ? 'ok' : r.verdict === 'MARGINAL' ? 'warn' : 'bad');
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('bdInputs', ({ bdInputs }) => {
    if (bdInputs) FIELDS.forEach(f => { if (bdInputs[f] !== undefined) $(f).value = bdInputs[f]; });
    render(estimateBattery(...readInputs()));
  });
  $('go').addEventListener('click', () => { save(); render(estimateBattery(...readInputs())); });
});
