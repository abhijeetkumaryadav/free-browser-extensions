// FOV Matrix — engine: field-of-view and magnification from textbook optics.
// Honest scope: idealized formulas (FOV = 2·arctan(d / 2f)); ignores distortion/vignetting.

/* ---------- pure engine (headless-testable) ---------- */
// ENGINE-START

/** Angular field of view in degrees for sensor dimension d (mm) and focal length f (mm). */
function fovDeg(d, f) {
  if (!(d > 0) || !(f > 0)) return null;
  return 2 * Math.atan(d / (2 * f)) * 180 / Math.PI;
}

/** Diagonal sensor dimension from width/height. */
function diag(w, h) {
  if (!(w > 0) || !(h > 0)) return null;
  return Math.hypot(w, h);
}

/** Full FOV bundle: horizontal, vertical, diagonal degrees. Null if invalid. */
function fovBundle(sw, sh, fl) {
  const h = fovDeg(sw, fl), v = fovDeg(sh, fl), d = fovDeg(diag(sw, sh), fl);
  if (h == null || v == null || d == null) return null;
  return { horizontal: h, vertical: v, diagonal: d };
}

/** Magnification with an eyepiece: telescope focal / eyepiece focal. */
function magnification(telescopeF, eyepieceF) {
  if (!(telescopeF > 0) || !(eyepieceF > 0)) return null;
  return telescopeF / eyepieceF;
}

/** Focal ratio f/D. */
function fRatio(focal, aperture) {
  if (!(focal > 0) || !(aperture > 0)) return null;
  return focal / aperture;
}

/** Format degrees with 2 decimals + ° symbol. */
function fmtDeg(x) {
  return x == null ? '—' : x.toFixed(2) + '°';
}
// ENGINE-END

/* ---------- popup wiring ---------- */
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'fovSetups';

document.addEventListener('DOMContentLoaded', async () => {
  const recalc = () => {
    const sw = +$('sw').value, sh = +$('sh').value, fl = +$('fl').value;
    const ep = +$('ep').value || null, ap = +$('ap').value || null;
    const f = fovBundle(sw, sh, fl);
    let html;
    if (!f) {
      html = '<span>Enter valid sensor dimensions and focal length.</span>';
    } else {
      html = `<div>FOV horizontal <b>${fmtDeg(f.horizontal)}</b> · vertical <b>${fmtDeg(f.vertical)}</b> · diagonal <b>${fmtDeg(f.diagonal)}</b></div>`;
      const m = ep ? magnification(fl, ep) : null;
      if (m != null) html += `<div>With ${ep} mm eyepiece: <b>${m.toFixed(0)}×</b> magnification</div>`;
      const r = ap ? fRatio(fl, ap) : null;
      if (r != null) html += `<div>Focal ratio: <b>f/${r.toFixed(1)}</b></div>`;
    }
    $('results').innerHTML = html;
  };
  ['fl', 'ap', 'sw', 'sh', 'ep'].forEach((id) => $(id).addEventListener('input', recalc));
  recalc();

  $('save').addEventListener('click', async () => {
    const setup = {
      name: $('name').value.trim() || 'Untitled setup',
      fl: +$('fl').value, ap: +$('ap').value || null,
      sw: +$('sw').value, sh: +$('sh').value, ep: +$('ep').value || null,
    };
    if (!fovBundle(setup.sw, setup.sh, setup.fl)) return;
    const { [STORAGE_KEY]: setups = [] } = await chrome.storage.local.get(STORAGE_KEY);
    setups.unshift(setup);
    await chrome.storage.local.set({ [STORAGE_KEY]: setups.slice(0, 50) });
    $('name').value = '';
    render(setups.slice(0, 50));
  });

  $('clear').addEventListener('click', async () => {
    if (!confirm('Delete all saved setups?')) return;
    await chrome.storage.local.remove(STORAGE_KEY);
    render([]);
  });

  $('matrix').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    const { [STORAGE_KEY]: setups = [] } = await chrome.storage.local.get(STORAGE_KEY);
    setups.splice(+btn.dataset.i, 1);
    await chrome.storage.local.set({ [STORAGE_KEY]: setups });
    render(setups);
  });

  const { [STORAGE_KEY]: setups = [] } = await chrome.storage.local.get(STORAGE_KEY);
  render(setups);
});

function render(setups) {
  if (!setups.length) {
    $('matrix').innerHTML = '<div class="empty">No setups saved. Enter values above and save to compare.</div>';
    return;
  }
  $('matrix').innerHTML = setups.map((s, i) => {
    const f = fovBundle(s.sw, s.sh, s.fl);
    const m = s.ep ? magnification(s.fl, s.ep) : null;
    return `<div class="mrow"><div class="nm"><span>${escapeHtml(s.name)}</span>` +
      `<button class="del" data-i="${i}" title="Delete">×</button></div>` +
      `<div class="dt">f=${s.fl}mm · sensor ${s.sw}×${s.sh}mm → ` +
      `H ${fmtDeg(f.horizontal)} / V ${fmtDeg(f.vertical)} / D ${fmtDeg(f.diagonal)}` +
      (m != null ? ` · ${m.toFixed(0)}× w/ ${s.ep}mm` : '') + `</div></div>`;
  }).join('');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
