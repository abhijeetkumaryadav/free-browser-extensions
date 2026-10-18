/* Community Fridge Inventory Logger — local-first logbook. storage only, no network. */

const KEY = "fridge_items_v1";
const SOON_DAYS = 3;

async function loadItems() {
  const r = await chrome.storage.local.get(KEY);
  return Array.isArray(r[KEY]) ? r[KEY] : [];
}
async function saveItems(items) {
  await chrome.storage.local.set({ [KEY]: items });
}
function uid() {
  return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Days from today to a YYYY-MM-DD date (local midnight math). */
function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

function expiryInfo(item) {
  const n = daysUntil(item.expiry);
  if (n < 0) return { cls: "over", text: `Expired ${Math.abs(n)}d ago` };
  if (n === 0) return { cls: "soon", text: "Expires today" };
  if (n <= SOON_DAYS) return { cls: "soon", text: `Expires in ${n}d` };
  return { cls: "ok", text: `Expires in ${n}d` };
}

const itemListEl = document.getElementById("itemList");
const searchEl = document.getElementById("searchBox");
const locFilterEl = document.getElementById("locFilter");
const catFilterEl = document.getElementById("catFilter");
const alertEl = document.getElementById("alertBanner");

function renderStats(items) {
  document.getElementById("statTotal").textContent = items.length;
  const soon = items.filter((i) => { const n = daysUntil(i.expiry); return n >= 0 && n <= SOON_DAYS; });
  const expired = items.filter((i) => daysUntil(i.expiry) < 0);
  document.getElementById("statSoon").textContent = soon.length;
  document.getElementById("statExpired").textContent = expired.length;
  document.getElementById("statCats").textContent = new Set(items.map((i) => i.category)).size;
  if (soon.length || expired.length) {
    alertEl.classList.remove("hidden");
    alertEl.innerHTML = `<strong>⚠ Action needed:</strong> ${expired.length ? `${expired.length} expired — please remove.` : ""}${expired.length && soon.length ? " " : ""}${soon.length ? `${soon.length} expiring within ${SOON_DAYS} days.` : ""}`;
  } else {
    alertEl.classList.add("hidden");
  }
}

function renderCatFilter(items) {
  const cur = catFilterEl.value;
  const cats = [...new Set(items.map((i) => i.category))].sort();
  catFilterEl.innerHTML = '<option value="">All categories</option>' +
    cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (cats.includes(cur)) catFilterEl.value = cur;
}

function renderItems(items) {
  const q = searchEl.value.trim().toLowerCase();
  const loc = locFilterEl.value;
  const cat = catFilterEl.value;
  let shown = items.filter((i) =>
    (!q || i.name.toLowerCase().includes(q)) &&
    (!loc || i.location === loc) &&
    (!cat || i.category === cat)
  );
  // expired first, then by expiry date
  shown = [...shown].sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  if (!shown.length) {
    itemListEl.innerHTML = '<div class="empty">Nothing here yet. Use the "Add item" tab to log food.</div>';
    return;
  }
  itemListEl.innerHTML = shown.map((i) => {
    const ex = expiryInfo(i);
    return `<div class="item" data-id="${i.id}">
      <div class="item-top"><strong>${esc(i.name)}</strong><span class="qty">× ${esc(i.qty)}</span></div>
      <div class="item-meta">
        <span class="exp ${ex.cls}">${ex.text} (${esc(i.expiry)})</span>
        <span>${esc(i.category)} · ${esc(locLabel(i.location))}</span>
        ${i.addedBy ? `<span>by ${esc(i.addedBy)}</span>` : ""}
      </div>
      <div class="item-actions">
        <button class="btn ghost" data-take="${i.id}">Mark taken</button>
        <button class="btn ghost" data-del="${i.id}">Delete</button>
      </div>
    </div>`;
  }).join("");
}

function locLabel(v) {
  return { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry shelf" }[v] || v;
}

function buildSummary(items) {
  const lines = [];
  lines.push("🧊 Community Fridge — Inventory Summary");
  lines.push("Generated: " + new Date().toLocaleString());
  lines.push("");
  if (!items.length) {
    lines.push("The fridge is empty. Restock needed!");
    return lines.join("\n");
  }
  const byCat = {};
  for (const i of items) { (byCat[i.category] = byCat[i.category] || []).push(i); }
  lines.push(`Total items: ${items.length}`);
  lines.push("");
  for (const [cat, list] of Object.entries(byCat).sort()) {
    lines.push(`▸ ${cat} (${list.length})`);
    for (const i of list) {
      const ex = expiryInfo(i);
      lines.push(`  • ${i.name} ×${i.qty} — ${ex.text}${i.addedBy ? ` (by ${i.addedBy})` : ""}`);
    }
    lines.push("");
  }
  const soon = items.filter((i) => { const n = daysUntil(i.expiry); return n >= 0 && n <= SOON_DAYS; });
  const expired = items.filter((i) => daysUntil(i.expiry) < 0);
  if (soon.length) {
    lines.push(`⚠ Expiring within ${SOON_DAYS} days: ` + soon.map((i) => i.name).join(", "));
  }
  if (expired.length) {
    lines.push(`❌ Expired — please remove: ` + expired.map((i) => i.name).join(", "));
  }
  const counts = Object.entries(byCat).map(([c, l]) => `${c}: ${l.length}`).join(" · ");
  lines.push("");
  lines.push(`Stock by category — ${counts}`);
  lines.push("Low on something? Consider restocking staple categories.");
  return lines.join("\n");
}

async function refresh() {
  const items = await loadItems();
  renderStats(items);
  renderCatFilter(items);
  renderItems(items);
  document.getElementById("summaryText").textContent = buildSummary(items);
}

/* events */
document.getElementById("itemForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("iName").value.trim();
  const category = document.getElementById("iCategory").value;
  const qty = Math.max(1, Number(document.getElementById("iQty").value) || 1);
  const expiry = document.getElementById("iExpiry").value;
  const location = document.getElementById("iLoc").value;
  const addedBy = document.getElementById("iBy").value.trim();
  if (!name || !expiry) { alert("Item name and expiry date are required."); return; }
  const items = await loadItems();
  items.push({ id: uid(), name, category, qty, expiry, location, addedBy, createdAt: Date.now() });
  await saveItems(items);
  e.target.reset();
  document.getElementById("iQty").value = 1;
  await refresh();
  switchTab("items");
});

itemListEl.addEventListener("click", async (e) => {
  const take = e.target.closest("[data-take]");
  const del = e.target.closest("[data-del]");
  if (!take && !del) return;
  const id = (take || del).dataset.take || (take || del).dataset.del;
  let items = await loadItems();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  if (take) {
    if (!confirm(`Mark "${item.name}" as taken/removed?`)) return;
    items = items.filter((i) => i.id !== id);
  } else {
    if (!confirm(`Delete "${item.name}"?`)) return;
    items = items.filter((i) => i.id !== id);
  }
  await saveItems(items);
  await refresh();
});

searchEl.addEventListener("input", () => refresh());
locFilterEl.addEventListener("change", () => refresh());
catFilterEl.addEventListener("change", () => refresh());

document.getElementById("copySummaryBtn").addEventListener("click", async () => {
  const text = document.getElementById("summaryText").textContent;
  try {
    await navigator.clipboard.writeText(text);
    alert("Summary copied to clipboard.");
  } catch {
    alert("Could not copy automatically — select the summary text and copy it manually.");
  }
});

/* tabs */
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

/* init */
refresh();
