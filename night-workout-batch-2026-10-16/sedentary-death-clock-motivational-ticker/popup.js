'use strict';
/* ============================================================
   Move Ticker — sedentary-time tracker (motivational, not medical)
   Tracks time since the user's last SELF-LOGGED movement break.
   ============================================================ */

// ENGINE-START
/** Thresholds in minutes → phase label + rotating motivational prompt. */
const PHASES = [
  { until: 30,   label: "You're fresh — keep it up.", prompts: [
    "Nice streak. Hydrate while you're at it.",
    "Good pace. Your future self says thanks." ] },
  { until: 60,   label: 'Settling in — consider a stretch.', prompts: [
    "Roll your shoulders. Feels good, promise.",
    "A 60-second walk beats another hour of sitting." ] },
  { until: 120,  label: 'Time for a movement break.', prompts: [
    "Stand up. Walk to the window. Come back sharper.",
    "Your legs miss you. Go say hi — 2 minutes is enough." ] },
  { until: Infinity, label: 'Long stretch — move now!', prompts: [
    "Seriously, stand up. The work will wait.",
    "Move for 5 minutes. You'll thank yourself in an hour." ] },
];

/** Pick phase + prompt for elapsed minutes (deterministic pick via minute bucket). */
function phaseFor(elapsedMin) {
  const phase = PHASES.find((p) => elapsedMin < p.until);
  const idx = Math.floor(elapsedMin / 15) % phase.prompts.length;
  return { label: phase.label, prompt: phase.prompts[idx] };
}

/** h:mm:ss formatting for elapsed seconds. */
function fmtElapsed(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return `${h}:${mm}:${ss}`;
}

/** "1h 23m" compact formatting for stats. */
function fmtShort(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
  if (h === 0 && m === 0) return '< 1m';
  return (h ? h + 'h ' : '') + m + 'm';
}

const DAY = 86400000;
function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Compute today's stats from break timestamps (sorted asc). */
function todayStats(breaks, now) {
  const key = dayKey(now);
  const todays = breaks.filter((b) => dayKey(b) === key).sort((a, b) => a - b);
  if (!todays.length) return { count: 0, longest: null, avg: null };
  // gaps: from midnight to first break, between breaks, last break → now
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const points = [start.getTime(), ...todays, now];
  const gaps = [];
  for (let i = 1; i < points.length; i++) gaps.push((points[i] - points[i - 1]) / 1000);
  const longest = Math.max(...gaps);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return { count: todays.length, longest, avg, todays };
}
// ENGINE-END

/* ---------------- UI ---------------- */
const $ = (id) => document.getElementById(id);
let lastBreakTs = null;
let timer = null;

function tick() {
  if (lastBreakTs == null) return;
  const elapsedSec = (Date.now() - lastBreakTs) / 1000;
  $('elapsed').textContent = fmtElapsed(elapsedSec);
  const { label, prompt } = phaseFor(elapsedSec / 60);
  $('phase').textContent = label;
  $('prompt').textContent = '"' + prompt + '"';
  // bar fills over a 2h scale
  $('bar').style.width = Math.min(100, (elapsedSec / 7200) * 100) + '%';
}

function renderHistory(stats) {
  const list = $('list');
  list.innerHTML = '';
  $('empty').style.display = stats.count ? 'none' : 'block';
  $('todayCount').textContent = stats.count;
  $('longest').textContent = stats.longest == null ? '—' : fmtShort(stats.longest);
  $('avg').textContent = stats.avg == null ? '—' : fmtShort(stats.avg);
  for (const ts of (stats.todays || []).slice().reverse()) {
    const li = document.createElement('li');
    const a = document.createElement('span'); a.textContent = 'Movement break';
    const t = document.createElement('span'); t.className = 't';
    t.textContent = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.append(a, t);
    list.appendChild(li);
  }
}

function refresh() {
  chrome.storage.local.get({ breaks: [], lastBreak: null }, (d) => {
    lastBreakTs = d.lastBreak;
    if (lastBreakTs == null) {
      // first run: start the clock now
      lastBreakTs = Date.now();
      chrome.storage.local.set({ lastBreak: lastBreakTs });
    }
    tick();
    renderHistory(todayStats(d.breaks, Date.now()));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  refresh();
  timer = setInterval(tick, 1000);

  $('logBreak').addEventListener('click', () => {
    const now = Date.now();
    chrome.storage.local.get({ breaks: [], lastBreak: null }, (d) => {
      const breaks = [...d.breaks, now].slice(-500);
      chrome.storage.local.set({ breaks, lastBreak: now }, refresh);
    });
  });

  $('reset').addEventListener('click', () => {
    const now = Date.now();
    lastBreakTs = now;
    chrome.storage.local.set({ lastBreak: now }, tick);
  });

  $('clear').addEventListener('click', () => {
    chrome.storage.local.get({ breaks: [] }, (d) => {
      const key = dayKey(Date.now());
      const kept = d.breaks.filter((b) => dayKey(b) !== key);
      chrome.storage.local.set({ breaks: kept }, refresh);
    });
  });
});
