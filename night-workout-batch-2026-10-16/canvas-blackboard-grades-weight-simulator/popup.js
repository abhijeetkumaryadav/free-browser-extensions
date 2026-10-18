// Grade Weight Simulator — popup logic (weighted grades + what-if math, 100% local).
"use strict";

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
let assignments = [];   // { id, name, weight, score (null = upcoming), guess }
let editingId = null;

/* ---------- persistence ---------- */
async function load() {
  const { assignments: saved } = await store.get("assignments");
  assignments = Array.isArray(saved) ? saved : [];
}
async function save() { await store.set({ assignments }); }

/* ---------- grade math ---------- */
function letterGrade(pct) {
  if (pct == null) return "–";
  if (pct >= 93) return "A";  if (pct >= 90) return "A−";
  if (pct >= 87) return "B+"; if (pct >= 83) return "B";
  if (pct >= 80) return "B−"; if (pct >= 77) return "C+";
  if (pct >= 73) return "C";  if (pct >= 70) return "C−";
  if (pct >= 67) return "D+"; if (pct >= 63) return "D";
  return "F";
}
// Current grade over scored assignments only; weights normalised.
function currentGrade(list) {
  const scored = list.filter((a) => a.score != null && !isNaN(a.score));
  const w = scored.reduce((s, a) => s + a.weight, 0);
  if (!w) return null;
  const pts = scored.reduce((s, a) => s + (a.score / 100) * a.weight, 0);
  return (pts / w) * 100;
}
// Projected grade: upcoming assignments count at their guess value (0 if none).
function projectedGrade(list) {
  if (!list.length) return null;
  const w = list.reduce((s, a) => s + a.weight, 0);
  if (!w) return null;
  const pts = list.reduce((s, a) => {
    const val = a.score != null && !isNaN(a.score) ? a.score : (a.guess || 0);
    return s + (val / 100) * a.weight;
  }, 0);
  return (pts / w) * 100;
}
function fmt(p) { return p == null ? "–" : p.toFixed(1) + "%"; }

/* ---------- rendering ---------- */
function render() {
  renderSummary();
  renderList();
  renderChart();
}

function renderSummary() {
  const cur = currentGrade(assignments);
  const proj = projectedGrade(assignments);
  $("gradeLetter").textContent = letterGrade(cur);
  $("gradePct").textContent = fmt(cur);
  $("projPct").textContent = fmt(proj);
  const wsum = assignments.reduce((s, a) => s + (a.weight || 0), 0);
  $("weightSum").textContent = wsum % 1 === 0 ? wsum : wsum.toFixed(1);
  $("weightWarn").hidden = Math.abs(wsum - 100) < 0.01 || wsum === 0;
}

function renderList() {
  const el = $("list");
  el.innerHTML = "";
  if (!assignments.length) {
    el.innerHTML = '<div class="empty">No assignments yet — add your first one above.</div>';
    return;
  }
  for (const a of assignments) {
    const div = document.createElement("div");
    div.className = "item";
    const scored = a.score != null && !isNaN(a.score);
    div.innerHTML =
      '<div class="nm"></div>' +
      '<div class="meta">' + a.weight + '% wt<br>' +
      (scored ? a.score + '% scored' : 'upcoming' + (a.guess != null ? ' · guess ' + a.guess + '%' : '')) + '</div>' +
      '<div class="badge ' + (scored ? 'scored">scored' : 'todo">upcoming') + '</div>';
    div.querySelector(".nm").textContent = a.name;
    div.addEventListener("click", () => openEditor(a.id));
    el.appendChild(div);
  }
}

function renderChart() {
  const el = $("chart");
  el.innerHTML = "";
  if (!assignments.length) {
    el.innerHTML = '<div class="empty">Impact chart appears after you add assignments.</div>';
    return;
  }
  const maxPts = Math.max(...assignments.map((a) => a.weight), 1);
  for (const a of assignments) {
    const val = a.score != null && !isNaN(a.score) ? a.score : (a.guess || 0);
    const pts = (val / 100) * a.weight;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      '<div class="bar-name"></div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + Math.min(100, (pts / maxPts) * 100) + '%"></div></div>' +
      '<div class="bar-val">' + pts.toFixed(1) + ' pts</div>';
    row.querySelector(".bar-name").textContent = a.name;
    row.title = a.name + ": " + pts.toFixed(1) + " points toward final grade";
    el.appendChild(row);
  }
}

/* ---------- editor ---------- */
function openEditor(id) {
  editingId = id || null;
  const a = id ? assignments.find((x) => x.id === id) : null;
  $("editorTitle").textContent = a ? "Edit assignment" : "New assignment";
  $("fName").value = a ? a.name : "";
  $("fWeight").value = a ? a.weight : "";
  $("fScore").value = a && a.score != null ? a.score : "";
  $("fUpcoming").checked = a ? a.score == null : false;
  $("fGuess").value = a && a.guess != null ? a.guess : "";
  $("delBtn").hidden = !a;
  $("editor").hidden = false;
  $("guessRow").style.display = $("fUpcoming").checked ? "flex" : "none";
  $("editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveEditor() {
  const name = $("fName").value.trim() || "Untitled";
  const weight = parseFloat($("fWeight").value);
  if (isNaN(weight) || weight <= 0) { alert("Enter a valid weight %."); return; }
  const upcoming = $("fUpcoming").checked;
  let score = null;
  if (!upcoming) {
    score = parseFloat($("fScore").value);
    if (isNaN(score) || score < 0 || score > 100) { alert("Enter a score between 0 and 100, or mark it upcoming."); return; }
  }
  const guess = parseFloat($("fGuess").value);
  const rec = { name, weight, score, guess: isNaN(guess) ? null : guess };
  if (editingId) {
    const a = assignments.find((x) => x.id === editingId);
    if (a) Object.assign(a, rec);
  } else {
    assignments.push(Object.assign({ id: "a" + Date.now().toString(36) }, rec));
  }
  await save();
  $("editor").hidden = true;
  render();
}

/* ---------- what-if ---------- */
function calcWhatIf() {
  const target = parseFloat($("fTarget").value);
  const box = $("whatifResult");
  if (isNaN(target) || target < 0 || target > 100) { alert("Enter a target between 0 and 100."); return; }
  const scored = assignments.filter((a) => a.score != null && !isNaN(a.score));
  const remaining = assignments.filter((a) => a.score == null || isNaN(a.score));
  const wRem = remaining.reduce((s, a) => s + a.weight, 0);
  if (!wRem) {
    box.hidden = false;
    box.textContent = "No remaining (un-scored) weight — everything is already graded.";
    return;
  }
  const pts = scored.reduce((s, a) => s + (a.score / 100) * a.weight, 0);
  // Target is expressed over the course's total weight actually entered.
  const totalW = assignments.reduce((s, a) => s + a.weight, 0);
  const needed = ((target / 100) * totalW - pts) / wRem * 100;
  box.hidden = false;
  if (needed > 100) {
    box.textContent = "You'd need " + needed.toFixed(1) + "% average on the remaining " + wRem + "% of weight — that's above 100%, so this target isn't reachable.";
  } else if (needed <= 0) {
    box.textContent = "Already on track — you can average 0% on the remaining " + wRem + "% of weight and still hit " + target + "%.";
  } else {
    box.textContent = "You need an average of " + needed.toFixed(1) + "% across the remaining " + wRem + "% of weight to finish at " + target + "%.";
  }
}

/* ---------- events ---------- */
function bind() {
  $("addBtn").addEventListener("click", () => openEditor(null));
  $("cancelBtn").addEventListener("click", () => { $("editor").hidden = true; });
  $("saveBtn").addEventListener("click", saveEditor);
  $("delBtn").addEventListener("click", async () => {
    assignments = assignments.filter((x) => x.id !== editingId);
    await save(); $("editor").hidden = true; render();
  });
  $("fUpcoming").addEventListener("change", (e) => {
    $("guessRow").style.display = e.target.checked ? "flex" : "none";
  });
  $("calcBtn").addEventListener("click", calcWhatIf);
}

/* ---------- init ---------- */
(async function init() {
  await load();
  bind();
  render();
})();
