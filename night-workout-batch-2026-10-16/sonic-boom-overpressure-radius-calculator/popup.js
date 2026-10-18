/* Sonic Boom Overpressure Estimator — popup logic.
   Carlson (1978) simplified sonic-boom theory, educational use. */

'use strict';

// ---------------- Pure engine (headless-testable) ----------------
// ENGINE-START
const P0_PSI = 14.6959;          // sea-level pressure
const CUTOFF_MACH = 1.15;        // typical atmosphere: below this the boom may not reach ground
const LUMP_KP = 0.15;            // lumped Kp*KR*KS constant, calibrated so Concorde
                                 // (M2, 50kft, 203ft) yields ~2 psf
const LUMP_KT = 0.12;            // lumped duration constant, calibrated to ~0.4 s Concorde

/** US Standard Atmosphere 1976 pressure, psi. hFt: feet MSL. */
function pressurePsi(hFt) {
  if (hFt <= 36089) {
    return P0_PSI * Math.pow(1 - 6.87535e-6 * hFt, 5.25588);
  }
  return 3.282 * Math.exp(-(hFt - 36089) / 20806);
}

/** Temperature, Kelvin. */
function tempK(hFt) {
  if (hFt <= 36089) return 288.15 - 0.0019812 * hFt;
  return 216.65;
}

/** Speed of sound at altitude, ft/s. */
function speedOfSoundFps(hFt) {
  return 20.05 * Math.sqrt(tempK(hFt)) * 3.28084;
}

/**
 * Estimate sonic-boom ground signature.
 * mach > 1, hFt > 0, lFt > 0.
 * Returns { psf, pa, durationS, halfWidthMi, machAngleDeg, belowCutoff }
 * or { error } on invalid input.
 */
function estimateBoom(mach, hFt, lFt) {
  if (!(mach > 1) || !(hFt > 0) || !(lFt > 0)) return { error: 'invalid' };
  const pv = pressurePsi(hFt);
  const pg = P0_PSI;
  const m2m1 = mach * mach - 1;
  // Bow-shock overpressure (Carlson-style scaling, lumped constant)
  const psf = LUMP_KP * Math.sqrt(pv * pg) * 144 *
    Math.pow(m2m1, 1 / 8) * Math.pow(hFt / lFt, -3 / 4);
  // N-wave signature duration
  const a = speedOfSoundFps(hFt);
  const durationS = LUMP_KT * (3.42 / a) *
    (mach / Math.pow(m2m1, 3 / 8)) *
    Math.pow(hFt, 1 / 4) * Math.pow(lFt, 3 / 4);
  // Mach cone half-angle
  const machAngleDeg = Math.asin(1 / mach) * 180 / Math.PI;
  // Boom carpet half-width (cutoff model)
  let halfWidthMi = 0;
  const belowCutoff = mach <= CUTOFF_MACH;
  if (!belowCutoff) {
    const mc2 = CUTOFF_MACH * CUTOFF_MACH;
    halfWidthMi = (hFt / mach) *
      Math.sqrt((mach * mach - mc2) / (mc2 - 1)) / 5280;
  }
  return { psf, pa: psf * 47.88, durationS, halfWidthMi, machAngleDeg, belowCutoff };
}

function boomVerdict(psf) {
  if (psf < 0.5) return 'Very faint — likely barely noticeable on the ground.';
  if (psf < 1.5) return 'Faint — comparable to distant thunder.';
  if (psf < 3) return 'Typical airliner-level boom — may startle, rattle windows.';
  if (psf < 6) return 'Loud — window rattling likely near the ground track.';
  return 'Very loud — in the range associated with minor-damage claims.';
}
// ENGINE-END

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);

function fmt(n, d) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }

async function restore() {
  try {
    const s = await chrome.storage.local.get('boomInputs');
    if (s.boomInputs) {
      $('mach').value = s.boomInputs.mach ?? 1.4;
      $('alt').value = s.boomInputs.alt ?? 40000;
      $('len').value = s.boomInputs.len ?? 200;
    }
  } catch { /* storage unavailable */ }
}

function calculate() {
  const mach = parseFloat($('mach').value);
  const alt = parseFloat($('alt').value);
  const len = parseFloat($('len').value);
  const r = estimateBoom(mach, alt, len);
  const box = $('results');
  if (r.error) {
    box.classList.remove('hidden');
    $('psf').textContent = '–'; $('pa').textContent = '–';
    $('width').textContent = '–'; $('angle').textContent = '–';
    $('verdict').textContent = 'Enter Mach > 1, positive altitude and length.';
    return;
  }
  box.classList.remove('hidden');
  $('psf').textContent = fmt(r.psf, 2) + ' psf';
  $('pa').textContent = fmt(r.pa, 1) + ' Pa';
  $('angle').textContent = fmt(r.machAngleDeg, 1) + '°';
  if (r.belowCutoff) {
    $('width').textContent = '—';
    $('verdict').textContent = 'Below cutoff Mach: in a typical atmosphere the boom may not reach the ground.';
  } else {
    $('width').textContent = '±' + fmt(r.halfWidthMi, 1) + ' mi';
    $('verdict').textContent =
      `N-wave duration ≈ ${fmt(r.durationS, 2)} s. ` + boomVerdict(r.psf);
  }
  chrome.storage.local.set({ boomInputs: { mach, alt, len } }).catch(() => {});
}

$('calc').addEventListener('click', calculate);
['mach', 'alt', 'len'].forEach((id) =>
  $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); }));
restore();
