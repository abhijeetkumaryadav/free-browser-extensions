// Yield Payout Estimator — popup logic. All calculations on-device; nothing uploaded.

const DEFAULT_TIERS = [
  { upTo: 5000, rate: 8 },
  { upTo: 20000, rate: 12 },
  { upTo: null, rate: 15 }, // null = no cap, applies to everything above
];

const $ = (id) => document.getElementById(id);
const fmt$ = (n) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Restore last inputs.
  const saved = await chrome.storage.local.get(["ypInputs", "ypTiers"]);
  if (saved.ypInputs) {
    for (const [k, v] of Object.entries(saved.ypInputs)) {
      const el = $(k);
      if (el) el.value = v;
    }
  }
  if (!saved.ypTiers) await chrome.storage.local.set({ ypTiers: DEFAULT_TIERS });

  for (const id of ["revenue", "sales", "rate", "returns"]) {
    $(id).addEventListener("input", onInput);
  }
  $("whatif").addEventListener("input", () => {
    $("wiRate").textContent = $("whatif").value + "%";
    calculate();
  });
  $("addTier").addEventListener("click", addTier);
  $("clearTiers").addEventListener("click", async () => {
    await chrome.storage.local.set({ ypTiers: DEFAULT_TIERS });
    renderTiers();
    calculate();
  });

  renderTiers();
  calculate();
}

async function onInput() {
  const inputs = { revenue: $("revenue").value, sales: $("sales").value, rate: $("rate").value, returns: $("returns").value };
  await chrome.storage.local.set({ ypInputs: inputs });
  calculate();
}

function sortedTiers(tiers) {
  return [...tiers].sort((a, b) => (a.upTo == null ? Infinity : a.upTo) - (b.upTo == null ? Infinity : b.upTo));
}

// Marginal tiered commission: each revenue band earns its band's rate.
function tieredGross(revenue, tiers) {
  let gross = 0, prev = 0;
  for (const t of sortedTiers(tiers)) {
    const cap = t.upTo == null ? revenue : Math.min(revenue, t.upTo);
    const band = Math.max(0, cap - prev);
    gross += band * (t.rate / 100);
    prev = t.upTo == null ? revenue : t.upTo;
    if (revenue <= (t.upTo == null ? revenue : t.upTo)) break;
  }
  return gross;
}

async function calculate() {
  const revenue = Math.max(0, parseFloat($("revenue").value) || 0);
  const sales = Math.max(0, parseInt($("sales").value, 10) || 0);
  const baseRate = Math.min(100, Math.max(0, parseFloat($("rate").value) || 0));
  const returnsPct = Math.min(100, Math.max(0, parseFloat($("returns").value) || 0));
  const { ypTiers = [] } = await chrome.storage.local.get("ypTiers");

  const box = $("result");
  if (!revenue) { box.hidden = true; updateWhatif(0, returnsPct); return; }
  box.hidden = false;

  let gross, tiered = false;
  if (ypTiers.length) {
    gross = tieredGross(revenue, ypTiers);
    tiered = true;
  } else {
    gross = revenue * (baseRate / 100);
  }
  const returnsDed = gross * (returnsPct / 100);
  const net = Math.max(0, gross - returnsDed);

  $("rNet").textContent = fmt$(net);
  $("rEffRate").textContent = "eff. " + (gross / revenue * 100).toFixed(2) + "%";
  $("rGross").textContent = fmt$(gross);
  $("rRet").textContent = "−" + fmt$(returnsDed);
  $("rPerSale").textContent = sales > 0 ? fmt$(net / sales) : "—";

  const note = $("tierNote");
  if (tiered) {
    note.hidden = false;
    note.textContent = "Tiered rates applied — the base rate is ignored while tiers exist. Clear tiers to use the flat base rate.";
  } else note.hidden = true;

  updateWhatif(revenue, returnsPct);
}

function updateWhatif(revenue, returnsPct) {
  const wiRate = parseFloat($("whatif").value) || 0;
  const payout = revenue * (wiRate / 100) * (1 - returnsPct / 100);
  $("wiRate").textContent = wiRate + "%";
  $("wiPayout").textContent = fmt$(Math.max(0, payout));
}

async function getTiers() {
  const { ypTiers = [] } = await chrome.storage.local.get("ypTiers");
  return ypTiers;
}

async function renderTiers() {
  const tiers = await getTiers();
  const box = $("tiers");
  box.innerHTML = "";
  const sorted = sortedTiers(tiers);
  sorted.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "tier";
    const nm = document.createElement("div");
    nm.className = "nm";
    const lo = i === 0 ? 0 : (sorted[i - 1].upTo == null ? 0 : sorted[i - 1].upTo);
    nm.innerHTML = `<b style="font-size:12px">$${lo.toLocaleString()} – ${t.upTo == null ? "∞" : "$" + t.upTo.toLocaleString()}</b><span>marginal band ${i + 1}</span>`;
    const b = document.createElement("b");
    b.textContent = t.rate + "%";
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const cur = await getTiers();
      cur.splice(tiers.indexOf(t), 1);
      await chrome.storage.local.set({ ypTiers: cur });
      renderTiers(); calculate();
    });
    row.append(nm, b, x);
    box.appendChild(row);
  });
  if (!sorted.length) {
    const d = document.createElement("div");
    d.className = "note";
    d.style.margin = "0 0 4px";
    d.textContent = "No tiers — the flat base rate is used.";
    box.appendChild(d);
  }
}

async function addTier() {
  const upToRaw = $("tUpTo").value.trim();
  const rate = parseFloat($("tRate").value);
  if (isNaN(rate) || rate < 0 || rate > 100) return;
  const upTo = upToRaw === "" ? null : Math.max(0, parseFloat(upToRaw));
  if (upTo !== null && isNaN(upTo)) return;
  const tiers = await getTiers();
  tiers.push({ upTo, rate });
  await chrome.storage.local.set({ ypTiers: tiers.slice(0, 12) });
  $("tUpTo").value = ""; $("tRate").value = "";
  renderTiers(); calculate();
}
