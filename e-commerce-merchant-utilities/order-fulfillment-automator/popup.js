// Order Fulfillment Automator — popup logic. All on-device; storage only.

const STATUSES = ["new", "picked", "packed", "shipped"];
const STATUS_LABEL = { new: "NEW", picked: "PICKED", packed: "PACKED", shipped: "SHIPPED" };

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", importCsv);
  $("clearBtn").addEventListener("click", async () => {
    await chrome.storage.local.set({ orders: [] });
    render();
  });
  render();
}

async function getOrders() {
  const { orders = [] } = await chrome.storage.local.get("orders");
  return orders;
}
async function setOrders(orders) {
  await chrome.storage.local.set({ orders });
}

// Minimal CSV parser handling quoted fields.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function importCsv(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return;
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const iId = head.findIndex((h) => /order|id/.test(h));
    const iCust = head.findIndex((h) => /customer|name|buyer/.test(h));
    const iItems = head.findIndex((h) => /item|product|sku/.test(h));
    const iAddr = head.findIndex((h) => /address|ship|street/.test(h));
    if (iId < 0) return;
    const cur = await getOrders();
    let added = 0;
    for (const r of rows.slice(1)) {
      const id = (r[iId] || "").trim();
      if (!id || cur.some((o) => o.id === id)) continue;
      cur.push({
        id: "ord-" + Date.now() + "-" + added,
        orderId: id,
        customer: iCust >= 0 ? (r[iCust] || "").trim() : "",
        items: iItems >= 0 ? (r[iItems] || "").trim() : "",
        address: iAddr >= 0 ? (r[iAddr] || "").trim() : "",
        status: "new",
        addedAt: Date.now(),
      });
      added++;
    }
    await setOrders(cur.slice(0, 1000));
    render();
  } catch (err) {
    /* invalid file — ignore quietly */
  } finally {
    e.target.value = "";
  }
}

async function cycleStatus(id) {
  const orders = await getOrders();
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  const i = STATUSES.indexOf(o.status);
  if (i < STATUSES.length - 1) o.status = STATUSES[i + 1];
  await setOrders(orders);
  render();
}

function openSlip(id) {
  chrome.tabs.create({ url: chrome.runtime.getURL("slip.html") + "?id=" + encodeURIComponent(id) });
}

async function render() {
  const orders = await getOrders();
  const count = (s) => orders.filter((o) => o.status === s).length;
  $("stTotal").textContent = orders.length;
  $("stPicked").textContent = count("picked");
  $("stPacked").textContent = count("packed");
  $("stShipped").textContent = count("shipped");
  const pct = orders.length ? Math.round((count("shipped") / orders.length) * 100) : 0;
  $("progFill").style.width = pct + "%";
  $("progLab").textContent = pct + "% shipped";

  const box = $("orders");
  box.innerHTML = "";
  $("emptyState").style.display = orders.length ? "none" : "";
  const rank = { new: 0, picked: 1, packed: 2, shipped: 3 };
  const sorted = [...orders].sort((a, b) => rank[a.status] - rank[b.status] || a.addedAt - b.addedAt);
  for (const o of sorted) {
    const el = document.createElement("div");
    el.className = "order";
    const top = document.createElement("div");
    top.className = "top";
    const oid = document.createElement("span");
    oid.className = "oid"; oid.textContent = "#" + o.orderId;
    const cust = document.createElement("span");
    cust.className = "cust"; cust.textContent = o.customer; cust.title = o.customer;
    top.append(oid, cust);
    const items = document.createElement("div");
    items.className = "items"; items.textContent = o.items; items.title = o.items;
    const row = document.createElement("div");
    row.className = "row";
    const pill = document.createElement("button");
    pill.className = "status-pill " + o.status;
    pill.textContent = STATUS_LABEL[o.status] + (o.status === "shipped" ? " ✓" : " →");
    pill.title = o.status === "shipped" ? "Completed" : "Advance to next stage";
    pill.addEventListener("click", () => cycleStatus(o.id));
    const slip = document.createElement("button");
    slip.className = "slip-btn"; slip.textContent = "Slip";
    slip.title = "Open printable packing slip";
    slip.addEventListener("click", () => openSlip(o.id));
    row.append(pill, slip);
    el.append(top, items, row);
    box.appendChild(el);
  }
}
