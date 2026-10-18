// Inversion & Smog Guide — observation log.
// Engine: pure functions between markers (headless-testable).
// ===================== ENGINE-START =====================
const LEVEL_LABELS = ['Clear', 'Slight haze', 'Noticeable', 'Thick', 'Very thick', "Can't see far"];
// Badge colors interpolate from teal (clear) to orange/red (thick).
const LEVEL_COLORS = ['#2dd4bf', '#a3e635', '#fbbf24', '#fb923c', '#f87171', '#ef4444'];

/** Validate an observation. Returns null when invalid. */
function makeObs(level, sky, notes) {
  const l = Number(level);
  if (!Number.isInteger(l) || l < 0 || l > 5) return null;
  const validSky = ['clear', 'partly', 'overcast', 'fog'];
  const s = validSky.includes(sky) ? sky : 'clear';
  return { id: 'o' + Date.now() + Math.floor(Math.random() * 1e4),
           level: l, sky: s, notes: String(notes || '').trim().slice(0, 500),
           created: Date.now() };
}

/** Sort observations newest-first; does not mutate. */
function sortObs(obs) {
  return [...obs].sort((a, b) => b.created - a.created);
}

/** Filter observations by query over notes, case-insensitive. */
function filterObs(obs, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return obs;
  return obs.filter(o => o.notes.toLowerCase().includes(needle));
}

/** Average haze level over last N days (1 decimal), or null when none. */
function avgLevelWindow(obs, days, now) {
  const cutoff = now - days * 86400000;
  const inWin = obs.filter(o => o.created >= cutoff);
  if (!inWin.length) return null;
  return Math.round((inWin.reduce((a, o) => a + o.level, 0) / inWin.length) * 10) / 10;
}

/** Format a timestamp as short date + time. */
function fmtWhen(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// ===================== ENGINE-END =====================

const $ = id => document.getElementById(id);
const KEY = 'smogObs';

// ---- Tabs ----
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('tab-learn').classList.toggle('hidden', btn.dataset.tab !== 'learn');
    $('tab-log').classList.toggle('hidden', btn.dataset.tab !== 'log');
  });
});

async function load() {
  const { [KEY]: obs = [] } = await chrome.storage.local.get(KEY);
  return obs;
}
async function save(obs) { await chrome.storage.local.set({ [KEY]: obs }); }

// ---- Form ----
$('obsForm').addEventListener('submit', async e => {
  e.preventDefault();
  const ob = makeObs($('obsLevel').value, $('obsSky').value, $('obsNotes').value);
  if (!ob) return;
  const obs = await load();
  obs.push(ob);
  await save(obs);
  $('obsNotes').value = '';
  render();
});

// ---- Search + render ----
$('search').addEventListener('input', render);

async function render() {
  const obs = sortObs(await load());
  const shown = filterObs(obs, $('search').value);

  $('obsCount').textContent = obs.length;
  $('statCount').textContent = obs.length;
  const avg = avgLevelWindow(obs, 7, Date.now());
  $('statAvg').textContent = avg === null ? '—' : avg.toFixed(1);
  $('statLast').textContent = obs.length ? LEVEL_LABELS[obs[0].level] : '—';

  const ul = $('obsList');
  ul.innerHTML = '';
  if (!shown.length) {
    ul.innerHTML = '<li class="empty">' + (obs.length ? 'No matches.' : 'No observations yet — log your first one above.') + '</li>';
    return;
  }
  for (const o of shown) {
    const li = document.createElement('li');
    const color = LEVEL_COLORS[o.level];
    li.innerHTML = '<div class="top"><span class="level"></span><span class="sky"></span></div>' +
      (o.notes ? '<div class="notes"></div>' : '') +
      '<div class="meta"><span></span><button class="del">delete</button></div>';
    const badge = li.querySelector('.level');
    badge.textContent = o.level + ' — ' + LEVEL_LABELS[o.level];
    badge.style.background = color + '22';
    badge.style.color = color;
    badge.style.border = '1px solid ' + color + '55';
    li.querySelector('.sky').textContent = o.sky;
    if (o.notes) li.querySelector('.notes').textContent = o.notes;
    li.querySelector('.meta span').textContent = fmtWhen(o.created);
    li.querySelector('.del').addEventListener('click', async () => {
      const all = await load();
      await save(all.filter(x => x.id !== o.id));
      render();
    });
    ul.appendChild(li);
  }
}

$('clearAll').addEventListener('click', async () => {
  if (confirm('Delete all observations?')) { await save([]); render(); }
});

render();
