/* Breathing Companion — guided breathing pacer + private mood check-in log.
   No diagnosis, no treatment claims. Everything stays local. */

const RHYTHMS = {
  box:    { label: "Boxed", phases: [["Inhale", 4], ["Hold", 4], ["Exhale", 4], ["Hold", 4]] },
  "478":  { label: "4-7-8", phases: [["Inhale", 4], ["Hold", 7], ["Exhale", 8]] },
  custom: { label: "Custom", phases: null }, // built from inputs
};

const KEY_SESSIONS = "sessions";
const KEY_MOODS = "moods";

let sessions = 0;
let moods = [];            // [{ts, mood, note}]
let selectedMood = 3;
let rhythm = "box";
let running = false;
let timerId = null;
let phaseIdx = 0;
let secondsLeft = 0;
let rounds = 0;
let elapsed = 0;
let phases = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- persistence ---------- */

async function load() {
  const data = await chrome.storage.local.get([KEY_SESSIONS, KEY_MOODS]);
  sessions = Number(data[KEY_SESSIONS]) || 0;
  moods = Array.isArray(data[KEY_MOODS]) ? data[KEY_MOODS] : [];
}

function persistSessions() { return chrome.storage.local.set({ [KEY_SESSIONS]: sessions }); }
function persistMoods() { return chrome.storage.local.set({ [KEY_MOODS]: moods }); }

/* ---------- breathing engine ---------- */

/** Build the phase list for the current rhythm selection. */
function buildPhases() {
  if (rhythm === "custom") {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || lo));
    const inh = clamp($("inInhale").value, 1, 12);
    const hold = clamp($("inHold").value, 0, 12);
    const exh = clamp($("inExhale").value, 1, 12);
    $("customLabel").textContent = `${inh} · ${hold} · ${exh}`;
    const ph = [["Inhale", inh]];
    if (hold > 0) ph.push(["Hold", hold]);
    ph.push(["Exhale", exh]);
    return ph;
  }
  return RHYTHMS[rhythm].phases.map(p => [...p]);
}

/** Render circle scale + labels for the current phase progress. */
function renderPhase() {
  const [name, total] = phases[phaseIdx];
  $("phaseLabel").textContent = name;
  $("phaseSeconds").textContent = secondsLeft;
  const circle = $("breathCircle");
  const done = total - secondsLeft;
  // Grow on inhale, hold at top on hold, shrink on exhale
  let scale = 1;
  if (name === "Inhale") scale = 1 + 0.35 * (done / total);
  else if (name === "Hold") scale = 1.35;
  else if (name === "Exhale") scale = 1.35 - 0.35 * (done / total);
  circle.style.transform = `scale(${scale.toFixed(3)})`;
  $("roundNum").textContent = rounds + 1;
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  $("totalTime").textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function tick() {
  secondsLeft--;
  elapsed++;
  if (secondsLeft <= 0) {
    phaseIdx++;
    if (phaseIdx >= phases.length) {
      phaseIdx = 0;
      rounds++;
    }
    secondsLeft = phases[phaseIdx][1];
  }
  renderPhase();
}

function start() {
  phases = buildPhases();
  if (!phases.length) return;
  running = true;
  phaseIdx = 0;
  rounds = 0;
  elapsed = 0;
  secondsLeft = phases[0][1];
  $("startBtn").classList.add("hidden");
  $("stopBtn").classList.remove("hidden");
  document.querySelectorAll("#rhythmRow .rhythm").forEach(b => b.disabled = true);
  renderPhase();
  timerId = setInterval(tick, 1000);
}

/** Stop and count the session if at least one full round finished. */
async function stop(countIt = true) {
  if (!running) return;
  running = false;
  clearInterval(timerId);
  if (countIt && rounds > 0) {
    sessions++;
    await persistSessions();
    updateCount();
  }
  rounds = 0; elapsed = 0;
  $("phaseLabel").textContent = "Ready";
  $("phaseSeconds").textContent = "";
  $("breathCircle").style.transform = "scale(1)";
  $("roundNum").textContent = "0";
  $("totalTime").textContent = "0:00";
  $("startBtn").classList.remove("hidden");
  $("stopBtn").classList.add("hidden");
  document.querySelectorAll("#rhythmRow .rhythm").forEach(b => b.disabled = false);
}

function updateCount() {
  $("sessionCount").textContent = `${sessions} session${sessions === 1 ? "" : "s"}`;
}

/* ---------- mood check-in ---------- */

function renderMoods() {
  const list = $("moodList");
  const sorted = [...moods].sort((a, b) => b.ts - a.ts).slice(0, 30);
  $("moodEmpty").classList.toggle("hidden", sorted.length > 0);
  list.innerHTML = sorted.map((m, i) => `
    <div class="mood-entry">
      <div class="mood-badge">${m.mood}</div>
      <div class="mood-meta">
        <div class="mood-date">${new Date(m.ts).toLocaleString()}</div>
        ${m.note ? `<div class="mood-text">${escapeHtml(m.note)}</div>` : ""}
      </div>
      <button class="mood-del" data-ts="${m.ts}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join("");
  list.querySelectorAll(".mood-del").forEach(b =>
    b.addEventListener("click", async () => {
      const ts = Number(b.dataset.ts);
      moods = moods.filter(x => x.ts !== ts);
      await persistMoods();
      renderMoods();
    }));
}

async function logMood() {
  const note = $("moodNote").value.trim();
  moods.push({ ts: Date.now(), mood: selectedMood, note });
  await persistMoods();
  $("moodNote").value = "";
  renderMoods();
}

/* ---------- init ---------- */

document.addEventListener("DOMContentLoaded", async () => {
  await load();
  updateCount();
  renderMoods();

  // Tabs
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
    $("tab-breathe").classList.toggle("hidden", t.dataset.tab !== "breathe");
    $("tab-mood").classList.toggle("hidden", t.dataset.tab !== "mood");
  }));

  // Rhythm picker
  document.querySelectorAll("#rhythmRow .rhythm").forEach(b => b.addEventListener("click", () => {
    if (running) return;
    document.querySelectorAll("#rhythmRow .rhythm").forEach(x => x.classList.toggle("active", x === b));
    rhythm = b.dataset.rhythm;
    $("customControls").classList.toggle("hidden", rhythm !== "custom");
  }));
  ["inInhale", "inHold", "inExhale"].forEach(id =>
    $(id).addEventListener("input", () => {
      if (rhythm === "custom") {
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || lo));
        $("customLabel").textContent = `${clamp($("inInhale").value,1,12)} · ${clamp($("inHold").value,0,12)} · ${clamp($("inExhale").value,1,12)}`;
      }
    }));

  $("startBtn").addEventListener("click", start);
  $("stopBtn").addEventListener("click", () => stop(true));

  // Mood picker
  document.querySelectorAll("#moodRow .mood").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#moodRow .mood").forEach(x => x.classList.toggle("active", x === b));
    selectedMood = Number(b.dataset.mood);
  }));
  document.querySelector('#moodRow .mood[data-default]').classList.add("active");
  $("logMoodBtn").addEventListener("click", logMood);
  $("moodNote").addEventListener("keydown", e => { if (e.key === "Enter") logMood(); });
});
