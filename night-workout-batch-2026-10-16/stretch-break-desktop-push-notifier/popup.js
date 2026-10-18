// Stretch Break — popup logic
// Edits the user's custom messages + interval, shows the done log.

const $ = (id) => document.getElementById(id);
const DEFAULT_MSGS = ["Stand up and stretch", "Roll your shoulders", "Look away from the screen"];

async function load() {
  const { stretch = {}, log = [] } = await chrome.storage.local.get(["stretch", "log"]);
  $("enabled").checked = stretch.enabled ?? false;
  $("interval").value = stretch.intervalMin ?? 60;
  $("intervalVal").textContent = ($("interval").value) + " min";
  $("messages").value = (stretch.messages ?? DEFAULT_MSGS).join("\n");
  renderLog(log);
}

function renderLog(log) {
  const ul = $("log");
  ul.innerHTML = "";
  $("emptyLog").style.display = log.length ? "none" : "block";
  for (const entry of log.slice(0, 20)) {
    const li = document.createElement("li");
    const d = new Date(entry.at);
    const when = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const a = document.createElement("span");
    a.textContent = "Break done";
    const b = document.createElement("span");
    b.textContent = when;
    li.append(a, b);
    ul.appendChild(li);
  }
}

function collect() {
  return {
    enabled: $("enabled").checked,
    intervalMin: Math.max(10, Number($("interval").value) || 60),
    messages: $("messages").value.split("\n").map((m) => m.trim()).filter(Boolean),
  };
}

async function save(showHint = true) {
  const settings = collect();
  await chrome.storage.local.set({ stretch: settings });
  chrome.runtime.sendMessage({ type: "STRETCH_SETTINGS_UPDATED" }).catch(() => {});
  if (showHint) {
    $("saveHint").textContent = settings.messages.length
      ? "Saved — reminders " + (settings.enabled ? "on." : "off.")
      : "Saved — add at least one message to enable reminders.";
    setTimeout(() => ($("saveHint").textContent = ""), 2500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("interval").addEventListener("input", () => {
    $("intervalVal").textContent = $("interval").value + " min";
  });
  $("enabled").addEventListener("change", () => save(false));
  $("interval").addEventListener("change", () => save(false));
  $("saveBtn").addEventListener("click", () => save(true));
  $("testBtn").addEventListener("click", async () => {
    await save(false);
    chrome.runtime.sendMessage({ type: "STRETCH_TEST_NOW" }).catch(() => {});
  });
  $("clearLog").addEventListener("click", async () => {
    await chrome.storage.local.set({ log: [] });
    renderLog([]);
  });
});
