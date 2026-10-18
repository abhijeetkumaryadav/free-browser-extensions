// Conjunction Risk Visualizer — popup logic
// ================= ENGINE-START =================
// Pure, headless-testable engine: simplified conjunction math.
// Educational model only: treats the encounter as a 2D circle of
// radius = miss distance, with the combined hard-body radius inside it.
// Pc ≈ (r_combined / miss_distance)^2. NOT a real conjunction assessment.

/** Combined hard-body radius in km from object diameters in meters. */
function combinedRadiusKm(size1m, size2m) {
  return ((size1m + size2m) / 2 / 1000);
}

/** Crude collision probability estimate. Returns { pc, logScore }. */
function estimatePc(missKm, size1m, size2m) {
  if (!(missKm > 0) || !(size1m > 0) || !(size2m > 0)) return null;
  const r = combinedRadiusKm(size1m, size2m);
  if (r >= missKm) return { pc: 1, logScore: 0 };
  const pc = (r / missKm) * (r / missKm);
  return { pc, logScore: -Math.log10(pc) };
}

/** Risk band from Pc. */
function riskBand(pc) {
  if (pc >= 1e-2) return { label: "HIGH", color: "#f87171" };
  if (pc >= 1e-4) return { label: "MODERATE", color: "#fb923c" };
  if (pc >= 1e-6) return { label: "LOW", color: "#facc15" };
  return { label: "NEGLIGIBLE", color: "#4ade80" };
}

/** Format Pc for display. */
function fmtPc(pc) {
  if (pc >= 0.01) return (pc * 100).toFixed(2) + "%";
  return pc.toExponential(2);
}
// ================= ENGINE-END =================

const $ = (id) => document.getElementById(id);

function drawViz(missKm, size1m, size2m) {
  const c = $("viz"), ctx = c.getContext("2d");
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#9aa3b2";
  ctx.font = "11px sans-serif";
  const cx = W / 2, cy = H / 2;
  const missR = Math.min(70, Math.max(30, 70)); // fixed visual scale
  // miss circle
  ctx.strokeStyle = "rgba(245,158,11,0.7)";
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(cx, cy, missR, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // combined body (exaggerated for visibility)
  const r = combinedRadiusKm(size1m, size2m);
  const bodyR = Math.max(6, Math.min(40, missR * Math.sqrt(Math.min(1, (r / missKm) ** 2)) * 8));
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath(); ctx.arc(cx, cy, bodyR, 0, Math.PI * 2); ctx.fill();
  // orbiting dot on miss circle
  const t = Date.now() / 1500;
  const ox = cx + missR * Math.cos(t), oy = cy + missR * Math.sin(t);
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9aa3b2";
  ctx.fillText("miss radius", cx + missR + 6, cy - 4);
  requestAnimationFrame(() => drawViz(missKm, size1m, size2m));
}

document.addEventListener("DOMContentLoaded", () => {
  $("calc").addEventListener("click", () => {
    const miss = parseFloat($("miss").value);
    const vel = parseFloat($("vel").value);
    const s1 = parseFloat($("size1").value);
    const s2 = parseFloat($("size2").value);
    const res = estimatePc(miss, s1, s2);
    if (!res) return;
    const band = riskBand(res.pc);
    $("resultCard").style.display = "block";
    $("score").textContent = "Pc ≈ " + fmtPc(res.pc);
    const bandEl = $("band");
    bandEl.textContent = band.label;
    bandEl.style.background = band.color + "22";
    bandEl.style.color = band.color;
    bandEl.style.border = "1px solid " + band.color;
    $("explain").innerHTML =
      "<strong>How this was computed:</strong> combined hard-body radius = " +
      (combinedRadiusKm(s1, s2) * 1000).toFixed(1) + " m. Pc ≈ (r / miss)<sup>2</sup> = " +
      fmtPc(res.pc) + " (log score " + res.logScore.toFixed(1) + ").<br><br>" +
      "This ignores real-world factors: position uncertainty (covariance), " +
      "atmospheric drag, object shapes, and encounter geometry. Relative velocity " +
      "(" + (vel || 0) + " km/s) is shown for context only and does not change this toy estimate. " +
      "Real operators use propagated covariance matrices — this demo does not.";
    drawViz(miss, s1, s2);
  });
});
