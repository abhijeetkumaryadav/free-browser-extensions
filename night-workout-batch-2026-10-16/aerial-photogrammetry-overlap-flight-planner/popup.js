/* Photogrammetry overlap planner — popup logic + pure engine */

// ENGINE-START //
/**
 * Survey-math engine (idealized flat terrain; estimates only).
 *
 * altM      - altitude above ground level (m)
 * focalMm   - focal length (mm)
 * sensorWMm - sensor width (mm)
 * sensorHMm - sensor height (mm)
 * imgPx     - image width in pixels
 * frontPct  - forward overlap (%)
 * sidePct   - side overlap (%)
 * areaWm    - survey area width (m, flown across = flight lines)
 * areaLm    - survey area length (m, along = photo direction)
 *
 * Returns null on invalid input, else:
 * { gsdCmPx, fpWm, fpHm, frontSpM, sideSpM, lines, photosPerLine, total }
 */
function planMission(altM, focalMm, sensorWMm, sensorHMm, imgPx,
                     frontPct, sidePct, areaWm, areaLm) {
  const nums = [altM, focalMm, sensorWMm, sensorHMm, imgPx, frontPct, sidePct, areaWm, areaLm];
  if (nums.some(n => typeof n !== 'number' || !isFinite(n) || n < 0)) return null;
  if (altM <= 0 || focalMm <= 0 || sensorWMm <= 0 || sensorHMm <= 0) return null;
  if (imgPx <= 0 || areaWm <= 0 || areaLm <= 0) return null;
  if (frontPct >= 100 || sidePct >= 100) return null;

  // Footprint on the ground (similar triangles: ground = alt * sensor / focal)
  const fpWm = altM * sensorWMm / focalMm;
  const fpHm = altM * sensorHMm / focalMm;

  // Ground sample distance: pixel size * alt / focal (cm/px)
  const pxSizeMm = sensorWMm / imgPx;
  const gsdCmPx = (pxSizeMm * altM / focalMm) * 100;

  // Spacing between shots and between flight lines
  const frontSpM = fpHm * (1 - frontPct / 100);
  const sideSpM = fpWm * (1 - sidePct / 100);
  if (frontSpM <= 0 || sideSpM <= 0) return null;

  // +1 each way so the area edge is covered
  const lines = Math.ceil(areaWm / sideSpM) + 1;
  const photosPerLine = Math.ceil(areaLm / frontSpM) + 1;

  return {
    gsdCmPx, fpWm, fpHm, frontSpM, sideSpM,
    lines, photosPerLine, total: lines * photosPerLine
  };
}

function fmtM(m) {
  if (!isFinite(m) || m < 0) return '—';
  return m >= 100 ? `${m.toFixed(0)} m` : `${m.toFixed(1)} m`;
}
// ENGINE-END //

/* ---------- UI wiring ---------- */
const $ = id => document.getElementById(id);
const FIELDS = ['alt', 'foc', 'sw', 'sh', 'px', 'fo', 'so', 'aw', 'al'];

function readInputs() {
  return FIELDS.map(f => parseFloat($(f).value));
}

function render(r) {
  $('results').hidden = false;
  if (!r) {
    ['rGsd', 'rFp', 'rSp', 'rLines', 'rTotal'].forEach(id => $(id).textContent = 'check your inputs');
    return;
  }
  $('rGsd').textContent = `${r.gsdCmPx.toFixed(2)} cm/px`;
  $('rFp').textContent = `${fmtM(r.fpWm)} × ${fmtM(r.fpHm)}`;
  $('rSp').textContent = `${fmtM(r.frontSpM)} apart along track · ${fmtM(r.sideSpM)} between lines`;
  $('rLines').textContent = `${r.lines} lines × ${r.photosPerLine} photos`;
  $('rTotal').textContent = `${r.total} photos`;
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('ppInputs', ({ ppInputs }) => {
    if (ppInputs) FIELDS.forEach(f => { if (ppInputs[f] !== undefined) $(f).value = ppInputs[f]; });
    render(planMission(...readInputs()));
  });
  $('go').addEventListener('click', () => {
    const v = {};
    FIELDS.forEach(f => v[f] = $(f).value);
    chrome.storage.local.set({ ppInputs: v });
    render(planMission(...readInputs()));
  });
});
