// popup.js — RPE target weight calculator.
// ENGINE-START
// Widely-published RPE percentage chart (fraction of 1RM).
// Rows: RPE 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6. Columns: reps 1..12.
const RPE_CHART = {
  "10":  [1.000, 0.978, 0.955, 0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.849, 0.836, 0.824],
  "9.5": [0.978, 0.955, 0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.849, 0.837, 0.824, 0.813],
  "9":   [0.955, 0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.849, 0.837, 0.824, 0.813, 0.802],
  "8.5": [0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.849, 0.837, 0.824, 0.813, 0.802, 0.792],
  "8":   [0.922, 0.907, 0.892, 0.878, 0.863, 0.849, 0.837, 0.824, 0.813, 0.802, 0.792, 0.782],
  "7.5": [0.907, 0.892, 0.878, 0.863, 0.849, 0.837, 0.824, 0.813, 0.802, 0.792, 0.782, 0.772],
  "7":   [0.892, 0.878, 0.863, 0.849, 0.837, 0.824, 0.813, 0.802, 0.792, 0.782, 0.772, 0.762],
  "6.5": [0.878, 0.863, 0.849, 0.837, 0.824, 0.813, 0.802, 0.792, 0.782, 0.772, 0.762, 0.752],
  "6":   [0.863, 0.849, 0.837, 0.824, 0.813, 0.802, 0.792, 0.782, 0.772, 0.762, 0.752, 0.742]
};
const RPE_ROWS = ["10", "9.5", "9", "8.5", "8", "7.5", "7", "6.5", "6"];

// Snap any RPE to the nearest chart row (chart has 0.5 steps).
function snapRpe(rpe) {
  rpe = Math.max(6, Math.min(10, rpe));
  return String(Math.round(rpe * 2) / 2);
}

// Clamp reps to 1..12.
function clampReps(reps) {
  reps = Math.round(reps);
  return Math.max(1, Math.min(12, reps));
}

// Target weight = 1RM × chart fraction. Returns {weight, fraction, rpeRow, reps}.
function targetWeight(oneRm, rpe, reps) {
  const row = snapRpe(rpe);
  const col = clampReps(reps);
  const fraction = RPE_CHART[row][col - 1];
  return { weight: oneRm * fraction, fraction, rpeRow: row, reps: col };
}
// ENGINE-END

// --- UI --------------------------------------------------------------------
const ormEl = document.getElementById("orm");
const repsEl = document.getElementById("reps");
const rpeEl = document.getElementById("rpe");
const calcBtn = document.getElementById("calc");
const resultEl = document.getElementById("result");
const targetEl = document.getElementById("target");
const pctEl = document.getElementById("pct");
const chartEl = document.getElementById("chart");

// Restore last 1RM.
chrome.storage.local.get("orm", ({ orm }) => { if (orm) ormEl.value = orm; });

// Render the full chart; highlight the row/col of the last calculation.
function renderChart(hlRow, hlCol) {
  let html = "<tr><th>RPE \\ reps</th>";
  for (let r = 1; r <= 12; r++) html += `<th>${r}</th>`;
  html += "</tr>";
  for (const row of RPE_ROWS) {
    html += `<tr><th>${row}</th>`;
    RPE_CHART[row].forEach((f, i) => {
      const cls = (row === hlRow && i === hlCol) ? ' class="hl"' : "";
      html += `<td${cls}>${Math.round(f * 100)}</td>`;
    });
    html += "</tr>";
  }
  chartEl.innerHTML = html;
}

function calculate() {
  const orm = parseFloat(ormEl.value);
  const reps = parseFloat(repsEl.value);
  const rpe = parseFloat(rpeEl.value);
  if (!orm || orm <= 0 || isNaN(reps) || isNaN(rpe)) {
    resultEl.hidden = false;
    targetEl.textContent = "Enter 1RM, reps & RPE";
    pctEl.textContent = "—";
    return;
  }
  const { weight, fraction, rpeRow, reps: col } = targetWeight(orm, rpe, reps);
  resultEl.hidden = false;
  targetEl.textContent = weight.toFixed(1);
  pctEl.textContent = `${Math.round(fraction * 100)}% of 1RM · RPE ${rpeRow} × ${col} reps`;
  renderChart(rpeRow, col - 1);
  chrome.storage.local.set({ orm });
}

calcBtn.addEventListener("click", calculate);
renderChart(null, -1);
