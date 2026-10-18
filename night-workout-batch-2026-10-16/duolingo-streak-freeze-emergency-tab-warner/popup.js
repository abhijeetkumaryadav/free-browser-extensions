// ENGINE-START — pure date/streak helpers, headless-testable.
// Day key in local date: "YYYY-MM-DD".
function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
// Consecutive done-days ending yesterday (or today if today done).
function streakFrom(doneDates) {
  const set = new Set(doneDates);
  let streak = 0;
  const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1); // start from yesterday if today not done
  while (set.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
// ENGINE-END

const $ = (id) => document.getElementById(id);

// --- state ---
async function getState() {
  const s = await chrome.storage.local.get({ time: "20:00", enabled: true, done: [] });
  return s;
}
async function saveState(patch) {
  await chrome.storage.local.set(patch);
  chrome.runtime.sendMessage({ type: "RESCHEDULE" }).catch(() => {});
}

async function render() {
  const s = await getState();
  $("timeInput").value = s.time;
  $("enableChk").checked = s.enabled;
  const today = dayKey();
  const doneToday = s.done.includes(today);
  const status = $("todayStatus");
  status.textContent = doneToday ? "Done today — nice!" : "Not done today";
  status.parentElement.classList.toggle("done", doneToday);
  $("doneBtn").disabled = doneToday;
  $("doneBtn").textContent = doneToday ? "Already marked done" : "Mark today's practice done";
  $("streakNum").textContent = streakFrom(s.done);
  $("nextInfo").textContent = s.enabled
    ? `Reminder set for ${s.time} daily.`
    : "Daily reminder is off.";
}

$("doneBtn").addEventListener("click", async () => {
  const s = await getState();
  const today = dayKey();
  if (!s.done.includes(today)) {
    s.done.push(today);
    await saveState({ done: s.done });
  }
  await render();
});

$("saveBtn").addEventListener("click", async () => {
  const t = $("timeInput").value || "20:00";
  await saveState({ time: t, enabled: $("enableChk").checked });
  await render();
});
$("enableChk").addEventListener("change", async () => {
  await saveState({ enabled: $("enableChk").checked });
  await render();
});
$("resetBtn").addEventListener("click", async () => {
  if (confirm("Reset your streak to zero?")) {
    await saveState({ done: [] });
    await render();
  }
});

document.addEventListener("DOMContentLoaded", render);
