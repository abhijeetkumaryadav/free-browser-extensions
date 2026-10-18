/* Chroma — color harmony studio logic.
 * Pure client-side color math (hex <-> HSL), harmonic palette generation,
 * clipboard copy, and favorites persisted via chrome.storage.local. */

/* ---------- DOM refs ---------- */
const basePicker = document.getElementById("basePicker");
const baseHex = document.getElementById("baseHex");
const eyeBtn = document.getElementById("eyeBtn");
const modesEl = document.getElementById("modes");
const swatchesEl = document.getElementById("swatches");
const saveBtn = document.getElementById("saveBtn");
const exportBtn = document.getElementById("exportBtn");
const favoritesEl = document.getElementById("favorites");
const favCount = document.getElementById("favCount");
const toast = document.getElementById("toast");

/* ---------- State ---------- */
let state = { base: "#ec4899", mode: "complementary" };
let currentPalette = [];

/* ---------- Color math (hex <-> HSL) ---------- */
function hexToHsl(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: Math.round(hue * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return ("#" + to(f(0)) + to(f(8)) + to(f(4))).toUpperCase();
}

function isValidHex(v) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

/* ---------- Harmony generators: hue offsets per mode ---------- */
const HARMONIES = {
  complementary: { label: "Complementary", offsets: [0, 180] },
  triadic: { label: "Triadic", offsets: [0, 120, 240] },
  analogous: { label: "Analogous", offsets: [-30, 0, 30] },
  split: { label: "Split-complementary", offsets: [0, 150, 210] },
  tetradic: { label: "Tetradic", offsets: [0, 90, 180, 270] },
  mono: { label: "Monochromatic", lightness: [18, 34, 50, 66, 82] },
};

function generatePalette(base, mode) {
  const { h, s, l } = hexToHsl(base);
  const def = HARMONIES[mode];
  if (mode === "mono") {
    return def.lightness.map((li) => hslToHex(h, Math.max(s, 40), li));
  }
  return def.offsets.map((off) => hslToHex(h + off, s, l));
}

/* ---------- Rendering ---------- */
function renderSwatches() {
  currentPalette = generatePalette(state.base, state.mode);
  swatchesEl.innerHTML = "";
  currentPalette.forEach((hex) => {
    const el = document.createElement("div");
    el.className = "swatch";
    el.title = "Click to copy " + hex;
    el.innerHTML =
      `<div class="chip" style="background:${hex}"></div><div class="hex">${hex}</div>`;
    el.addEventListener("click", () => copyText(hex, hex + " copied"));
    swatchesEl.appendChild(el);
  });
}

function setBase(hex) {
  state.base = hex.toUpperCase();
  basePicker.value = state.base;
  baseHex.value = state.base;
  renderSwatches();
}

/* ---------- Favorites (chrome.storage.local) ---------- */
async function loadFavorites() {
  const { favorites = [] } = await chrome.storage.local.get("favorites");
  return favorites;
}

async function renderFavorites() {
  const favorites = await loadFavorites();
  favCount.textContent = favorites.length ? favorites.length : "";
  favoritesEl.innerHTML = "";
  if (!favorites.length) {
    favoritesEl.innerHTML = `<p class="empty">No favorites yet — save a palette you love.</p>`;
    return;
  }
  favorites.forEach((fav, idx) => {
    const el = document.createElement("div");
    el.className = "fav";
    el.title = "Load this palette";
    el.innerHTML = `
      <div class="mini">${fav.colors.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="meta">
        <div class="name">${escapeHtml(fav.name)}</div>
        <div class="sub">${escapeHtml(fav.modeLabel)} · ${fav.colors[0]}</div>
      </div>
      <button class="del" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>`;
    el.addEventListener("click", (e) => {
      if (e.target.closest(".del")) return;
      setBase(fav.colors[0]);
      [...modesEl.children].forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === fav.mode)
      );
      state.mode = fav.mode;
      renderSwatches();
      showToast("Palette loaded");
    });
    el.querySelector(".del").addEventListener("click", async () => {
      const list = await loadFavorites();
      list.splice(idx, 1);
      await chrome.storage.local.set({ favorites: list });
      renderFavorites();
      showToast("Favorite deleted");
    });
    favoritesEl.appendChild(el);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ---------- Clipboard + toast ---------- */
async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(msg || "Copied");
  } catch {
    showToast("Copy failed — select and copy manually");
  }
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

/* ---------- CSS variable export ---------- */
function exportCssVars() {
  const lines = currentPalette.map((hex, i) => `  --chroma-${i + 1}: ${hex};`);
  const css = `:root {\n${lines.join("\n")}\n}`;
  copyText(css, "CSS variables copied");
}

/* ---------- Events ---------- */
basePicker.addEventListener("input", (e) => setBase(e.target.value));
baseHex.addEventListener("change", (e) => {
  const v = e.target.value.trim();
  if (isValidHex(v)) setBase(v.startsWith("#") ? v : "#" + v);
  else { e.target.value = state.base; showToast("Invalid hex color"); }
});

modesEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode");
  if (!btn) return;
  [...modesEl.children].forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.mode = btn.dataset.mode;
  renderSwatches();
});

// EyeDropper API (Chromium); degrade gracefully elsewhere.
if (typeof EyeDropper === "undefined") {
  eyeBtn.disabled = true;
  eyeBtn.title = "Screen color picking is not supported in this browser";
} else {
  eyeBtn.addEventListener("click", async () => {
    try {
      const result = await new EyeDropper().open();
      setBase(result.sRGBHex);
      showToast("Color picked from screen");
    } catch {
      /* user cancelled the picker */
    }
  });
}

saveBtn.addEventListener("click", async () => {
  const favorites = await loadFavorites();
  const name = `${HARMONIES[state.mode].label} · ${new Date().toLocaleDateString()}`;
  favorites.unshift({ name, mode: state.mode, modeLabel: HARMONIES[state.mode].label, colors: currentPalette });
  await chrome.storage.local.set({ favorites: favorites.slice(0, 60) });
  renderFavorites();
  showToast("Palette saved to favorites");
});

exportBtn.addEventListener("click", exportCssVars);

/* ---------- Init ---------- */
renderSwatches();
renderFavorites();
