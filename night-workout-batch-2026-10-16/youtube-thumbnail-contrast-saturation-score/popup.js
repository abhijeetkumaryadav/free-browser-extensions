/* Thumbnail Pixel Score — canvas pixel math for contrast + saturation. Zero network. */
// ENGINE-START

/** Convert one sRGB pixel to HSL saturation (0–100). */
function satOf(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
  if (mx === mn) return 0;
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d / (l > 0.5 ? 2 - mx - mn : mx + mn);
  return s * 100;
}

/** Relative luminance of one sRGB pixel (0–1). */
function lumOf(r, g, b) {
  const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Score an image's raw RGBA pixel data.
 * @param {{data:Uint8ClampedArray,width:number,height:number}} img
 * @returns {{contrast:number,saturation:number,overall:number,verdict:string}|null}
 *   contrast & saturation are 0–100; overall is their mean.
 */
function scorePixels(img) {
  if (!img || !img.data || img.data.length < 4 || !img.width || !img.height) return null;
  const d = img.data, n = d.length / 4;
  let sumLum = 0, sumLum2 = 0, sumSat = 0;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const lum = lumOf(r, g, b);
    sumLum += lum; sumLum2 += lum * lum;
    sumSat += satOf(r, g, b);
  }
  const mean = sumLum / n;
  const variance = Math.max(0, sumLum2 / n - mean * mean);
  const contrast = Math.min(100, Math.sqrt(variance) / 0.5 * 100);
  const saturation = Math.min(100, (sumSat / n) / 0.7);
  const overall = (contrast + saturation) / 2;
  return {
    contrast: round1(contrast),
    saturation: round1(saturation),
    overall: round1(overall),
    verdict: verdictFor(overall),
  };
}

function round1(x) { return Math.round(x * 10) / 10; }

/** Verdict bucket for the 0–100 overall score. */
function verdictFor(overall) {
  if (overall >= 70) return "High pop";
  if (overall >= 45) return "Moderate";
  return "Low pop";
}

/** Plain-language per-channel notes given the two 0–100 scores. */
function channelNotes(contrast, saturation) {
  const out = [];
  out.push(contrast >= 60
    ? "Contrast: strong tonal spread — text usually stays readable."
    : contrast >= 30
      ? "Contrast: middle ground — check small text legibility."
      : "Contrast: flat image — thumbnails can wash out at small sizes.");
  out.push(saturation >= 60
    ? "Saturation: vivid colors that tend to catch the eye."
    : saturation >= 30
      ? "Saturation: moderate color — balanced but not punchy."
      : "Saturation: muted palette — near-grayscale thumbnails blend in.");
  return out;
}
// ENGINE-END

// ---- UI wiring (not part of the tested engine) ----
const $ = (id) => document.getElementById(id);
const RING_LEN = 326.7;

function paint(res) {
  $("result").classList.remove("hidden");
  $("scoreNum").textContent = res.overall;
  $("scoreVerdict").textContent = res.verdict;
  $("ringFill").style.strokeDashoffset = (RING_LEN * (1 - res.overall / 100)).toFixed(1);
  $("barContrast").style.width = res.contrast + "%";
  $("barSat").style.width = res.saturation + "%";
  $("valContrast").textContent = res.contrast;
  $("valSat").textContent = res.saturation;
  $("notes").innerHTML = channelNotes(res.contrast, res.saturation)
    .map(t => `<div class="note">${t}</div>`).join("");
}

function analyzeFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const MAX = 240; // downscale for speed; stats are scale-invariant
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    const res = scorePixels({ data: px.data, width: w, height: h });
    if (res) { paint(res); chrome.storage.local.set({ last: res }); }
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

document.addEventListener("DOMContentLoaded", async () => {
  const drop = $("drop"), file = $("file");
  drop.onclick = () => file.click();
  file.onchange = (e) => analyzeFile(e.target.files[0]);
  drop.ondragover = (e) => { e.preventDefault(); drop.style.borderColor = "#f59e0b"; };
  drop.ondragleave = () => { drop.style.borderColor = ""; };
  drop.ondrop = (e) => { e.preventDefault(); drop.style.borderColor = ""; analyzeFile(e.dataTransfer.files[0]); };
  $("clearBtn").onclick = () => {
    file.value = ""; $("result").classList.add("hidden");
    chrome.storage.local.remove("last");
  };
  const d = await chrome.storage.local.get("last");
  if (d.last && typeof d.last.overall === "number") paint(d.last);
});
