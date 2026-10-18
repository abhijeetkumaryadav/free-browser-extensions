/* BoostLab offscreen audio engine (AUDIO_PLAYBACK context).
 * Captures the target tab's audio and routes it live through:
 *   MediaStreamSource -> GainNode (boost) -> DynamicsCompressor -> destination
 * Nothing is recorded, stored, or transmitted — the stream is processed in
 * memory and discarded when disabled.
 */

let audioCtx = null;
let mediaStream = null;
let sourceNode = null;
let boostGain = null;
let compressor = null;
let boostPercent = 150;
let bypass = false;

/** (Re)wire the graph. Bypass routes the raw stream straight to output. */
function wireGraph() {
  if (!audioCtx || !sourceNode) return;
  try {
    sourceNode.disconnect();
  } catch (e) {}
  try {
    boostGain.disconnect();
  } catch (e) {}
  try {
    compressor.disconnect();
  } catch (e) {}
  if (bypass) {
    sourceNode.connect(audioCtx.destination); // untouched passthrough
  } else {
    sourceNode.connect(boostGain);
    boostGain.connect(compressor);
    compressor.connect(audioCtx.destination);
  }
}

async function start(tabId, boost) {
  await stop(); // clean slate in case a previous session lingered
  boostPercent = boost;
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  });
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
    },
  });

  audioCtx = new AudioContext();
  sourceNode = audioCtx.createMediaStreamSource(mediaStream);

  boostGain = audioCtx.createGain();
  boostGain.gain.value = boostPercent / 100;

  // Gentle mastering-style compression so boosted peaks do not distort.
  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 20;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.3;

  wireGraph();
  await audioCtx.resume();
}

function setBoost(boost) {
  boostPercent = boost;
  if (audioCtx && boostGain) {
    boostGain.gain.setTargetAtTime(boostPercent / 100, audioCtx.currentTime, 0.05);
  }
}

function setBypass(value) {
  bypass = value;
  wireGraph();
}

async function stop() {
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      try {
        track.stop();
      } catch (e) {}
    }
    mediaStream = null;
  }
  sourceNode = null;
  boostGain = null;
  compressor = null;
  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch (e) {}
    audioCtx = null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return; // not for the audio engine
  (async () => {
    try {
      if (msg.type === 'offscreen-start') {
        await start(msg.tabId, msg.boost ?? 150);
        sendResponse({ ok: true });
      } else if (msg.type === 'offscreen-stop') {
        await stop();
        sendResponse({ ok: true });
      } else if (msg.type === 'offscreen-boost') {
        setBoost(msg.boost);
        sendResponse({ ok: true });
      } else if (msg.type === 'offscreen-bypass') {
        setBypass(!!msg.bypass);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Unknown offscreen command.' });
      }
    } catch (err) {
      await stop();
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
  })();
  return true; // async response
});
