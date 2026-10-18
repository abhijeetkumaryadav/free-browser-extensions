// Bidding Portfolio Assistant — popup logic. Manual entry, all on-device.
//
// Model: each campaign has a daily budget and entered revenue.
// Spend = daily budget (the controlled lever). ROAS = revenue / spend.
// Reallocation suggestion: move 10% of every underperformer (ROAS < portfolio
// average) budget into the single best-ROAS campaign.

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

document.addEventListener("DOMContentLoaded", () => {
  $("addBtn").addEventListener("click", addCampaign);
  render();
});

async function getCampaigns() {
  const { campaigns = [] } = await chrome.storage.local.get("campaigns");
  return campaigns;
}
async function setCampaigns(c) {
  await chrome.storage.local.set({ campaigns: c });
}

async function addCampaign() {
  const name = $("fName").value.trim();
  const cpc = Math.max(0, parseFloat($("fCpc").value) || 0);
  const budget = Math.max(0, parseFloat($("fBudget").value) || 0);
  const conv = Math.max(0, parseInt($("fConv").value, 10) || 0);
  const revenue = Math.max(0, parseFloat($("fRev").value) || 0);
  if (!name || budget <= 0) { $("fName").focus(); return; }
  const c = await getCampaigns();
  c.unshift({ id: "c-" + Date.now(), name, cpc, budget, conv, revenue });
  await setCampaigns(c.slice(0, 100));
  ["fName","fCpc","fBudget","fConv","fRev"].forEach((id) => { $(id).value = ""; });
  render();
}

function roas(c) {
  return c.budget > 0 ? c.revenue / c.budget : 0;
}

async function render() {
  const c = await getCampaigns();
  const totalBudget = c.reduce((a, x) => a + x.budget, 0);
  const totalRev = c.reduce((a, x) => a + x.revenue, 0);
  const portRoas = totalBudget > 0 ? totalRev / totalBudget : 0;
  $("stBudget").textContent = totalBudget ? fmt(totalBudget) : "—";
  $("stRev").textContent = totalRev ? fmt(totalRev) : "—";
  $("stRoas").textContent = totalBudget ? portRoas.toFixed(2) + "×" : "—";

  // --- alerts ---
  const alerts = $("alerts");
  alerts.innerHTML = "";
  for (const x of c) {
    const r = roas(x);
    if (r < 1 && x.revenue > 0) {
      const d = document.createElement("div");
      d.className = "alert over";
      d.textContent = `⚠ ${x.name}: losing money (ROAS ${r.toFixed(2)}×)`;
      alerts.appendChild(d);
    } else if (r > 0 && r < portRoas * 0.75) {
      const d = document.createElement("div");
      d.className = "alert low";
      d.textContent = `▾ ${x.name}: ROAS ${r.toFixed(2)}× trails portfolio average`;
      alerts.appendChild(d);
    }
  }

  // --- campaign cards ---
  const box = $("campaigns");
  box.innerHTML = "";
  if (!c.length) {
    const d = document.createElement("div");
    d.className = "empty-c";
    d.textContent = "No campaigns yet — add your first one below.";
    box.appendChild(d);
  }
  const sorted = [...c].sort((a, b) => roas(b) - roas(a));
  for (const x of sorted) {
    const r = roas(x);
    const card = document.createElement("div");
    card.className = "camp";
    const head = document.createElement("div");
    head.className = "chead";
    const nm = document.createElement("b");
    nm.textContent = x.name; nm.title = x.name;
    const badge = document.createElement("span");
    badge.className = "roas-badge " + (r >= 2 ? "good" : r >= 1 ? "mid" : "bad");
    badge.textContent = "ROAS " + r.toFixed(2) + "×";
    const del = document.createElement("button");
    del.className = "x"; del.textContent = "×";
    del.addEventListener("click", async () => {
      await setCampaigns((await getCampaigns()).filter((i) => i.id !== x.id));
      render();
    });
    head.append(nm, badge, del);
    const meta = document.createElement("div");
    meta.className = "cmeta";
    meta.innerHTML =
      `<div>CPC <b>${fmt(x.cpc)}</b></div>` +
      `<div>Budget <b>${fmt(x.budget)}</b></div>` +
      `<div>Conversions <b>${x.conv}</b></div>` +
      `<div>Revenue <b>${fmt(x.revenue)}</b></div>`;
    card.append(head, meta);
    box.appendChild(card);
  }

  // --- reallocation suggestion ---
  const rc = $("reallocCard"), rl = $("realloc");
  rl.innerHTML = "";
  if (sorted.length >= 2) {
    const best = sorted[0];
    const under = sorted.slice(1).filter((x) => roas(x) < portRoas);
    if (best && under.length && roas(best) > portRoas) {
      rc.hidden = false;
      for (const x of under) {
        const move = x.budget * 0.10;
        const row = document.createElement("div");
        row.className = "re-row";
        row.innerHTML = `<span class="from"></span><span class="arrow">→</span><b></b>`;
        row.children[0].textContent = `${x.name} −${fmt(move)}`;
        row.children[2].textContent = best.name;
        rl.appendChild(row);
      }
      const total = document.createElement("div");
      total.className = "re-row";
      const mv = under.reduce((a, x) => a + x.budget * 0.10, 0);
      total.innerHTML = `<span class="from">Projected extra return at ${best.name} ROAS</span><b class="amt">+${fmt(mv * roas(best))}</b>`;
      rl.appendChild(total);
    } else rc.hidden = true;
  } else rc.hidden = true;
}
