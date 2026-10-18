/* Frame GIF Encoder — extract frames from a local video, encode a GIF locally.
 * Fully offline: a bundled minimal GIF89a encoder (median-cut palette + LZW).
 * HEURISTIC-FREE but honestly limited: 320px wide, max 24 frames. */

'use strict';

// ===================== ENGINE-START =====================
// --- Settings helpers ---
function clampSettings(frames, width, delay) {
  const ci = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));
  return {
    frames: ci(frames, 2, 24),
    width: ci(width, 80, 320),
    delay: ci(delay, 2, 200)
  };
}

// Evenly spaced capture times, avoiding the often-black very first frame.
function frameTimes(duration, count) {
  if (!isFinite(duration) || duration <= 0 || count <= 1) return [Math.max(0, (duration || 0) / 2)];
  const times = [];
  for (let i = 0; i < count; i++) times.push(duration * (0.05 + (0.9 * i) / (count - 1)));
  return times;
}

function fmtBytes(n) {
  if (!isFinite(n) || n < 0) return '–';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

// --- Median-cut color quantization: flat [r,g,b,...] -> palette [[r,g,b],...] ---
function medianCutPalette(pixels, maxColors) {
  const n = Math.floor(pixels.length / 3);
  if (n === 0 || maxColors < 1) return [];
  if (maxColors === 1) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < n; i++) { r += pixels[i * 3]; g += pixels[i * 3 + 1]; b += pixels[i * 3 + 2]; }
    return [[Math.round(r / n), Math.round(g / n), Math.round(b / n)]];
  }
  const rangeOf = (idx) => {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const i of idx) {
      const r = pixels[i * 3], g = pixels[i * 3 + 1], b = pixels[i * 3 + 2];
      if (r < rMin) rMin = r; if (r > rMax) rMax = r;
      if (g < gMin) gMin = g; if (g > gMax) gMax = g;
      if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }
    return [rMax - rMin, gMax - gMin, bMax - bMin];
  };
  let boxes = [{ idx: Array.from({ length: n }, (_, i) => i) }];
  while (boxes.length < maxColors) {
    let best = -1, bestScore = -1, bestCh = 0;
    boxes.forEach((box, bi) => {
      if (box.idx.length < 2) return;
      const rg = rangeOf(box.idx);
      const ch = rg[0] >= rg[1] && rg[0] >= rg[2] ? 0 : (rg[1] >= rg[2] ? 1 : 2);
      const range = rg[ch];
      if (range === 0) return; // solid color: nothing to split
      const score = range * box.idx.length;
      if (score > bestScore) { bestScore = score; best = bi; bestCh = ch; }
    });
    if (best === -1) break;
    const box = boxes[best];
    box.idx.sort((a, b) => pixels[a * 3 + bestCh] - pixels[b * 3 + bestCh]);
    const mid = Math.floor(box.idx.length / 2);
    boxes.splice(best, 1, { idx: box.idx.slice(0, mid) }, { idx: box.idx.slice(mid) });
  }
  return boxes.map(box => {
    let r = 0, g = 0, b = 0;
    for (const i of box.idx) { r += pixels[i * 3]; g += pixels[i * 3 + 1]; b += pixels[i * 3 + 2]; }
    const c = box.idx.length || 1;
    return [Math.round(r / c), Math.round(g / c), Math.round(b / c)];
  });
}

// --- Map flat RGB pixels to palette indices (15-bit color cube cache for speed) ---
function mapPixelsToPalette(pixels, palette) {
  const count = Math.floor(pixels.length / 3);
  const out = new Uint8Array(count);
  const cache = new Map();
  for (let i = 0; i < count; i++) {
    const r = pixels[i * 3], g = pixels[i * 3 + 1], b = pixels[i * 3 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let idx = cache.get(key);
    if (idx === undefined) {
      let best = 0, bd = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = p; }
      }
      cache.set(key, best);
      idx = best;
    }
    out[i] = idx;
  }
  return out;
}

// --- GIF LZW compressor ---
function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const out = [];
  let buffer = 0, bits = 0;
  const emit = (code, size) => {
    buffer |= code << bits; bits += size;
    while (bits >= 8) { out.push(buffer & 0xFF); buffer >>>= 8; bits -= 8; }
  };
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const dict = new Map();
  emit(clearCode, codeSize);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix, codeSize);
    if (nextCode < 4096) {
      dict.set(key, nextCode++);
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      // Dictionary full: clear and restart at the small code size.
      emit(clearCode, codeSize);
      dict.clear();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    }
    prefix = k;
  }
  emit(prefix, codeSize);
  emit(eoiCode, codeSize);
  if (bits > 0) out.push(buffer & 0xFF);
  return out;
}

// --- GIF89a byte builder: frames [{width,height,indices}], one global 256-color table ---
function encodeGIF(frames, palette, delayCs, loopInfinite) {
  if (!frames.length) throw new Error('encodeGIF: no frames');
  const out = [];
  const pushStr = s => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
  const push16 = v => { out.push(v & 0xFF, (v >> 8) & 0xFF); };

  pushStr('GIF89a');
  const w = frames[0].width, h = frames[0].height;
  push16(w); push16(h);
  out.push(0xF7, 0x00, 0x00); // global color table, 8-bit resolution, 256 entries
  for (let i = 0; i < 256; i++) {
    const c = palette[i] || [0, 0, 0];
    out.push(c[0] & 0xFF, c[1] & 0xFF, c[2] & 0xFF);
  }
  // NETSCAPE looping extension
  out.push(0x21, 0xFF, 0x0B);
  pushStr('NETSCAPE2.0');
  out.push(0x03, 0x01);
  push16(loopInfinite ? 0 : 1); // 0 = loop forever
  out.push(0x00);

  for (const f of frames) {
    // Graphic Control Extension: delay, no transparency
    out.push(0x21, 0xF9, 0x04, 0x00);
    push16(Math.max(0, Math.min(65535, delayCs)));
    out.push(0x00, 0x00);
    // Image Descriptor
    out.push(0x2C);
    push16(0); push16(0); push16(f.width); push16(f.height);
    out.push(0x00); // no local color table
    // Image data
    const minCode = 8;
    out.push(minCode);
    const data = lzwEncode(f.indices, minCode);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      out.push(chunk.length);
      for (const byte of chunk) out.push(byte);
    }
    out.push(0x00); // block terminator
  }
  out.push(0x3B); // trailer
  return new Uint8Array(out);
}
// ===================== ENGINE-END =====================

// --------------------- UI wiring ---------------------
const $ = id => document.getElementById(id);
const video = $('video'), canvas = $('canvas'), ctx = canvas.getContext('2d');
const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB honest cap
let objectUrl = null;

function setProgress(pct, text) {
  $('progress').classList.remove('hidden');
  $('barFill').style.width = Math.round(pct * 100) + '%';
  $('progText').textContent = text;
}
function hideProgress() { $('progress').classList.add('hidden'); }
const tick = () => new Promise(r => setTimeout(r, 0)); // let the UI breathe

$('file').addEventListener('change', () => {
  const f = $('file').files[0];
  $('result').classList.add('hidden');
  if (!f) { $('extractBtn').disabled = true; return; }
  if (f.size > MAX_FILE_BYTES) {
    $('meta').classList.remove('hidden');
    $('meta').textContent = 'File too large (' + fmtBytes(f.size) + '). Cap is 200 MB.';
    $('extractBtn').disabled = true;
    return;
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(f);
  video.src = objectUrl;
  video.onloadedmetadata = () => {
    $('meta').classList.remove('hidden');
    $('meta').textContent = f.name + ' · ' + fmtBytes(f.size) + ' · ' +
      video.duration.toFixed(1) + 's · ' + video.videoWidth + '×' + video.videoHeight;
    $('extractBtn').disabled = false;
  };
  video.onerror = () => {
    $('meta').classList.remove('hidden');
    $('meta').textContent = 'Could not read this video. Try an MP4/WebM file.';
    $('extractBtn').disabled = true;
  };
});

// Seek the video and resolve when the frame is ready (with a timeout guard).
function seekTo(t) {
  return new Promise(resolve => {
    let done = false;
    const finish = ok => { if (!done) { done = true; video.removeEventListener('seeked', onSeek); resolve(ok); } };
    const onSeek = () => finish(true);
    video.addEventListener('seeked', onSeek);
    video.currentTime = Math.min(t, Math.max(0, video.duration - 0.05));
    setTimeout(() => finish(false), 4000);
  });
}

$('extractBtn').addEventListener('click', async () => {
  const cfg = clampSettings($('frames').value, $('width').value, $('delay').value);
  $('frames').value = cfg.frames; $('width').value = cfg.width; $('delay').value = cfg.delay;
  $('result').classList.add('hidden');
  $('extractBtn').disabled = true;

  try {
    // 1. Capture frames
    const outW = Math.min(cfg.width, video.videoWidth);
    const outH = Math.max(2, Math.round(video.videoHeight * outW / video.videoWidth));
    canvas.width = outW; canvas.height = outH;
    const times = frameTimes(video.duration, cfg.frames);
    const framePixels = [];   // flat RGB arrays per frame
    const paletteSample = []; // stride-sampled pixels across all frames
    const SAMPLE_TARGET = 20000;
    for (let i = 0; i < times.length; i++) {
      setProgress(i / times.length * 0.5, 'Capturing frame ' + (i + 1) + ' of ' + times.length + '…');
      await seekTo(times[i]);
      ctx.drawImage(video, 0, 0, outW, outH);
      const data = ctx.getImageData(0, 0, outW, outH).data;
      const flat = new Array(data.length / 4 * 3);
      for (let p = 0, q = 0; p < data.length; p += 4, q += 3) {
        flat[q] = data[p]; flat[q + 1] = data[p + 1]; flat[q + 2] = data[p + 2];
      }
      framePixels.push(flat);
      // stride sample for the palette
      const stride = Math.max(1, Math.floor(flat.length / 3 / Math.ceil(SAMPLE_TARGET / times.length)));
      for (let p = 0; p < flat.length; p += stride * 3) {
        paletteSample.push(flat[p], flat[p + 1], flat[p + 2]);
      }
      await tick();
    }

    // 2. Quantize once across all frames (single global palette)
    setProgress(0.55, 'Building color palette…');
    await tick();
    const palette = medianCutPalette(paletteSample, 256);

    // 3. Map each frame to palette indices
    const frames = [];
    for (let i = 0; i < framePixels.length; i++) {
      setProgress(0.55 + (i / framePixels.length) * 0.25, 'Quantizing frame ' + (i + 1) + '…');
      await tick();
      frames.push({ width: outW, height: outH, indices: mapPixelsToPalette(framePixels[i], palette) });
    }

    // 4. Encode GIF
    setProgress(0.85, 'Encoding GIF…');
    await tick();
    const bytes = encodeGIF(frames, palette, cfg.delay, true);
    const blob = new Blob([bytes.buffer], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);

    // 5. Show result
    $('previewImg').src = url;
    const a = $('download');
    a.href = url;
    const base = ($('file').files[0].name || 'clip').replace(/\.[^.]+$/, '');
    a.setAttribute('download', base + '-clip.gif');
    $('stFrames').textContent = frames.length;
    $('stSize').textContent = fmtBytes(bytes.length);
    $('stDims').textContent = outW + '×' + outH;
    $('result').classList.remove('hidden');
    hideProgress();
  } catch (e) {
    hideProgress();
    $('meta').classList.remove('hidden');
    $('meta').textContent = 'Encoding failed: ' + (e && e.message ? e.message : e);
  }
  $('extractBtn').disabled = false;
});
