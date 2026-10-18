/* TabForge shared theme logic — used by popup.html and newtab.html.
   A theme is a plain object; everything persists in chrome.storage.local. */

// Default theme applied on first run / reset.
const DEFAULT_THEME = {
  accent: "#ec4899",
  mode: "dark",                 // "dark" | "light"
  bgType: "gradient",           // "gradient" | "image"
  gradient: ["#14101f", "#3b115f"],
  bgImage: "",                  // data URL, only used when bgType === "image"
  tileStyle: "rounded",          // "rounded" | "square" | "pill"
  showClock: true,
  showSearch: true,
};

// Built-in preset themes (user presets live in storage under "userPresets").
const BUILTIN_PRESETS = [
  { name: "Neon Dusk",    accent: "#ec4899", mode: "dark",  bgType: "gradient", gradient: ["#14101f", "#3b115f"] },
  { name: "Ocean Glass",  accent: "#22d3ee", mode: "dark",  bgType: "gradient", gradient: ["#06121f", "#0b3b52"] },
  { name: "Sunset Paper", accent: "#f97316", mode: "light", bgType: "gradient", gradient: ["#fff7ed", "#fed7aa"] },
  { name: "Forest Mist",  accent: "#34d399", mode: "dark",  bgType: "gradient", gradient: ["#07130d", "#14532d"] },
  { name: "Mono Ink",     accent: "#a1a1aa", mode: "dark",  bgType: "gradient", gradient: ["#09090b", "#27272a"] },
];

/** Load the active theme from storage (falls back to DEFAULT_THEME). */
async function loadTheme() {
  const { activeTheme } = await chrome.storage.local.get("activeTheme");
  return { ...DEFAULT_THEME, ...(activeTheme || {}) };
}

/** Persist the active theme. */
async function saveTheme(theme) {
  await chrome.storage.local.set({ activeTheme: theme });
}

/** Apply a theme object to a root element by setting CSS variables. */
function applyThemeToRoot(theme, root = document.documentElement) {
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--mode", theme.mode);
  const [g1, g2] = theme.gradient || DEFAULT_THEME.gradient;
  const bg = theme.bgType === "image" && theme.bgImage
    ? `url("${theme.bgImage}") center / cover no-repeat, linear-gradient(135deg, ${g1}, ${g2})`
    : `linear-gradient(135deg, ${g1}, ${g2})`;
  root.style.setProperty("--page-bg", bg);

  // Derived surfaces for dark / light modes.
  if (theme.mode === "dark") {
    root.style.setProperty("--surface", "rgba(20,20,26,.72)");
    root.style.setProperty("--surface-solid", "#14141a");
    root.style.setProperty("--text", "#f4f4f5");
    root.style.setProperty("--text-dim", "rgba(244,244,245,.62)");
    root.style.setProperty("--border", "rgba(255,255,255,.09)");
    root.style.setProperty("--input-bg", "rgba(255,255,255,.06)");
  } else {
    root.style.setProperty("--surface", "rgba(255,255,255,.72)");
    root.style.setProperty("--surface-solid", "#ffffff");
    root.style.setProperty("--text", "#18181b");
    root.style.setProperty("--text-dim", "rgba(24,24,27,.62)");
    root.style.setProperty("--border", "rgba(0,0,0,.09)");
    root.style.setProperty("--input-bg", "rgba(0,0,0,.05)");
  }

  const radius = theme.tileStyle === "pill" ? "999px" : theme.tileStyle === "square" ? "6px" : "16px";
  root.style.setProperty("--tile-radius", radius);
}
