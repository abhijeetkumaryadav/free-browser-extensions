/* Warranty Vetter — popup logic.
   Scores warranty terms the USER types in against a transparent checklist.
   Honest scope: based on user-entered terms, never a verification of seller claims.
   All data stays in chrome.storage.local; nothing is transmitted. */
'use strict';

const $ = id => document.getElementById(id);
const KEY = 'warranty_entries';

/* ---- Scoring checklist (transparent, max 100) ----
   duration:      >=12mo → 40 | 6–11 → 25 | 3–5 → 12 | 1–2 → 6 | 0 → 0
   coverage:      parts&labor 5 · battery/main 5 · accidental 5 · certified 5  (max 20)
   return ship:   seller pays → 10 | unknown → 4 | buyer pays → 0
   restocking:    no fee → 10 | unknown → 4 | has fee → 0
   money-back:    >=14 days → 20 | 7–13 → 12 | 1–6 → 6 | 0 → 0
   --------------------------------------------------------------- */
function score(e) {
  const parts = [];
  let s = 0;
  const m = +e.months || 0;
  let d;
  if (m >= 12) d = 40; else if (m >= 6) d = 25; else if (m >= 3) d = 12;
  else if (m >= 1) d = 6; else d = 0;
  parts.push([`Warranty duration ${m} mo`, d]); s += d;

  let cov = 0;
  if (e.covParts) { cov += 5; parts.push(['Covers parts & labor', 5]); }
  if (e.covBattery) { cov += 5; parts.push(['Covers battery / main component', 5]); }
  if (e.covAccidental) { cov += 5; parts.push(['Covers accidental damage', 5]); }
  if (e.covCertified) { cov += 5; parts.push(['Certified refurbished', 5]); }
  s += cov;
  if (!cov) parts.push(['No extra coverage selected', 0]);

  const ship = e.ship === 'seller' ? 10 : e.ship === 'unknown' ? 4 : 0;
  parts.push([`Return shipping paid by ${e.ship === 'seller' ? 'seller' : e.ship === 'buyer' ? 'buyer' : 'unknown'}`, ship]); s += ship;

  const rs = e.restock === 'no' ? 10 : e.restock === 'unknown' ? 4 : 0;
  parts.push([e.restock === 'no' ? 'No restocking fee' : e.restock === 'yes' ? 'Has restocking fee' : 'Restocking fee unknown', rs]); s += rs;

  const b = +e.back || 0;
  const bd = b >= 14 ? 20 : b >= 7 ? 12 : b >= 1 ? 6 : 0;
  parts.push([`Money-back window ${b} days`, bd]); s += bd;

  return { total: Math.min(100, s), parts };
}

function ringColor(v) {
  return v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--warn)' : 'var(--bad)';
}

/* ---- storage ---- */
async function load() {
  const r = await chrome.storage.local.get(KEY);
  return r[KEY] || [];
}
async function save(list) {
  await chrome.storage.local.set({ [KEY]: list });
}

/* ---- rendering ---- */
function fact(k, v) {
  return `<span class="fact"><b>${k}</b> ${v}</span>`;
}
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function render(list) {
  const box = $('list');
  $('count').textContent = list.length;
  if (!list.length) {
    box.innerHTML = '<p class="empty">No sellers added yet.</p>';
    return;
  }
  // Best score first
  const ranked = list.map(e => ({ e, r: score(e) }))
    .sort((a, b) => b.r.total - a.r.total);
  box.innerHTML = ranked.map(({ e, r }, i) => `
    <div class="entry">
      <div class="top">
        <div>
          <div class="who">${i === 0 ? '🏆 ' : ''}${esc(e.seller) || 'Unnamed seller'}</div>
          <div class="item">${esc(e.item) || 'Item not specified'}</div>
        </div>
        <div class="score-ring" style="border:3px solid ${ringColor(r.total)};color:${ringColor(r.total)}">${r.total}</div>
      </div>
      <div class="facts">
        ${fact('Warranty', esc(e.months) + ' mo')}
        ${fact('Money-back', esc(e.back) + ' d')}
        ${fact('Ship', e.ship === 'seller' ? 'seller pays' : e.ship === 'buyer' ? 'buyer pays' : 'unknown')}
        ${fact('Restock', e.restock === 'no' ? 'no fee' : e.restock === 'yes' ? 'fee' : 'unknown')}
      </div>
      ${e.notes ? `<div class="notes">“${esc(e.notes)}”</div>` : ''}
      <details class="breakdown">
        <summary>Score breakdown</summary>
        <ul>${r.parts.map(([t, v]) => `<li>${esc(t)} — <b>${v}</b></li>`).join('')}</ul>
      </details>
      <button class="del" data-id="${e.id}">Remove</button>
    </div>`).join('');
  box.querySelectorAll('.del').forEach(b =>
    b.addEventListener('click', async () => {
      const l = await load();
      await save(l.filter(x => x.id !== b.dataset.id));
      render(await load());
    }));
}

/* ---- events ---- */
$('btn-add').addEventListener('click', async () => {
  const entry = {
    id: 'e' + Date.now().toString(36),
    seller: $('f-seller').value.trim(),
    item: $('f-item').value.trim(),
    months: $('f-months').value,
    back: $('f-back').value,
    covParts: $('f-cov-parts').checked,
    covBattery: $('f-cov-battery').checked,
    covAccidental: $('f-cov-accidental').checked,
    covCertified: $('f-cov-certified').checked,
    ship: $('f-ship').value,
    restock: $('f-restock').value,
    notes: $('f-notes').value.trim()
  };
  const list = await load();
  list.push(entry);
  await save(list);
  render(list);
  // Reset form lightly
  $('f-seller').value = ''; $('f-item').value = ''; $('f-notes').value = '';
  $('f-seller').focus();
});

$('btn-clear').addEventListener('click', async () => {
  if (confirm('Remove all warranty entries?')) {
    await save([]);
    render([]);
  }
});

document.addEventListener('DOMContentLoaded', async () => render(await load()));
