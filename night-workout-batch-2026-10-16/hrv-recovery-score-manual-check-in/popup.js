/* Recovery Check-In — pure engine + UI glue. Zero network. */
// ENGINE-START
const STORAGE_KEY = 'recovery.checkins.v1';

// Score: average of 4 ratings (1-5) mapped to 0-100.
// Soreness is stored as "freshness" (5 = fresh) so higher is always better.
function computeScore({ sleep, energy, soreness, mood }) {
  const vals = [sleep, energy, soreness, mood].map(v => clampRating(v));
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(((avg - 1) / 4) * 100);
}
function clampRating(v) {
  v = Number(v);
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, Math.round(v)));
}
function scoreLabel(score) {
  if (score >= 80) return 'Fully recovered';
  if (score >= 60) return 'Mostly recovered';
  if (score >= 40) return 'Somewhat fatigued';
  if (score >= 20) return 'Fatigued';
  return 'Very fatigued';
}
function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function fmtDate(key) {
  const d = new Date(key + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
// ENGINE-END

/* ---------- storage ---------- */
async function loadCheckins() {
  const { [STORAGE_KEY]: data } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data) ? data : [];
}
async function saveCheckins(list) {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const FIELDS = ['sleep', 'energy', 'soreness', 'mood'];

function bindSliders() {
  for (const f of FIELDS) {
    const input = $(f), out = $(f + 'Val');
    input.addEventListener('input', () => { out.textContent = input.value; });
  }
}

function renderLatest(checkins) {
  const wrap = $('scoreWrap');
  if (!checkins.length) { wrap.hidden = true; return; }
  const latest = checkins[checkins.length - 1];
  const score = computeScore(latest);
  wrap.hidden = false;
  $('scoreVal').textContent = score;
  $('scoreLabel').textContent = scoreLabel(score);
  $('scoreDate').textContent = 'Check-in: ' + fmtDate(latest.date);
  const ring = wrap.querySelector('.score-ring');
  ring.style.borderColor = score >= 60 ? 'var(--accent)' : (score >= 40 ? '#fbbf24' : '#fb7185');
  ring.style.color = ring.style.borderColor === 'var(--accent)' ? 'var(--accent)' : ring.style.borderColor;
}

function drawTrend(checkins) {
  const canvas = $('trendChart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const last7 = checkins.slice(-7);
  if (!last7.length) {
    ctx.fillStyle = '#6b7488'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No check-ins yet — log your first one above.', W / 2, H / 2 + 4);
    return;
  }
  const scores = last7.map(computeScore);
  const pad = 14, max = 100;
  const x = i => pad + (i * (W - pad * 2)) / Math.max(1, last7.length - 1);
  const y = s => H - pad - (s / max) * (H - pad * 2);
  // gridlines
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
  for (const g of [0, 50, 100]) { ctx.beginPath(); ctx.moveTo(pad, y(g)); ctx.lineTo(W - pad, y(g)); ctx.stroke(); }
  // line
  ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
  scores.forEach((s, i) => { i ? ctx.lineTo(x(i), y(s)) : ctx.moveTo(x(i), y(s)); });
  ctx.stroke();
  // dots + labels
  scores.forEach((s, i) => {
    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.arc(x(i), y(s), 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9aa3b5'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(fmtDate(last7[i].date), x(i), H - 2);
  });
}

function renderHistory(checkins) {
  const ul = $('historyList');
  ul.innerHTML = '';
  if (!checkins.length) { ul.innerHTML = '<li class="empty">No check-ins yet.</li>'; return; }
  [...checkins].reverse().slice(0, 30).forEach(c => {
    const score = computeScore(c);
    const li = document.createElement('li');
    li.innerHTML = `<span class="meta">${fmtDate(c.date)} · S${c.sleep} E${c.energy} So${c.soreness} M${c.mood}</span><span class="pill">${score}</span>`;
    ul.appendChild(li);
  });
}

async function refresh() {
  const checkins = await loadCheckins();
  checkins.sort((a, b) => a.date.localeCompare(b.date));
  renderLatest(checkins);
  drawTrend(checkins);
  renderHistory(checkins);
}

document.addEventListener('DOMContentLoaded', () => {
  bindSliders();
  refresh();
  $('checkinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const entry = { date: todayKey() };
    for (const f of FIELDS) entry[f] = clampRating($(f).value);
    const checkins = await loadCheckins();
    const idx = checkins.findIndex(c => c.date === entry.date);
    if (idx >= 0) checkins[idx] = entry; else checkins.push(entry); // one per day
    await saveCheckins(checkins);
    refresh();
  });
  $('clearBtn').addEventListener('click', async () => {
    if (confirm('Delete all check-ins?')) { await saveCheckins([]); refresh(); }
  });
});
