/* Hours Consistency Tracker — manual per-platform hours log with mismatch detection.
 * All data is entered by hand and stored locally. No page access, no network. */

'use strict';

const $ = (id) => document.getElementById(id);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STORE_KEY = 'hoursTracker';

let state = { platforms: [], holidays: [] }; // platform: {id, name, hours: {0..6: {open, close, closed}}}
let selectedId = null;

const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const blankHours = () => Object.fromEntries(DAYS.map((_, i) => [i, { open: '09:00', close: '18:00', closed: true }]));

// ---------- Persistence ----------
function save() {
  chrome.storage.local.set({ [STORE_KEY]: state, selectedId }, render);
}
function load() {
  chrome.storage.local.get([STORE_KEY, 'selectedId'], (res) => {
    if (res[STORE_KEY]) state = res[STORE_KEY];
    selectedId = res.selectedId || (state.platforms[0] && state.platforms[0].id) || null;
    render();
  });
}

// ---------- Mismatch logic ----------
const sig = (d) => (d.closed ? 'closed' : `${d.open}-${d.close}`);
const hasHours = (p) => Object.values(p.hours).some((d) => !d.closed);

function dayMismatch(dayIdx) {
  const active = state.platforms.filter(hasHours);
  if (active.length < 2) return false;
  const sigs = new Set(active.map((p) => sig(p.hours[dayIdx])));
  return sigs.size > 1;
}

function consistencyScore() {
  const active = state.platforms.filter(hasHours);
  if (active.length < 2) return null;
  let agreed = 0;
  for (let d = 0; d < 7; d++) if (!dayMismatch(d)) agreed++;
  return Math.round((agreed / 7) * 100);
}

// ---------- Render ----------
function render() {
  renderScore();
  renderPlatforms();
  renderHours();
  renderHolidays();
  renderBanner();
}

function renderScore() {
  const score = consistencyScore();
  $('scoreVal').textContent = score === null ? '–' : score;
  $('scoreCard').querySelector('.score-ring').style.setProperty('--fill', (score || 0) + '%');
  $('scoreSub').textContent = score === null
    ? 'Add 2+ platforms to compare'
    : score === 100 ? 'All platforms match — nice!' : `${7 - countAgreed()} of 7 days mismatch`;
}
function countAgreed() {
  let n = 0;
  for (let d = 0; d < 7; d++) if (!dayMismatch(d)) n++;
  return n;
}

function renderPlatforms() {
  const list = $('platformList');
  if (!state.platforms.length) {
    list.innerHTML = '<p class="empty">No platforms yet. Add Google, Yelp, Facebook, your website…</p>';
    return;
  }
  list.innerHTML = '';
  state.platforms.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'platform-row';
    const active = hasHours(p);
    const mismatched = active && DAYS.some((_, d) => dayMismatch(d));
    const badge = !active ? '<span class="badge na">no hours</span>'
      : mismatched ? '<span class="badge bad">mismatch</span>'
      : '<span class="badge ok">matches</span>';
    row.innerHTML = `<span class="name"></span>${badge}`;
    row.querySelector('.name').textContent = p.name;
    if (p.id === selectedId) row.style.borderColor = 'rgba(245,158,11,0.5)';
    row.querySelector('.name').style.cursor = 'pointer';
    row.querySelector('.name').addEventListener('click', () => { selectedId = p.id; save(); });
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.title = 'Delete platform'; del.textContent = '✕';
    del.addEventListener('click', () => {
      if (!confirm(`Delete "${p.name}" and its hours?`)) return;
      state.platforms = state.platforms.filter((x) => x.id !== p.id);
      if (selectedId === p.id) selectedId = (state.platforms[0] && state.platforms[0].id) || null;
      save();
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

function renderHours() {
  const p = state.platforms.find((x) => x.id === selectedId);
  $('hoursPanel').classList.toggle('hidden', !p);
  if (!p) return;
  $('hoursTitle').textContent = `Hours · ${p.name}`;
  const wrap = $('dayRows');
  wrap.innerHTML = '';
  DAYS.forEach((name, i) => {
    const d = p.hours[i];
    const row = document.createElement('div');
    row.className = 'day-row' + (dayMismatch(i) ? ' mismatch' : '');
    row.innerHTML = `
      <span class="dname">${name}</span>
      <input type="time" data-k="open" value="${d.open}">
      <span class="dash">–</span>
      <input type="time" data-k="close" value="${d.close}">
      <label class="closed"><input type="checkbox" data-k="closed" ${d.closed ? 'checked' : ''}> Closed</label>`;
    row.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const k = inp.dataset.k;
        p.hours[i][k] = inp.type === 'checkbox' ? inp.checked : inp.value;
        save();
      });
    });
    wrap.appendChild(row);
  });
}

function renderHolidays() {
  const list = $('holidayList');
  const items = [...state.holidays].sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) {
    list.innerHTML = '<p class="empty">No holiday overrides. Add Diwali, Christmas, etc.</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach((h) => {
    const row = document.createElement('div');
    row.className = 'holiday-row';
    const hrs = h.closed ? 'Closed' : `${h.open}–${h.close}`;
    row.innerHTML = `<span class="date">${h.date}</span><span class="label"></span><span class="hrs">${hrs}</span>`;
    row.querySelector('.label').textContent = h.label || '—';
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.title = 'Delete override'; del.textContent = '✕';
    del.addEventListener('click', () => {
      state.holidays = state.holidays.filter((x) => x.id !== h.id);
      save();
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

function renderBanner() {
  const banner = $('mismatchBanner');
  const active = state.platforms.filter(hasHours);
  const badIdx = DAYS.map((_, d) => d).filter((d) => dayMismatch(d));
  banner.innerHTML = '';
  if (active.length < 2 || !badIdx.length) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  const strong = document.createElement('strong');
  strong.textContent = `⚠ Mismatch detected on ${badIdx.length} day${badIdx.length > 1 ? 's' : ''}:`;
  banner.appendChild(strong);
  const ul = document.createElement('ul');
  badIdx.forEach((d) => {
    const li = document.createElement('li');
    const b = document.createElement('strong');
    b.textContent = DAYS[d];
    li.appendChild(b);
    li.appendChild(document.createTextNode(' — ' + active.map((p) =>
      `${p.name}: ${p.hours[d].closed ? 'Closed' : p.hours[d].open + '–' + p.hours[d].close}`).join(' · ')));
    ul.appendChild(li);
  });
  banner.appendChild(ul);
}

// ---------- Events: platforms ----------
$('addPlatformBtn').addEventListener('click', () => {
  $('platformForm').classList.toggle('hidden');
  $('platformName').focus();
});
$('cancelPlatformBtn').addEventListener('click', () => {
  $('platformForm').classList.add('hidden');
  $('platformName').value = '';
});
$('savePlatformBtn').addEventListener('click', () => {
  const name = $('platformName').value.trim();
  if (!name) return;
  const p = { id: uid(), name, hours: blankHours() };
  state.platforms.push(p);
  selectedId = p.id;
  $('platformName').value = '';
  $('platformForm').classList.add('hidden');
  save();
});
$('copyHoursBtn').addEventListener('click', () => {
  const src = state.platforms.find((x) => x.id === selectedId);
  const others = state.platforms.filter((x) => x.id !== selectedId);
  if (!src || !others.length) return;
  const choice = prompt('Copy hours to which platform?\n' + others.map((p, i) => `${i + 1}. ${p.name}`).join('\n'));
  const idx = parseInt(choice, 10) - 1;
  if (others[idx]) {
    others[idx].hours = JSON.parse(JSON.stringify(src.hours));
    save();
  }
});

// ---------- Events: holidays ----------
$('addHolidayBtn').addEventListener('click', () => {
  $('holidayForm').classList.toggle('hidden');
});
$('cancelHolidayBtn').addEventListener('click', () => {
  $('holidayForm').classList.add('hidden');
});
$('holidayClosed').addEventListener('change', (e) => {
  $('holidayOpen').disabled = e.target.checked;
  $('holidayClose').disabled = e.target.checked;
});
$('saveHolidayBtn').addEventListener('click', () => {
  const date = $('holidayDate').value;
  if (!date) return;
  state.holidays.push({
    id: uid(),
    date,
    label: $('holidayLabel').value.trim(),
    closed: $('holidayClosed').checked,
    open: $('holidayOpen').value,
    close: $('holidayClose').value,
  });
  $('holidayDate').value = ''; $('holidayLabel').value = '';
  $('holidayClosed').checked = true;
  $('holidayOpen').disabled = true; $('holidayClose').disabled = true;
  $('holidayForm').classList.add('hidden');
  save();
});

// ---------- Export ----------
function download(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
}
$('exportJsonBtn').addEventListener('click', () => {
  download('store-hours.json', JSON.stringify(state, null, 2), 'application/json');
});
$('exportCsvBtn').addEventListener('click', () => {
  const rows = [['platform', 'day', 'open', 'close', 'closed']];
  state.platforms.forEach((p) => {
    DAYS.forEach((name, i) => {
      const d = p.hours[i];
      rows.push([p.name, name, d.open, d.close, d.closed ? 'yes' : 'no']);
    });
  });
  state.holidays.forEach((h) => {
    rows.push([`HOLIDAY ${h.date} ${h.label || ''}`.trim(), '', h.open, h.close, h.closed ? 'yes' : 'no']);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  download('store-hours.csv', csv, 'text/csv');
});

load();
