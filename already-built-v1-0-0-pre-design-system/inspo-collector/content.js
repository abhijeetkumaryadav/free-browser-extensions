// Inspo Collector — content script: best-effort color palette extraction.
// Runs in page context so it can read already-loaded <img> pixels.
// Returns null palette when the canvas is CORS-tainted.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "GET_PALETTE") {
    sendResponse({ palette: extractPalette(msg.srcUrl) || [] });
  }
  return true;
});

function extractPalette(srcUrl) {
  try {
    const imgs = Array.from(document.images || []);
    const img = imgs.find(
      (el) => el.currentSrc === srcUrl || el.src === srcUrl
    );
    if (!img || !img.complete || img.naturalWidth === 0) return null;

    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data; // throws if tainted

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // skip transparent
      const r = data[i] >> 5;
      const g = data[i + 1] >> 5;
      const b = data[i + 2] >> 5;
      const key = (r << 6) | (g << 3) | b;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const top = [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return top.map(([key]) => {
      const r = (key >> 6) & 7;
      const g = (key >> 3) & 7;
      const b = key & 7;
      const hx = (v) =>
        Math.round((v * 255) / 7)
          .toString(16)
          .padStart(2, "0");
      return `#${hx(r)}${hx(g)}${hx(b)}`;
    });
  } catch (e) {
    return null; // tainted canvas or anything else — degrade gracefully
  }
}
