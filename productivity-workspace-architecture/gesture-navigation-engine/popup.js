/* Gesture Navigation Engine — popup settings UI. */

const GESTURES = [
  { key: "L",  label: "Go back",          hint: "Draw ←",
    svg: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>' },
  { key: "R",  label: "Go forward",       hint: "Draw →",
    svg: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>' },
  { key: "UD", label: "Reload page",      hint: "Draw ↑ then ↓",
    svg: '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M13 16l4 4 4-4"/>' },
  { key: "DR", label: "Close tab",        hint: "Draw ↓ then →",
    svg: '<path d="M12 3v13"/><path d="M12 16h9"/><path d="M17 12l4 4-4 4"/>' },
  { key: "U",  label: "Scroll to top",    hint: "Draw ↑",
    svg: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>' },
  { key: "D",  label: "Scroll to bottom", hint: "Draw ↓",
    svg: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>' },
];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const s = await chrome.storage.local.get({ gneEnabled: true, gneTrail: true, gneMap: null });
  $("master").checked = s.gneEnabled !== false;
  $("trail").checked = s.gneTrail !== false;

  $("master").addEventListener("change", (e) =>
    chrome.storage.local.set({ gneEnabled: e.target.checked }));
  $("trail").addEventListener("change", (e) =>
    chrome.storage.local.set({ gneTrail: e.target.checked }));

  renderGestures(s.gneMap || {});
}

function renderGestures(saved) {
  const box = $("gestures");
  box.innerHTML = "";
  for (const g of GESTURES) {
    const row = document.createElement("label");
    row.className = "rowline";

    const arrow = document.createElement("div");
    arrow.className = "g-arrow";
    arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${g.svg}</svg>`;

    const grow = document.createElement("div");
    grow.className = "grow";
    const b = document.createElement("b"); b.textContent = g.label;
    const hint = document.createElement("div"); hint.className = "hint"; hint.textContent = g.hint;
    grow.append(b, hint);

    const sw = document.createElement("span");
    sw.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = saved[g.key] ? saved[g.key].enabled !== false : true;
    const knob = document.createElement("span");
    sw.append(input, knob);
    input.addEventListener("change", async () => {
      const cur = await chrome.storage.local.get({ gneMap: null });
      const m = cur.gneMap || {};
      m[g.key] = { enabled: input.checked };
      await chrome.storage.local.set({ gneMap: m });
    });

    row.append(arrow, grow, sw);
    box.appendChild(row);
  }
}
