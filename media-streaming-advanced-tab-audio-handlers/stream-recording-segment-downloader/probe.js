/* StreamSaver probe — runs in the page MAIN world so it can read real media
   element sources and fetch blob: URLs. Returns a JSON-serializable list. */
(async () => {
  'use strict';

  // Direct media file extensions we support. Segmented playlists are
  // deliberately excluded (no segment stitching, no DRM bypass).
  const MEDIA_RE = /\.(mp4|webm|ogv|mov|m4v|mkv|mp3|wav|ogg|oga|m4a|flac|aac|opus)(\?|#|$)/i;
  const SKIP_RE = /\.(m3u8|mpd|ism|f4m)(\?|#|$)/i;
  const MAX_BLOB_BYTES = 150 * 1024 * 1024; // safety cap for in-page blob conversion

  const items = [];
  const seen = new Set();

  function push(url, kind, note) {
    if (!url || typeof url !== 'string' || seen.has(url)) return;
    if (SKIP_RE.test(url)) return; // segmented/DRM manifests: out of scope
    seen.add(url);
    items.push({ url, kind, note: note || '', size: null, dataUrl: null });
  }

  // 1. Media elements and their <source> children (real, current sources).
  document.querySelectorAll('video, audio').forEach((el) => {
    const src = el.currentSrc || el.src;
    const label = el.tagName.toLowerCase() + ' element';
    if (src) push(src, el.tagName.toLowerCase(), label);
    el.querySelectorAll('source').forEach((s) => {
      if (s.src) push(s.src, 'source', label + ' <source>');
    });
  });

  // 2. Plain links that point at media files.
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.href; // resolved absolute URL
    if (MEDIA_RE.test(href)) {
      const text = (a.textContent || '').trim().slice(0, 60);
      push(href, 'link', text ? 'link: ' + text : 'linked media file');
    }
  });

  // 3. Network resource timing entries (catches JS-loaded media).
  try {
    performance.getEntriesByType('resource').forEach((entry) => {
      if (MEDIA_RE.test(entry.name)) push(entry.name, 'resource', 'loaded network resource');
    });
  } catch (e) { /* performance API unavailable — non-fatal */ }

  // Enrich: HEAD for size on http(s) URLs; fetch blob: URLs into data URLs
  // so the popup can download them via chrome.downloads.
  async function headSize(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', credentials: 'omit' });
      const len = res.headers.get('content-length');
      return len ? parseInt(len, 10) : null;
    } catch (e) { return null; }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  for (const item of items) {
    try {
      if (item.url.startsWith('blob:')) {
        const res = await fetch(item.url);
        const blob = await res.blob();
        if (blob.size > MAX_BLOB_BYTES) {
          item.note += ' (too large to transfer)';
        } else {
          item.size = blob.size;
          item.dataUrl = await blobToDataUrl(blob);
        }
      } else if (/^https?:/i.test(item.url)) {
        item.size = await headSize(item.url);
      }
    } catch (e) { /* enrichment is best-effort */ }
  }

  return items;
})();
