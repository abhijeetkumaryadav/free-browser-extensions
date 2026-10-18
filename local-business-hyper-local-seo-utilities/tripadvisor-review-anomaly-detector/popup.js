/* TripAdvisor Review Anomaly Detector
 * Manual rating log + z-score anomaly detection. 100% offline.
 * Never scrapes TripAdvisor or any review site.
 */
'use strict';

const STORE_KEY = 'trad_entries';
const Z_THRESHOLD = 2;      // |z| >= 2 flags an anomaly
const MIN_PRIOR = 3;        // need at least 3 prior snapshots for stats

const $ = (id) => document.getElementById(id);

/* ---------- storage ---------- */
async function loadEntries() {
  const { [STORE_KEY]: entries = [] } = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(entries) ? entries : [];
}
async function saveEntries(entries) {
  await chrome.storage.local.set({ [STORE_KEY]: entries });
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- statistics ----------
 * For each entry (chronological), compute z against the *prior* snapshots:
 *   z = (rating - mean(prior ratings)) / stdev(prior ratings)
 * A flag means "this snapshot is unusual compared to what came before",
 * which is exactly what a rating-drop/spike alert needs.
 */
function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function stdev(xs, m) {
  const v = xs.reduce((a, x) => a + (x - m) * (x - m), 0) / xs.length;
  return Math.sqrt(v);
}

/** Attach {z, anomaly, dir} to every entry (sorted ascending by date). */
function annotate(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((e, i) => {
    const prior = sorted.slice(0, i).map((p) => p.rating);
    let z = null, anomaly = false, dir = null;
    if (prior.length >= MIN_PRIOR) {
      const m = mean(prior);
      const s = stdev(prior, m);
      if (s > 1e-9) {
        z = (e.rating - m) / s;
        if (Math.abs(z) >= Z_THRESHOLD) {
          anomaly = true;
          dir = z > 0 ? 'spike' : 'drop';
        }
      }
    }
    return { ...e, z, anomaly, dir };
  });
}

/* ---------- rendering ---------- */
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderAnomalies(annotated) {
  const list = $('anomList');
  const flags = annotated.filter((e) => e.anomaly);
  $('anomCount').textContent = flags.length;
  $('anomEmpty').classList.toggle('hidden', flags.length > 0);
  list.innerHTML = flags
    .slice()
    .reverse() // newest first
    .map((e) => `
      <li class="item">
        <div class="meta">
          <div class="top">${fmtDate(e.date)} — sudden ${e.dir}</div>
          <div class="sub">rating ${e.rating.toFixed(1)} · z = ${e.z > 0 ? '+' : ''}${e.z.toFixed(2)}${e.note ? ' · ' + esc(e.note) : ''}</div>
        </div>
        <span class="z-badge ${e.dir}">${e.dir === 'drop' ? '▼ drop' : '▲ spike'}</span>
      </li>`).join('');
}

function renderHistory(annotated) {
  const list = $('histList');
  $('histCount').textContent = annotated.length;
  $('histEmpty').classList.toggle('hidden', annotated.length > 0);
  list.innerHTML = annotated
    .slice()
    .reverse() // newest first
    .map((e) => `
      <li class="item">
        <div class="meta">
          <div class="top">${fmtDate(e.date)}</div>
          <div class="sub">${e.count != null && e.count !== '' ? Number(e.count).toLocaleString() + ' reviews' : 'no count'}${e.note ? ' · ' + esc(e.note) : ''}${e.anomaly ? ' · <b>z=' + (e.z > 0 ? '+' : '') + e.z.toFixed(2) + '</b>' : ''}</div>
        </div>
        <span class="rating-badge">${Number(e.rating).toFixed(1)}★</span>
        <button class="del" data-id="${e.id}" title="Delete snapshot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </li>`).join('');
  list.querySelectorAll('.del').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const entries = await loadEntries();
      await saveEntries(entries.filter((x) => x.id !== btn.dataset.id));
      await refresh();
    }));
}

/* ---------- timeline chart (plain canvas) ---------- */
function renderChart(annotated) {
  const canvas = $('chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const empty = $('chartEmpty');
  if (annotated.length < 2) {
    empty.classList.remove('hidden');
    canvas.style.display = 'none';
    return;
  }
  empty.classList.add('hidden');
  canvas.style.display = 'block';

  const padL = 26, padR = 12, padT = 12, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = annotated.length;
  const x = (i) => (n === 1 ? padL + iw / 2 : padL + (i / (n - 1)) * iw);
  const y = (r) => padT + (1 - (r - 1) / 4) * ih; // rating 1..5

  // gridlines at each whole star
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(139,139,152,0.9)';
  ctx.font = '9px sans-serif';
  ctx.lineWidth = 1;
  for (let s = 1; s <= 5; s++) {
    const gy = y(s);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
    ctx.fillText(s + '★', 6, gy + 3);
  }

  // line
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  annotated.forEach((e, i) => (i === 0 ? ctx.moveTo(x(i), y(e.rating)) : ctx.lineTo(x(i), y(e.rating))));
  ctx.stroke();

  // points + anomaly rings + date labels
  annotated.forEach((e, i) => {
    const px = x(i), py = y(e.rating);
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = e.anomaly ? '#f43f5e' : '#f97316';
    ctx.fill();
    if (e.anomaly) {
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(244,63,94,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(139,139,152,0.9)';
    const label = e.date.slice(5).replace('-', '/');
    ctx.fillText(label, px - 12, H - 7);
  });
}

/* ---------- csv export ---------- */
function toCSV(annotated) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['date', 'rating', 'review_count', 'note', 'z_score', 'anomaly']];
  annotated.forEach((e) =>
    rows.push([e.date, Number(e.rating).toFixed(1), e.count ?? '', e.note ?? '',
      e.z == null ? '' : e.z.toFixed(2), e.anomaly ? e.dir : '']));
  return rows.map((r) => r.map(q).join(',')).join('\r\n');
}
function downloadCSV(annotated) {
  const blob = new Blob([toCSV(annotated)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rating-anomalies.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- wiring ---------- */
async function refresh() {
  const entries = await loadEntries();
  const annotated = annotate(entries);
  renderChart(annotated);
  renderAnomalies(annotated);
  renderHistory(annotated);
  $('btnCsv').onclick = () => annotated.length && downloadCSV(annotated);
}

document.addEventListener('DOMContentLoaded', async () => {
  $('fDate').value = todayISO();
  $('fDate').max = todayISO();

  $('btnAdd').addEventListener('click', async () => {
    const rating = parseFloat($('fRating').value);
    const date = $('fDate').value || todayISO();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      $('fRating').focus();
      $('fRating').style.borderColor = '#f43f5e';
      return;
    }
    const entries = await loadEntries();
    entries.push({
      id: uid(),
      date,
      rating: Math.round(rating * 10) / 10,
      count: $('fCount').value === '' ? '' : Math.max(0, parseInt($('fCount').value, 10) || 0),
      note: $('fNote').value.trim(),
    });
    await saveEntries(entries);
    $('fRating').value = ''; $('fCount').value = ''; $('fNote').value = '';
    $('fRating').style.borderColor = '';
    await refresh();
  });

  await refresh();
});
