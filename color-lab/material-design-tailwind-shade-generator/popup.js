/* ShadeForge — generates a Tailwind-style 50–900 shade scale from a base hex.
 * Scale is built by interpolating lightness in HSL space around the base
 * color (anchor ~500), so it's an approximation, not the official palettes.
 * All local — no network, no tracking. */

"use strict";

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/* ---------- color math ---------- */

/** Parse #rgb or #rrggbb → {r,g,b} or null. */
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const to = (n) => Math.round(Math.min(255, Math.max(0, n)))
    .toString(16).padStart(2, "0");
  return ("#" + to(r) + to(g) + to(b)).toUpperCase();
}

/** sRGB → HSL. */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** HSL → sRGB. */
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const chan = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: chan(h + 1 / 3) * 255, g: chan(h) * 255, b: chan(h - 1 / 3) * 255 };
}

/**
 * Build the 10-step scale. The base color anchors step 500; lighter steps
 * walk up toward near-white, darker steps walk down toward near-black,
 * adjusting saturation slightly so grays stay neutral and hues stay vivid.
 */
function buildScale(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Lightness targets per step (Tailwind-like curve).
  const targets = { 50: 97, 100: 94, 200: 87, 300: 77, 400: 64,
                    500: l, 600: l - 12, 700: l - 24, 800: l - 37, 900: l - 50 };
  return STEPS.map((step) => {
    const tl = Math.min(97, Math.max(4, targets[step]));
    // Slightly desaturate very light steps and dark steps for realism.
    const sat = step <= 100 ? s * 0.35 : step >= 800 ? s * 0.9 : s;
    const c = hslToRgb(h, sat, tl);
    return { step, hex: rgbToHex(c.r, c.g, c.b) };
  });
}

/** Contrast pick: dark or light label text for a given hex. */
function labelColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#0a0e1a" : "#ffffff";
}

/* ---------- export formats ---------- */

function sanitizeName(name) {
  return (name || "brand").toLowerCase().replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "") || "brand";
}

function exportCode(scale, mode, name) {
  const n = sanitizeName(name);
  if (mode === "css") {
    return ":root {\n" + scale.map((s) =>
      `  --${n}-${s.step}: ${s.hex};`).join("\n") + "\n}";
  }
  if (mode === "json") {
    const obj = {};
    scale.forEach((s) => { obj[s.step] = s.hex; });
    return JSON.stringify({ [n]: obj }, null, 2);
  }
  // Tailwind config snippet.
  return `${n}: {\n` + scale.map((s) =>
    `  ${s.step}: '${s.hex}',`).join("\n") + "\n},";
}

/* ---------- UI ---------- */

const els = {
  base: document.getElementById("base"),
  hex: document.getElementById("hex"),
  random: document.getElementById("random"),
  swatches: document.getElementById("swatches"),
  code: document.getElementById("code"),
  name: document.getElementById("name"),
  copy: document.getElementById("copy"),
  toast: document.getElementById("toast"),
};

let mode = "tailwind";
let scale = [];

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("show"), 1600);
}

function copyText(text, msg) {
  const done = () => toast(msg || "Copied to clipboard");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed"); }
  ta.remove();
}

function render() {
  const hex = els.base.value;
  scale = buildScale(hex) || [];
  els.swatches.innerHTML = "";
  scale.forEach(({ step, hex: hx }) => {
    const row = document.createElement("div");
    row.className = "swatch";
    row.innerHTML = `<span class="chip"></span>` +
      `<span class="step"></span><span class="value"></span>`;
    row.querySelector(".chip").style.background = hx;
    const st = row.querySelector(".step");
    st.textContent = step;
    st.style.color = labelColor(hx);
    row.querySelector(".value").textContent = hx;
    row.querySelector(".value").style.color = labelColor(hx);
    row.style.background = hx;
    row.title = "Click to copy " + hx;
    row.addEventListener("click", () => copyText(hx, hx + " copied"));
    els.swatches.appendChild(row);
  });
  els.code.textContent = exportCode(scale, mode, els.name.value);
}

function persist() {
  chrome.storage.local.set({
    shadeforge: { base: els.base.value, name: els.name.value, mode },
  }).catch(() => {});
}

els.base.addEventListener("input", () => {
  els.hex.value = els.base.value.toUpperCase();
  render(); persist();
});
els.hex.addEventListener("change", () => {
  const rgb = hexToRgb(els.hex.value);
  if (rgb) {
    els.base.value = rgbToHex(rgb.r, rgb.g, rgb.b);
    els.hex.value = els.base.value.toUpperCase();
    render(); persist();
  } else {
    els.hex.value = els.base.value.toUpperCase();
    toast("Invalid hex — use #RGB or #RRGGBB");
  }
});
els.random.addEventListener("click", () => {
  const v = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  els.base.value = "#" + v;
  els.hex.value = els.base.value.toUpperCase();
  render(); persist();
});
els.name.addEventListener("input", () => { render(); persist(); });
els.copy.addEventListener("click", () =>
  copyText(els.code.textContent, "Export copied (" + mode + ")"));

document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;
    render(); persist();
  });
});

/* Restore last session. */
chrome.storage.local.get("shadeforge").then((res) => {
  const s = res.shadeforge;
  if (s) {
    if (s.base && hexToRgb(s.base)) {
      els.base.value = s.base;
      els.hex.value = s.base.toUpperCase();
    }
    if (s.name) els.name.value = s.name;
    if (s.mode && ["tailwind", "css", "json"].includes(s.mode)) {
      mode = s.mode;
      document.querySelectorAll(".seg-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === mode));
    }
  }
  render();
}).catch(() => render());
