/* Wrist Mobility Reminder — popup logic */
const DEFAULTS = { enabled: false, intervalMin: 45, lastExercise: null, doneLog: [] };
const $ = (id) => document.getElementById(id);

async function load() {
  const s = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
  $('toggle').classList.toggle('on', s.enabled);
  $('interval').value = s.intervalMin;
  $('intervalVal').textContent = s.intervalMin;
  $('lastEx').innerHTML = s.lastExercise
    ? `<b>${esc(s.lastExercise.name)}</b><br>${esc(s.lastExercise.how)}`
    : 'No reminder yet.';
  $('doneCount').textContent = s.doneLog.length ? `(${s.doneLog.length})` : '';
  $('doneLog').innerHTML = s.doneLog.slice().reverse().slice(0, 10).map(
    (d) => `<li>✓ ${new Date(d.ts).toLocaleString()}</li>`).join('') || '<li>No entries yet.</li>';
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

$('toggle').addEventListener('click', async () => {
  const { enabled } = await chrome.storage.local.get('enabled');
  await chrome.storage.local.set({ enabled: !enabled });
  load();
});

$('interval').addEventListener('input', (e) => { $('intervalVal').textContent = e.target.value; });
$('interval').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ intervalMin: Number(e.target.value) });
});

$('testNow').addEventListener('click', async () => {
  // Fire the reminder alarm immediately for a preview.
  await chrome.alarms.create('wrist-reminder', { when: Date.now() + 500 });
  window.close();
});

chrome.storage.onChanged.addListener(load);
load();
