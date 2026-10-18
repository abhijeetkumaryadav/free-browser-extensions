// Focus Session Sound Mixer — popup logic.
// The countdown is derived from the timer's endAt timestamp in storage,
// so it stays accurate even if the popup was closed. The service worker
// owns phase transitions; the offscreen document owns the audio.

const $ = (id) => document.getElementById(id);
const RING_C = 2 * Math.PI * 52;

const SOUNDS = [
  { id: "rain",  name: "Rain" },
  { id: "white", name: "White noise" },
  { id: "pink",  name: "Pink noise" },
  { id: "brown", name: "Brown noise" },
];

const PHASE_LABEL = { idle: "Ready", focus: "Focus", break: "Short break", longbreak: "Long break" };
const ICON_PLAY = '<polygon points="6 3 20 12 6 21 6 3"/>';
const ICON_PAUSE = '<rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/>';

let timer = null, mixer = null, stats = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await refresh();
  buildMixerRows();
  $("masterVol").addEventListener("input", onMaster);
  $("mainBtn").addEventListener("click", onMain);
  $("skipBtn").addEventListener("click", () => send({ cmd: "timer.skip" }));
  $("resetBtn").addEventListener("click", () => send({ cmd: "timer.reset" }));
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      send({ cmd: "timer.setLengths", focusLen: +c.dataset.f, breakLen: +c.dataset.b });
    })
  );
  $("cApply").addEventListener("click", () => {
    send({ cmd: "timer.setLengths", focusLen: +$("cFocus").value || 25, breakLen: +$("cBreak").value || 5 });
  });
  setInterval(tick, 1000);
}

async function refresh() {
  const cur = await chrome.storage.local.get(["timer", "mixer", "stats"]);
  timer = cur.timer; mixer = cur.mixer; stats = cur.stats;
  renderAll();
}

async function tick() {
  const cur = await chrome.storage.local.get(["timer", "stats"]);
  timer = cur.timer; stats = cur.stats;
  renderTimer();
  renderStats();
}

function send(msg) {
  chrome.runtime.sendMessage(msg).finally(() => setTimeout(refresh, 150));
}

// --- timer rendering ----------------------------------------------------------

function phaseTotalMs() {
  if (!timer || timer.phase === "idle") return (timer ? timer.focusLen : 25) * 60000;
  const len = timer.phase === "focus" ? timer.focusLen
    : timer.phase === "break" ? timer.breakLen : timer.longBreakLen;
  return len * 60000;
}

function remainingMs() {
  if (!timer || timer.phase === "idle") return phaseTotalMs();
  if (timer.running) return Math.max(0, timer.endAt - Date.now());
  return timer.remainingMs || 0;
}

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function renderTimer() {
  if (!timer) return;
  const rem = remainingMs();
  $("time").textContent = fmt(rem);
  const pill = $("phasePill");
  pill.textContent = PHASE_LABEL[timer.phase] || "Ready";
  pill.className = "pill " + timer.phase;
  $("ringFg").style.strokeDashoffset = (RING_C * (1 - rem / phaseTotalMs())).toFixed(1);
  // main button state
  const label = $("mainLabel"), icon = $("mainIcon");
  if (timer.phase === "idle") { label.textContent = "Start focus"; icon.innerHTML = ICON_PLAY; }
  else if (timer.running) { label.textContent = "Pause"; icon.innerHTML = ICON_PAUSE; }
  else { label.textContent = "Resume"; icon.innerHTML = ICON_PLAY; }
  // active preset chip
  document.querySelectorAll(".chip").forEach((c) =>
    c.classList.toggle("active", +c.dataset.f === timer.focusLen && +c.dataset.b === timer.breakLen)
  );
}

function renderStats() {
  if (!stats) return;
  $("stats").innerHTML =
    `<b>${stats.todaySessions}</b> session${stats.todaySessions === 1 ? "" : "s"} today · ` +
    `<b>${stats.totalFocusMin}</b> focus minutes all time`;
}

async function onMain() {
  if (!timer || timer.phase === "idle") send({ cmd: "timer.start", phase: "focus" });
  else if (timer.running) send({ cmd: "timer.pause" });
  else send({ cmd: "timer.resume" });
}

// --- mixer rendering ------------------------------------------------------------

function buildMixerRows() {
  const box = $("soundRows");
  box.innerHTML = "";
  $("masterVol").value = Math.round(mixer.master * 100);
  for (const s of SOUNDS) {
    const st = mixer.sounds[s.id];
    const row = document.createElement("div");
    row.className = "sound-row";
    const nm = document.createElement("div");
    nm.className = "nm"; nm.textContent = s.name;
    const power = document.createElement("button");
    power.className = "power" + (st.on ? " on" : "");
    power.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>';
    power.title = "Toggle " + s.name;
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = 0; slider.max = 100;
    slider.value = Math.round(st.vol * 100);
    power.addEventListener("click", () => {
      mixer.sounds[s.id].on = !mixer.sounds[s.id].on;
      power.classList.toggle("on", mixer.sounds[s.id].on);
      pushMixer();
    });
    slider.addEventListener("input", () => {
      mixer.sounds[s.id].vol = slider.value / 100;
      if (slider.value > 0 && !mixer.sounds[s.id].on) {
        mixer.sounds[s.id].on = true;
        power.classList.add("on");
      }
      pushMixer();
    });
    row.append(nm, power, slider);
    box.appendChild(row);
  }
}

function onMaster(e) {
  mixer.master = e.target.value / 100;
  pushMixer();
}

let pushTimer = null;
function pushMixer() {
  // persist immediately, but debounce the (slightly heavier) audio apply
  chrome.storage.local.set({ mixer });
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => send({ cmd: "audio.apply", mixer }), 60);
}

function renderAll() {
  renderTimer();
  renderStats();
}
