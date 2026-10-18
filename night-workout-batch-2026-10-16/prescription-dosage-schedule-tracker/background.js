/* Medication Schedule Tracker — background worker.
   Owns chrome.alarms: one alarm per (medication, time). On fire, shows a
   notification. Tracks daily check-offs and streaks. Never suggests doses. */
'use strict';

const STORE_KEY = 'medSchedule';

/** Load full state: { meds: [...], taken: { 'YYYY-MM-DD': ['medId@HH:MM'] }, stats } */
async function loadState() {
  const { [STORE_KEY]: s } = await chrome.storage.local.get(STORE_KEY);
  return s || { meds: [], taken: {}, stats: { total: 0, streak: 0, lastStreakDate: null } };
}

async function saveState(s) {
  await chrome.storage.local.set({ [STORE_KEY]: s });
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Parse "08:00, 20:00" -> ["08:00","20:00"]; throws on invalid */
function parseTimes(raw) {
  const parts = raw.split(',').map(t => t.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one time, e.g. 08:00, 20:00.');
  return parts.map(p => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(p);
    if (!m) throw new Error(`Bad time "${p}" — use HH:MM.`);
    return m[1].padStart(2, '0') + ':' + m[2];
  });
}

/** Rebuild all alarms from medication list. */
async function rebuildAlarms(state) {
  await chrome.alarms.clearAll();
  const now = Date.now();
  for (const med of state.meds) {
    for (const t of med.times) {
      const [h, m] = t.split(':').map(Number);
      const fire = new Date();
      fire.setHours(h, m, 0, 0);
      if (fire.getTime() <= now) fire.setDate(fire.getDate() + 1); // next occurrence
      await chrome.alarms.create(`${med.id}@${t}`, { when: fire.getTime(), periodInMinutes: 1440 });
    }
  }
}

// ---------------------------------------------------------------------------
// Alarm -> notification
// ---------------------------------------------------------------------------
chrome.alarms.onAlarm.addListener(async alarm => {
  const [medId, time] = alarm.name.split('@');
  const state = await loadState();
  const med = state.meds.find(m => m.id === medId);
  if (!med) return;
  const today = dayKey();
  const key = `${medId}@${time}`;
  const already = (state.taken[today] || []).includes(key);
  chrome.notifications.create(key + '@' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: already ? `Reminder (already checked): ${med.name}` : `Time for ${med.name}`,
    message: `${med.dose || 'Dose'} at ${time}. Open the extension to check it off.`,
    requireInteraction: false
  });
});

// ---------------------------------------------------------------------------
// Messages from popup
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const state = await loadState();
    if (msg.type === 'addMed') {
      const times = parseTimes(msg.times);
      const med = {
        id: 'm' + Date.now().toString(36),
        name: msg.name.trim(),
        dose: (msg.dose || '').trim(),
        times
      };
      state.meds.push(med);
      await saveState(state);
      await rebuildAlarms(state);
      sendResponse({ ok: true });
    } else if (msg.type === 'deleteMed') {
      state.meds = state.meds.filter(m => m.id !== msg.id);
      await saveState(state);
      await rebuildAlarms(state);
      sendResponse({ ok: true });
    } else if (msg.type === 'toggleTaken') {
      const today = dayKey();
      state.taken[today] = state.taken[today] || [];
      const arr = state.taken[today];
      const i = arr.indexOf(msg.key);
      if (i >= 0) {
        arr.splice(i, 1);
        state.stats.total = Math.max(0, state.stats.total - 1);
      } else {
        arr.push(msg.key);
        state.stats.total += 1;
      }
      // Streak: recompute — yesterday-or-today chain of days with >=1 check-off
      const days = Object.keys(state.taken).filter(d => state.taken[d].length > 0).sort();
      let streak = 0;
      let cursor = new Date();
      if (!state.taken[dayKey(cursor)]?.length) cursor.setDate(cursor.getDate() - 1);
      while (state.taken[dayKey(cursor)]?.length) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      state.stats.streak = streak;
      state.stats.lastStreakDate = dayKey();
      await saveState(state);
      sendResponse({ ok: true });
    } else if (msg.type === 'getState') {
      sendResponse({ ok: true, state });
    } else if (msg.type === 'exportLog') {
      sendResponse({ ok: true, state });
    }
  })().catch(err => sendResponse({ ok: false, error: String(err.message || err) }));
  return true; // async
});
