'use strict';
/* Habitable Zone Calculator — simplified Kopparapu-style model. Fully local, zero network. */

// ENGINE-START
/* Kopparapu et al. (2013) coefficients: S_eff = S_sun + a*T + b*T^2 + c*T^3 + d*T^4, T = Teff - 5780 */
const HZ_BOUNDS = {
  /* inner edge, conservative: Runaway Greenhouse */
  conInner: { s: 1.0512, a: 1.3242e-4, b: 1.5418e-8, c: -7.9895e-12, d: -1.8328e-15 },
  /* outer edge, conservative: Maximum Greenhouse */
  conOuter: { s: 0.3438, a: 5.8942e-5,  b: 1.6558e-9, c: -3.0045e-12, d: -5.2983e-16 },
  /* inner edge, optimistic: Recent Venus */
  optInner: { s: 1.7753, a: 1.4316e-4, b: 2.9875e-9,  c: -7.5702e-12, d: -1.1635e-15 },
  /* outer edge, optimistic: Early Mars */
  optOuter: { s: 0.3179, a: 5.4513e-5,  b: 1.5313e-9, c: -2.7786e-12, d: -4.8997e-16 }
};

function sEff(coeff, teff) {
  const T = teff - 5780;
  return coeff.s + coeff.a * T + coeff.b * T * T + coeff.c * T * T * T + coeff.d * T * T * T * T;
}

/** Distance (AU) of a given boundary for luminosity L (in L_sun) and Teff (K). */
function boundaryAU(coeff, lum, teff) {
  const s = sEff(coeff, teff);
  if (s <= 0) return NaN;
  return Math.sqrt(lum / s);
}

/** Validate inputs. Returns {ok, error?, lum, teff}. */
function validateStar(lumRaw, teffRaw) {
  const lum = Number(lumRaw), teff = Number(teffRaw);
  if (!isFinite(lum) || lum <= 0) return { ok: false, error: 'Luminosity must be a positive number (L☉).' };
  if (!isFinite(teff) || teff < 2600 || teff > 10000) return { ok: false, error: 'Temperature must be 2600–10000 K.' };
  return { ok: true, lum, teff };
}

/** Compute all four HZ boundaries in AU. */
function habitableZone(lum, teff) {
  return {
    optInner: boundaryAU(HZ_BOUNDS.optInner, lum, teff),
    conInner: boundaryAU(HZ_BOUNDS.conInner, lum, teff),
    conOuter: boundaryAU(HZ_BOUNDS.conOuter, lum, teff),
    optOuter: boundaryAU(HZ_BOUNDS.optOuter, lum, teff)
  };
}

/** Rough spectral class from effective temperature. */
function spectralClass(teff) {
  if (teff >= 30000) return 'O';
  if (teff >= 10000) return 'B';
  if (teff >= 7300) return 'A';
  if (teff >= 5900) return 'F';
  if (teff >= 5300) return 'G';
  if (teff >= 3900) return 'K';
  return 'M';
}

function fmtAU(au) {
  if (!isFinite(au)) return '—';
  return au >= 10 ? au.toFixed(1) + ' AU' : au.toFixed(2) + ' AU';
}
// ENGINE-END

/* ---------- storage + UI ---------- */
const $ = (id) => document.getElementById(id);
const KEY = 'hzCalcInputs';

async function saveInputs(lum, teff) { await chrome.storage.local.set({ [KEY]: { lum, teff } }); }

function renderZone(zone) {
  $('opt').textContent = `${fmtAU(zone.optInner)} – ${fmtAU(zone.optOuter)}`;
  $('con').textContent = `${fmtAU(zone.conInner)} – ${fmtAU(zone.conOuter)}`;
  // Bar: optimistic band with conservative band nested
  const bar = $('hzbar');
  bar.innerHTML = '';
  const max = Math.max(zone.optOuter, 1.5);
  const seg = (lo, hi, cls) => {
    const el = document.createElement('div');
    el.className = 'zseg ' + cls;
    el.style.left = (lo / max * 100) + '%';
    el.style.width = (Math.max(0, (hi - lo)) / max * 100) + '%';
    bar.appendChild(el);
  };
  seg(zone.optInner, zone.optOuter, 'opt');
  seg(zone.conInner, zone.conOuter, 'con');
}

document.addEventListener('DOMContentLoaded', async () => {
  const r = await chrome.storage.local.get(KEY);
  if (r[KEY]) { $('lum').value = r[KEY].lum; $('teff').value = r[KEY].teff; }
  $('calcbtn').addEventListener('click', async () => {
    const err = $('formerr');
    const v = validateStar($('lum').value, $('teff').value);
    if (!v.ok) { err.textContent = v.error; err.hidden = false; $('results').hidden = true; return; }
    err.hidden = true;
    const zone = habitableZone(v.lum, v.teff);
    if (![zone.optInner, zone.conInner, zone.conOuter, zone.optOuter].every(isFinite)) {
      err.textContent = 'Model produced no valid result for these inputs.'; err.hidden = false; return;
    }
    $('spectype').textContent = '(≈ ' + spectralClass(v.teff) + '-type)';
    renderZone(zone);
    $('results').hidden = false;
    saveInputs($('lum').value, $('teff').value);
  });
});
