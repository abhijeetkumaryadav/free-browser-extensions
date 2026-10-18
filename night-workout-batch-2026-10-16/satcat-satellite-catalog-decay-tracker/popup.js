// Satellite Decay Tracker — popup logic
// ================= ENGINE-START =================
// Pure, headless-testable engine: satellite list math.
const MS_PER_DAY = 86400000;

/** Validate and normalize a satellite entry. Returns entry or null. */
function makeSatellite(name, dateISO) {
  const clean = (name || "").trim();
  if (!clean) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO || "")) return null;
  const t = Date.parse(dateISO + "T00:00:00");
  if (isNaN(t)) return null;
  return { id: "sat_" + Math.random().toString(36).slice(2, 10), name: clean, decayISO: dateISO };
}

/** Days remaining (negative if past), using date-only comparison. */
function daysRemaining(dateISO, nowMs) {
  const t = Date.parse(dateISO + "T00:00:00");
  const day = Math.floor(t / MS_PER_DAY);
  const today = Math.floor(nowMs / MS_PER_DAY);
  return day - today;
}

/** Split entries into upcoming (decay >= today) and past lists. */
function splitUpcomingPast(list, nowMs) {
  const up = [], past = [];
  for (const s of list) {
    (daysRemaining(s.decayISO, nowMs) >= 0 ? up : past).push(s);
  }
  up.sort((a, b) => a.decayISO.localeCompare(b.decayISO));
  past.sort((a, b) => b.decayISO.localeCompare(a.decayISO));
  return { upcoming: up, past };
}

/** Human countdown label. */
function countdownLabel(dateISO, nowMs) {
  const d = daysRemaining(dateISO, nowMs);
  if (d < 0) return Math.abs(d) === 1 ? "1 day ago" : Math.abs(d) + " days ago";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return d + " days";
}
// ================= ENGINE-END =================

const $ = (id) => document.getElementById(id);
const STORE_KEY = "satcat_decay_list_v1";

async function load() {
  const { [STORE_KEY]: list } = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(list) ? list : [];
}
async function save(list) {
  await chrome.storage.local.set({ [STORE_KEY]: list });
}

function renderItem(s, nowMs, container, showCountdown) {
  const el = document.createElement("div");
  el.className = "list-item";
  const meta = document.createElement("div");
  meta.className = "meta";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = s.name;
  const sub = document.createElement("div");
  sub.className = "sub";
  sub.textContent = s.decayISO;
  if (showCountdown) {
    const cd = document.createElement("span");
    cd.className = "countdown";
    cd.textContent = "  ·  " + countdownLabel(s.decayISO, nowMs);
    sub.appendChild(cd);
  }
  meta.appendChild(name);
  meta.appendChild(sub);
  const del = document.createElement("button");
  del.className = "small danger";
  del.textContent = "Delete";
  del.addEventListener("click", async () => {
    const list = await load();
    await save(list.filter((x) => x.id !== s.id));
    refresh();
  });
  el.appendChild(meta);
  el.appendChild(del);
  container.appendChild(el);
}

async function refresh() {
  const list = await load();
  const nowMs = Date.now();
  const { upcoming, past } = splitUpcomingPast(list, nowMs);
  const upBox = $("upcoming"), pastBox = $("past");
  upBox.innerHTML = ""; pastBox.innerHTML = "";
  if (!upcoming.length) upBox.innerHTML = '<div class="empty">No upcoming decays.</div>';
  if (!past.length) pastBox.innerHTML = '<div class="empty">Nothing decayed yet.</div>';
  upcoming.forEach((s) => renderItem(s, nowMs, upBox, true));
  past.forEach((s) => renderItem(s, nowMs, pastBox, false));
}

document.addEventListener("DOMContentLoaded", () => {
  refresh();
  $("add").addEventListener("click", async () => {
    const entry = makeSatellite($("name").value, $("date").value);
    if (!entry) return;
    const list = await load();
    list.push(entry);
    await save(list);
    $("name").value = "";
    $("date").value = "";
    refresh();
  });
});
