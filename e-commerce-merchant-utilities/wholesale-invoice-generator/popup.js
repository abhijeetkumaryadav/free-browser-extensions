// Wholesale Invoice Generator — popup logic. All data stays on-device.

const $ = (id) => document.getElementById(id);
const FIELDS = ["sName", "sTax", "sAddr", "sPhone", "currency", "bName", "bTax", "bAddr", "notes"];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("addItem").addEventListener("click", () => addItemRow());
  $("printBtn").addEventListener("click", previewInvoice);
  $("saveDraft").addEventListener("click", saveDraft);
  $("newInv").addEventListener("click", newInvoice);
  document.querySelectorAll("input, textarea").forEach((el) =>
    el.addEventListener("input", recalc));
  const st = await chrome.storage.local.get(["working", "invCounter"]);
  if (st.working) restoreWorking(st.working);
  else addItemRow();
  updateMeta(st.invCounter || 1);
  renderDrafts();
}

function updateMeta(counter) {
  const d = new Date();
  const ds = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  $("invMeta").textContent = `INV-${String(counter).padStart(4, "0")} · ${ds}`;
}

function itemRowHTML() {
  return `<div class="item">
    <div class="irow">
      <input class="p" placeholder="Product / SKU" maxlength="80">
      <input class="q" type="number" min="0" step="1" placeholder="Qty">
      <input class="u" type="number" min="0" step="0.01" placeholder="Unit ₹">
      <input class="t" type="number" min="0" max="100" step="0.01" placeholder="Tax %">
      <button class="x" title="Remove">×</button>
    </div>
    <div class="lt">Line total: <b>—</b></div>
  </div>`;
}

function addItemRow(data) {
  const wrap = document.createElement("div");
  wrap.innerHTML = itemRowHTML();
  const row = wrap.firstElementChild;
  if (data) {
    row.querySelector(".p").value = data.product || "";
    row.querySelector(".q").value = data.qty ?? "";
    row.querySelector(".u").value = data.price ?? "";
    row.querySelector(".t").value = data.taxPct ?? "";
  }
  row.querySelector(".x").addEventListener("click", () => {
    if ($("items").children.length > 1) { row.remove(); recalc(); }
  });
  row.querySelectorAll("input").forEach((el) => el.addEventListener("input", recalc));
  $("items").appendChild(row);
  recalc();
}

function readItems() {
  return [...$("items").querySelectorAll(".item")].map((row) => ({
    product: row.querySelector(".p").value.trim(),
    qty: Math.max(0, parseFloat(row.querySelector(".q").value) || 0),
    price: Math.max(0, parseFloat(row.querySelector(".u").value) || 0),
    taxPct: Math.min(100, Math.max(0, parseFloat(row.querySelector(".t").value) || 0)),
  })).filter((it) => it.product || it.qty || it.price);
}

function collect() {
  const v = (id) => $(id).value.trim();
  return {
    seller: { name: v("sName"), tax: v("sTax"), addr: v("sAddr"), phone: v("sPhone") },
    buyer: { name: v("bName"), tax: v("bTax"), addr: v("bAddr") },
    currency: v("currency") || "₹",
    notes: v("notes"),
    items: readItems(),
  };
}

function fmt(n, cur) {
  return cur + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function recalc() {
  const data = collect();
  let sub = 0, tax = 0;
  const rows = $("items").querySelectorAll(".item");
  rows.forEach((row, i) => {
    const it = readItems()[i] || { qty: 0, price: 0, taxPct: 0 };
    const line = it.qty * it.price;
    const t = line * (it.taxPct / 100);
    sub += line; tax += t;
    row.querySelector(".lt b").textContent = fmt(line + t, data.currency);
  });
  $("tSub").textContent = fmt(sub, data.currency);
  $("tTax").textContent = fmt(tax, data.currency);
  $("tGrand").textContent = fmt(sub + tax, data.currency);
  // persist working copy quietly
  chrome.storage.local.set({ working: data }).catch(() => {});
}

function restoreWorking(w) {
  const map = { sName: w.seller.name, sTax: w.seller.tax, sAddr: w.seller.addr, sPhone: w.seller.phone,
    bName: w.buyer.name, bTax: w.buyer.tax, bAddr: w.buyer.addr,
    currency: w.currency, notes: w.notes };
  for (const [id, val] of Object.entries(map)) if (val != null) $(id).value = val;
  $("items").innerHTML = "";
  (w.items && w.items.length ? w.items : [null]).forEach((it) => addItemRow(it));
}

async function previewInvoice() {
  const data = collect();
  if (!data.items.length) return;
  const { invCounter = 1 } = await chrome.storage.local.get("invCounter");
  const invNo = `INV-${String(invCounter).padStart(4, "0")}`;
  const printInvoice = {
    ...data,
    invNo,
    date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
  };
  await chrome.storage.local.set({ printInvoice, invCounter: invCounter + 1 });
  updateMeta(invCounter + 1);
  chrome.tabs.create({ url: chrome.runtime.getURL("invoice.html") });
}

async function saveDraft() {
  const name = $("draftName").value.trim();
  if (!name) { $("draftName").focus(); return; }
  const { drafts = [] } = await chrome.storage.local.get("drafts");
  drafts.unshift({ id: "d" + Date.now(), name, savedAt: Date.now(), data: collect() });
  await chrome.storage.local.set({ drafts: drafts.slice(0, 50) });
  $("draftName").value = "";
  renderDrafts();
}

async function newInvoice() {
  await chrome.storage.local.remove("working");
  ["sName", "sTax", "sAddr", "sPhone", "bName", "bTax", "bAddr", "notes"].forEach((id) => { $(id).value = ""; });
  $("currency").value = "₹";
  $("items").innerHTML = "";
  addItemRow();
  recalc();
}

async function renderDrafts() {
  const { drafts = [] } = await chrome.storage.local.get("drafts");
  const box = $("drafts");
  box.innerHTML = "";
  if (!drafts.length) {
    box.innerHTML = '<div class="empty">No drafts yet.</div>';
    return;
  }
  for (const d of drafts) {
    const row = document.createElement("div");
    row.className = "draft";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.innerHTML = `<b></b><span>${new Date(d.savedAt).toLocaleString()} · ${d.data.items.length} items</span>`;
    nm.querySelector("b").textContent = d.name;
    const load = document.createElement("button");
    load.textContent = "Load";
    load.addEventListener("click", () => { restoreWorking(d.data); recalc(); });
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "del";
    del.addEventListener("click", async () => {
      const { drafts: cur = [] } = await chrome.storage.local.get("drafts");
      await chrome.storage.local.set({ drafts: cur.filter((x) => x.id !== d.id) });
      renderDrafts();
    });
    row.append(nm, load, del);
    box.appendChild(row);
  }
}
