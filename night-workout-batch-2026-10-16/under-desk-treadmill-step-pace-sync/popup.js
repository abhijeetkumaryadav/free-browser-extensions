/* ============================================================
 * Step Pace Log — popup logic
 * Manual sessions (steps + minutes), pace = steps / minutes.
 * Everything persists in chrome.storage.local. No network.
 * ============================================================ */

// ENGINE-START
/** Compute pace (steps/min), rounded to 1 decimal; null when minutes invalid. */
function paceOf(steps, minutes) {
  steps = Number(steps); minutes = Number(minutes);
  if (!Number.isFinite(steps) || !Number.isFinite(minutes) || minutes <= 0 || steps < 0) return null;
  return Math.round((steps / minutes) * 10) / 10;
}

/** Aggregate totals over a session array. */
function totalsOf(sessions) {
  const steps = sessions.reduce((a, s) => a + s.steps, 0);
  const minutes = sessions.reduce((a, s) => a + s.minutes, 0);
  return {
    steps,
    minutes: Math.round(minutes * 10) / 10,
    pace: paceOf(steps, minutes),
    count: sessions.length,
  };
}
// ENGINE-END

const $ = (id) => document.getElementById(id);
const KEY = "stepPaceSessions";

async function load() {
  const { [KEY]: sessions = [] } = await chrome.storage.local.get(KEY);
  return Array.isArray(sessions) ? sessions : [];
}
async function save(sessions) {
  await chrome.storage.local.set({ [KEY]: sessions });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

async function render() {
  const sessions = await load();
  const t = totalsOf(sessions);
  $("tSteps").textContent = t.steps.toLocaleString();
  $("tMins").textContent = t.minutes.toLocaleString();
  $("tPace").textContent = t.pace == null ? "–" : t.pace;
  $("tCount").textContent = t.count;

  const list = $("list");
  list.innerHTML = "";
  if (sessions.length === 0) {
    list.innerHTML = '<li class="empty">No sessions yet — log your first one above.</li>';
    return;
  }
  // Newest first.
  [...sessions].sort((a, b) => b.ts - a.ts).forEach((s) => {
    const li = document.createElement("li");
    li.className = "item";
    const pace = paceOf(s.steps, s.minutes);
    li.innerHTML =
      `<div><strong>${s.steps.toLocaleString()} steps</strong> · ${s.minutes} min` +
      `<div class="meta">${fmtDate(s.ts)}</div></div>` +
      `<div><span class="pace">${pace == null ? "–" : pace + "/min"}</span></div>`;
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      const all = await load();
      await save(all.filter((x) => x.id !== s.id));
      render();
    });
    li.appendChild(del);
    list.appendChild(li);
  });
}

function showErr(msg) {
  const el = $("err");
  el.hidden = false;
  el.textContent = msg;
}

async function onAdd() {
  $("err").hidden = true;
  const steps = Number($("inSteps").value);
  const minutes = Number($("inMins").value);
  if (!Number.isFinite(steps) || steps <= 0 || !Number.isInteger(steps)) {
    showErr("Enter a positive whole number of steps.");
    return;
  }
  if (!Number.isFinite(minutes) || minutes <= 0) {
    showErr("Enter a positive number of minutes.");
    return;
  }
  const sessions = await load();
  sessions.push({ id: "s" + Date.now() + Math.floor(Math.random() * 1e4), steps, minutes, ts: Date.now() });
  await save(sessions);
  $("inSteps").value = "";
  $("inMins").value = "";
  render();
}

$("btnAdd").addEventListener("click", onAdd);
$("btnClear").addEventListener("click", async () => {
  if (confirm("Delete all logged sessions?")) {
    await save([]);
    render();
  }
});

render();
