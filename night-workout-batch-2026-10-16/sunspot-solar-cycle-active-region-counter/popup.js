/* Sunspot Counter — popup logic.
 * Educational guide + personal observation log.
 * Wolf number R = 10g + s. All data local; no live solar feed. */

// ENGINE-START //

/** Wolf sunspot number from group count g and spot count s. */
function wolfNumber(g, s) {
  if (!Number.isInteger(g) || !Number.isInteger(s) || g < 0 || s < 0) return null;
  if (g > 50 || s > 300) return null;
  return 10 * g + s;
}

/** Make an observation record; returns null on bad input. */
function makeObs(dateStr, g, s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
  const R = wolfNumber(g, s);
  if (R === null) return null;
  return { date: dateStr, g, s, R, id: Date.now() + '-' + Math.random().toString(36).slice(2, 8) };
}

/** Sort observations newest-first (returns a copy). */
function sortObs(list) {
  return [...list].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
}

/** Average Wolf number across observations (0 if none). */
function avgR(list) {
  if (!list.length) return 0;
  return list.reduce((t, o) => t + o.R, 0) / list.length;
}

/** Max Wolf number across observations (0 if none). */
function maxR(list) {
  return list.length ? Math.max(...list.map((o) => o.R)) : 0;
}

/** Day key for today in local timezone, YYYY-MM-DD. */
function todayKey() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// ENGINE-END //

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'sunspotCounter.v1';

let obs = [];

function preview() {
  const g = parseInt($('obsGroups').value, 10), s = parseInt($('obsSpots').value, 10);
  const R = wolfNumber(g, s);
  $('preview').innerHTML = R === null
    ? 'Enter whole numbers: groups 0–50, spots 0–300.'
    : `Wolf number <b>R = ${R}</b> (10×${g} + ${s})`;
}

function drawChart() {
  const c = $('chart'), ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  if (!obs.length) return;
  const data = sortObs(obs).slice(0, 30).reverse();
  const max = Math.max(...data.map((o) => o.R), 1);
  const bw = W / data.length;
  data.forEach((o, i) => {
    const h = (o.R / max) * (H - 18);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(i * bw + 2, H - 10 - h, bw - 4, h);
  });
  ctx.fillStyle = '#a8a8b3'; ctx.font = '10px system-ui';
  ctx.fillText('R max ' + maxR(data), 6, 12);
}

function renderHist() {
  const el = $('hist');
  if (!obs.length) { el.innerHTML = '<div class="empty">No observations yet — log your first count above.</div>'; return; }
  el.innerHTML = sortObs(obs).map((o) =>
    `<div class="row"><span><span class="r">R ${o.R}</span> · ${o.g}g / ${o.s}s</span>
     <span class="d">${o.date}</span>
     <button data-del="${o.id}" title="Delete" type="button">✕</button></div>`).join('');
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      obs = obs.filter((o) => o.id !== b.dataset.del);
      save(); drawChart(); renderHist();
    }));
}

function save() {
  chrome.storage.local.set({ [STORE_KEY]: obs });
}

document.addEventListener('DOMContentLoaded', async () => {
  $('obsDate').value = todayKey();
  obs = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || [];
  preview(); drawChart(); renderHist();
  ['obsGroups', 'obsSpots'].forEach((id) => $(id).addEventListener('input', preview));
  $('addObs').addEventListener('click', () => {
    const rec = makeObs($('obsDate').value, parseInt($('obsGroups').value, 10), parseInt($('obsSpots').value, 10));
    if (!rec) { $('preview').textContent = 'Fix the inputs first: valid date, groups 0–50, spots 0–300.'; return; }
    obs.push(rec);
    save(); drawChart(); renderHist(); preview();
  });
});
