// Profit Margin Calculator — popup logic. All on-device; storage only.
//
// Math model (per unit):
//   feeAmt      = price * feePct / 100
//   contrib     = price - feeAmt - cost - ship        (margin before ads)
//   netProfit   = contrib - ads
//   netMargin   = netProfit / price
//   breakevenROAS = price / contrib                   (ad spend at which profit = 0)
//   maxAdSpend  = max(contrib, 0)

const $ = (id) => document.getElementById(id);
const INPUTS = ["cost", "price", "fee", "ads", "ship"];

document.addEventListener("DOMContentLoaded", init);

function init() {
  INPUTS.forEach((id) => $(id).addEventListener("input", calculate));
  $("saveBtn").addEventListener("click", saveScenario);
  renderHistory();
}

function num(id) {
  return Math.max(0, parseFloat($(id).value) || 0);
}

function calc() {
  const cost = num("cost");
  const price = num("price");
  const feePct = Math.min(100, num("fee"));
  const ads = num("ads");
  const ship = num("ship");
  const feeAmt = (price * feePct) / 100;
  const contrib = price - feeAmt - cost - ship;
  const netProfit = contrib - ads;
  const netMargin = price > 0 ? (netProfit / price) * 100 : 0;
  const breakevenROAS = contrib > 0 ? price / contrib : Infinity;
  const maxAd = Math.max(0, contrib);
  return { cost, price, feePct, ads, ship, netProfit, netMargin, breakevenROAS, maxAd };
}

function money(n) {
  const sign = n < 0 ? "−" : "";
  return sign + Math.abs(n).toFixed(2);
}

function calculate() {
  const d = calc();
  const box = $("result");
  if (!d.price && !d.cost) { box.hidden = true; return; }
  box.hidden = false;
  const rp = $("rProfit");
  rp.textContent = (d.netProfit >= 0 ? "+" : "") + money(d.netProfit);
  rp.style.color = d.netProfit >= 0 ? "var(--accent)" : "#f06666";
  $("rMargin").textContent = d.netMargin.toFixed(1) + "%";
  $("rRoas").textContent = isFinite(d.breakevenROAS) ? d.breakevenROAS.toFixed(2) + "×" : "never profitable";
  $("rMaxAd").textContent = money(d.maxAd);

  const v = $("verdict");
  let cls, txt;
  if (d.netMargin >= 30) [cls, txt] = ["excellent", "EXCELLENT MARGIN"];
  else if (d.netMargin >= 15) [cls, txt] = ["healthy", "HEALTHY"];
  else if (d.netMargin >= 5) [cls, txt] = ["thin", "THIN — WATCH ADS"];
  else if (d.netMargin > 0) [cls, txt] = ["razor", "RAZOR THIN"];
  else [cls, txt] = ["losing", "LOSING MONEY"];
  v.className = "verdict " + cls;
  v.textContent = txt;
}

async function saveScenario() {
  const d = calc();
  if (!d.price && !d.cost) return;
  const name = $("sname").value.trim() || `Scenario · ${new Date().toLocaleDateString()}`;
  const { scenarios = [] } = await chrome.storage.local.get("scenarios");
  scenarios.unshift({
    id: "scn-" + Date.now(),
    name,
    inputs: { cost: d.cost, price: d.price, feePct: d.feePct, ads: d.ads, ship: d.ship },
    netProfit: +d.netProfit.toFixed(2),
    netMargin: +d.netMargin.toFixed(1),
    roas: isFinite(d.breakevenROAS) ? +d.breakevenROAS.toFixed(2) : null,
    at: Date.now(),
  });
  await chrome.storage.local.set({ scenarios: scenarios.slice(0, 30) });
  $("sname").value = "";
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
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = s.name; b.title = s.name;
    const sp = document.createElement("span");
    sp.textContent = `margin ${s.netMargin}% · ROAS ${s.roas == null ? "—" : s.roas + "×"}`;
    t.append(b, sp);
    const p = document.createElement("div"); p.className = "p";
    p.textContent = (s.netProfit >= 0 ? "+" : "") + money(s.netProfit);
    p.style.color = s.netProfit >= 0 ? "var(--accent)" : "#f06666";
    const load = document.createElement("button");
    load.className = "x"; load.textContent = "↺"; load.title = "Load into calculator";
    load.addEventListener("click", () => {
      $("cost").value = s.inputs.cost || "";
      $("price").value = s.inputs.price || "";
      $("fee").value = s.inputs.feePct ?? 15;
      $("ads").value = s.inputs.ads || "";
      $("ship").value = s.inputs.ship || "";
      $("sname").value = s.name;
      calculate();
    });
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { scenarios: cur = [] } = await chrome.storage.local.get("scenarios");
      await chrome.storage.local.set({ scenarios: cur.filter((i) => i.id !== s.id) });
      renderHistory();
    });
    row.append(t, p, load, x);
    box.appendChild(row);
  }
}
