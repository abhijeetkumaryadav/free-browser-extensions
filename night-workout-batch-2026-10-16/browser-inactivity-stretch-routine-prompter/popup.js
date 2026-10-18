/* Stretch Prompt — bundled generic stretch routine (no medical claims). */
const STRETCHES = [
  { name: "Neck rolls", desc: "Slowly roll your head in a circle, 5× each direction." },
  { name: "Shoulder shrugs", desc: "Lift shoulders to ears, hold 3s, drop. Repeat 5×." },
  { name: "Wrist circles", desc: "Extend arms and circle your wrists, 10× each way." },
  { name: "Stand & reach", desc: "Stand up, reach arms overhead, hold 10s." },
  { name: "Ankle circles", desc: "Lift one foot and circle the ankle, 10× each side." },
  { name: "Deep breaths", desc: "Three slow breaths in through the nose, out through the mouth." },
];

const $ = (id) => document.getElementById(id);
const NOTIF_ID = "stretch-prompt-nudge";

/* ---- state ---- */
async function getState() {
  return chrome.storage.local.get({
    enabled: false, threshold: 600, done: 0, promptPending: false,
  });
}

/* ---- views ---- */
async function render() {
  const s = await getState();
  $("threshold").value = String(s.threshold);
  $("toggle").textContent = s.enabled ? "Disable" : "Enable";
  $("doneCount").textContent = s.done;

  const showRoutine = s.promptPending;
  $("routineView").classList.toggle("hidden", !showRoutine);
  $("settingsView").classList.toggle("hidden", showRoutine);
  if (showRoutine) buildSteps();
}

function buildSteps() {
  const ol = $("steps");
  ol.innerHTML = "";
  STRETCHES.forEach((st, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="n">${i + 1}</span><span><b>${st.name}</b><br>${st.desc}</span>`;
    li.addEventListener("click", () => li.classList.toggle("done"));
    ol.appendChild(li);
  });
}

/* ---- actions ---- */
$("toggle").addEventListener("click", async () => {
  const s = await getState();
  const enabled = !s.enabled;
  await chrome.storage.local.set({ enabled, promptPending: false });
  chrome.runtime.sendMessage({ type: "refresh-schedule" });
  render();
});

$("threshold").addEventListener("change", async (e) => {
  await chrome.storage.local.set({ threshold: Number(e.target.value), promptPending: false });
  chrome.runtime.sendMessage({ type: "refresh-schedule" });
});

$("skip").addEventListener("click", async () => {
  await chrome.storage.local.set({ promptPending: false });
  chrome.notifications.clear(NOTIF_ID);
  render();
});

$("finish").addEventListener("click", async () => {
  const s = await getState();
  await chrome.storage.local.set({ promptPending: false, done: s.done + 1 });
  chrome.notifications.clear(NOTIF_ID);
  render();
});

render();
