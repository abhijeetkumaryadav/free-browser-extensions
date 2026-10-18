// Blink & Sip — popup logic.
// Reads/writes settings via chrome.storage.local; scoring is handled in
// the background worker so totals stay consistent when the popup closes.

'use strict';

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  enabled: true,
  blinkMinutes: 20,
  waterMinutes: 60,
  points: 0,
  streak: 0,
  bestStreak: 0,
  completionsToday: 0
};

async function loadState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function render(s) {
  $('enabled').checked = s.enabled;
  $('blinkMinutes').value = s.blinkMinutes;
  $('waterMinutes').value = s.waterMinutes;
  $('points').textContent = s.points;
  $('streak').textContent = s.streak;
  $('best').textContent = s.bestStreak;
  $('today').textContent = s.completionsToday;
}

async function saveSettings() {
  const blinkMinutes = Math.min(120, Math.max(5, Number($('blinkMinutes').value) || 20));
  const waterMinutes = Math.min(240, Math.max(15, Number($('waterMinutes').value) || 60));
  await chrome.storage.local.set({
    enabled: $('enabled').checked,
    blinkMinutes,
    waterMinutes
  });
  // Ask the background worker to rebuild the alarms on the new schedule.
  await chrome.runtime.sendMessage({ type: 'RESCHEDULE' });
  const s = await loadState();
  render(s);
}

async function complete(kind) {
  const res = await chrome.runtime.sendMessage({ type: 'COMPLETE', kind });
  if (res && res.ok) render(res.state);
}

async function init() {
  render(await loadState());
  $('enabled').addEventListener('change', saveSettings);
  $('blinkMinutes').addEventListener('change', saveSettings);
  $('waterMinutes').addEventListener('change', saveSettings);
  $('doneBlink').addEventListener('click', () => complete('blink'));
  $('doneWater').addEventListener('click', () => complete('water'));
  // Live-refresh when background updates stats (e.g. day rollover).
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && (changes.points || changes.streak)) {
      render(await loadState());
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
