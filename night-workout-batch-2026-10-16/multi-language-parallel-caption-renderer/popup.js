/* Parallel Captions — dual caption viewer.
 * Scope: renders two user-supplied caption tracks side by side, synced by
 * timing with a user-adjustable offset. No machine translation happens here;
 * alignment is by paragraph order, not meaning. */

// ---------- Caption parsing (SRT / WebVTT / plain text) ----------
function tsToMs(ts) {
  // "01:02:03,500" | "01:02:03.500" | "02:03.500" | "123.5"
  const clean = ts.trim().replace('.', ',');
  const parts = clean.split(':');
  let ms = 0;
  if (parts.length === 3) {
    ms = (parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60) * 1000;
    ms += Math.round(parseFloat(parts[2].replace(',', '.')) * 1000);
  } else if (parts.length === 2) {
    ms = (parseInt(parts[0], 10) * 60) * 1000 +
      Math.round(parseFloat(parts[1].replace(',', '.')) * 1000);
  } else {
    ms = Math.round(parseFloat(parts[0].replace(',', '.')) * 1000);
  }
  return isNaN(ms) ? null : ms;
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, '').trim();
}

function parseTimed(text) {
  // Split into blocks; each block may start with an SRT index line,
  // then a "start --> end" line, then caption text lines.
  const cues = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    let i = 0;
    if (/^\d+$/.test(lines[0]) && lines.length > 1 && lines[1].includes('-->')) i = 1;
    const m = lines[i] && lines[i].match(/(\S+)\s*-->\s*(\S+)/);
    if (!m) continue;
    const start = tsToMs(m[1]);
    const end = tsToMs(m[2]);
    if (start === null || end === null) continue;
    const body = lines.slice(i + 1).map(stripTags).join('\n');
    if (!body) continue;
    cues.push({ start, end, text: body });
  }
  return cues;
}

function parsePlain(text) {
  // Plain text: blank line separates paragraphs. Spread them evenly so the
  // viewer still has something to step through; times are synthetic and the
  // notice banner explains alignment is by order.
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/)
    .map(p => p.trim()).filter(Boolean);
  return paras.map((p, i) => ({ start: i * 4000, end: i * 4000 + 3800, text: p }));
}

function parseCaptions(text) {
  if (/-->\s*\d/.test(text) || /\d{2}:\d{2}/.test(text.split('\n')[0] || '')) {
    const cues = parseTimed(text);
    if (cues.length) return cues;
  }
  const cues = parseTimed(text);
  return cues.length ? cues : parsePlain(text);
}

// ---------- Player state ----------
const state = {
  cuesA: [], cuesB: [],
  nameA: 'Track A', nameB: 'Track B',
  offsetMs: 0,
  playing: false,
  t: 0,            // playback position in ms (virtual timeline)
  lastTick: 0,
  duration: 0,
  raf: 0,
};

function cueAt(cues, t) {
  for (const c of cues) {
    if (t >= c.start && t <= c.end) return c;
  }
  return null;
}

function fmt(t) {
  const s = Math.max(0, t / 1000);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return String(m).padStart(2, '0') + ':' + sec;
}

function computeDuration() {
  const ends = [...state.cuesA.map(c => c.end), ...state.cuesB.map(c => c.end)];
  state.duration = ends.length ? Math.max(...ends) : 0;
}

function render() {
  const cueA = cueAt(state.cuesA, state.t);
  const cueB = cueAt(state.cuesB, state.t + state.offsetMs);
  const elA = document.getElementById('capA');
  const elB = document.getElementById('capB');
  elA.textContent = cueA ? cueA.text : (state.cuesA.length ? '…' : 'Load a track to begin.');
  elB.textContent = cueB ? cueB.text : (state.cuesB.length ? '…' : 'Load a track to begin.');
  elA.classList.toggle('active', !!cueA);
  elB.classList.toggle('active', !!cueB);
  document.getElementById('timeNow').textContent = fmt(state.t);
  document.getElementById('timeEnd').textContent = fmt(state.duration);
  const seek = document.getElementById('seek');
  seek.value = state.duration ? Math.round((state.t / state.duration) * 1000) : 0;
}

function tick(now) {
  if (!state.playing) return;
  const dt = now - state.lastTick;
  state.lastTick = now;
  state.t += dt;
  if (state.t >= state.duration) {
    state.t = state.duration;
    setPlaying(false);
  }
  render();
  state.raf = requestAnimationFrame(tick);
}

function setPlaying(on) {
  state.playing = on;
  document.getElementById('playIcon').classList.toggle('hidden', on);
  document.getElementById('pauseIcon').classList.toggle('hidden', !on);
  if (on) {
    if (state.t >= state.duration) state.t = 0;
    state.lastTick = performance.now();
    state.raf = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(state.raf);
  }
}

async function loadTrack(file, which) {
  const text = await file.text();
  const cues = parseCaptions(text);
  if (which === 'A') {
    state.cuesA = cues;
    state.nameA = file.name;
    document.getElementById('labelA').textContent = file.name;
  } else {
    state.cuesB = cues;
    state.nameB = file.name;
    document.getElementById('labelB').textContent = file.name;
  }
  computeDuration();
  state.t = 0;
  setPlaying(false);
  // Persist cue text (small captions; avoids re-upload every open).
  try {
    await chrome.storage.local.set({
      ['captions' + which]: { name: file.name, cues: cues.slice(0, 2000) },
    });
  } catch (e) { /* quota exceeded: session-only */ }
  render();
}

// ---------- Wiring ----------
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  $('settingsBtn').addEventListener('click', () => $('loadPanel').classList.toggle('hidden'));
  $('playBtn').addEventListener('click', () => setPlaying(!state.playing));
  $('seek').addEventListener('input', e => {
    state.t = Math.round((parseInt(e.target.value, 10) / 1000) * state.duration);
    render();
  });
  $('offset').addEventListener('input', e => {
    state.offsetMs = parseInt(e.target.value, 10);
    const s = (state.offsetMs / 1000);
    $('offsetVal').textContent = (s >= 0 ? '+' : '') + s.toFixed(1) + 's';
    render();
  });
  $('fileA').addEventListener('change', e => { if (e.target.files[0]) loadTrack(e.target.files[0], 'A'); });
  $('fileB').addEventListener('change', e => { if (e.target.files[0]) loadTrack(e.target.files[0], 'B'); });

  // Restore previously loaded tracks.
  try {
    const saved = await chrome.storage.local.get(['captionsA', 'captionsB']);
    if (saved.captionsA) {
      state.cuesA = saved.captionsA.cues;
      $('labelA').textContent = saved.captionsA.name;
    }
    if (saved.captionsB) {
      state.cuesB = saved.captionsB.cues;
      $('labelB').textContent = saved.captionsB.name;
    }
    computeDuration();
  } catch (e) { /* storage unavailable: start empty */ }
  render();
});
