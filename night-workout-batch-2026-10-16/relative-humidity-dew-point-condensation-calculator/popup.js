'use strict';
/* ============================================================
 * Dew Point Calculator — Magnus-formula engine (headless-testable)
 * ============================================================ */

// ENGINE-START
// Magnus constants (water, T ≥ 0 °C); valid -40..50 °C roughly.
const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04;

// Convert Fahrenheit to Celsius (pass-through for Celsius).
function toCelsius(t, unit) {
  if (unit === 'F') return (t - 32) * 5 / 9;
  return t;
}

// Validate inputs; returns { ok, err }.
function validateInput(temp, rh) {
  if (!Number.isFinite(temp) || !Number.isFinite(rh)) return { ok: false, err: 'Enter numeric values.' };
  if (rh < 1 || rh > 100) return { ok: false, err: 'Humidity must be 1–100%.' };
  const c = temp; // already converted before calling
  if (c < -40 || c > 60) return { ok: false, err: 'Temperature out of −40…60 °C range.' };
  return { ok: true };
}

// Magnus-formula dew point in °C. Returns null on invalid input.
function dewPointC(tempC, rh) {
  const v = validateInput(tempC, rh);
  if (!v.ok) return null;
  const gamma = Math.log(rh / 100) + (MAGNUS_A * tempC) / (MAGNUS_B + tempC);
  return (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
}

// Format a Celsius value for the active display unit.
function fmtTemp(c, unit) {
  const v = unit === 'F' ? c * 9 / 5 + 32 : c;
  return v.toFixed(1) + (unit === 'F' ? ' °F' : ' °C');
}

// Dew-point spread = air temp − dew point.
function spreadC(tempC, dpC) { return tempC - dpC; }

// Frost-risk label from dew point in °C.
function frostRisk(dpC) {
  if (dpC <= -2) return 'High — surfaces near/below freezing';
  if (dpC <= 1) return 'Possible — watch exposed surfaces';
  return 'Low — above freezing';
}

// Condensation risk note from the spread in °C.
function riskNote(spread) {
  if (spread < 1) return 'Spread under 1 °C: fog/dew very likely if air cools slightly.';
  if (spread < 2.5) return 'Spread under 2.5 °C: condensation likely overnight.';
  if (spread < 5) return 'Moderate spread: condensation possible on cold surfaces.';
  return 'Wide spread: condensation unlikely unless surfaces are very cold.';
}

// Export for headless tests (no-op in the browser).
if (typeof module !== 'undefined') {
  module.exports = { dewPointC, fmtTemp, spreadC, frostRisk, riskNote, toCelsius, validateInput, MAGNUS_A, MAGNUS_B };
}
// ENGINE-END

// ---------- UI wiring (browser only) ----------
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let unit = 'C';

  function render() {
    const tempRaw = parseFloat($('temp').value);
    const rh = parseFloat($('rh').value);
    $('rhVal').textContent = Math.round(rh) + '%';
    if (!Number.isFinite(tempRaw)) { reset('—'); return; }

    const tempC = toCelsius(tempRaw, unit);
    const v = validateInput(tempC, rh);
    if (!v.ok) { reset(v.err); return; }

    const dp = dewPointC(tempC, rh);
    const spread = spreadC(tempC, dp);
    $('dewPoint').textContent = fmtTemp(dp, unit);
    $('spread').textContent = spread.toFixed(1) + (unit === 'F' ? ' °F' : ' °C');
    $('frost').textContent = frostRisk(dp).split(' — ')[0];
    $('riskNote').textContent = riskNote(spread) + ' ' + (dp <= 0 ? 'Dew point at/below freezing: expect frost, not dew.' : 'Dew point above freezing: expect dew, not frost.');
    // Gauge: position marker by RH (0–100%)
    $('gaugeBar').style.left = 'calc(' + Math.min(100, Math.max(0, rh)) + '% - 7px)';
    // Persist
    try { chrome.storage.local.set({ dpTemp: tempRaw, dpRh: rh, dpUnit: unit }); } catch (e) {}
  }

  function reset(msg) {
    $('dewPoint').textContent = '—';
    $('spread').textContent = '—';
    $('frost').textContent = '—';
    $('riskNote').textContent = msg;
  }

  $('temp').addEventListener('input', render);
  $('rh').addEventListener('input', render);
  $('unitSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#unitSeg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); unit = b.dataset.unit; render();
  });

  // Restore last inputs
  try {
    chrome.storage.local.get(['dpTemp', 'dpRh', 'dpUnit'], d => {
      if (d.dpTemp != null) $('temp').value = d.dpTemp;
      if (d.dpRh != null) $('rh').value = d.dpRh;
      if (d.dpUnit) {
        unit = d.dpUnit;
        document.querySelectorAll('#unitSeg button').forEach(x => x.classList.toggle('on', x.dataset.unit === unit));
      }
      render();
    });
  } catch (e) { render(); }
}
