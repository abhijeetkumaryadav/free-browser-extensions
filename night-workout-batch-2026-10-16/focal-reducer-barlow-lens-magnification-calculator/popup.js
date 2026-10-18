"use strict";
/* Barlow & Focal Reducer Calculator — popup logic + optics engine.
   Fully local: chrome.storage.local only. Zero network. */

// ============ ENGINE-START ============
// Pure optics math — no DOM, no chrome.*. Headless-testable.
const APPARENT_FIELD_DEFAULT = 50; // degrees, assumed for true-field estimate

/** Preset accessory factors. */
const ACC_FACTORS = { none: 1, barlow2: 2, barlow3: 3, barlow5: 5, red063: 0.63, red05: 0.5, red08: 0.8 };

/** Validate inputs. Returns {ok, errors[]}. */
function validateOptics(focalMm, epMm, factor) {
  const errors = [];
  if (!(focalMm > 0)) errors.push("Telescope focal length must be > 0 mm.");
  if (!(epMm > 0)) errors.push("Eyepiece focal length must be > 0 mm.");
  if (!(factor >= 0.1 && factor <= 10)) errors.push("Accessory factor must be 0.1–10×.");
  return { ok: errors.length === 0, errors };
}

/**
 * Compute results.
 * focalMm: telescope focal length; apertureMm: optional (>0 or 0);
 * epMm: eyepiece focal; factor: accessory multiplier.
 * Returns { effFocal, mag, fRatio|null, exitPupil|null, trueField }
 */
function computeOptics(focalMm, apertureMm, epMm, factor) {
  const effFocal = focalMm * factor;
  const mag = effFocal / epMm;
  const fRatio = apertureMm > 0 ? effFocal / apertureMm : null;
  const exitPupil = apertureMm > 0 ? epMm / (effFocal / apertureMm) : null; // ep / f_ratio_eff
  const trueField = APPARENT_FIELD_DEFAULT / mag;
  return { effFocal, mag, fRatio, exitPupil, trueField };
}

/** Format helpers. */
function fmtMm(v) { return v >= 1000 ? (v / 1000).toFixed(2) + " m" : v.toFixed(1) + " mm"; }
function fmtX(v) { return v.toFixed(0) + "×"; }
function fmtF(v) { return "f/" + v.toFixed(1); }
function fmtDeg2(v) { return v.toFixed(2) + "°"; }
// ============ ENGINE-END ============

/* ---------- UI wiring ---------- */
const $ = (id) => document.getElementById(id);

function loadForm() {
  chrome.storage.local.get({ brcForm: {} }, (r) => {
    const f = r.brcForm || {};
    if (f.focal) $("focal").value = f.focal;
    if (f.aperture) $("aperture").value = f.aperture;
    if (f.ep) $("ep").value = f.ep;
    if (f.acc) $("acc").value = f.acc;
    if (f.custom) $("customFactor").value = f.custom;
  });
}

function saveForm() {
  chrome.storage.local.set({
    brcForm: { focal: $("focal").value, aperture: $("aperture").value, ep: $("ep").value, acc: $("acc").value, custom: $("customFactor").value }
  });
}

function resolveFactor() {
  const v = $("acc").value;
  if (v === "custom") {
    const c = parseFloat($("customFactor").value);
    return isNaN(c) ? NaN : c;
  }
  return ACC_FACTORS[v];
}

$("calc").addEventListener("click", () => {
  const focal = parseFloat($("focal").value);
  const aperture = parseFloat($("aperture").value) || 0;
  const ep = parseFloat($("ep").value);
  const factor = resolveFactor();
  const v = validateOptics(focal, ep, factor);
  if (!v.ok) { alert(v.errors.join("\n")); return; }
  const r = computeOptics(focal, aperture, ep, factor);
  $("mag").textContent = fmtX(r.mag);
  $("rFocal").textContent = fmtMm(r.effFocal);
  $("rF").textContent = r.fRatio !== null ? fmtF(r.fRatio) : "— (no aperture)";
  $("rPupil").textContent = r.exitPupil !== null ? r.exitPupil.toFixed(2) + " mm" : "— (no aperture)";
  $("rTfov").textContent = fmtDeg2(r.trueField);
  $("result").classList.remove("hidden");
  saveForm();
});

document.addEventListener("input", saveForm);
document.addEventListener("change", saveForm);
loadForm();
