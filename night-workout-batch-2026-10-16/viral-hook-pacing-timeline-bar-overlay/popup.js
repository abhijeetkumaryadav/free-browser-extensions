/* ============================================================================
 * HookPace — popup logic
 * Manual pacing analysis: the user logs beats, the popup visualizes spacing
 * and offers heuristic pacing guidance. 100% local, zero network.
 * ========================================================================== */
'use strict';

const $ = (id) => document.getElementById(id);

const BEAT_TYPES = {
  hook:   { label: 'Hook',   color: '#f472b6' },
  build:  { label: 'Build',  color: '#38bdf8' },
  payoff: { label: 'Payoff', color: '#4ade80' },
  cta:    { label: 'CTA',    color: '#fbbf24' },
  note:   { label: 'Note',   color: '#a78bfa' },
};

const STORAGE_KEY = 'hookpace.session.v1';

let session = { title: '', duration: 0, startTime: 0, beats: [] };
let clockTimer = null;

/* ------------------------------ persistence ------------------------------ */
async function loadSession() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (data[STORAGE_KEY] && typeof data[STORAGE_KEY] === 'object') {
    session = Object.assign(session, data[STORAGE_KEY]);
  }
}

async function saveSession() {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

/* --------------------------------- helpers ------------------------------- */
function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function elapsed() {
  if (!session.startTime) return 0;
  return (Date.now() - session.startTime) / 1000;
}

function startClock() {
  stopClock();
  clockTimer = setInterval(() => { $('clock').textContent = fmt(elapsed()); }, 500);
  $('clock').textContent = fmt(elapsed());
}

function stopClock() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ------------------------------ session flow ----------------------------- */
async function startSession() {
  const title = $('titleInput').value.trim();
  const duration = Math.max(5, Math.min(86400, parseInt($('durationInput').value, 10) || 0));
  if (!duration) {
    $('durationInput').classList.add('flash');
    setTimeout(() => $('durationInput').classList.remove('flash'), 600);
    $('durationInput').focus();
    return;
  }
  session = { title: title || 'Untitled session', duration, startTime: Date.now(), beats: [] };
  await saveSession();
  render();
  startClock();
}

async function resetSession() {
  session = { title: '', duration: 0, startTime: 0, beats: [] };
  $('titleInput').value = '';
  $('durationInput').value = '';
  $('clock').textContent = '00:00';
  stopClock();
  await saveSession();
  render();
}

async function logBeat(type) {
  if (!session.startTime) {
    // Nudge the user to start a session first.
    $('startBtn').classList.add('pulse');
    setTimeout(() => $('startBtn').classList.remove('pulse'), 1400);
    return;
  }
  const t = Math.round(Math.min(elapsed(), session.duration));
  let label = BEAT_TYPES[type].label;
  if (type === 'note') {
    const custom = prompt('Note label (optional):', 'Note');
    if (custom === null) return; // user cancelled
    label = custom.trim() || 'Note';
  }
  session.beats.push({ t, type, label });
  session.beats.sort((a, b) => a.t - b.t);
  await saveSession();
  render();
}

async function deleteBeat(index) {
  session.beats.splice(index, 1);
  await saveSession();
  render();
}

/* ------------------------------ guidance --------------------------------- */
/* Heuristic pacing rules applied to the USER's own logged beats. */
function computeGuidance() {
  const tips = [];
  const beats = session.beats;
  const dur = session.duration || 60;

  if (!beats.length) {
    tips.push({
      level: 'info',
      text: 'Log beats while you watch — patterns you notice are your own analysis, not a platform signal.',
    });
    return tips;
  }

  const hooks = beats.filter((b) => b.type === 'hook');
  if (!hooks.some((h) => h.t <= 5)) {
    tips.push({
      level: 'warn',
      text: 'No hook in the first 5 seconds — viewers decide fast. Tighten the opening or log an earlier hook.',
    });
  }

  const lull = Math.max(15, dur * 0.25);
  for (let i = 1; i < beats.length; i++) {
    const gap = beats[i].t - beats[i - 1].t;
    if (gap > lull) {
      tips.push({
        level: 'warn',
        text: `${fmt(gap)} lull between \u201c${beats[i - 1].label}\u201d (${fmt(beats[i - 1].t)}) and \u201c${beats[i].label}\u201d (${fmt(beats[i].t)}) — consider a bridge beat.`,
      });
    }
  }

  if (!beats.some((b) => b.type === 'payoff' && b.t <= dur * 0.85)) {
    tips.push({
      level: 'info',
      text: 'No payoff logged before the final stretch — deliver the payoff before ~85% of runtime.',
    });
  }

  if (!beats.some((b) => b.type === 'cta')) {
    tips.push({ level: 'info', text: 'No CTA logged — end with a clear call to action.' });
  }

  for (let i = 1; i < beats.length; i++) {
    if (beats[i].t - beats[i - 1].t < 3 && beats[i].type !== 'note' && beats[i - 1].type !== 'note') {
      tips.push({ level: 'info', text: 'Some beats are under 3s apart — let big moments breathe.' });
      break;
    }
  }

  return tips.slice(0, 6);
}

/* --------------------------------- render -------------------------------- */
function render() {
  $('titleInput').value = session.title || '';
  $('durationInput').value = session.duration || '';
  $('beatCount').textContent = session.beats.length;

  renderTimeline();
  renderGuidance();
  renderBeatList();
}

function renderTimeline() {
  const tl = $('timeline');
  tl.innerHTML = '';
  const dur = session.duration || 0;
  if (!session.beats.length || !dur) {
    tl.innerHTML = '<div class="tl-empty">No beats yet — start a session and log them.</div>';
    return;
  }

  const track = document.createElement('div');
  track.className = 'tl-track';
  tl.appendChild(track);

  const lull = Math.max(15, dur * 0.25);
  const beats = session.beats;

  // Highlight long gaps first (behind markers).
  for (let i = 1; i < beats.length; i++) {
    const gap = beats[i].t - beats[i - 1].t;
    if (gap > lull) {
      const g = document.createElement('div');
      g.className = 'tl-gap';
      g.style.left = `calc(10px + (100% - 20px) * ${beats[i - 1].t / dur})`;
      g.style.width = `calc((100% - 20px) * ${gap / dur})`;
      g.title = `Lull: ${fmt(gap)}`;
      tl.appendChild(g);
    }
  }

  beats.forEach((b) => {
    const m = document.createElement('div');
    m.className = 'tl-marker';
    m.style.setProperty('--c', BEAT_TYPES[b.type].color);
    m.style.left = `calc(10px + (100% - 20px) * ${b.t / dur})`;
    m.title = `${b.label} @ ${fmt(b.t)}`;
    tl.appendChild(m);

    const lbl = document.createElement('div');
    lbl.className = 'tl-label';
    lbl.style.left = m.style.left;
    lbl.textContent = fmt(b.t);
    tl.appendChild(lbl);
  });
}

function renderGuidance() {
  const box = $('guidance');
  const tips = computeGuidance();
  box.innerHTML = tips.map((t) => `
    <div class="tip ${t.level}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        ${t.level === 'warn'
          ? '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'
          : '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'}
      </svg>
      <span>${esc(t.text)}</span>
    </div>`).join('');
}

function renderBeatList() {
  const ul = $('beatList');
  if (!session.beats.length) {
    ul.innerHTML = '<li class="empty">Nothing logged yet.</li>';
    return;
  }
  ul.innerHTML = '';
  session.beats.forEach((b, i) => {
    const li = document.createElement('li');
    li.className = 'beat-item';
    li.innerHTML = `
      <span class="time">${fmt(b.t)}</span>
      <span class="tag" style="--c:${BEAT_TYPES[b.type].color}">${esc(BEAT_TYPES[b.type].label)}</span>
      <span class="lbl" title="${esc(b.label)}">${esc(b.label)}</span>
      <button class="del" data-i="${i}" title="Delete beat">&times;</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.del').forEach((btn) => {
    btn.addEventListener('click', () => deleteBeat(parseInt(btn.dataset.i, 10)));
  });
}

/* ------------------------------ page overlay ----------------------------- */
async function drawOverlay() {
  if (!session.beats.length) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome:|^edge:|^about:/.test(tab.url || '')) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, {
      action: 'hookpace-draw',
      beats: session.beats,
      duration: session.duration,
      title: session.title,
      colors: Object.fromEntries(Object.entries(BEAT_TYPES).map(([k, v]) => [k, v.color])),
    });
  } catch (e) {
    // Overlay is a nicety; the popup timeline is the core tool.
    console.warn('HookPace overlay failed:', e);
  }
}

/* --------------------------------- export -------------------------------- */
function exportJSON() {
  const payload = {
    tool: 'HookPace',
    exportedAt: new Date().toISOString(),
    title: session.title,
    durationSeconds: session.duration,
    beats: session.beats,
    guidance: computeGuidance().map((t) => t.text),
    note: 'Manual analysis — beats logged by the user; guidance is heuristic.',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hookpace-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------------------------- init --------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadSession();
  render();
  if (session.startTime) startClock();

  $('startBtn').addEventListener('click', startSession);
  $('resetBtn').addEventListener('click', resetSession);
  $('overlayBtn').addEventListener('click', drawOverlay);
  $('exportBtn').addEventListener('click', exportJSON);
  $('clearBeatsBtn').addEventListener('click', async () => {
    session.beats = [];
    await saveSession();
    render();
  });

  document.querySelectorAll('.beat').forEach((btn) => {
    btn.addEventListener('click', () => logBeat(btn.dataset.type));
  });
});
