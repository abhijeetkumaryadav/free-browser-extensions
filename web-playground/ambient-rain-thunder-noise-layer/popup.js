/* RainScape popup logic — talks to the offscreen audio engine, mirrors state from storage. */
'use strict';

const TARGET = 'rainscape-offscreen';
const $ = (id) => document.getElementById(id);

const playBtn = $('playBtn'), playLabel = $('playLabel'), playIcon = $('playIcon');
const statusDot = $('statusDot'), countdown = $('countdown'), sleepSel = $('sleep'), err = $('err');
const sliders = { master: $('master'), rain: $('rain'), wind: $('wind'), thunder: $('thunder') };
const sliderVals = { master: $('masterVal'), rain: $('rainVal'), wind: $('windVal'), thunder: $('thunderVal') };

const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_STOP = '<path d="M6 6h12v12H6z"/>';

const DEFAULT_SETTINGS = { master: 70, rain: 60, wind: 30, thunder: 50 };

function showErr(msg) { err.textContent = msg; err.hidden = false; }
function clearErr() { err.hidden = true; }

function paintSliders() {
  for (const k of Object.keys(sliders)) {
    sliderVals[k].textContent = sliders[k].value + '%';
    sliders[k].style.setProperty('--fill', sliders[k].value + '%');
  }
}

function currentSettings() {
  return {
    master: Number(sliders.master.value),
    rain: Number(sliders.rain.value),
    wind: Number(sliders.wind.value),
    thunder: Number(sliders.thunder.value),
  };
}

function setPlayingUI(on) {
  playLabel.textContent = on ? 'Stop' : 'Play ambience';
  playIcon.innerHTML = on ? ICON_STOP : ICON_PLAY;
  playBtn.classList.toggle('playing', on);
  statusDot.classList.toggle('on', on);
  statusDot.setAttribute('aria-label', on ? 'Playing' : 'Stopped');
}

// Ensure the offscreen document exists (Chrome 109+; hasDocument needs 116+).
async function ensureOffscreen() {
  try {
    if (chrome.offscreen && typeof chrome.offscreen.hasDocument === 'function') {
      if (await chrome.offscreen.hasDocument()) return;
    }
  } catch (e) { /* fall through and try creating */ }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play synthesized ambient rain/thunder/wind audio while the popup is closed.',
    });
  } catch (e) {
    // "Only one offscreen document may exist" means it's already there — fine.
    if (!String(e.message || e).includes('Only one')) throw e;
  }
}

function sendToEngine(message) {
  return chrome.runtime.sendMessage({ ...message, target: TARGET });
}

async function refreshFromStorage() {
  const { rainscape } = await chrome.storage.local.get('rainscape');
  const st = rainscape || {};
  if (st.settings) {
    for (const k of Object.keys(sliders)) {
      if (typeof st.settings[k] === 'number') sliders[k].value = st.settings[k];
    }
    paintSliders();
  }
  setPlayingUI(!!st.playing);
  return st;
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

// Live countdown while a sleep timer runs.
setInterval(async () => {
  const { rainscape } = await chrome.storage.local.get('rainscape');
  if (rainscape && rainscape.playing && rainscape.endsAt > Date.now()) {
    countdown.hidden = false;
    countdown.textContent = 'Stopping in ' + fmt(rainscape.endsAt - Date.now());
  } else {
    countdown.hidden = true;
  }
}, 1000);

async function init() {
  paintSliders();
  await refreshFromStorage();

  playBtn.addEventListener('click', async () => {
    clearErr();
    try {
      const isPlaying = playBtn.classList.contains('playing');
      if (isPlaying) {
        await ensureOffscreen();
        await sendToEngine({ type: 'rs-stop' });
      } else {
        await ensureOffscreen();
        await sendToEngine({
          type: 'rs-play',
          settings: currentSettings(),
          sleepMin: Number(sleepSel.value),
        });
      }
      await refreshFromStorage();
    } catch (e) {
      showErr('Audio engine unreachable: ' + (e.message || e));
    }
  });

  // Live mix updates while playing; persisted always.
  let updateTimer = null;
  for (const k of Object.keys(sliders)) {
    sliders[k].addEventListener('input', () => {
      paintSliders();
      clearTimeout(updateTimer);
      updateTimer = setTimeout(async () => {
        const settings = currentSettings();
        await chrome.storage.local.set({
          rainscape: { ...(await chrome.storage.local.get('rainscape')).rainscape, settings },
        });
        if (playBtn.classList.contains('playing')) {
          try {
            await sendToEngine({ type: 'rs-update', settings });
          } catch (e) { /* engine may have been closed; next play rebuilds */ }
        }
      }, 120);
    });
  }

  sleepSel.addEventListener('change', () => {
    // Applies on next Play press; changing it mid-play does not retro-apply.
  });
}

init();
