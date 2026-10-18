'use strict';

/* =========================================================
 * Launch Countdown — popup logic.
 * Your entries only: stores user-added launches locally,
 * counts down to the next upcoming one. No network.
 * ========================================================= */

// ENGINE-START
const NOTIFY_BEFORE_MS = 10 * 60 * 1000; // 10 minutes before liftoff

/** Build a launch record from raw fields. Returns null when invalid. */
function makeLaunch(name, dateStr, timeStr, rocket, site, notify) {
  const n = (name || '').trim();
  if (!n) return null;
  if (!dateStr) return null;
  const t = timeStr && timeStr.trim() ? timeStr.trim() : '00:00';
  const ts = new Date(`${dateStr}T${t}:00`).getTime();
  if (!Number.isFinite(ts)) return null;
  return {
    id: 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    name: n.slice(0, 80),
    ts,
    rocket: (rocket || '').trim().slice(0, 60),
    site: (site || '').trim().slice(0, 60),
    notify: notify !== false
  };
}

/** Split launches into upcoming (sorted) and past (sorted desc). */
function splitLaunches(launches, now) {
  const upcoming = launches.filter(l => l.ts >= now).sort((a, b) => a.ts - b.ts);
  const past = launches.filter(l => l.ts < now).sort((a, b) => b.ts - a.ts);
  return { upcoming, past };
}

/** Return the next upcoming launch or null. */
function nextLaunch(launches, now) {
  const { upcoming } = splitLaunches(launches, now);
  return upcoming.length ? upcoming[0] : null;
}

/** Break ms remaining into d/h/m/s parts (clamped at 0). */
function countdownParts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60
  };
}

/** Format a timestamp for list rows: "Oct 21, 2026 · 14:30". */
function fmtWhen(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}
// ENGINE-END

/* ---------------- storage + UI ---------------- */

const STORAGE_KEY = 'launchCountdown.launches.v1';

let launches = [];
let tickTimer = null;

async function loadLaunches() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  launches = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function saveLaunches() {
  await chrome.storage.local.set({ [STORAGE_KEY]: launches });
  // Tell the service worker to re-sync the liftoff alarm.
  chrome.runtime.sendMessage({ type: 'syncAlarm' }).catch(() => {});
}

const $ = id => document.getElementById(id);

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderLists() {
  const now = Date.now();
  const { upcoming, past } = splitLaunches(launches, now);
  const ul = $('upcoming');
  ul.innerHTML = '';
  if (!upcoming.length) {
    ul.innerHTML = '<li class="empty">No upcoming launches.</li>';
  } else {
    for (const l of upcoming) {
      const sub = [l.rocket, l.site].filter(Boolean).join(' · ');
      const li = document.createElement('li');
      li.innerHTML =
        `<div class="info"><div class="name">${escapeHtml(l.name)}</div>` +
        `<div class="when">${fmtWhen(l.ts)}${sub ? ` <em>${escapeHtml(sub)}</em>` : ''}</div></div>` +
        `<button class="del" data-id="${l.id}" title="Delete" aria-label="Delete">✕</button>`;
      ul.appendChild(li);
    }
  }
  const pl = $('past');
  pl.innerHTML = '';
  if (!past.length) {
    pl.innerHTML = '<li class="empty">No past launches.</li>';
  } else {
    for (const l of past.slice(0, 10)) {
      const li = document.createElement('li');
      li.innerHTML =
        `<div class="info"><div class="name">${escapeHtml(l.name)}</div>` +
        `<div class="when">${fmtWhen(l.ts)}</div></div>` +
        `<button class="del" data-id="${l.id}" title="Delete" aria-label="Delete">✕</button>`;
      pl.appendChild(li);
    }
  }
  document.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      launches = launches.filter(x => x.id !== btn.dataset.id);
      await saveLaunches();
      renderAll();
    });
  });
}

function renderNext() {
  const now = Date.now();
  const n = nextLaunch(launches, now);
  if (!n) {
    $('nextName').textContent = 'No launches yet';
    $('nextMeta').textContent = 'Add one below to start the countdown.';
    $('countdown').hidden = true;
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    return;
  }
  const sub = [n.rocket, n.site].filter(Boolean).join(' · ');
  $('nextName').textContent = n.name;
  $('nextMeta').textContent = fmtWhen(n.ts) + (sub ? ` — ${sub}` : '');
  $('countdown').hidden = false;
  const update = () => {
    const p = countdownParts(n.ts - Date.now());
    $('cdD').textContent = p.d;
    $('cdH').textContent = String(p.h).padStart(2, '0');
    $('cdM').textContent = String(p.m).padStart(2, '0');
    $('cdS').textContent = String(p.s).padStart(2, '0');
    if (n.ts - Date.now() <= 0) { renderAll(); } // rolled into "past"
  };
  if (tickTimer) clearInterval(tickTimer);
  update();
  tickTimer = setInterval(update, 1000);
}

function renderAll() {
  renderNext();
  renderLists();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadLaunches();
  // Default date input to tomorrow.
  const t = new Date();
  t.setDate(t.getDate() + 1);
  $('inDate').value = t.toISOString().slice(0, 10);
  $('inTime').value = '12:00';

  $('btnAdd').addEventListener('click', async () => {
    const l = makeLaunch(
      $('inName').value, $('inDate').value, $('inTime').value,
      $('inRocket').value, $('inSite').value, $('inNotify').checked
    );
    if (!l) {
      $('inName').focus();
      $('inName').style.borderColor = '#ff6b6b';
      setTimeout(() => { $('inName').style.borderColor = ''; }, 1200);
      return;
    }
    launches.push(l);
    await saveLaunches();
    $('inName').value = '';
    $('inRocket').value = '';
    $('inSite').value = '';
    renderAll();
  });

  renderAll();
});
