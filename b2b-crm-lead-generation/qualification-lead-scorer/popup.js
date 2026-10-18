// Qualification Lead Scorer — popup logic. All on-device; storage only.

const FACTORS = ["Budget", "Authority", "Need", "Timeline"];
const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

function init() {
  for (const f of FACTORS) {
    $("s" + f).addEventListener("input", () => {
      $("v" + f).textContent = $("s" + f).value;
      score();
    });
  }
  $("saveBtn").addEventListener("click", saveLead);
  score();
  renderHistory();
}

function readFactors() {
  const out = {};
  for (const f of FACTORS) out[f] = parseInt($("s" + f).value, 10) || 0;
  return out;
}

// 0–10 per factor → 0–100 total. Need counts double: it signals a real problem to solve.
function computeScore(f) {
  const total = f.Budget + f.Authority + f.Need * 2 + f.Timeline;
  return Math.round((total / 50) * 100);
}

function verdictFor(score) {
  if (score >= 75) return { label: "HOT", cls: "hot", hint: "Qualified — prioritize this lead." };
  if (score >= 45) return { label: "WARM", cls: "warm", hint: "Promising — nurture and re-qualify." };
  return { label: "COLD", cls: "cold", hint: "Weak fit — deprioritize for now." };
}

function score() {
  const f = readFactors();
  const s = computeScore(f);
  $("score").textContent = s;
  const v = verdictFor(s);
  const el = $("verdict");
  el.textContent = v.label;
  el.className = "verdict " + v.cls;
  $("hint").textContent = v.hint;
}

async function saveLead() {
  const name = $("leadName").value.trim();
  if (!name) { $("leadName").focus(); return; }
  const factors = readFactors();
  const scoreVal = computeScore(factors);
  const { label } = verdictFor(scoreVal);
  const { leads = [] } = await chrome.storage.local.get("leads");
  leads.unshift({
    id: "lead-" + Date.now(),
    name,
    factors,
    score: scoreVal,
    verdict: label,
    notes: $("notes").value.trim(),
    at: Date.now(),
  });
  await chrome.storage.local.set({ leads: leads.slice(0, 100) });
  $("leadName").value = "";
  $("notes").value = "";
  renderHistory();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function renderHistory() {
  const { leads = [] } = await chrome.storage.local.get("leads");
  const card = $("histCard"), box = $("history");
  box.innerHTML = "";
  card.hidden = leads.length === 0;
  for (const l of leads) {
    const row = document.createElement("div");
    row.className = "lead-row";
    const head = document.createElement("div");
    head.className = "lead-head";
    const b = document.createElement("b");
    b.textContent = l.name;
    b.title = l.name;
    const badge = document.createElement("span");
    badge.className = "badge " + l.verdict.toLowerCase();
    badge.textContent = `${l.verdict} · ${l.score}`;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Delete";
    x.addEventListener("click", async () => {
      const { leads: cur = [] } = await chrome.storage.local.get("leads");
      await chrome.storage.local.set({ leads: cur.filter((i) => i.id !== l.id) });
      renderHistory();
    });
    head.append(b, badge, x);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `B ${l.factors.Budget} · A ${l.factors.Authority} · N ${l.factors.Need} · T ${l.factors.Timeline}`;
    row.append(head, meta);
    // per-factor bars
    const fb = document.createElement("div");
    fb.className = "factorbar";
    for (const f of FACTORS) {
      const r = document.createElement("div");
      r.className = "row";
      const sp = document.createElement("span"); sp.textContent = f;
      const track = document.createElement("div"); track.className = "track";
      const fill = document.createElement("div"); fill.className = "fill";
      fill.style.width = (l.factors[f] * 10) + "%";
      track.appendChild(fill);
      const vv = document.createElement("b"); vv.textContent = l.factors[f];
      r.append(sp, track, vv);
      fb.appendChild(r);
    }
    row.appendChild(fb);
    if (l.notes) {
      const n = document.createElement("div");
      n.className = "meta";
      n.textContent = esc(l.notes);
      row.appendChild(n);
    }
    box.appendChild(row);
  }
}
