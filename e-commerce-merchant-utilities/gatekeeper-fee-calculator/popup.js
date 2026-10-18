// Gatekeeper Fee Calculator — popup logic.
// All data stays on-device. Fee presets are editable estimates, not live API data.

"use strict";

const $ = (id) => document.getElementById(id);
const STORE_KEY = "gkf_state_v1";
const MAX_HISTORY = 50;

// Fee presets are public marketplace fee schedules (approximate, as of 2026).
// Users can edit every value; edits are saved per marketplace.
const MARKETPLACES = [
  {
    id: "amazon_us", name: "Amazon (US)", symbol: "$",
    note: "Default 15% referral (categories range 6–45%). FBA is optional — toggle it off for FBM.",
    fees: [
      { id: "referral", label: "Referral fee", type: "percent", value: 15, of: "sale price" },
      { id: "closing", label: "Closing fee", type: "fixed", value: 1.80 },
      { id: "fba", label: "FBA fulfillment", type: "fixed", value: 4.76, optional: true, on: true },
    ],
  },
  {
    id: "ebay_us", name: "eBay (US)", symbol: "$",
    note: "Final value fee 13.25% up to $7,500 per item; categories vary 4–15%.",
    fees: [
      { id: "fvf", label: "Final value fee", type: "percent", value: 13.25, of: "sale price" },
      { id: "order", label: "Per-order fee", type: "fixed", value: 0.30 },
    ],
  },
  {
    id: "etsy", name: "Etsy", symbol: "$",
    note: "Transaction + payment processing. Offsite ads fees (12–15%) not included.",
    fees: [
      { id: "txn", label: "Transaction fee", type: "percent", value: 6.5, of: "sale price" },
      { id: "pay", label: "Payment processing", type: "percent", value: 3, of: "sale price" },
      { id: "listing", label: "Listing fee", type: "fixed", value: 0.20 },
    ],
  },
  {
    id: "walmart", name: "Walmart Marketplace", symbol: "$",
    note: "Referral fee varies by category, typically 6–15%.",
    fees: [
      { id: "referral", label: "Referral fee", type: "percent", value: 15, of: "sale price" },
    ],
  },
  {
    id: "flipkart", name: "Flipkart (IN)", symbol: "₹",
    note: "Commission varies by category (roughly 5–20%). Shipping pass-through is optional.",
    fees: [
      { id: "commission", label: "Marketplace commission", type: "percent", value: 12, of: "sale price" },
      { id: "gateway", label: "Payment gateway fee", type: "percent", value: 2, of: "sale price" },
      { id: "shipping", label: "Flipkart shipping", type: "fixed", value: 40, optional: true, on: false },
    ],
  },
  {
    id: "shopify", name: "Shopify (own store)", symbol: "$",
    note: "Payment fees with Shopify Payments. No marketplace referral fee.",
    fees: [
      { id: "pay", label: "Card processing", type: "percent", value: 2.9, of: "sale price" },
      { id: "txn_fixed", label: "Per-transaction fee", type: "fixed", value: 0.30 },
    ],
  },
];

const DEFAULT_INPUTS = { price: 29.99, cogs: 8.5, shipping: 3.2, ads: 1.5 };
const INPUT_IDS = ["price", "cogs", "shipping", "ads"];

let state = null; // { mpId, inputs, overrides: {mpId: {feeId: {value, on}}}, history: [] }

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state = await loadState();
  $("marketplace").addEventListener("change", onMarketplaceChange);
  for (const id of INPUT_IDS) {
    $(id).addEventListener("input", onInputChange);
  }
  $("resetFees").addEventListener("click", resetFees);
  $("copyBtn").addEventListener("click", copyBreakdown);
  $("saveBtn").addEventListener("click", saveScenario);
  renderAll();
}

async function loadState() {
  const fallback = { mpId: "amazon_us", inputs: { ...DEFAULT_INPUTS }, overrides: {}, history: [] };
  try {
    const stored = await chrome.storage.local.get(STORE_KEY);
    const s = stored[STORE_KEY];
    if (!s || typeof s !== "object") return fallback;
    return {
      mpId: MARKETPLACES.some((m) => m.id === s.mpId) ? s.mpId : fallback.mpId,
      inputs: { ...DEFAULT_INPUTS, ...(s.inputs || {}) },
      overrides: s.overrides && typeof s.overrides === "object" ? s.overrides : {},
      history: Array.isArray(s.history) ? s.history.slice(0, MAX_HISTORY) : [],
    };
  } catch (e) {
    return fallback;
  }
}

function saveState() {
  chrome.storage.local.set({ [STORE_KEY]: state }).catch(() => {});
}

function getMarketplace() {
  return MARKETPLACES.find((m) => m.id === state.mpId) || MARKETPLACES[0];
}

// Merge fee presets with the user's saved overrides for this marketplace.
function effectiveFees(mp) {
  const ov = (state.overrides && state.overrides[mp.id]) || {};
  return mp.fees.map((f) => {
    const o = ov[f.id] || {};
    return {
      ...f,
      value: typeof o.value === "number" && o.value >= 0 ? o.value : f.value,
      on: typeof o.on === "boolean" ? o.on : (f.on !== false),
    };
  });
}

function setOverride(mpId, feeId, patch) {
  if (!state.overrides[mpId]) state.overrides[mpId] = {};
  const cur = state.overrides[mpId][feeId] || {};
  state.overrides[mpId][feeId] = { ...cur, ...patch };
}

function num(id) {
  const v = parseFloat($(id).value);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function fmt(n, sym) {
  const sign = n < 0 ? "-" : "";
  return sign + sym + Math.abs(n).toFixed(2);
}

// ---------- rendering ----------

function renderAll() {
  renderMarketplaceSelect();
  renderInputs();
  renderFeeEditor();
  recalc();
  renderHistory();
}

function renderMarketplaceSelect() {
  const sel = $("marketplace");
  sel.innerHTML = "";
  for (const m of MARKETPLACES) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    if (m.id === state.mpId) opt.selected = true;
    sel.appendChild(opt);
  }
}

function renderInputs() {
  const sym = getMarketplace().symbol;
  for (const id of ["price", "cogs", "shipping", "ads"]) {
    $("sym" + id.charAt(0).toUpperCase() + id.slice(1)).textContent = sym;
    $(id).value = state.inputs[id];
  }
}

function renderFeeEditor() {
  const mp = getMarketplace();
  $("feeNote").textContent = mp.note;
  const box = $("feeRows");
  box.innerHTML = "";
  for (const f of effectiveFees(mp)) {
    const row = document.createElement("div");
    row.className = "fee-row" + (f.optional && !f.on ? " off" : "");

    const meta = document.createElement("div");
    meta.className = "meta";
    const b = document.createElement("b");
    b.textContent = f.label;
    const s = document.createElement("span");
    s.textContent = f.type === "percent" ? `of ${f.of} · editable` : "flat · editable";
    meta.append(b, s);

    const valWrap = document.createElement("div");
    valWrap.className = "val";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = f.type === "percent" ? "0.1" : "0.01";
    input.value = f.value;
    input.setAttribute("aria-label", f.label + " value");
    input.addEventListener("change", () => {
      const v = parseFloat(input.value);
      setOverride(mp.id, f.id, { value: Number.isFinite(v) && v >= 0 ? v : f.value });
      saveState();
      recalc();
    });
    const suffix = document.createElement("span");
    suffix.className = "suffix";
    suffix.textContent = f.type === "percent" ? "%" : mp.symbol;
    valWrap.append(input, suffix);
    row.append(meta, valWrap);

    if (f.optional) {
      const toggle = document.createElement("label");
      toggle.className = "toggle";
      toggle.title = "Include this fee";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = f.on;
      cb.setAttribute("aria-label", "Include " + f.label);
      const track = document.createElement("span");
      track.className = "track";
      const knob = document.createElement("span");
      knob.className = "knob";
      track.appendChild(knob);
      toggle.append(cb, track);
      cb.addEventListener("change", () => {
        setOverride(mp.id, f.id, { on: cb.checked });
        saveState();
        renderFeeEditor();
        recalc();
      });
      row.appendChild(toggle);
    }
    box.appendChild(row);
  }
}

function compute(mp, fees, inputs) {
  const rows = [];
  let feeTotal = 0;
  for (const f of fees) {
    if (f.optional && !f.on) continue;
    const amount = f.type === "percent" ? (inputs.price * f.value) / 100 : f.value;
    rows.push({
      label: f.label,
      detail: f.type === "percent" ? `${trimNum(f.value)}% of price` : "flat fee",
      amount,
    });
    feeTotal += amount;
  }
  const costTotal = inputs.cogs + inputs.shipping + inputs.ads;
  const net = inputs.price - feeTotal - costTotal;
  const margin = inputs.price > 0 ? (net / inputs.price) * 100 : 0;
  return { rows, feeTotal, costTotal, net, margin };
}

function trimNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function recalc() {
  const mp = getMarketplace();
  const fees = effectiveFees(mp);
  const inputs = { price: num("price"), cogs: num("cogs"), shipping: num("shipping"), ads: num("ads") };
  const r = compute(mp, fees, inputs);

  const netEl = $("netProfit");
  netEl.textContent = fmt(r.net, mp.symbol);
  netEl.className = "net" + (r.net < 0 ? " neg" : "");

  const badge = $("marginBadge");
  const m = r.margin;
  if (r.net < 0 || m < 0) {
    badge.textContent = "Losing money";
    badge.className = "badge bad";
  } else if (m < 10) {
    badge.textContent = m.toFixed(1) + "% margin · thin";
    badge.className = "badge warn";
  } else if (m < 30) {
    badge.textContent = m.toFixed(1) + "% margin · ok";
    badge.className = "badge warn";
  } else {
    badge.textContent = m.toFixed(1) + "% margin · healthy";
    badge.className = "badge ok";
  }

  const box = $("breakdown");
  box.innerHTML = "";
  const addRow = (label, amount, cls) => {
    const d = document.createElement("div");
    d.className = "brow" + (cls ? " " + cls : "");
    const l = document.createElement("span");
    l.textContent = label;
    const v = document.createElement("span");
    v.textContent = fmt(amount, mp.symbol);
    if (amount < 0) v.className = "neg";
    d.append(l, v);
    box.appendChild(d);
  };
  for (const row of r.rows) addRow(`${row.label} (${row.detail})`, row.amount);
  addRow("Your costs (goods + ship + ads)", r.costTotal);
  addRow("Total fees", r.feeTotal, "total");
}

function renderHistory() {
  const box = $("history");
  box.innerHTML = "";
  if (!state.history.length) {
    const d = document.createElement("div");
    d.className = "empty-hist";
    d.textContent = "Nothing saved yet. Tweak the numbers and hit Save scenario.";
    box.appendChild(d);
    return;
  }
  for (const h of state.history) {
    const row = document.createElement("div");
    row.className = "hist";
    const meta = document.createElement("div");
    meta.className = "meta";
    const b = document.createElement("b");
    b.textContent = h.mpName;
    const s = document.createElement("span");
    const date = new Date(h.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    s.textContent = `${h.symbol}${h.price.toFixed(2)} sale · ${date}`;
    meta.append(b, s);
    const netMini = document.createElement("span");
    netMini.className = "net-mini " + (h.net < 0 ? "neg" : "pos");
    netMini.textContent = fmt(h.net, h.symbol);
    netMini.title = h.margin.toFixed(1) + "% margin";
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      state.history = state.history.filter((x) => x.id !== h.id);
      saveState();
      renderHistory();
    });
    row.append(meta, netMini, del);
    box.appendChild(row);
  }
}

// ---------- events ----------

function onMarketplaceChange() {
  state.mpId = $("marketplace").value;
  saveState();
  renderInputs();
  renderFeeEditor();
  recalc();
}

function onInputChange(e) {
  state.inputs[e.target.id] = num(e.target.id);
  saveState();
  recalc();
}

function resetFees() {
  if (state.overrides[state.mpId]) delete state.overrides[state.mpId];
  saveState();
  renderFeeEditor();
  recalc();
}

async function copyBreakdown() {
  const mp = getMarketplace();
  const fees = effectiveFees(mp);
  const inputs = { price: num("price"), cogs: num("cogs"), shipping: num("shipping"), ads: num("ads") };
  const r = compute(mp, fees, inputs);
  const lines = [
    `Gatekeeper Fee Calculator — ${mp.name}`,
    `Price ${fmt(inputs.price, mp.symbol)} · COGS ${fmt(inputs.cogs, mp.symbol)} · Shipping ${fmt(inputs.shipping, mp.symbol)} · Ads ${fmt(inputs.ads, mp.symbol)}`,
  ];
  for (const row of r.rows) lines.push(`${row.label} (${row.detail}): ${fmt(row.amount, mp.symbol)}`);
  lines.push(`Total fees: ${fmt(r.feeTotal, mp.symbol)}`);
  lines.push(`Net profit: ${fmt(r.net, mp.symbol)} (${r.margin.toFixed(1)}% margin)`);
  const text = lines.join("\n");
  const btn = $("copyBtn");
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied ✓";
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    btn.textContent = "Copied ✓";
  }
  setTimeout(() => (btn.textContent = "Copy breakdown"), 1400);
}

function saveScenario() {
  const mp = getMarketplace();
  const fees = effectiveFees(mp);
  const inputs = { price: num("price"), cogs: num("cogs"), shipping: num("shipping"), ads: num("ads") };
  const r = compute(mp, fees, inputs);
  state.history.unshift({
    id: "scn-" + Date.now(),
    ts: Date.now(),
    mpId: mp.id,
    mpName: mp.name,
    symbol: mp.symbol,
    ...inputs,
    net: Math.round(r.net * 100) / 100,
    margin: Math.round(r.margin * 100) / 100,
  });
  state.history = state.history.slice(0, MAX_HISTORY);
  saveState();
  renderHistory();
  const btn = $("saveBtn");
  btn.textContent = "Saved ✓";
  setTimeout(() => (btn.textContent = "Save scenario"), 1400);
}
