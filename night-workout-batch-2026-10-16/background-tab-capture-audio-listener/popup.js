// Tab Audio Recorder — popup controller.
// Flow: Start -> background mints tabCapture streamId -> getUserMedia with the
// chrome "tab" source -> Web Audio analyser drives the level meter, and a
// MediaRecorder writes WebM. Everything stops when the user presses Stop or
// the popup closes; recordings are downloaded from a blob URL.

const $ = (id) => document.getElementById(id);
const startBtn = $('startBtn'), stopBtn = $('stopBtn'), dlBtn = $('dlBtn');
const stateDot = $('stateDot'), meterCanvas = $('meter'), ctx = meterCanvas.getContext('2d');
const tabLabel = $('tabLabel'), clockEl = $('clock'), errorMsg = $('errorMsg');
const resultBox = $('resultBox'), resultName = $('resultName'), resultSize = $('resultSize');

let stream = null, audioCtx = null, analyser = null, recorder = null;
let chunks = [], meterRAF = 0, clockTimer = 0, startedAt = 0, blobUrl = null;
let currentTabTitle = 'tab-audio';

const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
const fmtBytes = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB'
  : n > 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B';

function showError(msg) { errorMsg.textContent = msg; }
function clearError() { errorMsg.textContent = ''; }

// Draw a scrolling green->amber->red bar meter from the analyser's RMS level.
function drawMeter(level) {
  const W = meterCanvas.width, H = meterCanvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(0, 0, W, H);
  const barW = W * Math.min(1, level);
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#34d399'); grad.addColorStop(0.65, '#fbbf24'); grad.addColorStop(1, '#f87171');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H * 0.25, barW, H * 0.5);
  // tick marks every 10%
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 1; i < 10; i++) ctx.fillRect((W * i) / 10, H * 0.25, 1, H * 0.5);
}

function tickMeter() {
  if (!analyser) { meterRAF = requestAnimationFrame(tickMeter); return; }
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / data.length);
  drawMeter(Math.min(1, rms * 2.4)); // boost so quiet tabs still read
  meterRAF = requestAnimationFrame(tickMeter);
}

function setState(live) {
  stateDot.classList.toggle('live', live);
  stateDot.title = live ? 'recording' : 'idle';
  startBtn.disabled = live;
  stopBtn.disabled = !live;
}

function cleanup() {
  cancelAnimationFrame(meterRAF);
  clearInterval(clockTimer);
  if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch (_) {} }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; analyser = null; }
  drawMeter(0);
  setState(false);
}

async function startRecording() {
  clearError();
  resultBox.classList.add('hidden');
  try {
    // 1. Mint a stream id for the ACTIVE tab (fails if it is not audible).
    const res = await chrome.runtime.sendMessage({ type: 'GET_TAB_STREAM_ID' });
    if (!res || !res.ok) {
      showError(res && res.error
        ? 'Could not capture this tab: ' + res.error + ' (start audio in the tab first).'
        : 'Could not capture this tab. Start audio in the tab first.');
      return;
    }
    currentTabTitle = (res.tabTitle || 'tab-audio').replace(/[^\w\- ]+/g, '').trim() || 'tab-audio';

    // 2. Open the tab-audio stream inside this popup page.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: res.streamId } },
      video: false
    });

    // 3. Level meter via Web Audio.
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);

    // 4. Recorder -> WebM.
    chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = onRecordingDone;
    recorder.start(250);

    startedAt = Date.now();
    tabLabel.textContent = 'Capturing: ' + currentTabTitle.slice(0, 40);
    clockEl.textContent = '00:00';
    clockTimer = setInterval(() => { clockEl.textContent = fmtTime(Date.now() - startedAt); }, 500);
    meterRAF = requestAnimationFrame(tickMeter);
    setState(true);
  } catch (err) {
    showError('Could not start: ' + (err && err.message ? err.message : err) +
      '. Make sure audio is playing in the active tab and try again.');
    cleanup();
  }
}

function onRecordingDone() {
  const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  resultName.textContent = currentTabTitle.slice(0, 24) + '-' + stamp + '.webm';
  resultSize.textContent = fmtBytes(blob.size);
  resultBox.classList.remove('hidden');
  // stop the capture side of the stream
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; analyser = null; }
  tabLabel.textContent = 'Recording finished';
}

function stopRecording() {
  cancelAnimationFrame(meterRAF);
  clearInterval(clockTimer);
  clockEl.textContent = fmtTime(Date.now() - startedAt);
  setState(false);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
dlBtn.addEventListener('click', () => {
  if (!blobUrl) return;
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = resultName.textContent;
  a.click();
});

drawMeter(0);
// Stop everything if the popup is dismissed mid-recording.
window.addEventListener('pagehide', cleanup);
