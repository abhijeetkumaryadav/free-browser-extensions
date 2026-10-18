/* Ambience popup — UI + transport.
 * Chromium/Edge/Opera: audio runs in an offscreen document (AUDIO_PLAYBACK) so
 * it keeps playing after the popup closes.
 * Firefox (no offscreen API): the synth engine runs in the popup itself, so
 * sound plays while the popup is open. */
'use strict';

const SOUNDS = ['rain', 'thunder', 'wind', 'fire'];
const state = {}; // sound -> { on, vol }
const useOffscreen = !!(chrome.offscreen && chrome.offscreen.createDocument);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------- offscreen plumbing ---------- */
let offscreenReady = false;
async function ensureOffscreen() {
  if (!useOffscreen || offscreenReady) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play the user-selected ambient weather sounds while the popup is closed.'
    });
  } catch {
    // document already exists — that's fine
  }
  offscreenReady = true;
}

async function sendCmd(msg) {
  if (useOffscreen) {
    await ensureOffscreen();
    try { await chrome.runtime.sendMessage(msg); } catch { /* doc torn down */ }
  } else {
    // Firefox fallback: run the engine right here in the popup.
    AmbienceEngine.setVolume(msg.sound, msg.vol);
    if (msg.cmd === 'set') {
      if (msg.on) AmbienceEngine.start(msg.sound);
      else AmbienceEngine.stop(msg.sound);
    } else if (msg.cmd === 'stopAll') {
      AmbienceEngine.stopAll();
    }
  }
}

/* ---------- UI ---------- */
function paintSlider(el) {
  el.style.setProperty('--fill', el.value + '%');
}

function applyState(s) {
  for (const k of SOUNDS) {
    state[k] = { on: !!s[k].on, vol: s[k].vol };
    const card = $(`.sound-card[data-sound="${k}"]`);
    const toggle = $(`[data-toggle="${k}"]`);
    const slider = $(`[data-vol="${k}"]`);
    card.classList.toggle('playing', state[k].on);
    toggle.setAttribute('aria-pressed', String(state[k].on));
    slider.value = Math.round(state[k].vol * 100);
    paintSlider(slider);
  }
}

function updateCard(k) {
  const card = $(`.sound-card[data-sound="${k}"]`);
  const toggle = $(`[data-toggle="${k}"]`);
  card.classList.toggle('playing', state[k].on);
  toggle.setAttribute('aria-pressed', String(state[k].on));
}

async function toggleSound(k) {
  state[k].on = !state[k].on;
  updateCard(k);
  await sendCmd({ cmd: 'set', sound: k, on: state[k].on, vol: state[k].vol });
}

let saveTimer = null;
function persistVols() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const vols = {};
    for (const k of SOUNDS) vols[k] = state[k].vol;
    chrome.storage.local.set({ vols });
  }, 300);
}

// state events broadcast by the offscreen document
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.event === 'state' && msg.state) applyState(msg.state);
});

$$('[data-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => toggleSound(btn.dataset.toggle));
});

$$('[data-vol]').forEach((slider) => {
  paintSlider(slider);
  slider.addEventListener('input', async () => {
    const k = slider.dataset.vol;
    state[k].vol = slider.value / 100;
    paintSlider(slider);
    persistVols();
    await sendCmd({ cmd: 'setVol', sound: k, vol: state[k].vol });
  });
});

$('#stop-all').addEventListener('click', async () => {
  for (const k of SOUNDS) state[k].on = false;
  for (const k of SOUNDS) updateCard(k);
  await sendCmd({ cmd: 'stopAll' });
});

/* ---------- init ---------- */
(async function init() {
  const { vols = {} } = await chrome.storage.local.get('vols');
  const initial = {};
  for (const k of SOUNDS) initial[k] = { on: false, vol: typeof vols[k] === 'number' ? vols[k] : 0.6 };
  applyState(initial);

  // If an offscreen doc survived from an earlier session, sync its real state.
  if (useOffscreen) {
    try {
      const has = chrome.offscreen.hasDocument ? await chrome.offscreen.hasDocument() : false;
      if (has) {
        offscreenReady = true;
        const res = await chrome.runtime.sendMessage({ cmd: 'getState' });
        if (res && res.state) applyState(res.state);
      }
    } catch { /* fall back to defaults */ }
  }

  if (!useOffscreen) {
    $('#hint').textContent = 'Firefox: sound plays while this popup is open (no background audio API).';
  }
})();
