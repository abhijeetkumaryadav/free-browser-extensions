/* Frame-by-Frame GIF Converter — popup logic + tiny bundled GIF encoder.
 * Everything runs locally. The encoder uses a fixed 256-color (3-3-2 bit)
 * palette and plain LZW compression: fine for short clips, limited colors. */
"use strict";

const $ = (id) => document.getElementById(id);
const fileInput = $("file"), drop = $("drop"), fileName = $("fileName");
const video = $("video"), stage = $("stage"), ctx = stage.getContext("2d");
const scrub = $("scrub"), timeLabel = $("timeLabel"), frameLabel = $("frameLabel");
const stageWrap = $("stageWrap"), convertBtn = $("convert"), previewBtn = $("previewBtn");
const progress = $("progress"), fill = $("fill"), progressLabel = $("progressLabel");
const download = $("download"), err = $("err");

let duration = 0, objectUrl = null, previewTimer = null;

/* ---------- video loading ---------- */
function showErr(msg) { err.textContent = msg; err.classList.remove("hidden"); }
function clearErr() { err.classList.add("hidden"); err.textContent = ""; }

function loadFile(f) {
  clearErr();
  if (!f || !f.type.startsWith("video/")) { showErr("Please choose a video file."); return; }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(f);
  fileName.textContent = f.name;
  video.src = objectUrl;
}

drop.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
drop.addEventListener("dragover", (e) => e.preventDefault());
drop.addEventListener("drop", (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });

video.addEventListener("loadedmetadata", () => {
  duration = video.duration || 0;
  $("end").value = Math.min(2, duration).toFixed(1);
  stageWrap.classList.remove("hidden");
  convertBtn.disabled = false;
  previewBtn.disabled = false;
  video.currentTime = 0;
});
video.addEventListener("error", () => showErr("Could not read that video. Try an MP4/WebM file."));

/* ---------- frame-by-frame scrubbing ---------- */
function drawCurrent() {
  if (!video.videoWidth) return;
  const scale = stage.width / video.videoWidth;
  const h = Math.round(video.videoHeight * scale);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, stage.width, stage.height);
  ctx.drawImage(video, 0, 0, stage.width, h);
  const t = video.currentTime;
  timeLabel.textContent = t.toFixed(2) + "s / " + duration.toFixed(2) + "s";
  frameLabel.textContent = "frame ~" + Math.round(t * 30);
}
video.addEventListener("seeked", drawCurrent);

scrub.addEventListener("input", () => {
  if (!duration) return;
  stopPreview();
  video.currentTime = (scrub.value / 100) * duration;
});
function stepFrame(dir) {
  if (!duration) return;
  stopPreview();
  video.currentTime = Math.min(duration, Math.max(0, video.currentTime + dir / 30));
}
$("prevFrame").addEventListener("click", () => stepFrame(-1));
$("nextFrame").addEventListener("click", () => stepFrame(1));

function stopPreview() { if (previewTimer) { clearInterval(previewTimer); previewTimer = null; } }
previewBtn.addEventListener("click", () => {
  if (previewTimer) { stopPreview(); return; }
  const fps = Math.min(20, Math.max(1, parseInt($("fps").value, 10) || 8));
  let t = parseFloat($("start").value) || 0;
  const end = Math.min(duration, parseFloat($("end").value) || duration);
  previewTimer = setInterval(() => {
    t += 1 / fps;
    if (t > end) { stopPreview(); return; }
    video.currentTime = t;
  }, 1000 / fps);
});

/* ---------- tiny bundled GIF encoder ---------- */

// Fixed 256-color palette: 3 bits red, 3 bits green, 2 bits blue.
function buildPalette() {
  const pal = new Uint8Array(256 * 3);
  let i = 0;
  for (let r = 0; r < 8; r++) for (let g = 0; g < 8; g++) for (let b = 0; b < 4; b++) {
    pal[i++] = Math.round(r * 255 / 7);
    pal[i++] = Math.round(g * 255 / 7);
    pal[i++] = Math.round(b * 255 / 3);
  }
  return pal;
}
const PALETTE = buildPalette();

function quantize(rgba, w, h) {
  const idx = new Uint8Array(w * h);
  for (let p = 0, n = w * h; p < n; p++) {
    const r = rgba[p * 4], g = rgba[p * 4 + 1], b = rgba[p * 4 + 2];
    idx[p] = ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
  }
  return idx;
}

function lzwEncode(indices, minCodeSize) {
  const clear = 1 << minCodeSize, eoi = clear + 1;
  const out = [];
  let bitBuf = 0, bitCount = 0;
  const emit = (code, size) => {
    bitBuf |= code << bitCount; bitCount += size;
    while (bitCount >= 8) { out.push(bitBuf & 0xff); bitBuf >>= 8; bitCount -= 8; }
  };
  let codeSize = minCodeSize + 1;
  let dict = new Map(); // key: prev*256 + k  (prev < 4096, k < 256)
  let next = eoi + 1;
  emit(clear, codeSize);
  let prev = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prev * 256 + k;
    if (dict.has(key)) { prev = dict.get(key); }
    else {
      emit(prev, codeSize);
      if (next < 4096) { dict.set(key, next++); if (next === (1 << codeSize) + 1 && codeSize < 12) codeSize++; }
      else { emit(clear, codeSize); dict = new Map(); next = eoi + 1; codeSize = minCodeSize + 1; }
      prev = k;
    }
  }
  emit(prev, codeSize);
  emit(eoi, codeSize);
  if (bitCount > 0) out.push(bitBuf & 0xff);
  return out;
}

function pushWord(arr, v) { arr.push(v & 0xff, (v >> 8) & 0xff); }

function encodeGIF(frames, w, h, delayCs) {
  const b = [];
  b.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // GIF89a
  pushWord(b, w); pushWord(b, h);
  b.push(0xF7, 0x00, 0x00); // GCT flag, 256 colors, bg 0, aspect 0
  for (let i = 0; i < PALETTE.length; i++) b.push(PALETTE[i]);
  // Netscape looping extension: loop forever
  b.push(0x21, 0xFF, 0x0B);
  for (const c of "NETSCAPE2.0") b.push(c.charCodeAt(0));
  b.push(0x03, 0x01, 0x00, 0x00, 0x00);
  for (const fr of frames) {
    // Graphic Control Extension
    b.push(0x21, 0xF9, 0x04, 0x00);
    pushWord(b, delayCs);
    b.push(0x00, 0x00);
    // Image descriptor
    b.push(0x2C);
    pushWord(b, 0); pushWord(b, 0); pushWord(b, w); pushWord(b, h);
    b.push(0x00); // no local table
    const minCode = 8;
    b.push(minCode);
    const data = lzwEncode(fr, minCode);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      b.push(chunk.length, ...chunk);
    }
    b.push(0x00); // block terminator
  }
  b.push(0x3B); // trailer
  return new Uint8Array(b);
}

/* ---------- conversion ---------- */
function seekTo(t) {
  return new Promise((resolve) => {
    const onSeek = () => { video.removeEventListener("seeked", onSeek); resolve(); };
    video.addEventListener("seeked", onSeek);
    video.currentTime = t;
  });
}

convertBtn.addEventListener("click", async () => {
  clearErr(); stopPreview();
  download.classList.add("hidden");
  const start = Math.max(0, parseFloat($("start").value) || 0);
  const end = Math.min(duration, Math.max(start, parseFloat($("end").value) || duration));
  const fps = Math.min(20, Math.max(1, parseInt($("fps").value, 10) || 8));
  const w = Math.min(480, Math.max(64, parseInt($("width").value, 10) || 240));
  const total = Math.min(600, Math.max(1, Math.floor((end - start) * fps)));
  if (total < 1) { showErr("End time must be after start time."); return; }

  progress.classList.remove("hidden");
  convertBtn.disabled = true;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = Math.max(2, Math.round(video.videoHeight * (w / video.videoWidth)));
  const octx = off.getContext("2d");
  const frames = [];

  try {
    for (let i = 0; i < total; i++) {
      await seekTo(start + i / fps);
      octx.drawImage(video, 0, 0, off.width, off.height);
      const rgba = octx.getImageData(0, 0, off.width, off.height).data;
      frames.push(quantize(rgba, off.width, off.height));
      const pct = Math.round(((i + 1) / total) * 80);
      fill.style.width = pct + "%";
      progressLabel.textContent = `Capturing frames ${i + 1}/${total}…`;
      await new Promise((r) => setTimeout(r, 0)); // keep UI alive
    }
    progressLabel.textContent = "Encoding GIF…";
    fill.style.width = "90%";
    await new Promise((r) => setTimeout(r, 0));
    const gif = encodeGIF(frames, off.width, off.height, Math.max(2, Math.round(100 / fps)));
    const blob = new Blob([gif], { type: "image/gif" });
    if (download.href.startsWith("blob:")) URL.revokeObjectURL(download.href);
    download.href = URL.createObjectURL(blob);
    download.classList.remove("hidden");
    progressLabel.textContent = `Done — ${(blob.size / 1024).toFixed(0)} KB, ${total} frames.`;
    fill.style.width = "100%";
  } catch (e) {
    showErr("Conversion failed: " + (e && e.message ? e.message : e));
  } finally {
    convertBtn.disabled = false;
  }
});
