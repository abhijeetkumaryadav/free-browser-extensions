// Focus Gate — popup (gated-site list + prompt settings).
'use strict';

const DEF = { fgSites: [], fgEnabled: true, fgMinutes: 2, fgExercise: '10 squats' };

// ENGINE-START
// Normalize a user-typed site entry ("https://www.reddit.com/r/x " -> "reddit.com").
function cleanSite(raw) {
  let s = String(raw || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : '';
}
// ENGINE-END

const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.local.get(DEF);
  render(cfg);
}

function render(cfg) {
  $('enabled').checked = cfg.fgEnabled;
  $('exercise').value = cfg.fgExercise;
  $('minutes').value = cfg.fgMinutes;
  const ul = $('list');
  ul.innerHTML = '';
  cfg.fgSites.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Remove ' + s;
    del.addEventListener('click', async () => {
      const c = await chrome.storage.local.get(DEF);
      c.fgSites = c.fgSites.filter((x) => x !== s);
      await chrome.storage.local.set(c);
      render(c);
    });
    li.appendChild(del);
    ul.appendChild(li);
  });
}

async function save(patch) {
  const cfg = await chrome.storage.local.get(DEF);
  await chrome.storage.local.set({ ...cfg, ...patch });
  render(await chrome.storage.local.get(DEF));
}

$('add').addEventListener('click', async () => {
  const s = cleanSite($('site').value);
  if (!s) return;
  const cfg = await chrome.storage.local.get(DEF);
  if (!cfg.fgSites.includes(s)) cfg.fgSites.push(s);
  $('site').value = '';
  await chrome.storage.local.set(cfg);
  render(cfg);
});
$('site').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('add').click(); });
$('enabled').addEventListener('change', (e) => save({ fgEnabled: e.target.checked }));
$('exercise').addEventListener('change', (e) => save({ fgExercise: e.target.value.trim() || '10 squats' }));
$('minutes').addEventListener('change', (e) => {
  const v = Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 2));
  save({ fgMinutes: v });
});

load();
