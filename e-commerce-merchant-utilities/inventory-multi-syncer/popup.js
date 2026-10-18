// Inventory Multi-Syncer — popup logic. All on-device; no network.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("addBtn").addEventListener("click", addSku);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", importCsv);
  document.querySelectorAll("[data-mkt]").forEach((b) =>
    b.addEventListener("click", () => exportMarketplace(b.dataset.mkt))
  );
  render();
}

async function getSkus() {
  const { skus = [] } = await chrome.storage.local.get("skus");
  return skus;
}
async function setSkus(skus) {
  await chrome.storage.local.set({ skus });
}

async function addSku() {
  const name = $("fName").value.trim();
  const sku = $("fSku").value.trim().toUpperCase();
  const stock = Math.max(0, parseInt($("fStock").value, 10) || 0);
  const threshold = Math.max(0, parseInt($("fThresh").value, 10) || 5);
  if (!name || !sku) return;
  const skus = await getSkus();
  if (skus.some((s) => s.sku === sku)) {
    $("fSku").focus();
    return;
  }
  skus.unshift({ id: "sku-" + Date.now(), name, sku, stock, threshold });
  await setSkus(skus.slice(0, 500));
  $("fName").value = $("fSku").value = $("fStock").value = $("fThresh").value = "";
  render();
}

function statusOf(s) {
  if (s.stock <= 0) return "out";
  if (s.stock <= s.threshold) return "low";
  return "ok";
}

async function render() {
  const skus = await getSkus();
  const units = skus.reduce((a, s) => a + s.stock, 0);
  const low = skus.filter((s) => statusOf(s) !== "ok").length;
  $("stSku").textContent = skus.length;
  $("stUnits").textContent = units.toLocaleString();
  $("stLow").textContent = low;

  const box = $("rows");
  box.innerHTML = "";
  if (!skus.length) {
    const d = document.createElement("div");
    d.className = "empty-sku";
    d.textContent = "No SKUs yet — add your first one below.";
    box.appendChild(d);
    return;
  }
  for (const s of skus) {
    const row = document.createElement("div");
    row.className = "sku";
    const dot = document.createElement("div");
    dot.className = "dot " + statusOf(s);
    dot.title = statusOf(s) === "ok" ? "In stock" : statusOf(s) === "low" ? "Low stock" : "Out of stock";
    const nm = document.createElement("div");
    nm.className = "nm";
    const b = document.createElement("b"); b.textContent = s.name; b.title = s.name;
    const sp = document.createElement("span"); sp.textContent = `${s.sku} · alert at ${s.threshold}`;
    nm.append(b, sp);
    const stepper = document.createElement("div");
    stepper.className = "stepper";
    const minus = document.createElement("button"); minus.textContent = "−";
    const val = document.createElement("b"); val.textContent = s.stock;
    const plus = document.createElement("button"); plus.textContent = "+";
    const bump = async (d) => {
      const cur = await getSkus();
      const it = cur.find((x) => x.id === s.id);
      if (it) { it.stock = Math.max(0, it.stock + d); await setSkus(cur); render(); }
    };
    minus.addEventListener("click", () => bump(-1));
    plus.addEventListener("click", () => bump(1));
    stepper.append(minus, val, plus);
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      await setSkus((await getSkus()).filter((i) => i.id !== s.id));
      render();
    });
    row.append(dot, nm, stepper, x);
    box.appendChild(row);
  }
}

function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportMarketplace(mkt) {
  const skus = await getSkus();
  if (mkt === "full") {
    downloadCsv("inventory-full.csv", [
      ["sku", "name", "stock", "low_alert_at"],
      ...skus.map((s) => [s.sku, s.name, s.stock, s.threshold]),
    ]);
    return;
  }
  // per-marketplace quantity files use each marketplace's conventional headers
  const headers = {
    amazon: ["sku", "quantity"],
    ebay: ["SKU", "Quantity"],
    shopify: ["SKU", "Inventory Qty"],
  }[mkt] || ["sku", "quantity"];
  downloadCsv(`inventory-${mkt}.csv`, [
    headers,
    ...skus.map((s) => [s.sku, s.stock]),
  ]);
}

async function importCsv(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("empty");
    const parse = (l) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
    const head = parse(lines[0]).map((h) => h.toLowerCase());
    const iSku = head.findIndex((h) => /sku/.test(h));
    const iName = head.findIndex((h) => /name|title|product/.test(h));
    const iStock = head.findIndex((h) => /stock|qty|quantity|inventory/.test(h));
    if (iSku < 0) throw new Error("no-sku");
    const cur = await getSkus();
    let added = 0;
    for (const line of lines.slice(1)) {
      const c = parse(line);
      const sku = (c[iSku] || "").toUpperCase();
      if (!sku || cur.some((s) => s.sku === sku)) continue;
      cur.unshift({
        id: "sku-" + Date.now() + "-" + added,
        name: (iName >= 0 && c[iName]) || sku,
        sku,
        stock: Math.max(0, parseInt(c[iStock], 10) || 0),
        threshold: 5,
      });
      added++;
    }
    await setSkus(cur.slice(0, 500));
    render();
  } catch (err) {
    /* invalid file — ignore quietly */
  } finally {
    e.target.value = "";
  }
}
