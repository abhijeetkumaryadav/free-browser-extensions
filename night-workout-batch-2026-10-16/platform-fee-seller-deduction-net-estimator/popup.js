/* Seller Fee Lens — net proceeds estimator.
 * All numbers are estimates from user-maintained fee tables; not financial advice.
 * 100% local: fee tables stored in chrome.storage.local, no network calls. */

"use strict";

// ---------------------------------------------------------------------------
// Default fee tables (user-editable; verify against official marketplace pages)
// Fields: referralPct (% of sell price), perOrderFee (flat), closingFee (flat),
//         shippingCreditPct (% of buyer-paid shipping kept as credit; 0 = none)
// ---------------------------------------------------------------------------
const DEFAULT_TABLES = {
  "Amazon":        { referralPct: 15.0, perOrderFee: 0.30, closingFee: 0.00, shippingCreditPct: 0 },
  "eBay":          { referralPct: 13.25, perOrderFee: 0.30, closingFee: 0.00, shippingCreditPct: 0 },
  "Etsy":         { referralPct: 6.5, perOrderFee: 0.20, closingFee: 0.00, shippingCreditPct: 0 },
  "Shopify":      { referralPct: 2.9, perOrderFee: 0.30, closingFee: 0.00, shippingCreditPct: 0 },
  "Mercari":      { referralPct: 10.0, perOrderFee: 0.00, closingFee: 0.00, shippingCreditPct: 0 },
  "Custom":       { referralPct: 10.0, perOrderFee: 0.30, closingFee: 0.00, shippingCreditPct: 0 }
};

const $ = (id) => document.getElementById(id);
const money = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
const num = (id) => parseFloat($(id).value) || 0;

// Compute net proceeds from inputs + one fee-table row.
function estimateNet({ sellPrice, itemCost, shipCharged, shipCost }, fees) {
  const referral = sellPrice * (fees.referralPct / 100);
  const orderFee = fees.perOrderFee;
  const closing = fees.closingFee;
  const shipCredit = shipCharged * (fees.shippingCreditPct / 100);
  const gross = sellPrice + shipCharged;
  const deductions = referral + orderFee + closing + itemCost + shipCost;
  const net = gross + shipCredit - deductions;
  return { referral, orderFee, closing, shipCredit, gross, deductions, net };
}

// ---------------------------------------------------------------------------
// Fee-table editor
// ---------------------------------------------------------------------------
async function loadTables() {
  const stored = await chrome.storage.local.get("feeTables");
  return stored.feeTables || structuredClone(DEFAULT_TABLES);
}

function renderEditor(tables) {
  const host = $("feeEditor");
  host.innerHTML = "";
  for (const [name, fees] of Object.entries(tables)) {
    const block = document.createElement("div");
    block.className = "market-block";
    block.innerHTML = `<h3>${name}</h3>`;
    const fields = [
      ["referralPct", "Referral %", 0.1],
      ["perOrderFee", "Per-order fee $", 0.01],
      ["closingFee", "Closing fee $", 0.01],
      ["shippingCreditPct", "Ship credit %", 0.1]
    ];
    for (const [key, label, step] of fields) {
      const row = document.createElement("div");
      row.className = "fee-row";
      row.innerHTML = `<label>${label}</label>`;
      const input = document.createElement("input");
      input.type = "number"; input.min = "0"; input.step = String(step);
      input.value = fees[key];
      input.dataset.market = name; input.dataset.field = key;
      input.addEventListener("change", async () => {
        const t = await loadTables();
        t[name][key] = parseFloat(input.value) || 0;
        await chrome.storage.local.set({ feeTables: t });
      });
      row.appendChild(input);
      block.appendChild(row);
    }
    host.appendChild(block);
  }
  const reset = document.createElement("button");
  reset.className = "reset-btn";
  reset.textContent = "Reset tables to defaults";
  reset.addEventListener("click", async () => {
    await chrome.storage.local.set({ feeTables: structuredClone(DEFAULT_TABLES) });
    renderEditor(structuredClone(DEFAULT_TABLES));
  });
  host.appendChild(reset);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  const tables = await loadTables();

  const sel = $("marketplace");
  for (const name of Object.keys(tables)) {
    const opt = document.createElement("option");
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }

  renderEditor(tables);

  $("feeToggle").addEventListener("click", () => {
    $("feeEditor").hidden = !$("feeEditor").hidden;
  });

  $("calcBtn").addEventListener("click", async () => {
    const fresh = await loadTables();
    const fees = fresh[sel.value];
    const inputs = {
      sellPrice: num("sellPrice"),
      itemCost: num("itemCost"),
      shipCharged: num("shippingCharged"),
      shipCost: num("shippingCost")
    };
    const r = estimateNet(inputs, fees);

    $("resultCard").hidden = false;
    $("netValue").textContent = money(r.net);
    const margin = inputs.sellPrice > 0 ? (r.net / (inputs.sellPrice + inputs.shipCharged || 1)) * 100 : 0;
    $("marginValue").textContent = margin.toFixed(1) + "%";

    const rows = [
      ["Sell price", inputs.sellPrice, "pos"],
      ["+ Shipping charged", inputs.shipCharged, "pos"],
      ["− Referral fee (" + fees.referralPct + "%)", -r.referral, "neg"],
      ["− Per-order fee", -r.orderFee, "neg"]
    ];
    if (r.closing > 0) rows.push(["− Closing fee", -r.closing, "neg"]);
    rows.push(
      ["− Item cost", -inputs.itemCost, "neg"],
      ["− Shipping cost", -inputs.shipCost, "neg"]
    );
    if (r.shipCredit > 0) rows.push(["+ Shipping credit", r.shipCredit, "pos"]);

    const ul = $("breakdown");
    ul.innerHTML = "";
    for (const [label, value, cls] of rows) {
      const li = document.createElement("li");
      li.innerHTML = `<span></span><span class="${cls}"></span>`;
      li.children[0].textContent = label;
      li.children[1].textContent = money(value);
      ul.appendChild(li);
    }
  });
});
