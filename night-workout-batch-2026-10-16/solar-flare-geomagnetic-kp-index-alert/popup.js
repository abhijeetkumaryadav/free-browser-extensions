/* Kp Index Watcher — popup logic.
 * Fully local: readings + threshold live in chrome.storage.local. No network. */

"use strict";

/* // ENGINE-START — pure helpers, headless-testable */
// Kp band data: label + plain-language description for each band.
const KP_BANDS = [
  { min: 0, max: 3, label: "Quiet",        desc: "Normal conditions" },
  { min: 4, max: 4, label: "Active",       desc: "Unsettled field" },
  { min: 5, max: 5, label: "G1 · Minor",   desc: "Weak fluctuations" },
  { min: 6, max: 6, label: "G2 · Moderate",desc: "High-lat aurora" },
  { min: 7, max: 7, label: "G3 · Strong",  desc: "Voltage corrections" },
  { min: 8, max: 8, label: "G4 · Severe",  desc: "Widespread aurora" },
  { min: 9, max: 9, label: "G5 · Extreme", desc: "Extreme event" },
];

// Band lookup for a Kp value 0–9. Returns null for anything else.
function kpBand(kp) {
  if (!Number.isInteger(kp) || kp < 0 || kp > 9) return null;
  return KP_BANDS.find((b) => kp >= b.min && kp <= b.max) || null;
}

// True when v is a valid storm-alert threshold choice (5–9).
function isValidThreshold(v) {
  return Number.isInteger(v) && v >= 5 && v <= 9;
}

// Validate a reading object {kp, note}. Returns error string or "".
function validateReading(kp, note) {
  if (!Number.isInteger(kp) || kp < 0 || kp > 9) {
    return "Kp must be a whole number from 0 to 9.";
  }
  if (note && note.length > 80) return "Note is too long (max 80 chars).";
  return "";
}

// Sort readings newest-first by timestamp.
function sortReadings(readings) {
  return readings.slice().sort((a, b) => b.ts - a.ts);
}

// Compact local date-time for history rows.
function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
/* // ENGINE-END */

/* ---------- Lucide-style outline icons (inline SVG, stroke-only) ---------- */
const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

/* ---------- Storage ---------- */
const store = {
  async get() {
    const d = await chrome.storage.local.get({ readings: [], threshold: 7 });
    return { readings: d.readings || [], threshold: d.threshold };
  },
  async set(patch) { await chrome.storage.local.set(patch); },
};

/* ---------- Rendering ---------- */
function renderScale() {
  const el = document.getElementById("kpScale");
  el.innerHTML = KP_BANDS.map((b) => {
    const range = b.min === b.max ? `Kp ${b.min}` : `Kp ${b.min}–${b.max}`;
    return `<div class="scale-row">
      <span class="scale-kp">${range}</span>
      <span class="scale-label">${b.label}</span>
      <span class="scale-desc">${b.desc}</span>
    </div>`;
  }).join("");
}

function renderHistory(readings, threshold) {
  const ul = document.getElementById("history");
  const sorted = sortReadings(readings);
  if (!sorted.length) {
    ul.innerHTML = '<li class="empty">No readings logged yet.</li>';
    return;
  }
  ul.innerHTML = sorted.map((r) => `
    <li>
      <span class="kp-badge${r.kp >= threshold ? " storm" : ""}">Kp ${r.kp}</span>
      <span class="hist-note">${escapeHtml(r.note || "—")}</span>
      <span class="hist-time">${fmtWhen(r.ts)}</span>
      <button class="hist-del" data-id="${r.id}" title="Delete">×</button>
    </li>`).join("");
  ul.querySelectorAll(".hist-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { readings: cur } = await store.get();
      await store.set({ readings: cur.filter((r) => r.id !== btn.dataset.id) });
      await refresh();
    });
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderThresholdNote(threshold) {
  document.getElementById("thresholdNote").textContent =
    `Your watch note: Kp ${threshold}+ — check manually when you see this level.`;
}

async function refresh() {
  const { readings, threshold } = await store.get();
  document.getElementById("threshold").value = String(threshold);
  renderThresholdNote(threshold);
  renderHistory(readings, threshold);
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("sunIcon").innerHTML = ICONS.sun;
  document.getElementById("infoIcon").innerHTML = ICONS.info;
  renderScale();
  await refresh();

  document.getElementById("saveThreshold").addEventListener("click", async () => {
    const v = parseInt(document.getElementById("threshold").value, 10);
    if (!isValidThreshold(v)) return;
    await store.set({ threshold: v });
    await refresh();
  });

  document.getElementById("addReading").addEventListener("click", async () => {
    const errEl = document.getElementById("formError");
    const kp = parseInt(document.getElementById("kpValue").value, 10);
    const note = document.getElementById("kpNote").value.trim();
    const err = validateReading(kp, note);
    if (err) { errEl.textContent = err; return; }
    errEl.textContent = "";
    const { readings } = await store.get();
    readings.push({ id: "r" + Date.now(), ts: Date.now(), kp, note });
    await store.set({ readings: readings.slice(-100) }); // cap at 100
    document.getElementById("kpValue").value = "";
    document.getElementById("kpNote").value = "";
    await refresh();
  });

  document.getElementById("kpValue").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("addReading").click();
  });

  document.getElementById("clearAll").addEventListener("click", async () => {
    if (!confirm("Delete all logged Kp readings?")) return;
    await store.set({ readings: [] });
    await refresh();
  });
});
