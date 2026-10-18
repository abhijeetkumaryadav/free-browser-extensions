// Clear Sky Readiness — engine: readiness scoring from user-logged conditions.
// Honest scope: scores only what the user records. No live sky data.

/* ---------- pure engine (headless-testable) ---------- */
// ENGINE-START

/**
 * Compute a 0–100 readiness score from three 0–4 condition ratings
 * (0 = perfect, 4 = terrible for cloud/moon/transparency).
 */
function readinessScore(cloud, moon, transp) {
  if (![cloud, moon, transp].every((v) => Number.isInteger(v) && v >= 0 && v <= 4)) return null;
  // Weighted: cloud cover matters most, then transparency, then moon.
  const penalty = cloud * 15 + transp * 8 + moon * 5;
  return Math.max(0, 100 - penalty);
}

/** Verdict label for a 0–100 score. */
function scoreVerdict(score) {
  if (score == null || score < 0 || score > 100) return '—';
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Marginal';
  return 'Poor';
}

/** "YYYY-MM-DD" key for a Date. */
function dayKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Average readiness over an array of {score}. Returns null when empty. */
function avgScore(logs) {
  if (!logs.length) return null;
  const sum = logs.reduce((a, l) => a + (l.score || 0), 0);
  return Math.round(sum / logs.length);
}
// ENGINE-END

/* ---------- popup wiring ---------- */
const $ = (id) => document.getElementById(id);
const FACTORS = [
  ['M3 3l1.5 4L9 8.5 4.5 10 3 14.5 1.5 10-3 8.5 1.5 7z', 'Cloud cover', 'the single biggest factor — overcast means no targets'],
  ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', 'Moonlight', 'a full moon washes out faint deep-sky objects'],
  ['M12 2v20M2 12h20', 'Transparency', 'haze and turbulence blur fine detail'],
];
const STORAGE_KEY = 'skyLogs';

document.addEventListener('DOMContentLoaded', async () => {
  // Render factor guide
  $('factors').innerHTML = FACTORS.map(([d, name, tip]) =>
    `<div class="factor"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg><span><b>${name}:</b> ${tip}</span></div>`
  ).join('');

  const updatePreview = () => {
    const s = readinessScore(+$('cloud').value, +$('moon').value, +$('transp').value);
    $('scorePreview').textContent = `${s}/100 — ${scoreVerdict(s)}`;
  };
  ['cloud', 'moon', 'transp'].forEach((id) => $(id).addEventListener('change', updatePreview));
  updatePreview();

  $('save').addEventListener('click', async () => {
    const score = readinessScore(+$('cloud').value, +$('moon').value, +$('transp').value);
    const entry = {
      date: dayKey(new Date()),
      cloud: +$('cloud').value, moon: +$('moon').value, transp: +$('transp').value,
      notes: $('notes').value.trim(), score,
    };
    const { [STORAGE_KEY]: logs = [] } = await chrome.storage.local.get(STORAGE_KEY);
    logs.unshift(entry);
    await chrome.storage.local.set({ [STORAGE_KEY]: logs.slice(0, 200) });
    $('notes').value = '';
    render(logs.slice(0, 200));
  });

  $('clear').addEventListener('click', async () => {
    if (!confirm('Delete all sky logs?')) return;
    await chrome.storage.local.remove(STORAGE_KEY);
    render([]);
  });

  $('list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    const { [STORAGE_KEY]: logs = [] } = await chrome.storage.local.get(STORAGE_KEY);
    logs.splice(+btn.dataset.i, 1);
    await chrome.storage.local.set({ [STORAGE_KEY]: logs });
    render(logs);
  });

  const { [STORAGE_KEY]: logs = [] } = await chrome.storage.local.get(STORAGE_KEY);
  render(logs);
});

function render(logs) {
  if (!logs.length) {
    $('list').innerHTML = '<div class="empty">No nights logged yet. Score tonight above.</div>';
    return;
  }
  const avg = avgScore(logs);
  $('list').innerHTML =
    `<div class="row"><div class="meta">Average readiness (${logs.length} nights)</div><div class="sc">${avg}/100</div></div>` +
    logs.map((l, i) =>
      `<div class="row"><div><div>${l.date} — ${scoreVerdict(l.score)}</div>` +
      `<div class="meta">${l.notes ? escapeHtml(l.notes) : 'no notes'}</div></div>` +
      `<div style="display:flex;align-items:center;gap:6px"><div class="sc">${l.score}</div>` +
      `<button class="del" data-i="${i}" title="Delete">×</button></div></div>`
    ).join('');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
