/* Idle Motivation New Tab — new-tab page logic.
 * If the browser has been idle past the user's threshold, show a
 * motivational quote + gentle movement prompt. Otherwise show a calm
 * minimal new tab. Everything is bundled; nothing is fetched. */

const QUOTES = [
  "Small steps every day lead to big changes.",
  "Your future self will thank you for moving today.",
  "Motion is lotion — a little goes a long way.",
  "You don't have to be extreme, just consistent.",
  "Take care of your body; it's the only place you have to live.",
  "A short walk is better than no walk.",
  "Discipline beats motivation — start tiny.",
  "Energy creates energy. Move a little."
];

const PROMPTS = [
  "Stand up and shake out your shoulders.",
  "Do 10 gentle squats right now.",
  "Stretch your arms overhead for 30 seconds.",
  "Take a 2-minute walk.",
  "Roll your neck gently, 5 each side.",
  "March in place for 20 seconds."
];

const CALM = "Take a breath. You're doing fine.";

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function showMotivation() {
  $("kicker").textContent = "You've been idle a while — a gentle nudge";
  $("quote").textContent = "\u201C" + pick(QUOTES) + "\u201D";
  $("prompt").textContent = pick(PROMPTS);
  $("prompt").style.display = "";
}

function showCalm() {
  $("kicker").textContent = "New tab";
  $("quote").textContent = CALM;
  $("prompt").style.display = "none";
}

async function refresh() {
  const s = await chrome.storage.local.get({ enabled: true, idleMinutes: 15 });
  chrome.idle.setDetectionInterval(s.idleMinutes * 60);
  if (!s.enabled) { showCalm(); return; }
  const state = await chrome.idle.queryState(s.idleMinutes * 60);
  if (state === "idle") showMotivation();
  else showCalm();
}

$("new").addEventListener("click", () => {
  $("quote").textContent = "\u201C" + pick(QUOTES) + "\u201D";
  const p = $("prompt");
  if (p.style.display !== "none") p.textContent = pick(PROMPTS);
});

$("enabled").addEventListener("change", (e) => {
  chrome.storage.local.set({ enabled: e.target.checked }).then(refresh);
});

$("idleMinutes").addEventListener("change", (e) => {
  const v = Math.min(120, Math.max(5, parseInt(e.target.value, 10) || 15));
  e.target.value = v;
  chrome.storage.local.set({ idleMinutes: v }).then(refresh);
});

(async () => {
  const s = await chrome.storage.local.get({ enabled: true, idleMinutes: 15 });
  $("enabled").checked = s.enabled;
  $("idleMinutes").value = s.idleMinutes;
  refresh();
})();
