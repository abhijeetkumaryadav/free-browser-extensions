/* Permaculture Companion Plant Matrix — popup logic.
 * Tabs: matrix explorer + garden-bed planner with neighbour conflict detection.
 * All state local (chrome.storage.local). No network.
 */
"use strict";

/* ---------- tab switching ---------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tabpane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ---------- matrix explorer ---------- */
const plantSelect = document.getElementById("plantSelect");
const matrixResult = document.getElementById("matrixResult");

COMPANION_DB.forEach(p => {
  const o = document.createElement("option");
  o.value = p.name;
  o.textContent = p.name;
  plantSelect.appendChild(o);
});

function renderEntry([name, reason], cls) {
  const div = document.createElement("div");
  div.className = "entry";
  const b = document.createElement("b");
  b.textContent = name;
  const p = document.createElement("p");
  p.textContent = reason;
  div.appendChild(b);
  div.appendChild(p);
  return div;
}

function renderMatrix(name) {
  const plant = getPlant(name);
  matrixResult.innerHTML = "";
  if (!plant) return;

  const fCard = document.createElement("div");
  fCard.className = "card";
  fCard.innerHTML = '<h2><span class="dot friend"></span>Friends (' + plant.friends.length + ')</h2>';
  if (plant.friends.length === 0) {
    fCard.insertAdjacentHTML("beforeend", '<div class="none">No known good companions.</div>');
  } else {
    plant.friends.forEach(e => fCard.appendChild(renderEntry(e)));
  }

  const eCard = document.createElement("div");
  eCard.className = "card";
  eCard.innerHTML = '<h2><span class="dot foe"></span>Foes (' + plant.foes.length + ')</h2>';
  if (plant.foes.length === 0) {
    eCard.insertAdjacentHTML("beforeend", '<div class="none">No known bad companions.</div>');
  } else {
    plant.foes.forEach(e => eCard.appendChild(renderEntry(e)));
  }

  matrixResult.appendChild(fCard);
  matrixResult.appendChild(eCard);
}

plantSelect.addEventListener("change", () => renderMatrix(plantSelect.value));
renderMatrix(plantSelect.value);

/* ---------- bed planner ---------- */
const bedSize = document.getElementById("bedSize");
const placeSelect = document.getElementById("placeSelect");
const bedGrid = document.getElementById("bedGrid");
const conflictsBox = document.getElementById("conflicts");

COMPANION_DB.forEach(p => {
  const o = document.createElement("option");
  o.value = p.name;
  o.textContent = p.name;
  placeSelect.appendChild(o);
});
/* extra "empty" option handled by clicking a planted cell */

let bed = [];   // flat array, "" = empty
let size = 4;

function newBed(n) {
  size = n;
  bed = new Array(n * n).fill("");
}

function saveBed() {
  chrome.storage.local.set({ bedPlan: { size, cells: bed } }).catch(() => {});
}

function loadBed(done) {
  chrome.storage.local.get("bedPlan").then(res => {
    const plan = res.bedPlan;
    if (plan && Array.isArray(plan.cells) && plan.size >= 2 && plan.size <= 6) {
      size = plan.size;
      bed = plan.cells.slice(0, size * size);
      while (bed.length < size * size) bed.push("");
    } else {
      newBed(parseInt(bedSize.value, 10));
    }
    bedSize.value = String(size);
    done();
  }).catch(() => { newBed(parseInt(bedSize.value, 10)); done(); });
}

function neighbours(idx) {
  const r = Math.floor(idx / size), c = idx % size;
  const out = [];
  if (r > 0) out.push(idx - size);
  if (r < size - 1) out.push(idx + size);
  if (c > 0) out.push(idx - 1);
  if (c < size - 1) out.push(idx + 1);
  return out;
}

function findConflicts() {
  const hits = [];
  const flagged = new Set();
  for (let i = 0; i < bed.length; i++) {
    if (!bed[i]) continue;
    for (const j of neighbours(i)) {
      if (!bed[j] || j < i) continue;
      if (relationOf(bed[i], bed[j]) === "foe") {
        hits.push([bed[i], bed[j]]);
        flagged.add(i); flagged.add(j);
      }
    }
  }
  return { hits, flagged };
}

function renderBed() {
  const { hits, flagged } = findConflicts();
  bedGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  bedGrid.innerHTML = "";
  bed.forEach((plant, i) => {
    const cell = document.createElement("button");
    cell.className = "cell" + (plant ? " planted" : "") + (flagged.has(i) ? " conflict" : "");
    cell.textContent = plant || "+";
    cell.title = plant ? plant + " — click to clear" : "Click to plant " + placeSelect.value;
    cell.addEventListener("click", () => {
      if (bed[i]) {
        bed[i] = "";
      } else {
        bed[i] = placeSelect.value;
      }
      saveBed();
      renderBed();
    });
    bedGrid.appendChild(cell);
  });

  conflictsBox.innerHTML = "";
  if (hits.length === 0) {
    const planted = bed.filter(Boolean).length;
    const ok = document.createElement("div");
    ok.className = "ok-card";
    ok.textContent = planted === 0
      ? "Bed is empty — start planting!"
      : "No conflicts detected. Happy planting!";
    conflictsBox.appendChild(ok);
  } else {
    hits.forEach(([a, b]) => {
      const d = document.createElement("div");
      d.className = "conflict-card";
      d.textContent = "⚠ " + a + " × " + b + " — these two dislike each other. Consider moving one.";
      conflictsBox.appendChild(d);
    });
  }
}

bedSize.addEventListener("change", () => {
  newBed(parseInt(bedSize.value, 10));
  saveBed();
  renderBed();
});
document.getElementById("clearBed").addEventListener("click", () => {
  bed = new Array(size * size).fill("");
  saveBed();
  renderBed();
});

loadBed(renderBed);
