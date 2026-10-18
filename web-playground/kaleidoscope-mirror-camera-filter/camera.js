/* Kaleidoscope Camera — live mirror/kaleidoscope effect from the user's camera.
   Camera stays OFF until "Start camera" is clicked. All processing is local:
   no recording, no network, tracks are stopped on "Stop camera" or page close. */
'use strict';

const video = document.getElementById('video');
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const idleOverlay = document.getElementById('idleOverlay');
const controls = document.getElementById('controls');
const errBox = document.getElementById('err');
const segsInput = document.getElementById('segs');
const segsVal = document.getElementById('segsVal');
const mirrorInput = document.getElementById('mirror');

let stream = null;
let rafId = 0;
let running = false;

/** Draw one frame of the kaleidoscope: the video frame tiled into N
    wedge slices around the canvas center, alternating slices mirrored. */
function drawFrame() {
  if (!running) return;
  const w = canvas.width, h = canvas.height;
  const vw = video.videoWidth, vh = video.videoHeight;
  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, w, h);

  if (vw > 0 && vh > 0) {
    const cx = w / 2, cy = h / 2;
    const R = Math.hypot(w, h) / 2;
    const n = parseInt(segsInput.value, 10);
    const step = (Math.PI * 2) / n;
    const mirror = mirrorInput.checked;
    // Scale video so it covers the full kaleidoscope disc.
    const s = Math.max((R * 2) / vw, (R * 2) / vh);
    const dw = vw * s, dh = vh * s;

    for (let i = 0; i < n; i++) {
      ctx.save();
      // Clip to this slice's wedge.
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, i * step, (i + 1) * step);
      ctx.closePath();
      ctx.clip();
      // Rotate the whole video frame into the wedge; mirror alternate wedges.
      ctx.translate(cx, cy);
      ctx.rotate(i * step);
      if (mirror && i % 2 === 1) ctx.scale(1, -1);
      ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }
  rafId = requestAnimationFrame(drawFrame);
}

function showError(msg) {
  errBox.textContent = msg;
  errBox.hidden = false;
}

async function startCamera() {
  errBox.hidden = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('Camera is not available in this browser.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
  } catch (e) {
    showError('Could not access the camera. Check the browser permission prompt and try again.');
    return;
  }
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* play() may reject; frames still render */ }
  running = true;
  idleOverlay.hidden = true;
  controls.hidden = false;
  drawFrame();
}

function stopCamera() {
  running = false;
  cancelAnimationFrame(rafId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  controls.hidden = true;
  idleOverlay.hidden = false;
}

function snapshot() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kaleidoscope.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

segsInput.addEventListener('input', () => { segsVal.textContent = segsInput.value; });
document.getElementById('startBtn').addEventListener('click', startCamera);
document.getElementById('stopBtn').addEventListener('click', stopCamera);
document.getElementById('snapBtn').addEventListener('click', snapshot);
// Safety: never leave the camera on if the tab closes.
window.addEventListener('pagehide', stopCamera);
