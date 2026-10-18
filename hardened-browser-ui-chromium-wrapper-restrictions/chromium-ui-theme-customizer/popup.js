/* TabForge studio popup — theme editing, presets, live preview. */
"use strict";

const ACCENTS = ["#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#22d3ee", "#818cf8", "#a78bfa"];
const GRADIENTS = [
  ["#14101f", "#3b115f"], ["#06121f", "#0b3b52"], ["#07130d", "#14532d"],
  ["#1c0a0a", "#7c2d12"], ["#09090b", "#27272a"], ["#1e1b4b", "#6d28d9"],
];

let theme = { ...DEFAULT_THEME };
let themeName = "Default";

const $ = (id) => document.getElementById(id);

/** Persist + refresh the preview. Debounced writes keep storage calm. */
let saveTimer = null;
function commit(name) {
  applyThemeToRoot(theme, document.getElementById("preview"));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveTheme(theme);
    await chrome.storage.local.set({ themeName: name || themeName });
  }, 250);
}

// --- Accent swatches ---
function buildAccentSwatches() {
  const box = $("accentSwatches");
  box.innerHTML = "";
  for (const c of ACCENTS) {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = c;
    b.title = c;
    b.className = theme.accent.toLowerCase() === c.toLowerCase() ? "on" : "";
    b.addEventListener("click", () => { theme.accent = c; $("accentCustom").value = c; syncUI(); commit(); });
    box.appendChild(b);
  }
}

// --- Gradient presets ---
function buildGradientPresets() {
  const box = $("gradPresets");
  box.innerHTML = "";
  for (const [a, b] of GRADIENTS) {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "grad" + (theme.gradient[0] === a && theme.gradient[1] === b ? " on" : "");
    d.style.background = `linear-gradient(135deg, ${a}, ${b})`;
    d.title = `${a} → ${b}`;
    d.addEventListener("click", () => { theme.gradient = [a, b]; theme.bgType = "gradient"; syncUI(); commit(); });
    box.appendChild(d);
  }
}

/** Segmented control wiring. */
function wireSeg(id, key) {
  const seg = $(id);
  seg.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      theme[key] = b.dataset.v;
      syncUI();
      commit();
    });
  });
}

/** Reflect the theme object into all controls. */
function syncUI() {
  buildAccentSwatches();
  buildGradientPresets();
  $("accentCustom").value = theme.accent;
  $("gradA").value = theme.gradient[0];
  $("gradB").value = theme.gradient[1];
  $("showClock").checked = theme.showClock;
  $("showSearch").checked = theme.showSearch;
  for (const [segId, key] of [["bgTypeSeg", "bgType"], ["modeSeg", "mode"], ["tileSeg", "tileStyle"]]) {
    $(segId).querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === theme[key]));
  }
  $("gradientRow").hidden = theme.bgType !== "gradient";
  $("imageRow").hidden = theme.bgType !== "image";
  applyThemeToRoot(theme, $("preview"));
}

/** Render built-in + user presets. */
async function renderPresets() {
  const { userPresets = [] } = await chrome.storage.local.get("userPresets");
  const box = $("presetList");
  box.innerHTML = "";
  const all = [
    ...BUILTIN_PRESETS.map((p) => ({ ...p, builtin: true })),
    ...userPresets.map((p, i) => ({ ...p, userIndex: i })),
  ];
  for (const p of all) {
    const row = document.createElement("div");
    row.className = "preset";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = p.bgType === "image" && p.bgImage
      ? `url("${p.bgImage}") center / cover`
      : `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})`;
    dot.style.border = `2px solid ${p.accent}`;
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = p.name;
    const apply = document.createElement("button");
    apply.textContent = "Apply";
    apply.addEventListener("click", () => {
      theme = { ...DEFAULT_THEME, ...p, name: undefined };
      delete theme.builtin; delete theme.userIndex;
      themeName = p.name;
      syncUI(); commit(p.name);
    });
    row.append(dot, nm, apply);
    if (!p.builtin) {
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "✕";
      del.title = "Delete preset";
      del.addEventListener("click", async () => {
        const cur = (await chrome.storage.local.get("userPresets")).userPresets || [];
        cur.splice(p.userIndex, 1);
        await chrome.storage.local.set({ userPresets: cur });
        renderPresets();
      });
      row.appendChild(del);
    }
    box.appendChild(row);
  }
}

// --- Control listeners ---
$("accentCustom").addEventListener("input", (e) => { theme.accent = e.target.value; syncUI(); commit(); });
$("gradA").addEventListener("input", (e) => { theme.gradient = [e.target.value, theme.gradient[1]]; theme.bgType = "gradient"; syncUI(); commit(); });
$("gradB").addEventListener("input", (e) => { theme.gradient = [theme.gradient[0], e.target.value]; theme.bgType = "gradient"; syncUI(); commit(); });
$("showClock").addEventListener("change", (e) => { theme.showClock = e.target.checked; commit(); });
$("showSearch").addEventListener("change", (e) => { theme.showSearch = e.target.checked; commit(); });
wireSeg("bgTypeSeg", "bgType");
wireSeg("modeSeg", "mode");
wireSeg("tileSeg", "tileStyle");

// Background image upload — stored as data URL, capped at ~2 MB.
$("bgImageInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert("Image is larger than 2 MB — pick a smaller one."); return; }
  const reader = new FileReader();
  reader.onload = () => { theme.bgImage = reader.result; theme.bgType = "image"; syncUI(); commit(); };
  reader.readAsDataURL(file);
});
$("bgImageClear").addEventListener("click", () => { theme.bgImage = ""; theme.bgType = "gradient"; syncUI(); commit(); });

// Save current theme as a user preset.
$("presetSave").addEventListener("click", async () => {
  const name = $("presetName").value.trim();
  if (!name) { $("presetName").focus(); return; }
  const { userPresets = [] } = await chrome.storage.local.get("userPresets");
  userPresets.push({ name, ...theme });
  await chrome.storage.local.set({ userPresets });
  $("presetName").value = "";
  renderPresets();
});

// Reset everything.
$("resetBtn").addEventListener("click", async () => {
  theme = { ...DEFAULT_THEME };
  themeName = "Default";
  await saveTheme(theme);
  await chrome.storage.local.set({ themeName });
  syncUI();
  commit();
});

// --- Init ---
(async function init() {
  theme = await loadTheme();
  themeName = (await chrome.storage.local.get("themeName")).themeName || "Default";
  syncUI();
  renderPresets();
})();
