// Negotiation Margin Helper — popup logic. All on-device.
// Ladder: anchor below target, then two concession rungs up to target.
// gap = walkAway - target (your concession range). Never exceed walk-away.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

function init() {
  ["list", "target", "walk", "resale"].forEach((id) =>
    $(id).addEventListener("input", calculate)
  );
  $("saveBtn").addEventListener("click", saveScenario);
  renderHistory();
}

const num = (id) => parseFloat($(id).value) || 0;
const fmt = (n) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildLadder(list, target, walk) {
  const gap = Math.max(0, walk - target);
  return [
    { round: "Round 1 · Anchor", offer: target - gap * 0.5, note: "Aggressive opener — leaves room to concede." },
    { round: "Round 2 · Counter", offer: target - gap * 0.25, note: "Meet them halfway on your range." },
    { round: "Round 3 · Final", offer: target, note: "Your target. Hold here — never cross walk-away." },
  ];
}

function calculate() {
  const list = num("list"), target = num("target"), walk = num("walk"), resale = num("resale");
  const card = $("ladderCard");
  const warn = $("warn");
  const valid = list > 0 && target > 0 && walk > 0 && target <= walk;
  warn.hidden = !(list > 0 && target > 0 && walk > 0) || target <= walk;
  if (!valid) { card.hidden = true; return; }
  card.hidden = false;

  const rungs = buildLadder(list, target, walk);
  const box = $("ladder");
  box.innerHTML = "";
  for (const r of rungs) {
    const el = document.createElement("div");
    el.className = "rung";
    const rh = document.createElement("div");
    rh.className = "rh";
    const b = document.createElement("b"); b.textContent = r.round;
    const offer = document.createElement("span"); offer.className = "offer";
    offer.textContent = fmt(r.offer);
    rh.append(b, offer);
    const rm = document.createElement("div");
    rm.className = "rm";
    const disc = list ? ((list - r.offer) / list) * 100 : 0;
    rm.innerHTML =
      `<span>vs list: <b>${disc.toFixed(1)}% off</b></span>` +
      (resale > 0
        ? `<span>margin: <b>${(((resale - r.offer) / resale) * 100).toFixed(1)}%</b></span>`
        : `<span>saves: <b>${fmt(list - r.offer)}</b></span>`);
    const note = document.createElement("div");
    note.style.cssText = "font-size:11px;color:var(--muted);margin-top:6px;";
    note.textContent = r.note;
    el.append(rh, rm, note);
    box.appendChild(el);
  }
}

async function saveScenario() {
  const list = num("list"), target = num("target"), walk = num("walk");
  if (!(list > 0 && target > 0 && walk > 0 && target <= walk)) return;
  const { scenarios = [] } = await chrome.storage.local.get("scenarios");
  scenarios.unshift({
    id: "sc-" + Date.now(),
    label: `List ${fmt(list)} → target ${fmt(target)} · walk-away ${fmt(walk)}`,
    at: Date.now(),
  });
  await chrome.storage.local.set({ scenarios: scenarios.slice(0, 20) });
  renderHistory();
}

async function renderHistory() {
  const { scenarios = [] } = await chrome.storage.local.get("scenarios");
  const card = $("histCard"), box = $("history");
  box.innerHTML = "";
  card.hidden = scenarios.length === 0;
  for (const s of scenarios) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div");
    t.className = "t"; t.textContent = s.label;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { scenarios: cur = [] } = await chrome.storage.local.get("scenarios");
      await chrome.storage.local.set({ scenarios: cur.filter((i) => i.id !== s.id) });
      renderHistory();
    });
    row.append(t, x);
    box.appendChild(row);
  }
}
