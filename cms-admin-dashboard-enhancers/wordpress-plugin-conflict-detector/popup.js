/**
 * Plugin Conflict Detector — guided binary-search troubleshooter.
 *
 * Honest scope: the extension cannot touch WordPress admin. The user
 * deactivates plugins manually; this popup tracks the classic
 * "deactivate half, test, repeat" bisect and narrows down the culprit.
 * All state lives in chrome.storage.local — nothing leaves the device.
 */

"use strict";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const DEFAULT_STATE = {
  step: 1,            // 1 symptom · 2 plugins · 3 bisect · 4 report
  symptom: "",
  started: "",
  plugins: [],        // [{ name, note }]
  candidates: [],     // plugin names still under suspicion
  round: 0,
  currentSplit: null, // { off: [...], on: [...] } for the active round
  log: [],            // [{ round, off, on, result }]
  culprit: null,
};

let state = { ...DEFAULT_STATE };

async function loadState() {
  const saved = await chrome.storage.local.get("pcd");
  if (saved.pcd) state = { ...DEFAULT_STATE, ...saved.pcd };
}

async function saveState() {
  await chrome.storage.local.set({ pcd: state });
}

/* ------------------------------------------------------------------ */
/* Element helpers                                                     */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

function showStep(n) {
  state.step = n;
  for (let i = 1; i <= 4; i++) $("step" + i).classList.toggle("hidden", i !== n);
  document.querySelectorAll(".steps li").forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });
  saveState();
}

/* ------------------------------------------------------------------ */
/* Step 1 — symptom                                                    */
/* ------------------------------------------------------------------ */

function bindStep1() {
  $("symptomInput").value = state.symptom;
  $("startedInput").value = state.started;
  $("toStep2").addEventListener("click", () => {
    state.symptom = $("symptomInput").value.trim();
    state.started = $("startedInput").value.trim();
    if (!state.symptom) {
      $("symptomInput").focus();
      $("symptomInput").style.borderColor = "#ef4444";
      setTimeout(() => ($("symptomInput").style.borderColor = ""), 1200);
      return;
    }
    showStep(2);
  });
}

/* ------------------------------------------------------------------ */
/* Step 2 — plugin list                                                */
/* ------------------------------------------------------------------ */

function renderPlugins() {
  const list = $("pluginList");
  list.innerHTML = "";
  $("pluginCount").textContent = state.plugins.length;

  state.plugins.forEach((p, i) => {
    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "plugin-row";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = p.name;

    // Per-plugin note toggle
    const noteBtn = document.createElement("button");
    noteBtn.className = "icon-btn";
    noteBtn.title = "Add a note";
    noteBtn.textContent = "✎";
    noteBtn.setAttribute("aria-label", `Note for ${p.name}`);

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn del";
    delBtn.title = "Remove";
    delBtn.textContent = "✕";
    delBtn.setAttribute("aria-label", `Remove ${p.name}`);
    delBtn.addEventListener("click", () => {
      state.plugins.splice(i, 1);
      saveState();
      renderPlugins();
    });

    row.append(name, noteBtn, delBtn);
    li.appendChild(row);

    // Collapsible per-plugin note field
    const noteWrap = document.createElement("div");
    noteWrap.className = "note-input hidden";
    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.placeholder = "Note, e.g. updated yesterday";
    noteInput.value = p.note || "";
    noteInput.addEventListener("input", () => {
      state.plugins[i].note = noteInput.value;
      saveState();
    });
    noteWrap.appendChild(noteInput);
    li.appendChild(noteWrap);

    noteBtn.addEventListener("click", () => noteWrap.classList.toggle("hidden"));

    list.appendChild(li);
  });

  $("startBisect").disabled = state.plugins.length < 2;
  $("startBisect").textContent =
    state.plugins.length < 2 ? "Add at least 2 plugins" : "Start binary search";
}

function addPlugin() {
  const input = $("pluginInput");
  const name = input.value.trim();
  if (!name) return;
  if (state.plugins.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    input.value = "";
    input.focus();
    return;
  }
  state.plugins.push({ name, note: "" });
  input.value = "";
  input.focus();
  saveState();
  renderPlugins();
}

function bindStep2() {
  $("addPluginBtn").addEventListener("click", addPlugin);
  $("pluginInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addPlugin();
  });
  $("backTo1").addEventListener("click", () => showStep(1));
  $("startBisect").addEventListener("click", () => {
    state.candidates = state.plugins.map((p) => p.name);
    state.round = 0;
    state.log = [];
    state.culprit = null;
    nextRound();
  });
  renderPlugins();
}

/* ------------------------------------------------------------------ */
/* Step 3 — binary search                                              */
/* ------------------------------------------------------------------ */

/** Split candidates: first half deactivated, rest kept active. */
function split(candidates) {
  const mid = Math.ceil(candidates.length / 2);
  return { off: candidates.slice(0, mid), on: candidates.slice(mid) };
}

function renderSplit() {
  const { off, on } = state.currentSplit;
  $("roundNum").textContent = state.round;

  const offList = $("deactivateList");
  offList.innerHTML = "";
  off.forEach((n) => {
    const li = document.createElement("li");
    li.className = "off";
    li.textContent = n;
    offList.appendChild(li);
  });

  const onList = $("keepList");
  onList.innerHTML = "";
  on.forEach((n) => {
    const li = document.createElement("li");
    li.className = "on";
    li.textContent = n;
    onList.appendChild(li);
  });
}

function nextRound() {
  // Culprit isolated?
  if (state.candidates.length === 1) {
    state.culprit = state.candidates[0];
    buildReport();
    showStep(4);
    return;
  }
  state.round += 1;
  state.currentSplit = split(state.candidates);
  renderSplit();
  showStep(3);
}

/**
 * Bisect logic: the "off" group was deactivated in WP admin.
 * - Still broken  → culprit is among the plugins still active ("on").
 * - Fixed         → culprit is among the deactivated plugins ("off").
 */
function recordResult(result) {
  const { off, on } = state.currentSplit;
  state.log.push({ round: state.round, off: [...off], on: [...on], result });
  state.candidates = result === "fixed" ? [...off] : [...on];
  saveState();
  nextRound();
}

function bindStep3() {
  $("stillBrokenBtn").addEventListener("click", () => recordResult("still-broken"));
  $("fixedBtn").addEventListener("click", () => recordResult("fixed"));
  $("backTo2").addEventListener("click", () => showStep(2));
}

/* ------------------------------------------------------------------ */
/* Step 4 — report                                                     */
/* ------------------------------------------------------------------ */

function pluginNote(name) {
  const p = state.plugins.find((x) => x.name === name);
  return p && p.note ? ` (${p.note})` : "";
}

function buildReport() {
  $("culpritName").textContent = state.culprit || "—";
  const lines = [
    "WORDPRESS PLUGIN CONFLICT — DIAGNOSIS REPORT",
    "Generated with Plugin Conflict Detector (guided binary search)",
    "",
    `Symptom: ${state.symptom || "—"}`,
    state.started ? `Started: ${state.started}` : null,
    `Plugins tested: ${state.plugins.length}`,
    `Rounds: ${state.log.length}`,
    "",
    "LIKELY CULPRIT:",
    `→ ${state.culprit}${pluginNote(state.culprit)}`,
    "",
    "ROUND LOG:",
    ...state.log.map(
      (r) =>
        `Round ${r.round}: deactivated [${r.off.join(", ")}] → ${r.result === "fixed" ? "FIXED" : "still broken"}`
    ),
    "",
    "NEXT STEPS:",
    "1. Keep only the culprit deactivated and confirm the site works.",
    "2. Check for an update, or contact the plugin author with this report.",
    "3. Look for an alternative plugin if the issue is unresolved.",
  ].filter((l) => l !== null);
  $("reportBox").value = lines.join("\n");
}

function bindStep4() {
  $("copyReportBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("reportBox").value);
      $("copyReportBtn").textContent = "Copied ✓";
      setTimeout(() => ($("copyReportBtn").textContent = "Copy report"), 1500);
    } catch {
      $("reportBox").select();
      document.execCommand("copy");
    }
  });
  $("newSessionBtn").addEventListener("click", resetAll);
}

async function resetAll() {
  state = { ...DEFAULT_STATE };
  await chrome.storage.local.remove("pcd");
  $("symptomInput").value = "";
  $("startedInput").value = "";
  renderPlugins();
  showStep(1);
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  bindStep1();
  bindStep2();
  bindStep3();
  bindStep4();
  $("resetBtn").addEventListener("click", resetAll);

  // Resume where the user left off
  if (state.step === 3 && state.currentSplit) {
    renderSplit();
    showStep(3);
  } else if (state.step === 4 && state.culprit) {
    buildReport();
    showStep(4);
  } else {
    showStep(Math.min(state.step, 2));
  }
});
