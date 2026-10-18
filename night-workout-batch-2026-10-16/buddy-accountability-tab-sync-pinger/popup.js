// Buddy Check-In — popup logic: check-in streak log + copy-as-text sharing.
//
// ENGINE-START
// Pure streak engine — shared shape, no DOM access. Unit-testable in node.
const ENGINE = {
  /** "YYYY-MM-DD" key for a Date in local time. */
  dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * Streak = number of consecutive done-days ending today, or ending
   * yesterday if today is not yet done. doneDays: array of "YYYY-MM-DD".
   */
  streak(doneDays, todayKey) {
    const set = new Set(doneDays);
    let count = 0;
    let cursor = todayKey;
    // Allow the streak to be alive through yesterday when today is pending.
    if (!set.has(cursor)) cursor = ENGINE.shift(cursor, -1);
    while (set.has(cursor)) {
      count += 1;
      cursor = ENGINE.shift(cursor, -1);
    }
    return count;
  },

  /** Shift a "YYYY-MM-DD" key by n days. */
  shift(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return ENGINE.dayKey(dt);
  },

  /** Build the check-in share text from date + streak. */
  shareText(dayKey, streakCount) {
    return `✅ Checked in for ${dayKey} — ${streakCount}-day streak and counting.`;
  },
};
// ENGINE-END
'use strict';

/* ---------- state ---------- */

const STORE_KEYS = { checkinTime: '09:00', reminderOn: true, doneDays: [] };

async function loadState() {
  return chrome.storage.local.get(STORE_KEYS);
}

/* ---------- render ---------- */

function renderGrid(doneDays, todayKey) {
  const grid = document.getElementById('dayGrid');
  grid.innerHTML = '';
  const set = new Set(doneDays);
  for (let i = 13; i >= 0; i -= 1) {
    const key = ENGINE.shift(todayKey, -i);
    const cell = document.createElement('div');
    cell.className = 'day';
    if (set.has(key)) cell.classList.add('done');
    if (key === todayKey) cell.classList.add('today');
    cell.textContent = key.slice(8); // day-of-month
    cell.title = key + (set.has(key) ? ' — done' : '');
    grid.appendChild(cell);
  }
}

async function refresh() {
  const { doneDays, checkinTime, reminderOn } = await loadState();
  const todayKey = ENGINE.dayKey(new Date());
  const done = new Set(doneDays).has(todayKey);

  document.getElementById('streakNum').textContent = ENGINE.streak(doneDays, todayKey);
  renderGrid(doneDays, todayKey);

  const doneBtn = document.getElementById('doneBtn');
  doneBtn.disabled = done;
  doneBtn.innerHTML = done
    ? '<svg class="icon sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Checked in'
    : '<svg class="icon sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Mark today done';
  document.getElementById('doneNote').classList.toggle('hidden', !done);

  document.getElementById('timeInput').value = checkinTime;
  document.getElementById('reminderToggle').checked = reminderOn;
}

/* ---------- actions ---------- */

async function markDone() {
  const { doneDays } = await loadState();
  const todayKey = ENGINE.dayKey(new Date());
  const set = new Set(doneDays);
  set.add(todayKey);
  await chrome.storage.local.set({ doneDays: [...set] });
  refresh();
}

async function copyShare() {
  const { doneDays } = await loadState();
  const todayKey = ENGINE.dayKey(new Date());
  const text = ENGINE.shareText(todayKey, ENGINE.streak(doneDays, todayKey));
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Clipboard API can be unavailable; fall back to a prompt-style copy.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  document.getElementById('copiedNote').classList.remove('hidden');
  setTimeout(() => document.getElementById('copiedNote').classList.add('hidden'), 2200);
}

async function saveSettings() {
  await chrome.storage.local.set({
    checkinTime: document.getElementById('timeInput').value || '09:00',
    reminderOn: document.getElementById('reminderToggle').checked,
  });
}

/* ---------- init ---------- */

document.getElementById('doneBtn').addEventListener('click', markDone);
document.getElementById('copyBtn').addEventListener('click', copyShare);
document.getElementById('timeInput').addEventListener('change', saveSettings);
document.getElementById('reminderToggle').addEventListener('change', saveSettings);

refresh();
