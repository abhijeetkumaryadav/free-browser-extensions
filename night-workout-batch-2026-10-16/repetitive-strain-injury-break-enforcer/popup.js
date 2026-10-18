// Break Enforcer — popup logic.
// Reads/writes settings; cycle control delegated to the background worker.
// Ring + countdown update locally every 500ms from stored phase/endsAt.

'use strict';

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  workMinutes: 25,
  breakMinutes: 5,
  enforceMode: false,
  phase: 'idle',
  endsAt: 0,
  cycles: 0
};

async function loadState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function ringSVG(frac, color) {
  const r = 48, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, frac)));
  return `<svg viewBox="0 0 110 110">
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="9"/>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="${color}" stroke-width="9"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
      transform="rotate(-90 55 55)"/>
  </svg>`;
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function totalFor(s) {
  if (s.phase === 'work') return s.workMinutes * 60 * 1000;
  if (s.phase === 'break') return s.breakMinutes * 60 * 1000;
  return 1;
}

function render(s) {
  const labels = { idle: 'Idle', work: 'Focus', break: 'Break time' };
  $('phaseLabel').textContent = labels[s.phase] || 'Idle';
  $('phaseLabel').style.color = s.phase === 'break' ? '#fbbf24' : 'var(--accent)';
  $('cycles').textContent = `${s.cycles} break${s.cycles === 1 ? '' : 's'} taken`;
  $('workMinutes').value = s.workMinutes;
  $('breakMinutes').value = s.breakMinutes;
  $('enforceMode').checked = s.enforceMode;
  $('startBtn').disabled = s.phase !== 'idle';
  $('startBtn').style.opacity = s.phase !== 'idle' ? 0.5 : 1;

  const remain = s.endsAt - Date.now();
  $('clock').textContent = s.phase === 'idle' ? '--:--' : fmt(remain);
  const frac = s.phase === 'idle' ? 0 : remain / totalFor(s);
  const color = s.phase === 'break' ? '#fbbf24' : '#60a5fa';
  $('ringWrap').innerHTML = ringSVG(frac, color);
}

let timerId = 0;

async function refresh() {
  render(await loadState());
}

async function saveSettings() {
  const workMinutes = Math.min(120, Math.max(5, Number($('workMinutes').value) || 25));
  const breakMinutes = Math.min(60, Math.max(1, Number($('breakMinutes').value) || 5));
  await chrome.storage.local.set({
    workMinutes,
    breakMinutes,
    enforceMode: $('enforceMode').checked
  });
  await refresh();
}

async function init() {
  await refresh();
  timerId = setInterval(refresh, 500);
  $('startBtn').addEventListener('click', async () => {
    await saveSettings();
    await chrome.runtime.sendMessage({ type: 'START' });
    await refresh();
  });
  $('stopBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'STOP' });
    await refresh();
  });
  $('workMinutes').addEventListener('change', saveSettings);
  $('breakMinutes').addEventListener('change', saveSettings);
  $('enforceMode').addEventListener('change', saveSettings);
  window.addEventListener('unload', () => clearInterval(timerId));
}

document.addEventListener('DOMContentLoaded', init);
