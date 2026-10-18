/* Offscreen document — hosts the AmbienceEngine so sound keeps playing after the
 * popup closes. Chromium/Edge/Opera only. Created on demand with reason
 * AUDIO_PLAYBACK; the service-worker-free design keeps everything MV3-clean. */
'use strict';

const VALID = new Set(['rain', 'thunder', 'wind', 'fire']);

function snapshot() {
  const state = {};
  for (const k of VALID) {
    state[k] = { on: AmbienceEngine.isPlaying(k), vol: AmbienceEngine.getVolumes()[k] };
  }
  return state;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.cmd !== 'string') return false;
  try {
    switch (msg.cmd) {
      case 'set': { // { cmd:'set', sound, on, vol }
        if (!VALID.has(msg.sound)) break;
        AmbienceEngine.setVolume(msg.sound, msg.vol);
        if (msg.on) AmbienceEngine.start(msg.sound);
        else AmbienceEngine.stop(msg.sound);
        break;
      }
      case 'setVol': { // { cmd:'setVol', sound, vol }
        if (!VALID.has(msg.sound)) break;
        AmbienceEngine.setVolume(msg.sound, msg.vol);
        break;
      }
      case 'stopAll':
        AmbienceEngine.stopAll();
        break;
      case 'getState':
        sendResponse({ state: snapshot() });
        return true; // async-safe
      default:
        break;
    }
  } catch (err) {
    // AudioContext can throw if the document is torn down; stay silent.
  }
  // broadcast fresh state so any open popup stays in sync
  chrome.runtime.sendMessage({ event: 'state', state: snapshot() }).catch(() => {});
  return false;
});
