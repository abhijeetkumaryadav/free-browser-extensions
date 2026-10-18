'use strict';
/* ============================================================
 * Wave Watcher — sea-state engine (headless-testable)
 * ============================================================ */

// ENGINE-START
// Sea-state bands (Douglas-scale inspired, simplified).
const SEA_BANDS = [
  { max: 0.1,  name: 'Calm',        color: '#38bdf8', desc: 'Glassy. Ideal for a paddle.' },
  { max: 0.5,  name: 'Slight',      color: '#34d399', desc: 'Small ripples, easy boating.' },
  { max: 1.25, name: 'Moderate',    color: '#a3e635', desc: 'Waves to waist height; fun for surf.' },
  { max: 2.5,  name: 'Rough',       color: '#fbbf24', desc: 'Waves to ~2.5 m; whitecaps forming.' },
  { max: 4,    name: 'Very rough',  color: '#fb923c', desc: 'Waves to ~4 m; spray, small craft caution.' },
  { max: 6,    name: 'High',        color: '#f87171', desc: 'Waves to ~6 m; dangerous for small craft.' },
  { max: Infinity, name: 'Very high', color: '#e11d48', desc: 'Waves 6 m+; storm conditions.' },
];

// Band for a significant wave height in metres; null on invalid input.
function seaBand(hs) {
  if (!Number.isFinite(hs) || hs < 0) return null;
  for (const b of SEA_BANDS) if (hs <= b.max) return b;
  return SEA_BANDS[SEA_BANDS.length - 1];
}

// Validate an observation; returns { ok, err }.
function validateObs(hs, period, dir) {
  if (!Number.isFinite(hs) || !Number.isFinite(period)) return { ok: false, err: 'Enter height and period.' };
  if (hs < 0 || hs > 20) return { ok: false, err: 'Height must be 0–20 m.' };
  if (period <= 0 || period > 30) return { ok: false, err: 'Period must be 1–30 s.' };
  if (dir !== '' && dir != null && (!Number.isFinite(+dir) || +dir < 0 || +dir > 360)) return { ok: false, err: 'Direction must be 0–360°.' };
  return { ok: true };
}

// Build an observation entry.
function makeObs(hs, period, dir, note) {
  const v = validateObs(hs, period, dir);
  if (!v.ok) return null;
  return { id: Date.now(), hs, period, dir: dir === '' || dir == null ? null : +dir, note: (note || '').trim(), ts: new Date().toISOString() };
}

// Newest-first sort (immutable).
function sortObs(list) { return [...list].sort((a, b) => b.ts.localeCompare(a.ts)); }

// Max significant height across a list (null when empty).
function maxHeight(list) {
  if (!list.length) return null;
  return Math.max(...list.map(o => o.hs));
}

// Short compass point from degrees; null when dir is null.
function compassPoint(deg) {
  if (deg == null) return null;
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return pts[Math.round(deg / 22.5) % 16];
}

if (typeof module !== 'undefined') {
  module.exports = { seaBand, validateObs, makeObs, sortObs, maxHeight, compassPoint, SEA_BANDS };
}
// ENGINE-END

// ---------- UI wiring (browser only) ----------
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);

  // Guide bands
  $('bands').innerHTML = SEA_BANDS.map(b =>
    `<div class="band"><span class="dot" style="background:${b.color}"></span><b>${b.name}</b><span>${b.desc}</span></div>`
  ).join('');

  // Tabs
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    $('tab-guide').hidden = t.dataset.tab !== 'guide';
    $('tab-log').hidden = t.dataset.tab !== 'log';
  }));

  let obs = [];

  function esc(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function render() {
    const sorted = sortObs(obs);
    $('statCount').textContent = obs.length + ' logged';
    const mh = maxHeight(obs);
    $('statMax').textContent = mh == null ? 'max —' : 'max ' + mh.toFixed(1) + ' m';
    $('list').innerHTML = sorted.length ? sorted.map(o => {
      const band = seaBand(o.hs);
      const cp = compassPoint(o.dir);
      return `<div class="entry">
        <div class="meta"><time>${new Date(o.ts).toLocaleString()}</time><button class="del" data-id="${o.id}" title="Delete">✕</button></div>
        <div class="vals">${o.hs.toFixed(1)} m · ${o.period.toFixed(1)} s${o.dir != null ? ' · ' + o.dir + '° ' + cp : ''}</div>
        <div class="note" style="color:${band.color}">${esc(band.name)}</div>
        ${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}
      </div>`;
    }).join('') : '<div class="empty">No observations yet — log the sea as you see it.</div>';
  }

  $('addBtn').addEventListener('click', () => {
    const entry = makeObs(parseFloat($('fHeight').value), parseFloat($('fPeriod').value), $('fDir').value, $('fNote').value);
    if (!entry) {
      const v = validateObs(parseFloat($('fHeight').value), parseFloat($('fPeriod').value), $('fDir').value);
      alert(v.err); return;
    }
    obs.push(entry);
    $('fHeight').value = $('fPeriod').value = $('fDir').value = $('fNote').value = '';
    try { chrome.storage.local.set({ waveObs: obs }); } catch (e) {}
    render();
  });

  $('list').addEventListener('click', e => {
    const b = e.target.closest('.del'); if (!b) return;
    obs = obs.filter(o => String(o.id) !== b.dataset.id);
    try { chrome.storage.local.set({ waveObs: obs }); } catch (e) {}
    render();
  });

  try {
    chrome.storage.local.get(['waveObs'], d => { obs = d.waveObs || []; render(); });
  } catch (e) { render(); }
}
