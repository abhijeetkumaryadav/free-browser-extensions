/* Hydroponic Nutrient Dosing Calculator — popup logic.
 * Pure calculator: EC/PPM conversions, nutrient dosing, dilution math.
 * All local. Inputs persisted via chrome.storage.local.
 */
"use strict";

/* ---------- pure math (also unit-tested in Node) ---------- */

/** Convert EC (mS/cm) to PPM on the given scale. */
function ecToPpm(ec, scale) {
  return ec * scale;
}

/**
 * Compute nutrient dose.
 * @param {number} volumeL reservoir litres
 * @param {number} currentEc current EC mS/cm
 * @param {number} targetEc target EC mS/cm
 * @param {number} strength EC rise produced by 1 ml of nutrient per litre
 * @param {number} parts 1, 2 or 3
 * @returns dose plan object
 */
function computeDose(volumeL, currentEc, targetEc, strength, parts) {
  const ecRise = targetEc - currentEc;
  if (ecRise <= 0) {
    // Over target: compute dilution water needed: V_new = V * (current/target)
    const waterToAdd = targetEc > 0 ? volumeL * (currentEc / targetEc - 1) : 0;
    return { mode: "dilute", ecRise, waterToAdd };
  }
  const mlPerLitre = ecRise / strength;
  const totalMl = mlPerLitre * volumeL;
  const perPart = totalMl / parts;
  return { mode: "dose", ecRise, mlPerLitre, totalMl, perPart, parts };
}

function fmt(n, d = 1) {
  return Number(n).toFixed(d);
}

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const FIELDS = ["volume", "currentEc", "targetEc", "strength", "ppmScale", "parts"];

function readInputs() {
  return {
    volume: parseFloat($("volume").value) || 0,
    currentEc: parseFloat($("currentEc").value) || 0,
    targetEc: parseFloat($("targetEc").value) || 0,
    strength: parseFloat($("strength").value) || 0,
    scale: parseInt($("ppmScale").value, 10),
    parts: parseInt($("parts").value, 10)
  };
}

function row(k, v, cls = "") {
  const d = document.createElement("div");
  d.className = "result-row";
  const ks = document.createElement("span"); ks.className = "k"; ks.textContent = k;
  const vs = document.createElement("span"); vs.className = "v " + cls; vs.innerHTML = v;
  d.appendChild(ks); d.appendChild(vs);
  return d;
}

function calculate() {
  const { volume, currentEc, targetEc, strength, scale, parts } = readInputs();
  const box = $("results");
  box.innerHTML = "";
  box.classList.remove("hidden");

  const h = document.createElement("h2");
  h.textContent = "Dose plan";
  box.appendChild(h);

  if (volume <= 0 || strength <= 0) {
    box.appendChild(row("Status", "Enter a reservoir volume and nutrient strength.", "danger"));
    return;
  }

  const plan = computeDose(volume, currentEc, targetEc, strength, parts);

  box.appendChild(row("Current", fmt(currentEc) + " EC · " + Math.round(ecToPpm(currentEc, scale)) + " PPM"));
  box.appendChild(row("Target", fmt(targetEc) + " EC · " + Math.round(ecToPpm(targetEc, scale)) + " PPM"));

  if (plan.mode === "dilute") {
    box.appendChild(row("Status", "Already at / above target EC", "warn"));
    if (plan.waterToAdd > 0.05) {
      box.appendChild(row("Add plain water", fmt(plan.waterToAdd) + " L", "big"));
      box.appendChild(row("…to reach", fmt(volume + plan.waterToAdd) + " L total"));
    } else {
      box.appendChild(row("Action", "No change needed.", "big"));
    }
  } else {
    box.appendChild(row("EC to add", "+" + fmt(plan.ecRise) + " mS/cm", "big"));
    const partNames = { 1: ["Nutrient"], 2: ["Part A", "Part B"], 3: ["Part A", "Part B", "Part C"] }[parts];
    partNames.forEach(name => {
      box.appendChild(row(name, fmt(plan.perPart) + " ml"));
    });
    if (parts > 1) {
      box.appendChild(row("Total nutrient", fmt(plan.totalMl) + " ml"));
    }
    box.appendChild(row("Dose rate", fmt(plan.mlPerLitre, 2) + " ml / L" + (parts > 1 ? " per part" : "")));
  }

  // persist inputs
  const data = {};
  FIELDS.forEach(f => { data[f] = $(f).value; });
  chrome.storage.local.set({ hydroInputs: data }).catch(() => {});
}

$("calc").addEventListener("click", calculate);

/* restore saved inputs */
chrome.storage.local.get("hydroInputs").then(res => {
  const saved = res.hydroInputs;
  if (saved) {
    FIELDS.forEach(f => { if (saved[f] !== undefined) $(f).value = saved[f]; });
  }
}).catch(() => {});

/* export for Node smoke tests */
if (typeof module !== "undefined") {
  module.exports = { ecToPpm, computeDose };
}
