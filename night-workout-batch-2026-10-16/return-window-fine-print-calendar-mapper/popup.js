/* Return Window Mapper — popup logic.
   Deadline tracker from USER-entered purchase dates + return policies.
   Honest scope: reminder aid only — verify with the seller's actual terms.
   All data stays in chrome.storage.local; nothing is transmitted. */
'use strict';

const $ = id => document.getElementById(id);
const KEY = 'return_purchases';
const DAY = 86400000;

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime();
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function load() {
  const r = await chrome.storage.local.get(KEY);
  return r[KEY] || [];
}
async function save(list) {
  await chrome.storage.local.set({ [KEY]: list });
}

/* Status buckets: urgent (<=3d left or expired), soon (<=7d), ok (>7d) */
function statusOf(e) {
  const deadline = startOfDay(e.date) + (+e.days) * DAY;
  const left = Math.round((deadline - startOfDay(Date.now())) / DAY);
  let st = 'ok';
  if (left < 0 || left <= 3) st = 'urgent';
  else if (left <= 7) st = 'soon';
  return { deadline, left, st };
}
function leftText(left) {
  if (left < 0) return `${Math.abs(left)}d expired`;
  if (left === 0) return 'Last day!';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}

function renderAlerts(list) {
  const box = $('alerts');
  const live = list.filter(e => !e.done).map(e => ({ e, ...statusOf(e) }));
  const urgent = live.filter(x => x.st === 'urgent');
  const soon = live.filter(x => x.st === 'soon');
  let html = '';
  if (urgent.length) {
    html += `<div class="alert urgent">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <span><b>${urgent.length} return deadline${urgent.length > 1 ? 's' : ''} urgent:</b> ${urgent.map(x => esc(x.e.item || 'Item')).join(', ')}</span></div>`;
  }
  if (soon.length) {
    html += `<div class="alert soon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      <span><b>${soon.length} expiring this week:</b> ${soon.map(x => esc(x.e.item || 'Item')).join(', ')}</span></div>`;
  }
  box.innerHTML = html;
}

function render(list) {
  renderAlerts(list);
  $('count').textContent = list.filter(e => !e.done).length;

  const live = list.filter(e => !e.done).length;
  const urgentN = list.filter(e => !e.done && statusOf(e).st === 'urgent').length;
  $('stats').innerHTML = `
    <div class="stat"><div class="n">${live}</div><div class="l">active</div></div>
    <div class="stat"><div class="n">${urgentN}</div><div class="l">urgent</div></div>
    <div class="stat"><div class="n">${list.filter(e => e.done).length}</div><div class="l">resolved</div></div>`;

  const box = $('list');
  if (!list.length) {
    box.innerHTML = '<p class="empty">No purchases logged yet.</p>';
    return;
  }
  // Soonest deadline first; done ones at the end
  const ranked = list.map(e => ({ e, ...statusOf(e) }))
    .sort((a, b) => (a.e.done - b.e.done) || (a.deadline - b.deadline));
  box.innerHTML = ranked.map(({ e, deadline, left, st }) => `
    <div class="entry ${e.done ? 'done' : st}">
      <div class="top">
        <div>
          <div class="who">${esc(e.item) || 'Unnamed item'}</div>
          <div class="item">${esc(e.store) || 'Store not specified'}</div>
        </div>
        <span class="count ${e.done ? 'done' : st}">${e.done ? 'Resolved' : leftText(left)}</span>
      </div>
      <div class="meta">Bought ${fmtDate(e.date)} · ${esc(e.days)}-day window · deadline ${fmtDate(deadline)}</div>
      ${e.notes ? `<div class="notes">“${esc(e.notes)}”</div>` : ''}
      <div class="row">
        ${e.done ? '' : `<button class="mini" data-act="done" data-id="${e.id}">Mark returned / resolved</button>`}
        <button class="mini danger" data-act="del" data-id="${e.id}">Remove</button>
      </div>
    </div>`).join('');

  box.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
    let l = await load();
    if (b.dataset.act === 'del') l = l.filter(x => x.id !== b.dataset.id);
    else l = l.map(x => x.id === b.dataset.id ? { ...x, done: true } : x);
    await save(l);
    render(await load());
  }));
}

$('btn-add').addEventListener('click', async () => {
  const dateVal = $('f-date').value;
  if (!dateVal) { $('f-date').focus(); return; }
  const entry = {
    id: 'p' + Date.now().toString(36),
    item: $('f-item').value.trim(),
    store: $('f-store').value.trim(),
    date: new Date(dateVal + 'T00:00:00').getTime(),
    days: $('f-days').value || 30,
    notes: $('f-notes').value.trim(),
    done: false
  };
  const list = await load();
  list.push(entry);
  await save(list);
  render(list);
  $('f-item').value = ''; $('f-store').value = ''; $('f-notes').value = '';
  $('f-item').focus();
});

$('btn-clear').addEventListener('click', async () => {
  if (confirm('Remove all logged purchases?')) {
    await save([]);
    render([]);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // Default date = today
  $('f-date').valueAsDate = new Date();
  render(await load());
});
