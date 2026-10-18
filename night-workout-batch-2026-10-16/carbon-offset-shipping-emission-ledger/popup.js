/* popup.js — shipping emission ledger logic. All local. */
"use strict";

const modeSel = document.getElementById("mode");
const distIn = document.getElementById("dist");
const weightIn = document.getElementById("weight");
const noteIn = document.getElementById("note");
const offKgIn = document.getElementById("offKg");
const offNoteIn = document.getElementById("offNote");
const addShipBtn = document.getElementById("addShipBtn");
const addOffBtn = document.getElementById("addOffBtn");
const totalEmittedEl = document.getElementById("totalEmitted");
const totalOffsetEl = document.getElementById("totalOffset");
const netBalanceEl = document.getElementById("netBalance");
const breakdownEl = document.getElementById("breakdown");
const ledgerList = document.getElementById("ledgerList");
const emptyMsg = document.getElementById("emptyMsg");

let entries = []; // [{kind:'ship'|'offset', ts, ...}]

/* ---------- persistence ---------- */
function save() { chrome.storage.local.set({ shipLedger: entries }); }
function load() {
  chrome.storage.local.get({ shipLedger: [] }, (res) => {
    entries = res.shipLedger;
    render();
  });
}

/* ---------- rendering ---------- */
function render() {
  const ships = entries.filter((e) => e.kind === "ship");
  const offs = entries.filter((e) => e.kind === "offset");
  const totalEmitted = ships.reduce((a, e) => a + e.co2eKg, 0);
  const totalOffset = offs.reduce((a, e) => a + e.kg, 0);
  const net = totalEmitted - totalOffset;

  totalEmittedEl.textContent = fmtKg(totalEmitted);
  totalOffsetEl.textContent = fmtKg(totalOffset);
  netBalanceEl.textContent = fmtKg(net);
  netBalanceEl.style.color = net <= 0 ? "#22c55e" : "#ff8f8f";

  // per-mode breakdown
  const perMode = {};
  Object.keys(EMISSION_FACTORS).forEach((m) => (perMode[m] = 0));
  ships.forEach((e) => { perMode[e.mode] += e.co2eKg; });
  const max = Math.max(1, ...Object.values(perMode));
  breakdownEl.innerHTML = Object.keys(EMISSION_FACTORS)
    .map((m) => {
      const v = perMode[m];
      const pct = (v / max) * 100;
      return `<div class="bd-row"><span class="bd-label">${EMISSION_FACTORS[m].label}</span>` +
        `<span class="bd-bar"><i style="width:${pct}%"></i></span>` +
        `<span class="bd-val">${fmtKg(v)}</span></div>`;
    })
    .join("");

  // ledger (newest first)
  ledgerList.innerHTML = "";
  emptyMsg.style.display = entries.length ? "none" : "block";
  [...entries].reverse().forEach((e) => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    if (e.kind === "ship") {
      left.innerHTML = `<span class="tag ship">SHIP</span><b>${EMISSION_FACTORS[e.mode].label}</b> · ${e.dist} km · ${e.weight} kg` +
        (e.note ? `<span class="note">${escapeHtml(e.note)}</span>` : "");
      const amt = document.createElement("span");
      amt.className = "amt";
      amt.textContent = fmtKg(e.co2eKg);
      li.appendChild(left); li.appendChild(amt);
    } else {
      left.innerHTML = `<span class="tag off">OFFSET</span>${e.note ? `<span class="note">${escapeHtml(e.note)}</span>` : "<span class='note'>recorded offset</span>"}`;
      const amt = document.createElement("span");
      amt.className = "amt";
      amt.style.color = "#22c55e";
      amt.textContent = "−" + fmtKg(e.kg);
      li.appendChild(left); li.appendChild(amt);
    }
    const idx = entries.indexOf(e);
    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "Delete entry";
    del.addEventListener("click", () => {
      entries.splice(idx, 1);
      save(); render();
    });
    li.appendChild(del);
    ledgerList.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- wiring ---------- */
Object.keys(EMISSION_FACTORS).forEach((m) => {
  const opt = document.createElement("option");
  opt.value = m;
  opt.textContent = `${EMISSION_FACTORS[m].label} — ${EMISSION_FACTORS[m].gPerTkm} g/t·km`;
  modeSel.appendChild(opt);
});

addShipBtn.addEventListener("click", () => {
  const dist = parseFloat(distIn.value);
  const weight = parseFloat(weightIn.value);
  if (!(dist > 0) || !(weight > 0)) {
    addShipBtn.textContent = "Enter distance & weight";
    setTimeout(() => (addShipBtn.textContent = "Add shipment"), 1500);
    return;
  }
  entries.push({
    kind: "ship", ts: Date.now(),
    mode: modeSel.value, dist, weight,
    co2eKg: co2eKg(modeSel.value, dist, weight),
    note: noteIn.value.trim(),
  });
  distIn.value = ""; weightIn.value = ""; noteIn.value = "";
  save(); render();
});

addOffBtn.addEventListener("click", () => {
  const kg = parseFloat(offKgIn.value);
  if (!(kg > 0)) {
    addOffBtn.textContent = "Enter offset amount";
    setTimeout(() => (addOffBtn.textContent = "Record offset"), 1500);
    return;
  }
  entries.push({ kind: "offset", ts: Date.now(), kg, note: offNoteIn.value.trim() });
  offKgIn.value = ""; offNoteIn.value = "";
  save(); render();
});

load();
