/* Outbox Delay Timer — popup logic
   All entries live in chrome.storage.local. The service worker checks
   due reminders on an alarm and fires notifications. */

const $ = (id) => document.getElementById(id);

let selectedHours = 48; // default: 2 days

/* ---------- Preset buttons ---------- */
document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.hours;
    if (v === 'custom') {
      $('customRow').classList.remove('hidden');
      selectedHours = parseInt($('customHours').value, 10) || 72;
    } else {
      $('customRow').classList.add('hidden');
      selectedHours = parseInt(v, 10);
    }
  });
});
$('customHours').addEventListener('input', () => {
  selectedHours = parseInt($('customHours').value, 10) || 72;
});

/* ---------- Add entry ---------- */
$('addBtn').addEventListener('click', async () => {
  const to = $('to').value.trim();
  const subject = $('subject').value.trim();
  if (!to) {
    $('to').focus();
    $('to').style.borderColor = '#f43f5e';
    return;
  }
  const hours = Math.min(Math.max(selectedHours || 72, 1), 8760);
  const entry = {
    id: crypto.randomUUID(),
    to,
    subject: subject || '(no subject)',
    dueAt: Date.now() + hours * 3600 * 1000,
    createdAt: Date.now(),
    done: false,
    notified: false,
  };
  const { entries = [] } = await chrome.storage.local.get('entries');
  entries.push(entry);
  await chrome.storage.local.set({ entries });
  // Ensure the periodic check alarm exists.
  chrome.alarms.create('check-due', { periodInMinutes: 1 });
  $('to').value = '';
  $('subject').value = '';
  render();
});

/* ---------- Rendering ---------- */
function relativeDue(dueAt) {
  const diff = dueAt - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const label =
    mins < 60 ? `${mins}m` :
    mins < 1440 ? `${Math.round(mins / 60)}h` :
    `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${label}` : `${label} overdue`;
}

async function render() {
  const { entries = [] } = await chrome.storage.local.get('entries');
  const pending = entries.filter((e) => !e.done).sort((a, b) => a.dueAt - b.dueAt);
  $('count').textContent = pending.length;
  $('empty').style.display = pending.length ? 'none' : 'block';
  const list = $('list');
  list.innerHTML = '';

  for (const e of pending) {
    const item = document.createElement('div');
    const overdue = e.dueAt <= Date.now();
    const soon = !overdue && e.dueAt - Date.now() < 24 * 3600 * 1000;
    item.className = 'item' + (overdue ? ' overdue' : soon ? ' item-soon' : '');

    item.innerHTML = `
      <div class="item-meta">
        <span class="item-to"></span>
        <span class="item-due">${escapeHtml(relativeDue(e.dueAt))}</span>
      </div>
      <div class="item-subject"></div>
      <div class="item-actions">
        <button class="chip snooze" title="Snooze 1 day">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>
          Snooze 1d
        </button>
        <button class="chip done" title="Mark as followed up">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Done
        </button>
      </div>`;
    item.querySelector('.item-to').textContent = e.to;
    item.querySelector('.item-subject').textContent = e.subject;

    item.querySelector('.snooze').addEventListener('click', () => mutate(e.id, (x) => {
      x.dueAt = Date.now() + 24 * 3600 * 1000;
      x.notified = false;
    }));
    item.querySelector('.done').addEventListener('click', () => mutate(e.id, (x) => {
      x.done = true;
    }));
    list.appendChild(item);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function mutate(id, fn) {
  const { entries = [] } = await chrome.storage.local.get('entries');
  const e = entries.find((x) => x.id === id);
  if (e) {
    fn(e);
    await chrome.storage.local.set({ entries });
    render();
  }
}

render();
