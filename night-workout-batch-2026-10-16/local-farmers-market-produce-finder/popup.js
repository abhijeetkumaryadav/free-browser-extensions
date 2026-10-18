/* Local Farmers Market Finder — popup logic. 100% local; no network. */

/* Bundled sample markets — clearly labeled sample data, user replaces with real ones. */
const SAMPLE_MARKETS = [
  { id: "sample-1", name: "Riverside Saturday Market", location: "Riverside Park, Gate 2", days: "Sat 8am–2pm", notes: "Sample listing — great for organic greens.", sample: true },
  { id: "sample-2", name: "Old Town Night Bazaar", location: "Old Town Square", days: "Fri 5pm–10pm", notes: "Sample listing — street food stalls.", sample: true },
  { id: "sample-3", name: "Greenfield Farm Stall", location: "Greenfield Rd, km 4", days: "Sun 9am–1pm", notes: "Sample listing — farm-direct dairy & eggs.", sample: true }
];

/* General Northern-hemisphere seasonal produce guidance (not exhaustive, varies locally). */
const SEASONAL = {
  0: { fruits: ["Apples", "Pears", "Citrus"], veg: ["Brussels sprouts", "Cabbage", "Carrots", "Leeks", "Parsnips"] },
  1: { fruits: ["Apples", "Pears", "Citrus"], veg: ["Cabbage", "Carrots", "Leeks", "Parsnips", "Kale"] },
  2: { fruits: ["Apples", "Citrus"], veg: ["Leeks", "Spinach", "Spring onions", "Cabbage"] },
  3: { fruits: ["Rhubarb", "Strawberries"], veg: ["Asparagus", "Peas", "Spinach", "Lettuce", "Radishes"] },
  4: { fruits: ["Strawberries", "Cherries"], veg: ["Asparagus", "Peas", "New potatoes", "Lettuce", "Broad beans"] },
  5: { fruits: ["Cherries", "Apricots", "Raspberries", "Blueberries"], veg: ["Peas", "Beans", "Courgettes", "Cucumbers", "Tomatoes"] },
  6: { fruits: ["Apricots", "Peaches", "Blueberries", "Blackberries"], veg: ["Tomatoes", "Sweetcorn", "Courgettes", "Beans", "Peppers"] },
  7: { fruits: ["Peaches", "Plums", "Blackberries", "Apples"], veg: ["Tomatoes", "Sweetcorn", "Aubergines", "Peppers", "Courgettes"] },
  8: { fruits: ["Apples", "Pears", "Plums", "Grapes"], veg: ["Pumpkins", "Squash", "Sweetcorn", "Tomatoes", "Beetroot"] },
  9: { fruits: ["Apples", "Pears", "Quinces"], veg: ["Pumpkins", "Cabbage", "Carrots", "Parsnips", "Leeks"] },
  10: { fruits: ["Apples", "Pears", "Citrus"], veg: ["Brussels sprouts", "Cabbage", "Parsnips", "Leeks", "Turnips"] },
  11: { fruits: ["Apples", "Pears", "Citrus"], veg: ["Brussels sprouts", "Cabbage", "Carrots", "Parsnips", "Kale"] }
};
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const $ = (id) => document.getElementById(id);
let markets = [];
let editingId = null;

const icons = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function load() {
  const data = await chrome.storage.local.get(["markets", "seeded"]);
  if (!data.seeded) {
    markets = [...SAMPLE_MARKETS];
    await chrome.storage.local.set({ markets, seeded: true });
  } else {
    markets = data.markets || [];
  }
  renderMarkets("");
}

function renderMarkets(query) {
  const q = query.trim().toLowerCase();
  const list = $("market-list");
  const filtered = markets.filter((m) =>
    !q || [m.name, m.location, m.days, m.notes].join(" ").toLowerCase().includes(q)
  );
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No markets found. Add your first one!</div>';
    return;
  }
  list.innerHTML = filtered.map((m) => `
    <div class="card" data-id="${esc(m.id)}">
      <div class="card-head">
        <div>
          <h3>${esc(m.name)} ${m.sample ? '<span class="badge-sample">SAMPLE</span>' : ""}</h3>
          <div class="loc">${icons.pin}<span>${esc(m.location)}</span></div>
        </div>
        <div class="card-actions">
          <button data-act="edit" title="Edit">${icons.edit}</button>
          <button data-act="del" class="danger" title="Delete">${icons.trash}</button>
        </div>
      </div>
      ${m.days ? `<span class="days">${esc(m.days)}</span>` : ""}
      ${m.notes ? `<div class="notes">${esc(m.notes)}</div>` : ""}
    </div>`).join("");
}

async function save() {
  await chrome.storage.local.set({ markets });
}

function openEditor(market) {
  editingId = market ? market.id : null;
  $("editor-title").textContent = market ? "Edit market" : "Add market";
  $("f-name").value = market?.name || "";
  $("f-location").value = market?.location || "";
  $("f-days").value = market?.days || "";
  $("f-notes").value = market?.notes || "";
  $("editor").classList.remove("hidden");
  $("f-name").focus();
}

async function saveEditor() {
  const name = $("f-name").value.trim();
  if (!name) { $("f-name").focus(); return; }
  const entry = {
    id: editingId || "m-" + Date.now(),
    name,
    location: $("f-location").value.trim(),
    days: $("f-days").value.trim(),
    notes: $("f-notes").value.trim(),
    sample: editingId ? (markets.find((m) => m.id === editingId)?.sample || false) : false
  };
  if (editingId) {
    markets = markets.map((m) => (m.id === editingId ? entry : m));
  } else {
    markets.push(entry);
  }
  await save();
  $("editor").classList.add("hidden");
  renderMarkets($("search").value);
}

function renderSeasonal(monthIdx) {
  const data = SEASONAL[monthIdx];
  $("produce-list").innerHTML = `
    <div class="card"><div class="produce-head">Fruits in ${MONTHS[monthIdx]}</div>
      <div class="produce-grid">${data.fruits.map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</div>
    </div>
    <div class="card"><div class="produce-head">Vegetables in ${MONTHS[monthIdx]}</div>
      <div class="produce-grid">${data.veg.map((v) => `<span class="chip">${esc(v)}</span>`).join("")}</div>
    </div>`;
}

function init() {
  // Tabs
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $("tab-" + t.dataset.tab).classList.add("active");
    });
  });

  // Month selector
  $("month").innerHTML = MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join("");
  $("month").value = String(new Date().getMonth());
  $("month").addEventListener("change", (e) => renderSeasonal(Number(e.target.value)));
  renderSeasonal(new Date().getMonth());

  // Search
  $("search").addEventListener("input", (e) => renderMarkets(e.target.value));

  // Add / edit / delete (event delegation)
  $("add-btn").addEventListener("click", () => openEditor(null));
  $("editor-cancel").addEventListener("click", () => $("editor").classList.add("hidden"));
  $("editor-save").addEventListener("click", saveEditor);
  $("market-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest(".card").dataset.id;
    if (btn.dataset.act === "edit") {
      openEditor(markets.find((m) => m.id === id));
    } else if (btn.dataset.act === "del") {
      markets = markets.filter((m) => m.id !== id);
      await save();
      renderMarkets($("search").value);
    }
  });

  load();
}

document.addEventListener("DOMContentLoaded", init);
