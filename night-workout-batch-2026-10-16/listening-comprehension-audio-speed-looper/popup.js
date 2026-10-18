'use strict';
/* Listening Looper — local audio playback with variable speed, A/B looping and
 * skip buttons. All logic runs in the popup; the file is played from a
 * same-session object URL and never uploaded or persisted. */

// ---------------------------------------------------------------- helpers
// ENGINE-START
/** Format seconds as m:ss. */
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

/** Clamp a playback rate to the supported range [0.5, 1.5]. */
function clampRate(r) {
  r = Number(r);
  if (!isFinite(r)) return 1;
  return Math.min(1.5, Math.max(0.5, r));
}

/** Decide whether the A/B loop is currently valid (a < b, both finite). */
function abValid(a, b) {
  return isFinite(a) && isFinite(b) && a < b;
}
// ENGINE-END

const $ = (id) => document.getElementById(id);

const els = {
  fileInput: $('fileInput'), fileLabel: $('fileLabel'), trackName: $('trackName'),
  btnPlay: $('btnPlay'), icoPlay: $('icoPlay'), icoPause: $('icoPause'),
  btnBack5: $('btnBack5'), btnBack10: $('btnBack10'),
  btnFwd5: $('btnFwd5'), btnFwd10: $('btnFwd10'),
  seek: $('seek'), tCur: $('tCur'), tDur: $('tDur'),
  speed: $('speed'), speedVal: $('speedVal'),
  btnSetA: $('btnSetA'), btnSetB: $('btnSetB'), btnClearAB: $('btnClearAB'),
  aVal: $('aVal'), bVal: $('bVal'), btnLoop: $('btnLoop'),
};

// Offscreen audio element (kept outside the DOM layout).
const audio = new Audio();
audio.preload = 'metadata';

const state = { url: null, a: NaN, b: NaN, loop: false, loaded: false };

/** Refresh which controls are enabled based on load state. */
function refreshEnabled() {
  const dis = !state.loaded;
  [els.btnPlay, els.btnBack5, els.btnBack10, els.btnFwd5, els.btnFwd10,
   els.seek, els.btnSetA, els.btnSetB, els.btnClearAB, els.btnLoop]
    .forEach((b) => { b.disabled = dis; });
}

/** Update the play/pause glyph. */
function refreshPlayGlyph() {
  const paused = audio.paused;
  els.icoPlay.hidden = !paused;
  els.icoPause.hidden = paused;
}

/** Update A/B readouts and the loop button label. */
function refreshAB() {
  els.aVal.textContent = isFinite(state.a) ? fmtTime(state.a) : '—';
  els.bVal.textContent = isFinite(state.b) ? fmtTime(state.b) : '—';
  els.btnLoop.textContent = 'Loop: ' + (state.loop ? 'on' : 'off');
  els.btnLoop.style.opacity = state.loop ? '1' : '';
}

/** Update time/seek readouts. */
function refreshTime() {
  els.tCur.textContent = fmtTime(audio.currentTime);
  if (isFinite(audio.duration) && audio.duration > 0) {
    els.tDur.textContent = fmtTime(audio.duration);
    els.seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
  }
}

// ---------------------------------------------------------- event wiring
els.fileInput.addEventListener('change', () => {
  const f = els.fileInput.files && els.fileInput.files[0];
  if (!f) return;
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(f);
  audio.src = state.url;
  audio.playbackRate = clampRate(els.speed.value);
  state.loaded = false;
  state.a = NaN; state.b = NaN; state.loop = false;
  els.trackName.textContent = f.name;
  els.fileLabel.textContent = 'Change audio file';
  refreshAB();
  refreshPlayGlyph();
});

audio.addEventListener('loadedmetadata', () => {
  state.loaded = true;
  refreshEnabled();
  refreshTime();
});

audio.addEventListener('timeupdate', () => {
  // Enforce the A/B loop: bounce back to A when we pass B.
  if (state.loop && abValid(state.a, state.b) && audio.currentTime >= state.b) {
    audio.currentTime = state.a;
  }
  refreshTime();
});

audio.addEventListener('play', refreshPlayGlyph);
audio.addEventListener('pause', refreshPlayGlyph);
audio.addEventListener('ended', () => {
  refreshPlayGlyph();
  if (state.loop && abValid(state.a, state.b)) { audio.currentTime = state.a; audio.play(); }
});

els.btnPlay.addEventListener('click', () => {
  if (!state.loaded) return;
  if (audio.paused) audio.play(); else audio.pause();
});

els.seek.addEventListener('input', () => {
  if (!state.loaded || !isFinite(audio.duration)) return;
  audio.currentTime = (Number(els.seek.value) / 1000) * audio.duration;
});

// Skip buttons.
[['btnBack5', -5], ['btnBack10', -10], ['btnFwd5', 5], ['btnFwd10', 10]].forEach(([id, delta]) => {
  els[id].addEventListener('click', () => {
    if (!state.loaded) return;
    audio.currentTime = Math.min(
      Math.max(0, audio.currentTime + delta),
      isFinite(audio.duration) ? audio.duration : audio.currentTime + delta
    );
    refreshTime();
  });
});

// Speed.
els.speed.addEventListener('input', () => {
  const r = clampRate(els.speed.value);
  audio.playbackRate = r;
  els.speedVal.textContent = r.toFixed(2).replace(/0$/, '') + '×';
});

// A/B loop controls.
els.btnSetA.addEventListener('click', () => {
  if (!state.loaded) return;
  state.a = audio.currentTime;
  if (abValid(state.a, state.b)) { /* keep */ } else { state.b = NaN; }
  refreshAB();
});
els.btnSetB.addEventListener('click', () => {
  if (!state.loaded) return;
  state.b = audio.currentTime;
  if (!abValid(state.a, state.b)) { state.a = NaN; }
  refreshAB();
});
els.btnClearAB.addEventListener('click', () => {
  state.a = NaN; state.b = NaN; state.loop = false; refreshAB();
});
els.btnLoop.addEventListener('click', () => {
  if (!abValid(state.a, state.b)) return;
  state.loop = !state.loop;
  refreshAB();
});

// Persist UI prefs (speed); file itself is never persisted.
els.speed.addEventListener('change', () => {
  chrome.storage.local.set({ rate: clampRate(els.speed.value) }).catch(() => {});
});
chrome.storage.local.get({ rate: 1 }).then((v) => {
  const r = clampRate(v.rate);
  els.speed.value = r;
  audio.playbackRate = r;
  els.speedVal.textContent = r.toFixed(2).replace(/0$/, '') + '×';
}).catch(() => {});

refreshEnabled();
refreshAB();
refreshPlayGlyph();
