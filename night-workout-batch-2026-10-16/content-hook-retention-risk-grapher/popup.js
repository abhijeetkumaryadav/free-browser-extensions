/* Retention Risk Grapher — heuristic scoring engine (rule-based, NOT AI). */
"use strict";

// ================= ENGINE-START =================

// Bundled jargon list: each hit raises a sentence's risk score.
const JARGON = [
  "leverage", "synergy", "ecosystem", "paradigm", "holistic", "disruptive",
  "granular", "robust", "scalable", "seamless", "cutting-edge", "game-changer",
  "game changer", "deep dive", "unpack", "circle back", "bandwidth",
  "touch base", "moving forward", "at the end of the day", "low-hanging fruit",
  "thought leader", "best-in-class", "next-gen", "utilize", "facilitate",
  "implement", "methodology"
];

/** Split text into sentences (keeps terminal punctuation). */
function splitSentences(text) {
  const parts = text.match(/[^.!?]+[.!?]+["'”’)]?|\S[^.!?]*$/g) || [];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Count words in a string. */
function countWords(s) {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}

/** Find bundled jargon hits in a sentence (case-insensitive, word-boundary). */
function jargonHits(sentence) {
  const low = " " + sentence.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ") + " ";
  return JARGON.filter((w) => low.includes(" " + w + " ") || low.includes(" " + w.replace(/-/g, " ") + " "));
}

/**
 * Heuristic retention-risk score for one sentence (0–100, higher = riskier).
 * Proxies only: length, jargon density, questions, concrete numbers, direct address.
 */
function scoreSentence(sentence) {
  let score = 10;
  const factors = [];
  const words = countWords(sentence);

  if (words > 28) { score += 30; factors.push("long sentence (" + words + " words)"); }
  else if (words > 20) { score += 15; factors.push("lengthy (" + words + " words)"); }

  const jhits = jargonHits(sentence);
  if (jhits.length) {
    score += Math.min(36, 12 * jhits.length);
    factors.push("jargon: " + jhits.slice(0, 3).join(", "));
  }

  if (/\?/.test(sentence)) { score -= 15; factors.push("question keeps attention (−)"); }
  if (/\d/.test(sentence)) { score -= 10; factors.push("concrete number (−)"); }
  if (/\b(you|your|yours)\b/i.test(sentence)) { score -= 5; factors.push("direct address (−)"); }

  score = Math.max(0, Math.min(100, score));
  return { score: Math.round(score), factors };
}

/** Color for a risk score (semantic; UI accent stays #f472b6). */
function riskColor(score) {
  if (score < 35) return "#34d399";
  if (score < 65) return "#fbbf24";
  return "#f87171";
}

/** Verdict band for the average score. */
function verdictFor(avg) {
  if (avg < 35) return { label: "Low risk", cls: "low" };
  if (avg < 65) return { label: "Moderate risk", cls: "mod" };
  return { label: "High risk", cls: "high" };
}
// ================= ENGINE-END =================

// ---------- Chart ----------
function drawChart(canvas, scores) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 348;
  const H = 130;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const padL = 28, padR = 8, padT = 10, padB = 18;
  const iw = W - padL - padR, ih = H - padT - padB;

  // Gridlines at 0/25/50/75/100.
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.fillStyle = "#6b6880";
  ctx.font = "9px sans-serif";
  ctx.lineWidth = 1;
  for (const v of [0, 25, 50, 75, 100]) {
    const y = padT + ih * (1 - v / 100);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillText(String(v), 4, y + 3);
  }

  const n = scores.length;
  const x = (idx) => padL + (n === 1 ? iw / 2 : (iw * idx) / (n - 1));
  const y = (v) => padT + ih * (1 - v / 100);

  // Connect points, coloring each segment by the later point's risk.
  for (let i = 1; i < n; i++) {
    ctx.strokeStyle = riskColor(scores[i]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x(i - 1), y(scores[i - 1]));
    ctx.lineTo(x(i), y(scores[i]));
    ctx.stroke();
  }
  // Dots.
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = riskColor(scores[i]);
    ctx.beginPath(); ctx.arc(x(i), y(scores[i]), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b0b10";
    ctx.beginPath(); ctx.arc(x(i), y(scores[i]), 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // X labels: sentence numbers.
  ctx.fillStyle = "#6b6880";
  const step = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += step) ctx.fillText(String(i + 1), x(i) - 3, H - 5);
}

// ---------- UI wiring ----------
const input = document.getElementById("scriptInput");
const results = document.getElementById("results");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render() {
  const text = input.value.trim();
  const sentences = splitSentences(text);
  if (!sentences.length) {
    results.innerHTML = '<div class="empty">Paste a script above to score it.</div>';
    return;
  }
  const scored = sentences.map((s, i) => ({ i: i + 1, text: s, ...scoreSentence(s) }));
  const avg = Math.round(scored.reduce((n, r) => n + r.score, 0) / scored.length);
  const v = verdictFor(avg);

  let html = '<div class="card"><div class="verdict">' +
    '<div><div class="avg">' + avg + '</div><div class="lbl">avg risk score · ' + scored.length + ' sentences</div></div>' +
    '<span class="pill ' + v.cls + '">' + v.label + "</span></div>" +
    '<canvas id="riskChart"></canvas>' +
    '<div class="legend"><span><span class="dot" style="background:#34d399"></span>low &lt;35</span>' +
    '<span><span class="dot" style="background:#fbbf24"></span>moderate 35–64</span>' +
    '<span><span class="dot" style="background:#f87171"></span>high ≥65</span></div></div>';

  const risky = scored.filter((r) => r.score >= 65).slice(0, 3);
  if (risky.length) {
    html += '<div class="card risky"><h3>Riskiest sentences</h3>';
    for (const r of risky) {
      const t = esc(r.text.slice(0, 160)) + (r.text.length > 160 ? "…" : "");
      html += '<div class="risk-item"><span class="score">#' + r.i + " · " + r.score + "/100</span> — " + t +
        (r.factors.length ? '<div class="factors">' + esc(r.factors.join(" · ")) + "</div>" : "") + "</div>";
    }
    html += "</div>";
  }
  results.innerHTML = html;
  drawChart(document.getElementById("riskChart"), scored.map((r) => r.score));
}

document.getElementById("analyzeBtn").addEventListener("click", () => {
  render();
  try { chrome.storage.local.set({ lastScript: input.value }); } catch (e) { /* optional */ }
});
document.getElementById("clearBtn").addEventListener("click", () => {
  input.value = "";
  results.innerHTML = "";
  try { chrome.storage.local.remove("lastScript"); } catch (e) { /* optional */ }
});

// Restore the last pasted script (local convenience, never transmitted).
try {
  chrome.storage.local.get("lastScript", (d) => {
    if (d && d.lastScript) { input.value = d.lastScript; render(); }
  });
} catch (e) { /* storage unavailable */ }
