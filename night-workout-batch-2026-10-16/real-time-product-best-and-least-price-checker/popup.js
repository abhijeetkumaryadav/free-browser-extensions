/* Price Logbook — personal price-sighting logbook.
 * Honest scope: the user logs prices they see themselves. The extension
 * NEVER fetches other sites' prices, scrapes pages, or compares live offers. */

"use strict";

const STORE_KEY = "priceEntries"; // Array of { id, product, store, price, ts }

/* ---------- storage helpers ---------- */

async function loadEntries() {
  const { [STORE_KEY]: entries } = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(entries) ? entries : [];
}

async function saveEntries(entries) {
  await chrome.storage.local.set({ [STORE_KEY]: entries });
}

/* ---------- formatting ---------- */

function fmt(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------- sparkline chart ---------- */

function drawChart(canvas, prices) {
  const ctx = canvas.getContext("2d");
  const w = (canvas.width = 640);
  const h = (canvas.height = 88);
  ctx.clearRect(0, 0, w, h);
  if (prices.length < 2) return;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const x = (i) => (i / (prices.length - 1)) * (w - 16) + 8;
  const y = (v) => h - 10 - ((v - min) / span) * (h - 24);

  ctx.beginPath();
  prices.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
  ctx.strokeStyle = "#a3e635";
  ctx.lineWidth = 3;
  ctx.stroke();

  prices.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(v), 5, 0, Math.PI * 2);
    ctx.fillStyle = "#a3e635";
    ctx.fill();
  });
}

/* ---------- rendering ---------- */

function render(entries) {
  const list = document.getElementById("product-list");
  const empty = document.getElementById("empty");
  list.innerHTML = "";

  // Group entries by normalized product name, preserving first-seen order.
  const groups = new Map();
  for (const e of entries) {
    const key = e.product.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: e.product.trim(), items: [] });
    groups.get(key).items.push(e);
  }

  empty.hidden = groups.size > 0;

  for (const { name, items } of groups.values()) {
    const prices = items.map((e) => e.price);
    const best = Math.min(...prices);
    const least = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    const card = document.createElement("div");
    card.className = "product";

    const head = document.createElement("div");
    head.className = "product-head";
    const title = document.createElement("strong");
    title.textContent = name;
    const clear = document.createElement("button");
    clear.textContent = "Clear";
    clear.title = "Remove all entries for this product";
    clear.addEventListener("click", async () => {
      const ids = new Set(items.map((e) => e.id));
      await saveEntries(entries.filter((e) => !ids.has(e.id)));
      render(await loadEntries());
    });
    head.append(title, clear);

    const stats = document.createElement("div");
    stats.className = "stats";
    for (const [label, value] of [["Best", best], ["Least", least], ["Avg", avg]]) {
      const s = document.createElement("div");
      s.className = "stat";
      const l = document.createElement("span");
      l.textContent = label;
      const v = document.createElement("b");
      v.textContent = fmt(value);
      s.append(l, v);
      stats.appendChild(s);
    }

    const chart = document.createElement("canvas");
    chart.className = "chart";
    drawChart(chart, prices);

    const ul = document.createElement("ul");
    ul.className = "entries";
    for (const e of items.slice().sort((a, b) => b.ts - a.ts)) {
      const li = document.createElement("li");
      const info = document.createElement("span");
      info.textContent = `${e.store} · ${fmtDate(e.ts)} · ${fmt(e.price)}`;
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "✕";
      del.title = "Delete entry";
      del.addEventListener("click", async () => {
        await saveEntries(entries.filter((x) => x.id !== e.id));
        render(await loadEntries());
      });
      li.append(info, del);
      ul.appendChild(li);
    }

    card.append(head, stats, chart, ul);
    list.appendChild(card);
  }
}

/* ---------- add form ---------- */

function showError(msg) {
  const el = document.getElementById("form-error");
  el.textContent = msg;
  el.hidden = !msg;
}

document.getElementById("add").addEventListener("click", async () => {
  const product = document.getElementById("product").value.trim();
  const store = document.getElementById("store").value.trim();
  const price = parseFloat(document.getElementById("price").value);

  if (!product) return showError("Enter a product name.");
  if (!store) return showError("Enter the store where you saw it.");
  if (!Number.isFinite(price) || price <= 0) return showError("Enter a valid price above 0.");
  showError("");

  const entries = await loadEntries();
  entries.push({ id: crypto.randomUUID(), product, store, price, ts: Date.now() });
  await saveEntries(entries);

  document.getElementById("product").value = "";
  document.getElementById("store").value = "";
  document.getElementById("price").value = "";
  render(entries);
});

/* ---------- init ---------- */

loadEntries().then(render);
