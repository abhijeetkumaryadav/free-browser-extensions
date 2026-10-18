/* Churn Risk Worksheet — manual health-score worksheet.
   Every score is typed by the user. Nothing is detected automatically.
   Risk score = weighted average of 1–5 signal sliders (higher = riskier). */
'use strict';

const SIGNALS = [
  { key: 'tickets',  label: 'Support tickets & escalations', hint: '1 = quiet, 5 = constant escalations', weight: 0.25 },
  { key: 'usage',    label: 'Usage drop-off',                hint: '1 = usage steady, 5 = sharp drop-off',   weight: 0.30 },
  { key: 'renewal',  label: 'Renewal proximity',             hint: '1 = just renewed, 5 = renews soon',     weight: 0.25 },
  { key: 'nps',      label: 'Low satisfaction (NPS)',        hint: '1 = promoters, 5 = detractors',         weight: 0.20 },
];

const $ = (id) => document.getElementById(id);
let customers = [];
let editingId = null;

/* ---------- storage ---------- */
async function load() {
  const { customers: c } = await chrome.storage.local.get('customers');
  customers = Array.isArray(c) ? c : [];
}
async function save() {
  await chrome.storage.local.set({ customers });
}

/* ---------- scoring ---------- */
function riskScore(c) {
  let s = 0;
  for (const sig of SIGNALS) s += (c.scores[sig.key] || 1) * sig.weight;
  return s; // 1.0–5.0
}
function band(score) {
  if (score >= 4.0) return { cls: 'high',    text: 'HIGH RISK' };
  if (score >= 2.75) return { cls: 'watch',  text: 'WATCH' };
  return { cls: 'healthy', text: 'HEALTHY' };
}
/* Plain-language notes derived only from the user's own scores. */
function plainNotes(c) {
  const notes = [];
  if (c.scores.usage >= 4 && c.scores.nps >= 4)
    notes.push('Usage is falling and satisfaction is low — schedule a check-in call before renewal.');
  if (c.scores.tickets >= 4)
    notes.push('Ticket load is heavy — resolve open issues fast, they are eroding trust.');
  if (c.scores.renewal >= 4 && riskScore(c) >= 2.75)
    notes.push('Renewal is near and risk is elevated — prepare a retention offer now.');
  if (c.scores.nps >= 4 && c.scores.usage <= 2)
    notes.push('Satisfaction is low but usage is stable — dig into the why before it spreads.');
  if (!notes.length && riskScore(c) >= 2.75)
    notes.push('Risk is building — re-score next week and watch the trend.');
  if (!notes.length) notes.push('Looks steady. Keep scoring periodically to catch drift early.');
  return notes;
}

/* ---------- UI ---------- */
function buildSliders() {
  $('sliders').innerHTML = SIGNALS.map((s) => `
    <div class="slider-row">
      <div class="lbl"><span>${s.label}</span><span class="val" id="val-${s.key}">3</span></div>
      <input type="range" id="sl-${s.key}" min="1" max="5" step="1" value="3" aria-label="${s.label}">
    </div>`).join('');
  for (const s of SIGNALS) {
    $('sl-' + s.key).addEventListener('input', (e) => { $('val-' + s.key).textContent = e.target.value; });
  }
}
function readScores() {
  const o = {};
  for (const s of SIGNALS) o[s.key] = parseInt($('sl-' + s.key).value, 10);
  return o;
}
function fillForm(c) {
  $('nameInput').value = c.name;
  $('noteInput').value = c.note || '';
  for (const s of SIGNALS) { $('sl-' + s.key).value = c.scores[s.key]; $('val-' + s.key).textContent = c.scores[s.key]; }
  $('formTitle').textContent = 'Edit customer';
  $('saveBtn').textContent = 'Save changes';
  $('resetBtn').hidden = false;
}
function clearForm() {
  $('nameInput').value = '';
  $('noteInput').value = '';
  for (const s of SIGNALS) { $('sl-' + s.key).value = 3; $('val-' + s.key).textContent = 3; }
  $('formTitle').textContent = 'Add customer';
  $('saveBtn').textContent = 'Add customer';
  $('resetBtn').hidden = true;
  editingId = null;
}

function esc(t) { return String(t).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

function render() {
  const ranked = [...customers].sort((a, b) => riskScore(b) - riskScore(a));
  $('count').textContent = String(ranked.length);
  if (!ranked.length) {
    $('list').innerHTML = '<p class="empty">No customers yet. Score your first one above.</p>';
    return;
  }
  $('list').innerHTML = ranked.map((c) => {
    const score = riskScore(c).toFixed(2);
    const b = band(parseFloat(score));
    const flags = plainNotes(c).map((n) => `<div class="flag">• ${esc(n)}</div>`).join('');
    return `<div class="item" data-id="${c.id}">
      <div class="head"><span class="name">${esc(c.name)}</span><span class="badge ${b.cls}">${b.text}</span></div>
      <div class="score">Risk score: <b>${score} / 5.00</b> — manually scored</div>
      ${flags}
      ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
      <div class="actions">
        <button class="edit" data-act="edit">Edit</button>
        <button class="del" data-act="del">Delete</button>
      </div>
    </div>`;
  }).join('');
  $('list').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.item').dataset.id;
      if (btn.dataset.act === 'del') {
        customers = customers.filter((c) => String(c.id) !== id);
        await save(); render();
      } else {
        const c = customers.find((x) => String(x.id) === id);
        if (c) { editingId = c.id; fillForm(c); }
      }
    });
  });
}

$('saveBtn').addEventListener('click', async () => {
  const name = $('nameInput').value.trim();
  if (!name) { $('nameInput').focus(); return; }
  const note = $('noteInput').value.trim();
  const scores = readScores();
  if (editingId) {
    const c = customers.find((x) => x.id === editingId);
    if (c) Object.assign(c, { name, note, scores });
  } else {
    customers.push({ id: Date.now(), name, note, scores });
  }
  clearForm(); await save(); render();
});
$('resetBtn').addEventListener('click', clearForm);

buildSliders();
load().then(render);
