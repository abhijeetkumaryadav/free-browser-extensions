/* Micro Walk Converter — popup logic.
   Pure conversion engine lives between ENGINE-START/ENGINE-END so it can be
   unit-tested headlessly; the DOM wiring below it is browser-only. */

// ENGINE-START
const KM_PER_MI = 1.609344;

/** Convert a distance value in `unit` to {km, mi}. Returns null for bad input. */
function convertDistance(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return null;
  const km = unit === 'mi' ? v * KM_PER_MI : v;
  return { km, mi: km / KM_PER_MI };
}

/** Estimate kilometres covered by `steps` at `strideCm` centimetres per step. */
function stepsToKm(steps, strideCm) {
  const s = Number(steps), stride = Number(strideCm);
  if (!Number.isFinite(s) || !Number.isFinite(stride) || s < 0 || stride <= 0) return null;
  return (s * stride) / 100000;
}

/** Estimate steps for `km` kilometres at `strideCm` centimetres per step. */
function kmToSteps(km, strideCm) {
  const k = Number(km), stride = Number(strideCm);
  if (!Number.isFinite(k) || !Number.isFinite(stride) || k < 0 || stride <= 0) return null;
  return Math.round((k * 100000) / stride);
}

/** Estimate walking minutes for `km` at `paceKmh` km/h. */
function walkingMinutes(km, paceKmh) {
  const k = Number(km), pace = Number(paceKmh);
  if (!Number.isFinite(k) || !Number.isFinite(pace) || k < 0 || pace <= 0) return null;
  return (k / pace) * 60;
}

/** Format minutes as "1h 23m" / "45m" / "<1m". */
function fmtMinutes(min) {
  if (min == null || !Number.isFinite(min) || min < 0) return '–';
  if (min < 1) return '<1m';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Format a number to a sensible precision for display. */
function fmtNum(n, decimals = 2) {
  if (n == null || !Number.isFinite(n)) return '–';
  return Number(n.toFixed(decimals)).toLocaleString('en-US');
}
// ENGINE-END

// ---- DOM wiring (browser only) ----
(function () {
  if (typeof document === 'undefined') return; // headless: skip wiring

  const $ = (id) => document.getElementById(id);
  const distInput = $('distInput'), distUnit = $('distUnit');
  const stepsInput = $('stepsInput'), stepsKmInput = $('stepsKmInput'), strideInput = $('strideInput');
  const timeDistInput = $('timeDistInput'), paceInput = $('paceInput');

  function renderDistance() {
    const r = convertDistance(distInput.value, distUnit.value);
    $('outKm').textContent = r ? fmtNum(r.km) + ' km' : '–';
    $('outMi').textContent = r ? fmtNum(r.mi) + ' mi' : '–';
  }
  function renderStepsFromSteps() {
    const km = stepsToKm(stepsInput.value, strideInput.value);
    stepsKmInput.value = km == null ? '' : fmtNum(km, 3);
    saveSettings();
  }
  function renderStepsFromKm() {
    const steps = kmToSteps(stepsKmInput.value, strideInput.value);
    stepsInput.value = steps == null ? '' : steps.toLocaleString('en-US');
    saveSettings();
  }
  function renderTime() {
    // timeDistInput reuses the top distance field's unit semantics: it is km.
    const min = walkingMinutes(timeDistInput.value, paceInput.value);
    $('outTime').textContent = fmtMinutes(min);
    saveSettings();
  }

  let saveTimer = null;
  function saveSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.local.set({
        strideCm: strideInput.value || '75',
        paceKmh: paceInput.value || '5',
      });
    }, 300);
  }

  distInput.addEventListener('input', renderDistance);
  distUnit.addEventListener('change', renderDistance);
  stepsInput.addEventListener('input', renderStepsFromSteps);
  stepsKmInput.addEventListener('input', renderStepsFromKm);
  strideInput.addEventListener('input', () => { renderStepsFromSteps(); });
  timeDistInput.addEventListener('input', renderTime);
  paceInput.addEventListener('input', renderTime);

  // Restore persisted settings, then render.
  chrome.storage.local.get({ strideCm: '75', paceKmh: '5' }, (s) => {
    strideInput.value = s.strideCm;
    paceInput.value = s.paceKmh;
    renderDistance();
    renderTime();
  });
})();
