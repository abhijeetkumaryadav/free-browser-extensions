/* Bubble Latency Tracker — popup logic.
   HONEST SCOPE: this extension cannot instrument Bubble apps. It is a manual
   stopwatch log: you time plugin/workflow steps yourself and the extension
   aggregates averages, slowest steps, and exports CSV. All on-device. */
"use strict";

const $ = (id) => document.getElementById(id);

/* storage shape: { plugins: [name], runs: [{name, ms, note, at}], active: {name, startedAt} | null } */
async function loadState() {
  const s = await chrome.storage.local.get(["plugins", "runs", "active"]);
  return { plugins: s.plugins || [], runs: s.runs || [], active: s.active || null };
}
async function saveState(patch) {
  await chrome.storage.local.set(patch);
}

/* ---------- formatting ---------- */
function fmtMs(ms) {
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + "s";
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toFixed(0).padStart(2, "0")}s`;
}
function fmtClock(ms) {
  const t = Math.floor(ms / 100);
  const d = t % 10, s = Math.floor(t / 10) % 60, m = Math.floor(t / 600);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${d}`;
}
function fmtTime(ts) {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ---------- renderers ---------- */
function renderPlugins(plugins, runs, active) {
  const list = $("pluginList");
  list.innerHTML = "";
  if (!plugins.length) {
    list.innerHTML = '<p class="empty-note">Add a plugin or workflow step to start timing.</p>';
    return;
  }
  for (const name of plugins) {
    const count = runs.filter(r => r.name === name).length;
    const row = document.createElement("div");
    row.className = "plugin-row";
    const nm = document.createElement("span"); nm.className = "pname"; nm.textContent = name; nm.title = name;
    const ct = document.createElement("span"); ct.className = "pcount"; ct.textContent = `${count} run${count === 1 ? "" : "s"}`;
    const start = document.createElement("button");
    start.className = "btn ghost"; start.textContent = "Start";
    start.disabled = !!active;
    start.title = active ? "Stop the running timer first" : `Start timing “${name}”`;
    start.addEventListener("click", () => startTimer(name));
    const rm = document.createElement("button");
    rm.className = "rm"; rm.textContent = "✕"; rm.title = "Remove plugin";
    rm.addEventListener("click", async () => {
      const st = await loadState();
      st.plugins = st.plugins.filter(p => p !== name);
      await saveState({ plugins: st.plugins });
      refresh();
    });
    row.append(nm, ct, start, rm);
    list.appendChild(row);
  }
}

function renderStats(plugins, runs) {
  const box = $("statsList");
  box.innerHTML = "";
  if (!runs.length) {
    box.innerHTML = '<p class="empty-note">No runs logged yet.</p>';
    return;
  }
  // aggregate per plugin, slowest average first
  const agg = {};
  for (const r of runs) {
    (agg[r.name] = agg[r.name] || []).push(r.ms);
  }
  const rows = Object.entries(agg)
    .map(([name, arr]) => ({
      name,
      n: arr.length,
      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
      max: Math.max(...arr),
      total: arr.reduce((a, b) => a + b, 0)
    }))
    .sort((a, b) => b.avg - a.avg);
  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "stat-row";
    const nm = document.createElement("div"); nm.className = "sname"; nm.textContent = r.name; nm.title = r.name;
    const grid = document.createElement("div"); grid.className = "stat-grid";
    grid.innerHTML =
      `<span>runs <b>${r.n}</b></span>` +
      `<span>avg <b>${fmtMs(r.avg)}</b></span>` +
      `<span class="slow">slowest <b>${fmtMs(r.max)}</b></span>` +
      `<span>total <b>${fmtMs(r.total)}</b></span>`;
    div.append(nm, grid);
    box.appendChild(div);
  }
}

function renderLog(runs) {
  const box = $("logList");
  box.innerHTML = "";
  const recent = [...runs].reverse().slice(0, 30);
  if (!recent.length) {
    box.innerHTML = '<p class="empty-note">Your recent timed runs will appear here.</p>';
    return;
  }
  for (const r of recent) {
    const row = document.createElement("div");
    row.className = "log-row";
    const dur = document.createElement("span"); dur.className = "dur"; dur.textContent = fmtMs(r.ms);
    const nm = document.createElement("span"); nm.className = "lname"; nm.textContent = r.name; nm.title = r.name;
    const tm = document.createElement("span"); tm.className = "ltime"; tm.textContent = fmtTime(r.at);
    row.append(dur, nm, tm);
    if (r.note) {
      const note = document.createElement("span"); note.className = "lnote"; note.textContent = r.note;
      row.appendChild(note);
    }
    box.appendChild(row);
  }
}

/* ---------- live timer ---------- */
let tickHandle = null;

function showTimer(active) {
  $("timerCard").hidden = !active;
  if (active) {
    $("timerName").textContent = active.name;
    const update = () => { $("timerValue").textContent = fmtClock(Date.now() - active.startedAt); };
    update();
    clearInterval(tickHandle);
    tickHandle = setInterval(update, 100);
  } else {
    clearInterval(tickHandle);
  }
}

async function startTimer(name) {
  await saveState({ active: { name, startedAt: Date.now() } });
  $("timerNote").value = "";
  refresh();
}

async function stopTimer() {
  const st = await loadState();
  if (!st.active) return;
  const ms = Date.now() - st.active.startedAt;
  const note = $("timerNote").value.trim();
  st.runs.push({ name: st.active.name, ms, note, at: Date.now() });
  // keep the log bounded
  if (st.runs.length > 500) st.runs = st.runs.slice(-500);
  await saveState({ runs: st.runs, active: null });
  refresh();
}

/* ---------- export / clear ---------- */
function csvCell(v) { return `"${String(v).replace(/"/g, '""')}"`; }

async function exportCSV() {
  const { runs } = await loadState();
  if (!runs.length) return flash($("exportBtn"), "No runs");
  const lines = ["plugin,step,duration_ms,duration,note,recorded_at"];
  for (const r of runs) {
    lines.push([csvCell(r.name), "", r.ms, csvCell(fmtMs(r.ms)), csvCell(r.note || ""), new Date(r.at).toISOString()].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "latency-log.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  flash($("exportBtn"), "Exported ✓");
}

async function clearAll() {
  const btn = $("clearBtn");
  if (btn.dataset.armed) {
    delete btn.dataset.armed;
    btn.textContent = "Clear";
    await chrome.storage.local.set({ plugins: [], runs: [], active: null });
    refresh();
  } else {
    btn.dataset.armed = "1";
    btn.textContent = "Sure?";
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = "Clear"; }, 4000);
  }
}

function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, 1400);
}

/* ---------- wiring ---------- */
$("addPluginBtn").addEventListener("click", async () => {
  const name = $("pluginName").value.trim();
  if (!name) return;
  const st = await loadState();
  if (!st.plugins.includes(name)) st.plugins.push(name);
  await saveState({ plugins: st.plugins });
  $("pluginName").value = "";
  refresh();
});
$("pluginName").addEventListener("keydown", (e) => { if (e.key === "Enter") $("addPluginBtn").click(); });
$("stopBtn").addEventListener("click", stopTimer);
$("exportBtn").addEventListener("click", exportCSV);
$("clearBtn").addEventListener("click", clearAll);

async function refresh() {
  const st = await loadState();
  renderPlugins(st.plugins, st.runs, st.active);
  renderStats(st.plugins, st.runs);
  renderLog(st.runs);
  showTimer(st.active);
}

refresh();
