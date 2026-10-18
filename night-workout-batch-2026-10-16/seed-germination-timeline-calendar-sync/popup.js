/* popup.js — seed timeline planner logic. All local. */
"use strict";

const seedSel = document.getElementById("seed");
const sowInput = document.getElementById("sowDate");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const detailCard = document.getElementById("detailCard");
const detailName = document.getElementById("detailName");
const factsEl = document.getElementById("facts");
const timelineEl = document.getElementById("timeline");
const planList = document.getElementById("planList");
const planCount = document.getElementById("planCount");
const icsBtn = document.getElementById("icsBtn");
const emptyMsg = document.getElementById("emptyMsg");

let plan = []; // [{seedIdx, sowISO}]

/* ---------- helpers ---------- */
function fmt(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function parseISODate(iso) {
  // Parse YYYY-MM-DD as UTC to avoid timezone drift.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function germMid(seed) {
  return Math.round((seed.germMin + seed.germMax) / 2);
}

/* ---------- detail view ---------- */
function showDetail(idx) {
  const seed = SEEDS[idx];
  detailCard.hidden = false;
  detailName.textContent = seed.name;
  factsEl.innerHTML = [
    ["Germination", `${seed.germMin}–${seed.germMax} days`],
    ["Min soil temp", `${seed.soilMinC}°C`],
    ["Sow depth", `${seed.depthCm} cm`],
    ["Spacing", `${seed.spacingCm} cm`],
    ["Days to harvest", `≈ ${seed.daysHarvest}`],
    ["Start", seed.transplant ? "Start indoors" : "Direct sow"],
  ].map(([k, v]) => `<div class="fact">${k}: <b>${v}</b></div>`).join("");

  const sow = sowInput.value ? parseISODate(sowInput.value) : new Date();
  const germ = addDays(sow, germMid(seed));
  const harvest = addDays(sow, seed.daysHarvest);
  const ms = seed.transplant
    ? [
        ["Sow indoors", sow],
        ["Transplant", addDays(sow, Math.round(seed.daysHarvest * 0.25))],
        ["Germinate ≈", germ],
        ["Harvest ≈", harvest],
      ]
    : [
        ["Sow", sow],
        ["Germinate ≈", germ],
        ["Harvest ≈", harvest],
      ];
  timelineEl.innerHTML = ms
    .map(([label, date]) => `<div class="milestone"><div class="m-label">${label}</div><div class="m-date">${fmt(date)}</div></div>`)
    .join("");
}

/* ---------- plan list ---------- */
function renderPlan() {
  planCount.textContent = plan.length;
  planList.innerHTML = "";
  emptyMsg.style.display = plan.length ? "none" : "block";
  icsBtn.disabled = plan.length === 0;
  plan.forEach((p, i) => {
    const seed = SEEDS[p.seedIdx];
    const sow = parseISODate(p.sowISO);
    const li = document.createElement("li");
    li.className = "plan-item";
    li.innerHTML = `<span><b>${seed.name}</b><br><span class="when">Sow ${fmt(sow)} · harvest ≈ ${fmt(addDays(sow, seed.daysHarvest))}</span></span>`;
    const rm = document.createElement("button");
    rm.textContent = "✕";
    rm.title = "Remove";
    rm.addEventListener("click", () => {
      plan.splice(i, 1);
      savePlan();
      renderPlan();
    });
    li.appendChild(rm);
    planList.appendChild(li);
  });
}

function savePlan() {
  chrome.storage.local.set({ seedPlan: plan });
}
function loadPlan() {
  chrome.storage.local.get({ seedPlan: [] }, (res) => {
    plan = res.seedPlan.filter((p) => SEEDS[p.seedIdx]); // drop stale entries
    renderPlan();
  });
}

/* ---------- .ics export ---------- */
icsBtn.addEventListener("click", () => {
  const entries = [];
  plan.forEach((p) => {
    const seed = SEEDS[p.seedIdx];
    const sow = parseISODate(p.sowISO);
    entries.push({
      title: `🌱 Sow ${seed.name}`,
      date: sow,
      desc: `Sow ${seed.name}: depth ${seed.depthCm}cm, spacing ${seed.spacingCm}cm, min soil temp ${seed.soilMinC}°C.`,
    });
    entries.push({
      title: `🌿 ${seed.name} germination (est.)`,
      date: addDays(sow, germMid(seed)),
      desc: `Estimated germination window for ${seed.name}: ${seed.germMin}–${seed.germMax} days after sowing.`,
    });
    if (seed.transplant) {
      entries.push({
        title: `🪴 Transplant ${seed.name}`,
        date: addDays(sow, Math.round(seed.daysHarvest * 0.25)),
        desc: `Transplant ${seed.name} seedlings outdoors (est.).`,
      });
    }
    entries.push({
      title: `🧺 Harvest ${seed.name} (est.)`,
      date: addDays(sow, seed.daysHarvest),
      desc: `Estimated harvest for ${seed.name}, ~${seed.daysHarvest} days after sowing.`,
    });
  });
  const ics = buildIcs(entries);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "seed-plan.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

/* ---------- wiring ---------- */
SEEDS.forEach((s, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = s.name;
  seedSel.appendChild(opt);
});
const today = new Date();
sowInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
showDetail(0);

seedSel.addEventListener("change", () => showDetail(Number(seedSel.value)));
sowInput.addEventListener("change", () => showDetail(Number(seedSel.value)));
addBtn.addEventListener("click", () => {
  plan.push({ seedIdx: Number(seedSel.value), sowISO: sowInput.value });
  savePlan();
  renderPlan();
});
clearBtn.addEventListener("click", () => {
  plan = [];
  savePlan();
  renderPlan();
});

loadPlan();
