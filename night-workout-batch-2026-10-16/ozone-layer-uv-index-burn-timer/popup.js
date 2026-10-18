/* UV Burn Timer — pure engine between ENGINE markers; UI glue outside. */
'use strict';

/* // ENGINE-START */
// Standard-ish burn-time heuristic: at UVI 10, type I burns in ~10 min.
// burnMinutes = round(200 / uvi * skinFactor)
function burnMinutes(uvi, skinFactor) {
  if (!(uvi > 0) || !(skinFactor > 0)) return null;
  return Math.round(200 / uvi * skinFactor);
}

// UV index band table (EPA-style)
function uvBand(uvi) {
  if (!(uvi >= 0)) return null;
  if (uvi < 3)  return { label: 'Low',      color: '#34d399' };
  if (uvi < 6)  return { label: 'Moderate', color: '#fbbf24' };
  if (uvi < 8)  return { label: 'High',     color: '#fb923c' };
  if (uvi < 11) return { label: 'Very high', color: '#f87171' };
  return { label: 'Extreme', color: '#c084fc' };
}

function fmtBurn(mins) {
  if (mins == null) return '—';
  if (mins >= 120) return 'about ' + Math.round(mins / 60 * 10) / 10 + ' hours';
  return 'about ' + mins + ' minutes';
}
/* // ENGINE-END */

const SCALE_ROWS = [
  [0, 2, 'Low'], [3, 5, 'Moderate'], [6, 7, 'High'], [8, 10, 'Very high'], [11, null, 'Extreme']
];

document.addEventListener('DOMContentLoaded', () => {
  const uv = document.getElementById('uv');
  const skin = document.getElementById('skin');
  const result = document.getElementById('result');
  const spfHint = document.getElementById('spfHint');
  const scale = document.getElementById('scale');

  // Restore last inputs
  chrome.storage.local.get(['uvi', 'skinFactor'], (d) => {
    if (d.uvi) uv.value = d.uvi;
    if (d.skinFactor) skin.value = d.skinFactor;
    update();
  });

  SCALE_ROWS.forEach(([lo, hi, label]) => {
    const b = uvBand(lo === 11 ? 11 : lo);
    const row = document.createElement('div');
    row.className = 'band';
    row.innerHTML = `<span class="dot" style="background:${b.color}"></span>
      <span><b>${lo}${hi ? '–' + hi : '+'}</b> · ${label}</span>`;
    scale.appendChild(row);
  });

  function update() {
    const u = parseFloat(uv.value), f = parseFloat(skin.value);
    const mins = burnMinutes(u, f);
    const band = uvBand(u);
    result.textContent = mins == null
      ? 'Enter a UV index ≥ 1.'
      : `Unprotected skin may start to burn in ${fmtBurn(mins)} (UV index ${u} — ${band.label}).`;
    spfHint.textContent = mins == null
      ? ''
      : `With properly applied SPF 30, that stretches toward ${fmtBurn(mins * 30)} — in theory. Reapply anyway.`;
    chrome.storage.local.set({ uvi: u, skinFactor: f });
  }
  uv.addEventListener('input', update);
  skin.addEventListener('change', update);
});
