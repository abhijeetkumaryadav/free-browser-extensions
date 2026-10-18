// Keyword Density Optimizer — all analysis runs on-device, nothing leaves the popup.

const $ = (id) => document.getElementById(id);

// Checklist: `auto` names the detector function (below) that can pre-evaluate it.
// Items without `auto` are ticked manually by the user.
const CHECKS = [
  { id: "first100", label: "Keyword appears in the first 100 words", auto: "first100" },
  { id: "density", label: "Density sits in the ideal 1–2% band", auto: "density" },
  { id: "nostuff", label: "No keyword stuffing (density under 3%)", auto: "nostuff" },
  { id: "heading", label: "Keyword used in a heading or subheading", auto: null },
  { id: "title", label: "Keyword in the page title / meta description", auto: null },
  { id: "alt", label: "Keyword in image alt text", auto: null },
  { id: "opening", label: "Keyword in the opening paragraph", auto: null },
];

let lastStats = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("clear").addEventListener("click", clearAll);
  const { kdo_ticks = {} } = await chrome.storage.local.get("kdo_ticks");
  renderChecklist(kdo_ticks, {});
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearAll() {
  $("kw").value = "";
  $("text").value = "";
  $("results").hidden = true;
  lastStats = null;
}

function analyze() {
  const kwRaw = $("kw").value.trim();
  const text = $("text").value;
  if (!kwRaw || !text.trim()) return;

  const words = text.match(/[A-Za-z0-9']+/g) || [];
  const total = words.length || 1;
  const re = new RegExp("\\b" + escRe(kwRaw) + "\\b", "gi");

  let occ = 0;
  let firstPos = Infinity;
  const thirds = [0, 0, 0];
  let m;
  while ((m = re.exec(text)) !== null) {
    occ++;
    const wi = (text.slice(0, m.index).match(/[A-Za-z0-9']+/g) || []).length;
    if (wi < firstPos) firstPos = wi;
    thirds[Math.min(2, Math.floor((wi / total) * 3))]++;
  }
  const density = (occ / total) * 100;
  lastStats = { occ, total, density, firstPos, thirds };
  renderResults(lastStats);
}

function verdictFor(d) {
  if (d < 0.5) return "Density is very low — the keyword may be under-optimized. Weave it in naturally a few more times.";
  if (d < 1) return "A touch low. One or two more natural placements would help.";
  if (d <= 2) return "Ideal range. This reads naturally and signals the topic clearly.";
  if (d <= 3) return "Slightly high — check it still reads naturally to a human.";
  return "Keyword stuffing risk. Search engines penalize this; rewrite some occurrences with synonyms.";
}

function renderResults(s) {
  $("results").hidden = false;
  $("pct").textContent = s.density.toFixed(2) + "%";
  $("occ").textContent = s.occ;
  $("words").textContent = s.total.toLocaleString();
  // Ring scale: 0–5% maps to 0–100% of the ring.
  const ringPct = Math.min(100, (s.density / 5) * 100);
  $("ring").style.background =
    `conic-gradient(var(--accent) ${ringPct}%, rgba(255,255,255,.08) ${ringPct}%)`;
  $("verdict").textContent = verdictFor(s.density);

  const ids = ["nB", "nM", "nE"];
  const bars = ["barB", "barM", "barE"];
  const max = Math.max(...s.thirds, 1);
  s.thirds.forEach((n, i) => {
    $(ids[i]).textContent = n;
    $(bars[i]).style.width = (n / max) * 100 + "%";
  });

  const auto = {
    first100: s.firstPos < 100,
    density: s.density >= 1 && s.density <= 2,
    nostuff: s.density < 3,
  };
  chrome.storage.local.get("kdo_ticks").then(({ kdo_ticks = {} }) => {
    renderChecklist(kdo_ticks, auto);
  });
}

async function renderChecklist(ticks, auto) {
  const box = $("checklist");
  box.innerHTML = "";
  for (const c of CHECKS) {
    const label = document.createElement("label");
    label.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    const autoVal = c.auto ? auto[c.auto] : undefined;
    input.checked = autoVal !== undefined ? autoVal : !!ticks[c.id];
    input.disabled = autoVal !== undefined; // auto-detected rows are read-only
    input.addEventListener("change", async () => {
      const { kdo_ticks = {} } = await chrome.storage.local.get("kdo_ticks");
      kdo_ticks[c.id] = input.checked;
      await chrome.storage.local.set({ kdo_ticks });
    });
    const span = document.createElement("span");
    span.className = "lbl";
    span.textContent = c.label;
    label.append(input, span);
    if (autoVal !== undefined) {
      const b = document.createElement("span");
      b.className = "badge " + (autoVal ? "ok" : "miss");
      b.textContent = autoVal ? "detected" : "missing";
      label.appendChild(b);
    }
    box.appendChild(label);
  }
}
