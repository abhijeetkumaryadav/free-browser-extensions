/* Popup logic for Idle Quest Assigner: settings + done log. */
const $ = (id) => document.getElementById(id);
const DEFAULTS = { enabled: true, idleMinutes: 15, doneLog: [] };

async function load() {
  const s = await chrome.storage.local.get(DEFAULTS);
  $("enabled").checked = s.enabled;
  $("idleMinutes").value = s.idleMinutes;
  renderLog(s.doneLog);
}

/** Render the done log newest-first. */
function renderLog(log) {
  const ul = $("log");
  ul.innerHTML = "";
  if (!log.length) {
    ul.innerHTML = '<li class="empty">No completed quests yet.</li>';
    return;
  }
  [...log].reverse().forEach((e) => {
    const li = document.createElement("li");
    const t = document.createElement("time");
    t.textContent = new Date(e.at).toLocaleString();
    li.textContent = e.quest;
    li.appendChild(t);
    ul.appendChild(li);
  });
}

$("enabled").addEventListener("change", (e) => {
  chrome.storage.local.set({ enabled: e.target.checked });
});

$("idleMinutes").addEventListener("change", (e) => {
  const v = Math.min(120, Math.max(5, parseInt(e.target.value, 10) || 15));
  e.target.value = v;
  chrome.storage.local.set({ idleMinutes: v });
});

$("test").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "TEST_QUEST" });
});

$("clear").addEventListener("click", async () => {
  if (!confirm("Clear the done log?")) return;
  await chrome.storage.local.set({ doneLog: [] });
  renderLog([]);
});

load();
