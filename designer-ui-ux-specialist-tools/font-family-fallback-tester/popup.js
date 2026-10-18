/* FontStack Lab — font stack testing logic.
 * Detection uses the standard canvas-measurement technique: render a probe
 * string with "<font>, <fallback>" for several fallbacks and compare widths
 * against the bare fallback. A differing width means the font is installed.
 * Generic families are always available as browser fallbacks. All on-device. */

/* ---------- DOM refs ---------- */
const sampleText = document.getElementById("sampleText");
const stacksEl = document.getElementById("stacks");
const stackCount = document.getElementById("stackCount");
const customName = document.getElementById("customName");
const customFonts = document.getElementById("customFonts");
const addBtn = document.getElementById("addBtn");
const resetBtn = document.getElementById("resetBtn");
const toast = document.getElementById("toast");

/* ---------- Font detection ---------- */
const GENERICS = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
  "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "emoji", "math", "fangsong",
]);
const FALLBACKS = ["monospace", "serif", "sans-serif"];
const PROBE_TEXT = "mmmmmmmmmmlli"; // wide glyphs => measurable width deltas

const probeCtx = document.createElement("canvas").getContext("2d");
const BASELINES = {};
for (const fb of FALLBACKS) {
  probeCtx.font = `72px ${fb}`;
  BASELINES[fb] = probeCtx.measureText(PROBE_TEXT).width;
}

/* Returns "hit" (installed), "miss" (not installed), or "generic". */
function detectFont(name) {
  const clean = name.replace(/^["']|["']$/g, "").trim();
  if (!clean) return "miss";
  if (GENERICS.has(clean.toLowerCase())) return "generic";
  for (const fb of FALLBACKS) {
    probeCtx.font = `72px "${clean}", ${fb}`;
    if (probeCtx.measureText(PROBE_TEXT).width !== BASELINES[fb]) return "hit";
  }
  return "miss";
}

/* ---------- Preset stacks ---------- */
const PRESETS = [
  { name: "System stack", fonts: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"], custom: false },
  { name: "Classic sans", fonts: ["Helvetica Neue", "Helvetica", "Arial", "Segoe UI", "sans-serif"], custom: false },
  { name: "Editorial serif", fonts: ["Georgia", "Times New Roman", "Times", "serif"], custom: false },
  { name: "Code mono", fonts: ["SF Mono", "Cascadia Code", "Consolas", "Courier New", "monospace"], custom: false },
  { name: "Humanist", fonts: ["Verdana", "Geneva", "Tahoma", "sans-serif"], custom: false },
];

/* ---------- State ---------- */
let stacks = [];

/* Split a comma-separated stack, stripping surrounding quotes. */
function parseStack(str) {
  return str.split(",").map((f) => f.replace(/^["']|["']$/g, "").trim()).filter(Boolean);
}

function cssFontFamily(fonts) {
  return fonts.map((f) => (/\s/.test(f) && !GENERICS.has(f.toLowerCase()) ? `"${f}"` : f)).join(", ");
}

/* ---------- Rendering ---------- */
function renderStacks() {
  stacksEl.innerHTML = "";
  stackCount.textContent = stacks.length || "";
  stacks.forEach((stack, idx) => {
    const results = stack.fonts.map((f) => ({ name: f, status: detectFont(f) }));
    const resolved = results.find((r) => r.status === "hit" || r.status === "generic");
    const family = cssFontFamily(stack.fonts);

    const el = document.createElement("div");
    el.className = "stack";
    el.innerHTML = `
      <div class="stack-head">
        <span class="stack-name">${escapeHtml(stack.name)}</span>
        <button class="copy-btn" title="Copy CSS font-family">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          CSS
        </button>
        ${stack.custom ? `<button class="del-btn" title="Delete stack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>` : ""}
      </div>
      <div class="preview" style="font-family: ${family}">${escapeHtml(sampleText.value) || "&nbsp;"}</div>
      <div class="chips">
        ${results.map((r) => `<span class="chip ${r.status}" title="${statusTitle(r.status)}"><span class="dot"></span>${escapeHtml(r.name)}</span>`).join("")}
      </div>
      <div class="resolved">Resolves to <strong>${escapeHtml(resolved ? resolved.name : "nothing — stack is empty")}</strong> on this device</div>
    `;

    el.querySelector(".copy-btn").addEventListener("click", () =>
      copyText(`font-family: ${family};`, "font-family copied")
    );
    const del = el.querySelector(".del-btn");
    if (del) del.addEventListener("click", () => removeStack(idx));
    stacksEl.appendChild(el);
  });
}

function statusTitle(s) {
  return s === "hit" ? "Installed on this device"
    : s === "generic" ? "Generic family — always available as a fallback"
    : "Not installed — browser falls through to the next font";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ---------- Storage ---------- */
async function loadStacks() {
  const { stacks: saved } = await chrome.storage.local.get("stacks");
  stacks = Array.isArray(saved) && saved.length ? saved : structuredClone(PRESETS);
}

async function persistStacks() {
  await chrome.storage.local.set({ stacks });
}

async function removeStack(idx) {
  stacks.splice(idx, 1);
  await persistStacks();
  renderStacks();
  showToast("Stack deleted");
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

/* ---------- Events ---------- */
sampleText.addEventListener("input", renderStacks);

addBtn.addEventListener("click", async () => {
  const name = customName.value.trim() || "Custom stack";
  const fonts = parseStack(customFonts.value);
  if (!fonts.length) { showToast("Enter at least one font"); return; }
  stacks.push({ name, fonts, custom: true });
  await persistStacks();
  customName.value = "";
  customFonts.value = "";
  renderStacks();
  showToast("Custom stack added");
});

resetBtn.addEventListener("click", async () => {
  stacks = structuredClone(PRESETS);
  await persistStacks();
  renderStacks();
  showToast("Reset to presets");
});

/* ---------- Init ---------- */
(async () => {
  await loadStacks();
  renderStacks();
})();
