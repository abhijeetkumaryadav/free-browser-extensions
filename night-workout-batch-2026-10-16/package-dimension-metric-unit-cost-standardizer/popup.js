/* Parcel Metrics — dimension/weight conversion + dimensional-weight + unit cost.
 * Conversions are exact math (1 in = 2.54 cm; 1 lb = 0.45359237 kg).
 * The dim-weight divisor is a user setting; carriers publish their own factors —
 * verify carrier rules before quoting customers. 100% local, storage only. */

"use strict";

const IN_TO_CM = 2.54;
const LB_TO_KG = 0.45359237;

const $ = (id) => document.getElementById(id);
const f = (n, d = 2) => (Math.round(n * 100) / 100).toFixed(d);
const num = (id) => parseFloat($(id).value) || 0;

// Pure math (exported for testing via node vm if needed).
function convertDims(len, wid, hei, unit) {
  // unit: 'in' | 'cm' -> returns both
  const toIn = unit === "cm" ? (v) => v / IN_TO_CM : (v) => v;
  const li = toIn(len), wi = toIn(wid), hi = toIn(hei);
  return { in: [li, wi, hi], cm: [li * IN_TO_CM, wi * IN_TO_CM, hi * IN_TO_CM] };
}
function convertWeight(w, unit) {
  const lb = unit === "kg" ? w / LB_TO_KG : w;
  return { lb, kg: lb * LB_TO_KG };
}
function dimWeightLb(dimsIn, divisor) {
  return divisor > 0 ? (dimsIn[0] * dimsIn[1] * dimsIn[2]) / divisor : 0;
}
function billable(actualLb, dimLb) {
  return Math.max(actualLb, dimLb);
}

function standardize() {
  const dims = convertDims(num("len"), num("wid"), num("hei"), $("dimUnit").value);
  const wgt = convertWeight(num("weight"), $("wgtUnit").value);
  const divisor = parseFloat($("divisor").value) || 0;
  const dw = dimWeightLb(dims.in, divisor);
  const bw = billable(wgt.lb, dw);

  $("resultCard").hidden = false;
  $("dimsIn").textContent = dims.in.map((v) => f(v, 1)).join(" × ");
  $("dimsCm").textContent = dims.cm.map((v) => f(v, 1)).join(" × ");
  $("wgtLb").textContent = f(wgt.lb) + " lb";
  $("wgtKg").textContent = f(wgt.kg) + " kg";
  $("dimWgt").textContent = divisor > 0 ? f(dw) + " lb (÷" + divisor + ")" : "– (set divisor)";
  $("billWgt").textContent = f(bw) + " lb";

  const quote = num("quote");
  const units = Math.max(1, Math.floor(num("units") || 1));
  $("perLb").textContent = bw > 0 ? "$" + f(quote / bw) : "$–";
  $("perUnit").textContent = "$" + f(quote / units);

  // Persist last inputs for convenience (no page interaction, storage only).
  chrome.storage.local.set({
    parcelLast: {
      len: $("len").value, wid: $("wid").value, hei: $("hei").value,
      dimUnit: $("dimUnit").value, weight: $("weight").value,
      wgtUnit: $("wgtUnit").value, divisor: $("divisor").value
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get("parcelLast");
  if (stored.parcelLast) {
    for (const [k, v] of Object.entries(stored.parcelLast)) {
      if ($(k)) $(k).value = v;
    }
  }
  $("calcBtn").addEventListener("click", standardize);
  $("clearBtn").addEventListener("click", () => {
    for (const id of ["len", "wid", "hei", "weight", "divisor", "quote", "units"]) $(id).value = "";
    $("resultCard").hidden = true;
    chrome.storage.local.remove("parcelLast");
  });
});
