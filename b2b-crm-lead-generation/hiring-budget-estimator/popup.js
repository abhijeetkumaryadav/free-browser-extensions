// Hiring Budget Estimator — popup logic. All on-device; no network.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("calcBtn").addEventListener("click", addRole);
  $("clearBtn").addEventListener("click", async () => {
    await chrome.storage.local.set({ roles: [] });
    renderRollup();
  });
  renderRollup();
}

function readInputs() {
  const n = (id) => Math.max(0, parseFloat($(id).value) || 0);
  return {
    title: $("fTitle").value.trim() || "Untitled role",
    base: n("fBase"),
    benefits: n("fBenefits"),
    tax: n("fTax"),
    fee: n("fFee"),
    equip: n("fEquip"),
    onboard: n("fOnboard"),
  };
}

// Fully-loaded year-one cost breakdown
function costOf(r) {
  const benefits = r.base * (r.benefits / 100);
  const tax = r.base * (r.tax / 100);
  const fee = r.base * (r.fee / 100);
  const oneOffs = r.equip + r.onboard;
  const annual = r.base + benefits + tax + fee + oneOffs;
  const monthly = annual / 12;
  return { benefits, tax, fee, oneOffs, annual, monthly };
}

const fmt = (n) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

async function addRole() {
  const inputs = readInputs();
  if (!inputs.base) { $("fBase").focus(); return; }
  const c = costOf(inputs);
  const { roles = [] } = await chrome.storage.local.get("roles");
  roles.unshift({
    id: "role-" + Date.now(),
    ...inputs,
    annual: Math.round(c.annual),
    monthly: Math.round(c.monthly),
  });
  await chrome.storage.local.set({ roles: roles.slice(0, 100) });
  renderResult(inputs, c);
  renderRollup();
}

function renderResult(inputs, c) {
  $("result").hidden = false;
  $("rTitle").textContent = inputs.title;
  $("rAnnual").textContent = fmt(c.annual);
  $("rMonthly").textContent = fmt(c.monthly);
  $("bBase").textContent = fmt(inputs.base);
  $("bBen").textContent = fmt(c.benefits) + ` (${inputs.benefits}%)`;
  $("bTax").textContent = fmt(c.tax) + ` (${inputs.tax}%)`;
  $("bFee").textContent = fmt(c.fee) + ` (${inputs.fee}%)`;
  $("bOne").textContent = fmt(c.oneOffs);
}

async function renderRollup() {
  const { roles = [] } = await chrome.storage.local.get("roles");
  $("rollCount").textContent = roles.length;
  const totalAnnual = roles.reduce((a, r) => a + r.annual, 0);
  const totalMonthly = roles.reduce((a, r) => a + r.monthly, 0);
  $("tAnnual").textContent = roles.length ? fmt(totalAnnual) : "—";
  $("tMonthly").textContent = roles.length ? fmt(totalMonthly) : "—";
  $("tAvg").textContent = roles.length ? fmt(totalAnnual / roles.length) : "—";

  const box = $("roles");
  box.innerHTML = "";
  if (!roles.length) {
    const d = document.createElement("div");
    d.className = "empty-roles";
    d.textContent = "No roles yet — calculate one above to start the team budget.";
    box.appendChild(d);
    return;
  }
  for (const r of roles) {
    const row = document.createElement("div");
    row.className = "role-row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = r.title; b.title = r.title;
    const s = document.createElement("span"); s.textContent = fmt(r.monthly) + "/mo run-rate";
    t.append(b, s);
    const p = document.createElement("div"); p.className = "p"; p.textContent = fmt(r.annual);
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { roles: cur = [] } = await chrome.storage.local.get("roles");
      await chrome.storage.local.set({ roles: cur.filter((i) => i.id !== r.id) });
      renderRollup();
    });
    row.append(t, p, x);
    box.appendChild(row);
  }
}
