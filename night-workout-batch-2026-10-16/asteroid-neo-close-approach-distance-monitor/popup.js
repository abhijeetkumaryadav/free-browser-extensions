// ============================================================================
// NEO Close-Approach Journal — popup logic
// Fully local: entries the user types; nothing fetched, nothing sent.
// ============================================================================

// ENGINE-START
const STORE_KEY = 'neo_approaches_v1';
const LD_KM = 384400; // km per lunar distance

// Build a validated approach entry. Returns null if invalid.
function makeApproach(name, dateStr, timeStr, distLd, size, notes) {
  const n = (name || '').trim();
  if (!n) return null;
  const when = new Date(`${dateStr}T${timeStr || '00:00'}`);
  if (Number.isNaN(when.getTime())) return null;
  const dist = distLd === '' || distLd == null ? null : Number(distLd);
  if (dist !== null && (!Number.isFinite(dist) || dist < 0)) return null;
  return {
    id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    name: n,
    when: when.getTime(),
    distLd: dist,
    size: (size || '').trim(),
    notes: (notes || '').trim(),
  };
}

// Split entries into upcoming (soonest first) and past (latest first).
function splitApproaches(entries, nowMs) {
  const up = [], past = [];
  for (const e of entries) (e.when >= nowMs ? up : past).push(e);
  up.sort((a, b) => a.when - b.when);
  past.sort((a, b) => b.when - a.when);
  return { upcoming: up, past };
}

// Parts of a countdown to a future timestamp. Returns null if past.
function countdownParts(targetMs, nowMs) {
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

function fmtCountdown(p) {
  if (!p) return 'passed';
  return `${p.days}d ${String(p.hours).padStart(2, '0')}h ${String(p.mins).padStart(2, '0')}m ${String(p.secs).padStart(2, '0')}s`;
}

function fmtWhen(ms) {
  const d = new Date(ms);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDist(ld) {
  if (ld === null || ld === undefined) return '—';
  const km = ld * LD_KM;
  return `${ld} LD (~${km >= 1e6 ? (km / 1e6).toFixed(1) + 'M' : Math.round(km).toLocaleString()} km)`;
}
// ENGINE-END

// --- UI --------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

async function load() {
  const { [STORE_KEY]: entries = [] } = await chrome.storage.local.get(STORE_KEY);
  return entries;
}
async function save(entries) {
  await chrome.storage.local.set({ [STORE_KEY]: entries });
}

function render() {
  load().then((entries) => {
    const now = Date.now();
    const { upcoming, past } = splitApproaches(entries, now);

    $('count').textContent = `(${entries.length})`;
    const next = upcoming[0];
    if (next) {
      $('nextName').textContent = next.name;
      $('nextCountdown').textContent = fmtCountdown(countdownParts(next.when, now));
      $('nextMeta').textContent = `${fmtWhen(next.when)} · ${fmtDist(next.distLd)}`;
    } else {
      $('nextName').textContent = '—';
      $('nextCountdown').textContent = '—';
      $('nextMeta').textContent = past.length ? 'All logged approaches are in the past.' : 'Log one above to start.';
    }

    const list = $('list');
    list.innerHTML = '';
    const ordered = [...upcoming, ...past];
    $('empty').style.display = ordered.length ? 'none' : '';
    for (const e of ordered) {
      const li = document.createElement('li');
      li.className = 'item';
      const isPast = e.when < now;
      li.innerHTML = `
        <div class="item-top">
          <div>
            <div class="item-name"></div>
            <div class="item-date"></div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="badge ${isPast ? 'past' : ''}">${isPast ? 'past' : fmtCountdown(countdownParts(e.when, now))}</span>
            <button class="del" title="Delete">×</button>
          </div>
        </div>
        ${e.notes ? '<div class="item-note"></div>' : ''}
      `;
      li.querySelector('.item-name').textContent = e.name;
      li.querySelector('.item-date').textContent = `${fmtWhen(e.when)} · ${fmtDist(e.distLd)}${e.size ? ' · ' + e.size : ''}`;
      if (e.notes) li.querySelector('.item-note').textContent = e.notes;
      li.querySelector('.del').addEventListener('click', async () => {
        await save((await load()).filter((x) => x.id !== e.id));
        render();
      });
      list.appendChild(li);
    }
  });
}

$('addForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const entry = makeApproach($('fName').value, $('fDate').value, $('fTime').value, $('fDist').value, $('fSize').value, $('fNotes').value);
  if (!entry) return;
  const entries = await load();
  entries.push(entry);
  await save(entries);
  $('addForm').reset();
  $('fTime').value = '00:00';
  render();
});

render();
setInterval(render, 1000);
