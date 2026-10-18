// Tab Audio Channel Splitter & Mixer — offscreen audio engine.
//
// Graph (rebuilt whenever routing-affecting settings change):
//
//   tabCapture stream -> MediaStreamSource -> splitter(2)
//        L channel -> [gainL] ->\
//                               merger(2) -> masterGain -> destination (speakers)
//        R channel -> [gainR] ->/
//
// Routing modes:
//   - normal : L->L, R->R        (balance applied via gainL/gainR)
//   - swap   : L->R, R->L
//   - mono   : (L+R)/2 -> both outputs
// Per-channel mute zeroes the corresponding gain regardless of mode.

let audioCtx = null;
let sourceNode = null;
let splitter = null;
let merger = null;
let gainL = null;
let gainR = null;
let masterGain = null;
let captureStream = null;
let currentTabId = null;

// ---------------------------------------------------------------------------
// Settings application
// settings: { balance (-1..1), swap (bool), mono (bool), muteL (bool), muteR (bool) }
// ---------------------------------------------------------------------------
function applySettings(s) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;

  // Balance: linear pan law. balance -1 = full left, +1 = full right.
  let l = 1, r = 1;
  if (s.balance < 0) r = 1 + s.balance; // s.balance in [-1, 0)
  else if (s.balance > 0) l = 1 - s.balance; // s.balance in (0, 1]

  if (s.muteL) l = 0;
  if (s.muteR) r = 0;

  gainL.gain.setTargetAtTime(l, t, 0.015);
  gainR.gain.setTargetAtTime(r, t, 0.015);

  // Rewire routing for swap / mono modes.
  try { splitter.disconnect(); } catch (_e) { /* already disconnected */ }

  if (s.mono) {
    // Mix down: average of both channels, sent to both outputs.
    // Note: in mono mode, "mute L" silences the mix; "mute R" has no effect.
    const mix = audioCtx.createGain();
    mix.gain.value = 0.5;
    splitter.connect(mix, 0);
    splitter.connect(mix, 1);
    mix.connect(gainL);
    gainL.connect(merger, 0, 0);
    gainL.connect(merger, 0, 1);
    // gainR intentionally left disconnected in mono mode.
  } else if (s.swap) {
    splitter.connect(gainL, 0); // L input ...
    gainL.connect(merger, 0, 1); // ... routed to R output
    splitter.connect(gainR, 1); // R input ...
    gainR.connect(merger, 0, 0); // ... routed to L output
  } else {
    splitter.connect(gainL, 0);
    gainL.connect(merger, 0, 0);
    splitter.connect(gainR, 1);
    gainR.connect(merger, 0, 1);
  }
}

// ---------------------------------------------------------------------------
// Capture lifecycle
// ---------------------------------------------------------------------------
async function start(tabId, settings) {
  await stop(); // clean slate

  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (chrome.runtime.lastError || !stream) {
        reject(new Error(chrome.runtime.lastError?.message || "Tab capture failed."));
        return;
      }
      try {
        currentTabId = tabId;
        captureStream = stream;

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioCtx.createMediaStreamSource(stream);
        splitter = audioCtx.createChannelSplitter(2);
        merger = audioCtx.createChannelMerger(2);
        gainL = audioCtx.createGain();
        gainR = audioCtx.createGain();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 1.0;

        sourceNode.connect(splitter);
        merger.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        applySettings(settings);

        // If the stream ends (tab closed etc.), notify the background.
        stream.getAudioTracks().forEach((track) => {
          track.onended = () => {
            chrome.runtime.sendMessage({ type: "mixer-stream-ended" }).catch(() => {});
          };
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function stop() {
  currentTabId = null;
  if (captureStream) {
    captureStream.getTracks().forEach((t) => { try { t.stop(); } catch (_e) {} });
    captureStream = null;
  }
  if (audioCtx) {
    try { await audioCtx.close(); } catch (_e) {}
    audioCtx = null;
  }
  sourceNode = splitter = merger = gainL = gainR = masterGain = null;
}

// ---------------------------------------------------------------------------
// Messages from the background service worker
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return false;
  (async () => {
    try {
      if (msg.type === "start") {
        await start(msg.tabId, msg.settings);
        sendResponse({ ok: true });
      } else if (msg.type === "update") {
        applySettings(msg.settings);
        sendResponse({ ok: true });
      } else if (msg.type === "stop") {
        await stop();
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    }
  })();
  return true;
});
