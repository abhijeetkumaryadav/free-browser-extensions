/* Posture Prompt — popup logic.
 * Reads routines + settings from the background worker, renders
 * routine list, interval control, last prompt, and done log. */
'use strict';

const $ = id => document.getElementById(id);

let routines = [];
let settings = {};

function fmtTime(ts) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderRoutines() {
  const box = $('routineList');
  box.innerHTML = '';
  routines.forEach(r => {
    const label = document.createElement('label');
    label.className = 'routine';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = (settings.enabledRoutines || []).includes(r.id);
    cb.addEventListener('change', () => save({ enabledRoutines: currentRoutineSelection() }));
    const div = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = r.title;
    const ol = document.createElement('ol');
    r.steps.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    });
    div.append(strong, ol);
    label.append(cb, div);
    box.appendChild(label);
  });
}

function currentRoutineSelection() {
  return [...$('routineList').querySelectorAll('input[type=checkbox]')]
    .map((cb, i) => cb.checked ? routines[i].id : null)
    .filter(Boolean);
}

function save(patch) {
  settings = { ...settings, ...patch };
  chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: patch });
}

function renderLastPrompt() {
  const log = settings._log || [];
  const last = log[0];
  const box = $('lastPrompt');
  if (!last) {
    box.innerHTML = '<span class="empty">No prompts yet. Turn reminders on above.</span>';
    $('markDone').disabled = true;
    return;
  }
  const r = routines.find(x => x.id === last.routine);
  box.innerHTML = '';
  const t = document.createElement('div');
  t.className = 'prompt-title';
  t.textContent = `${last.title} · ${fmtTime(last.ts)}`;
  const ol = document.createElement('ol');
  ol.className = 'prompt-steps';
  (r ? r.steps : []).forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    ol.appendChild(li);
  });
  box.append(t, ol);
  $('markDone').disabled = last.done;
  $('markDone').textContent = last.done ? 'Done ✓' : 'Mark done';
}

function renderLog() {
  const log = settings._log || [];
  const box = $('log');
  if (!log.length) {
    box.innerHTML = '<span class="empty">Nothing logged yet.</span>';
    return;
  }
  box.innerHTML = '';
  log.slice(0, 20).forEach(entry => {
    const row = document.createElement('div');
    row.className = 'log-item';
    const name = document.createElement('span');
    name.textContent = `${entry.title} — ${fmtTime(entry.ts)}`;
    const badge = document.createElement('span');
    badge.className = 'badge ' + (entry.done ? 'done' : 'skip');
    badge.textContent = entry.done ? 'DONE' : 'PROMPTED';
    row.append(name, badge);
    box.appendChild(row);
  });
}

async function init() {
  const data = await chrome.runtime.sendMessage({ type: 'GET_DATA' });
  routines = data.routines;
  settings = data.settings;
  settings._log = (await chrome.storage.local.get({ doneLog: [] })).doneLog;

  $('enabled').checked = !!settings.enabled;
  $('interval').value = settings.intervalMinutes;
  $('intervalLabel').textContent = `${settings.intervalMinutes} min`;

  renderRoutines();
  renderLastPrompt();
  renderLog();

  $('enabled').addEventListener('change', e => save({ enabled: e.target.checked }));
  $('interval').addEventListener('input', e => {
    $('intervalLabel').textContent = `${e.target.value} min`;
  });
  $('interval').addEventListener('change', e => save({ intervalMinutes: Number(e.target.value) }));
  $('testNow').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'TEST_NOW' });
    settings._log = (await chrome.storage.local.get({ doneLog: [] })).doneLog;
    renderLastPrompt();
    renderLog();
  });
  $('markDone').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'MARK_DONE' });
    settings._log = (await chrome.storage.local.get({ doneLog: [] })).doneLog;
    renderLastPrompt();
    renderLog();
  });

  // live-update log when a notification fires while popup is open
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.doneLog) {
      settings._log = changes.doneLog.newValue;
      renderLastPrompt();
      renderLog();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
