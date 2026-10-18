/* ISS Pass Countdown — manual pass-time countdown.
   Your times only — NOT live tracking. Notifications fire via chrome.alarms. */
'use strict';

/* ---------- Pure engine (testable, no DOM/chrome) ---------- */
// ENGINE-START
const NOTIFY_BEFORE_MS = 5 * 60 * 1000;

/** Build a pass record from date/time inputs. Returns {ok, pass} or {ok:false, error}. */
function makePass(dateStr, timeStr, elevation, note) {
  if (!dateStr || !timeStr) return { ok: false, error: 'Date and time are required.' };
  const when = new Date(dateStr + 'T' + timeStr);
  if (isNaN(when)) return { ok: false, error: 'Invalid date/time.' };
  const el = elevation === '' || elevation == null ? null : Number(elevation);
  if (el !== null && (isNaN(el) || el < 0 || el > 90)) return { ok: false, error: 'Elevation must be 0–90.' };
  return {
    ok: true,
    pass: {
      id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      when: when.getTime(),
      elevation: el,
      note: (note || '').trim()
    }
  };
}

/** Sort passes ascending by time. */
function sortPasses(list) {
  return [...list].sort((a, b) => a.when - b.when);
}

/** First pass with when > now, or null. */
function nextPass(list, now) {
  const sorted = sortPasses(list);
  return sorted.find(p => p.when > now) || null;
}

/** Split into past / upcoming relative to now. */
function splitPast(list, now) {
  return { past: list.filter(p => p.when <= now), upcoming: list.filter(p => p.when > now) };
}

/** Countdown parts from ms remaining. */
function countdownParts(ms) {
  ms = Math.max(0, ms);
  const total = Math.floor(ms / 1000);
  return {
    d: Math.floor(total / 86400),
    h: Math.floor(total % 86400 / 3600),
    m: Math.floor(total % 3600 / 60),
    s: total % 60
  };
}

/** Format countdown parts as "2d 4h 13m 05s". */
function fmtCountdown(p) {
  const mm = String(p.m).padStart(2, '0');
  const ss = String(p.s).padStart(2, '0');
  return `${p.d}d ${p.h}h ${mm}m ${ss}s`;
}

/** Local date+time for a timestamp. */
function fmtWhen(ts) {
  return new Date(ts).toLocaleString(undefined,
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// ENGINE-END

/* ---------- Popup UI ---------- */
const $ = id => document.getElementById(id);
const els = {
  countdown: $('countdown'), nextDetail: $('nextDetail'), nextCard: $('nextCard'),
  passDate: $('passDate'), passTime: $('passTime'), elevation: $('elevation'), note: $('note'),
  add: $('addBtn'), notify: $('notifyBtn'), list: $('list'), empty: $('empty'), count: $('count')
};
let passes = [];
let notifyArmed = false;
let tick = null;

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function load() {
  const { passes: saved = [], notifyArmed: armed = false } = await chrome.storage.local.get(['passes', 'notifyArmed']);
  passes = Array.isArray(saved) ? saved : [];
  notifyArmed = !!armed;
  // Move already-past passes out of upcoming (keep them as log, don't delete)
  updateNotifyBtn();
  render();
  tick = setInterval(renderNext, 1000);
}

async function save() {
  await chrome.storage.local.set({ passes });
}

async function updateNotifyBtn() {
  els.notify.textContent = notifyArmed ? 'Notify armed ✓ (5 min before)' : 'Notify 5 min before';
  els.notify.classList.toggle('active', notifyArmed);
}

/** Ask background to schedule/cancel the pre-pass notification. */
function syncAlarm() {
  chrome.runtime.sendMessage({ type: 'syncAlarm', notifyArmed }).catch(() => {});
}

function renderNext() {
  const now = Date.now();
  const np = nextPass(passes, now);
  if (!np) {
    els.countdown.textContent = '—';
    els.nextDetail.textContent = 'No upcoming passes. Add one below.';
    return;
  }
  els.countdown.textContent = fmtCountdown(countdownParts(np.when - now));
  els.nextDetail.textContent = fmtWhen(np.when) +
    (np.elevation != null ? ` · max ${np.elevation}°` : '') +
    (np.note ? ` · ${np.note}` : '');
}

function render() {
  renderNext();
  const now = Date.now();
  const sorted = sortPasses(passes);
  const np = nextPass(passes, now);
  els.list.innerHTML = '';
  sorted.forEach(p => {
    const past = p.when <= now;
    const li = document.createElement('li');
    li.className = 'item' + (past ? ' past' : '') + (np && p.id === np.id ? ' next' : '');
    li.innerHTML =
      `<div class="when">${esc(fmtWhen(p.when))}${past ? ' · passed' : ''}</div>
       <div class="meta">${p.elevation != null ? `max ${esc(p.elevation)}°` : 'elevation —'}${p.note ? ` · ${esc(p.note)}` : ''}</div>
       <div class="ops"><button class="del" data-id="${p.id}">Delete</button></div>`;
    els.list.appendChild(li);
  });
  els.list.querySelectorAll('.del').forEach(btn =>
    btn.addEventListener('click', async () => {
      passes = passes.filter(p => p.id !== btn.dataset.id);
      await save();
      syncAlarm();
      render();
    }));
  els.empty.style.display = sorted.length ? 'none' : 'block';
  els.count.textContent = `${sorted.length} pass${sorted.length === 1 ? '' : 'es'}`;
}

els.add.addEventListener('click', async () => {
  const res = makePass(els.passDate.value, els.passTime.value, els.elevation.value, els.note.value);
  if (!res.ok) {
    els.passDate.focus();
    return;
  }
  passes.push(res.pass);
  await save();
  els.passDate.value = ''; els.passTime.value = ''; els.elevation.value = ''; els.note.value = '';
  syncAlarm();
  render();
});

els.notify.addEventListener('click', async () => {
  notifyArmed = !notifyArmed;
  await chrome.storage.local.set({ notifyArmed });
  syncAlarm();
  updateNotifyBtn();
});

window.addEventListener('unload', () => clearInterval(tick));
load();
