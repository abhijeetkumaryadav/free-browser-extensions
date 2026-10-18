/* Stream Delay Sync Tuner — offscreen audio engine.
 * Runs in an offscreen document (service workers cannot host an AudioContext).
 * Graph: tab MediaStream -> DelayNode (0-500ms) -> GainNode -> destination.
 * The tab's original output is muted by the service worker to prevent echo. */
(() => {
  'use strict';

  const MAX_DELAY_S = 0.5; // 500 ms

  let audioCtx = null;
  let sourceNode = null;
  let delayNode = null;
  let mediaStream = null;

  function clampMs(ms) {
    return Math.min(Math.max(Number(ms) || 0, 0), 500);
  }

  // Start capturing the tab's audio and routing it through the delay.
  async function start(streamId, delayMs) {
    await stop(); // tear down any previous graph first

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();

    sourceNode = audioCtx.createMediaStreamSource(mediaStream);
    delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = clampMs(delayMs) / 1000;
    const out = audioCtx.createGain();
    out.gain.value = 1.0;

    sourceNode.connect(delayNode);
    delayNode.connect(out);
    out.connect(audioCtx.destination);
  }

  // Adjust the delay live without restarting the stream.
  function setDelay(delayMs) {
    if (delayNode && audioCtx) {
      delayNode.delayTime.setTargetAtTime(clampMs(delayMs) / 1000, audioCtx.currentTime, 0.02);
    }
  }

  async function stop() {
    try {
      if (mediaStream) mediaStream.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
    } catch (_) { /* already stopped */ }
    try {
      if (audioCtx) await audioCtx.close();
    } catch (_) { /* already closed */ }
    mediaStream = null;
    sourceNode = null;
    delayNode = null;
    audioCtx = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen') return; // not for this document
    (async () => {
      if (msg.action === 'start') {
        await start(msg.streamId, msg.delayMs);
        sendResponse({ ok: true });
      } else if (msg.action === 'stop') {
        await stop();
        sendResponse({ ok: true });
      } else if (msg.action === 'setDelay') {
        setDelay(msg.delayMs);
        sendResponse({ ok: true });
      }
    })().catch(err => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true; // async response
  });
})();
