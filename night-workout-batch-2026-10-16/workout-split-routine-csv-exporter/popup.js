/* Workout Split CSV Planner — popup logic. Fully local (chrome.storage.local).
   CSV format: day,exercise,sets,reps,rest — one row per exercise. */

const $ = (id) => document.getElementById(id);
const CSV_HEADER = ["day", "exercise", "sets", "reps", "rest"];

/* ENGINE-START: pure CSV helpers, headless-testable */
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(plan) {
  const rows = [CSV_HEADER.join(",")];
  for (const day of plan) {
    for (const ex of day.exercises) {
      rows.push([day.name, ex.name, ex.sets, ex.reps, ex.rest].map(csvCell).join(","));
    }
  }
  return rows.join("\n");
}
function parseCSV(text) {
  const plan = [];
  const lines = text.split(/\r?\n/);
  let start = 0;
  if (lines[0] && /^day\s*,/i.test(lines[0].trim())) start = 1; // skip header
  const dayMap = new Map();
  for (let i = start; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    if (!cells.length || cells.every((c) => !c.trim())) continue;
    const [dayName, exName, sets, reps, rest] = cells;
    if (!dayName || !dayName.trim() || !exName || !exName.trim()) continue;
    const name = dayName.trim();
    if (!dayMap.has(name)) { dayMap.set(name, { name, exercises: [] }); plan.push(dayMap.get(name)); }
    dayMap.get(name).exercises.push({
      name: exName.trim(),
      sets: sets ? sets.trim() : "",
      reps: reps ? reps.trim() : "",
      rest: rest ? rest.trim() : "",
    });
  }
  return plan;
}
/* Minimal CSV line splitter handling quoted fields. */
function splitCSVLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
/* ENGINE-END */

let plan = [];       // [{ name, exercises: [{name, sets, reps, rest}] }]
let activeDay = 0;

async function load() {
  const res = await chrome.storage.local.get(["plan"]);
  if (Array.isArray(res.plan) && res.plan.length) {
    plan = res.plan;
  } else {
    plan = [{ name: "Push", exercises: [] }, { name: "Pull", exercises: [] }, { name: "Legs", exercises: [] }];
    await save();
  }
  if (activeDay >= plan.length) activeDay = 0;
}
async function save() {
  await chrome.storage.local.set({ plan });
}

function render() {
  renderChips();
  renderDay();
}
function renderChips() {
  const wrap = $("day-chips");
  wrap.innerHTML = "";
  plan.forEach((d, i) => {
    const b = document.createElement("button");
    b.className = "chip" + (i === activeDay ? " active" : "");
    b.textContent = d.name;
    b.addEventListener("click", () => { activeDay = i; render(); });
    wrap.appendChild(b);
  });
}
function renderDay() {
  const day = plan[activeDay];
  if (!day) return;
  $("day-title").textContent = day.name;
  const list = $("ex-list");
  list.innerHTML = "";
  $("ex-empty").style.display = day.exercises.length ? "none" : "block";
  day.exercises.forEach((ex, i) => {
    const li = document.createElement("li");
    li.className = "ex-item";
    const meta = [ex.sets ? `${ex.sets} sets` : "", ex.reps ? `× ${ex.reps}` : "", ex.rest ? `· ${ex.rest} rest` : ""]
      .filter(Boolean).join(" ");
    li.innerHTML = `<span class="e-name"></span><span class="e-meta"></span><button class="del" aria-label="Delete exercise">×</button>`;
    li.querySelector(".e-name").textContent = ex.name;
    li.querySelector(".e-meta").textContent = meta;
    li.querySelector(".del").addEventListener("click", async () => {
      day.exercises.splice(i, 1);
      await save(); render();
    });
    list.appendChild(li);
  });
}

function bind() {
  $("add-day").addEventListener("click", async () => {
    const name = prompt("Day name (e.g. Upper, Lower):", `Day ${plan.length + 1}`);
    if (name === null) return;
    plan.push({ name: name.trim() || `Day ${plan.length + 1}`, exercises: [] });
    activeDay = plan.length - 1;
    await save(); render();
  });
  $("rename-day").addEventListener("click", async () => {
    const day = plan[activeDay];
    const name = prompt("Rename day:", day.name);
    if (name === null || !name.trim()) return;
    day.name = name.trim();
    await save(); render();
  });
  $("delete-day").addEventListener("click", async () => {
    if (plan.length <= 1) { alert("Keep at least one day."); return; }
    if (!confirm(`Delete day "${plan[activeDay].name}" and its exercises?`)) return;
    plan.splice(activeDay, 1);
    activeDay = Math.max(0, activeDay - 1);
    await save(); render();
  });
  $("add-ex").addEventListener("click", async () => {
    const name = $("ex-name").value.trim();
    if (!name) { $("ex-name").focus(); return; }
    plan[activeDay].exercises.push({
      name,
      sets: $("ex-sets").value.trim(),
      reps: $("ex-reps").value.trim(),
      rest: $("ex-rest").value.trim(),
    });
    $("ex-name").value = ""; $("ex-sets").value = ""; $("ex-reps").value = ""; $("ex-rest").value = "";
    await save(); render();
  });
  $("export-csv").addEventListener("click", () => {
    const csv = toCSV(plan);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workout-split.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  $("import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    try {
      const imported = parseCSV(text);
      if (!imported.length) { alert("No valid rows found in that CSV."); return; }
      if (!confirm(`Replace your plan with ${imported.length} imported day(s)?`)) return;
      plan = imported;
      activeDay = 0;
      await save(); render();
    } catch (err) {
      alert("Could not parse that CSV file.");
    }
    e.target.value = "";
  });
  $("clear-all").addEventListener("click", async () => {
    if (!confirm("Clear the whole plan?")) return;
    plan = [{ name: "Day 1", exercises: [] }];
    activeDay = 0;
    await save(); render();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bind();
  await load();
  render();
});
