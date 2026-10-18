/* Deepfake Heuristic Warner — on-page media scanner.
 * Exposes window.__dfScan(): collects <img>/<video>/<audio> elements and runs
 * LOCAL heuristic checks only. No AI, no network analysis, no real/fake verdicts. */
'use strict';

window.__dfScan = async function () {
  const out = { images: [], videos: [], audios: [] };

  const SUSPICIOUS_TOKENS = [
    'deepfake', 'faceswap', 'face-swap', 'midjourney', 'dall-e', 'dalle',
    'stable-diffusion', 'stablediffusion', 'ai-generated', 'aigenerated',
    'synthetic', 'thispersondoesnotexist', 'generated-media'
  ];
  const sig = (text) => ({ text });

  const shortUrl = (u) => {
    try {
      const x = new URL(u, location.href);
      return x.host + x.pathname.slice(0, 60);
    } catch (e) { return String(u).slice(0, 80); }
  };

  /* --- tiny JPEG EXIF "Software" tag reader (same-origin fetch only) --- */
  function parseExifSoftware(buf, tiffStart, tiffLen) {
    try {
      const dv = new DataView(buf.buffer, buf.byteOffset + tiffStart, tiffLen);
      const le = dv.getUint8(0) === 0x49 && dv.getUint8(1) === 0x49; // "II"
      const be = dv.getUint8(0) === 0x4D && dv.getUint8(1) === 0x4D; // "MM"
      if (!le && !be) return null;
      const g16 = (o) => dv.getUint16(o, le);
      const g32 = (o) => dv.getUint32(o, le);
      if (g16(2) !== 42) return null;
      const ifd = g32(4);
      if (ifd > tiffLen - 2) return null;
      const n = g16(ifd);
      for (let e = 0; e < n && e < 64; e++) {
        const o = ifd + 2 + e * 12;
        if (g16(o) === 0x0131) { // Software tag
          const type = g16(o + 2), count = g32(o + 4);
          if (type === 2 && count > 1 && count < 256) {
            const vo = count <= 4 ? o + 8 : g32(o + 8);
            let s = '';
            for (let k = 0; k < count - 1; k++) s += String.fromCharCode(dv.getUint8(vo + k));
            return s.replace(/[^\x20-\x7e]/g, '').trim() || null;
          }
        }
      }
    } catch (e) { /* malformed EXIF — ignore */ }
    return null;
  }

  async function exifSoftware(url) {
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) return { status: 'http-error' };
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return { status: 'not-jpeg' };
      let i = 2;
      while (i + 4 < buf.length) {
        if (buf[i] !== 0xFF) break;
        const marker = buf[i + 1];
        const len = (buf[i + 2] << 8) | buf[i + 3];
        if (len < 2) break;
        if (marker === 0xE1 && len > 16 &&
            buf[i + 4] === 0x45 && buf[i + 5] === 0x78 && buf[i + 6] === 0x69 && buf[i + 7] === 0x66) {
          const sw = parseExifSoftware(buf, i + 10, len - 8);
          return { status: sw ? 'found' : 'no-software-tag', software: sw };
        }
        if (marker === 0xDA || marker === 0xD9) break;
        i += 2 + len;
      }
      return { status: 'no-exif' };
    } catch (e) { return { status: 'unfetchable' }; }
  }

  const sameOrigin = (u) => {
    try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; }
  };

  /* --- images --- */
  const imgs = [...document.images].slice(0, 40);
  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src) continue;
    const signals = [];
    const r = img.getBoundingClientRect();
    const dw = Math.round(r.width), dh = Math.round(r.height);

    if (dw <= 2 || dh <= 2) signals.push(sig('Tiny/hidden image element — could be a tracker or placeholder, not necessarily a fake.'));
    if (img.naturalWidth > 0 && dw > img.naturalWidth * 1.5) {
      signals.push(sig(`Upscaled display: shown ${dw}×${dh}px from a ${img.naturalWidth}×${img.naturalHeight}px file — enlargement can hide editing artifacts.`));
    }
    const low = src.toLowerCase();
    const hit = SUSPICIOUS_TOKENS.find((t) => low.includes(t));
    if (hit) signals.push(sig(`URL contains "${hit}" — informational only; the filename may describe AI-generated content.`));
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      signals.push(sig('Inline/blob image — original source URL unavailable, cannot check provenance.'));
    }
    // EXIF software tag (same-origin JPEGs only)
    let exif = null;
    if (sameOrigin(src) && /\.(jpe?g)(\?|#|$)/i.test(src)) {
      exif = await exifSoftware(src);
      if (exif.status === 'found' && exif.software) {
        signals.push(sig(`EXIF "Software" tag: "${exif.software}" — tells you the editing app, not whether it's a deepfake.`));
      }
    }
    out.images.push({
      src, short: shortUrl(src),
      dims: img.naturalWidth ? `${img.naturalWidth}×${img.naturalHeight}` : 'unknown size',
      signals: signals.map((s) => s.text)
    });
  }

  /* --- videos --- */
  const vids = [...document.querySelectorAll('video')].slice(0, 10);
  for (const v of vids) {
    const src = v.currentSrc || v.src || '(stream/embedded)';
    const signals = [];
    if (!isFinite(v.duration) || v.duration === 0) {
      signals.push(sig('No readable duration — could be a live stream or protected player; check the source directly.'));
    } else if (v.duration < 3 && v.loop) {
      signals.push(sig('Very short looping clip — a common format for viral synthetic videos; verify the source.'));
    }
    const low = String(src).toLowerCase();
    const hit = SUSPICIOUS_TOKENS.find((t) => low.includes(t));
    if (hit) signals.push(sig(`URL contains "${hit}" — informational only.`));
    signals.push(sig('Automated checks cannot assess lip-sync, blinking or lighting — use the checklist below.'));
    out.videos.push({
      src, short: shortUrl(src),
      dims: v.videoWidth ? `${v.videoWidth}×${v.videoHeight}` : 'unknown size',
      dur: isFinite(v.duration) && v.duration > 0 ? v.duration.toFixed(1) + 's' : 'unknown',
      signals: signals.map((s) => s.text)
    });
  }

  /* --- audios --- */
  const auds = [...document.querySelectorAll('audio')].slice(0, 10);
  for (const a of auds) {
    const src = a.currentSrc || a.src || '(stream/embedded)';
    out.audios.push({
      src, short: shortUrl(src),
      dur: isFinite(a.duration) && a.duration > 0 ? a.duration.toFixed(1) + 's' : 'unknown',
      signals: [
        'No automated voice analysis is possible locally — listen for flat/robotic tone and check the source, per the checklist below.'
      ]
    });
  }

  return out;
};
