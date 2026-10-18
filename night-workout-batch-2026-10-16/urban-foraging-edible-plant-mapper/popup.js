/* Urban Foraging Plant Mapper — popup logic. 100% local; no network.
   Plant data: standard published foraging knowledge, summarized for reference.
   ALWAYS verify with a local expert guide before eating anything wild. */

/* Bundled local reference: common edible urban plants (general guidance only). */
const PLANTS = [
  { name: "Dandelion", latin: "Taraxacum officinale",
    id: "Toothed green leaves in a basal rosette; bright yellow flowers; hollow stem with white sap.",
    edible: "Leaves (salads), flowers (fritters, wine), roots (roasted as coffee substitute).",
    season: "Spring (leaves & flowers); roots autumn–winter.",
    warning: "Avoid lawns and roadsides treated with herbicides or heavy traffic pollution." },
  { name: "Stinging nettle", latin: "Urtica dioica",
    id: "Serrated heart-shaped leaves with stinging hairs; grows in dense patches.",
    edible: "Young spring tops, cooked like spinach (soup, pesto). Cooking or drying removes the sting.",
    season: "Spring (young tops before flowering).",
    warning: "Wear gloves when picking. Never eat raw. Avoid polluted ground." },
  { name: "Wild garlic", latin: "Allium ursinum",
    id: "Broad green leaves smelling strongly of garlic; white star flowers in spring.",
    edible: "Leaves (pesto, salads), flowers, bulbs in small amounts.",
    season: "Early spring.",
    warning: "Can be confused with toxic lily of the valley — always check the garlic smell." },
  { name: "Chickweed", latin: "Stellaria media",
    id: "Small star-shaped white flowers; single line of hairs on the stem; sprawling habit.",
    edible: "Leaves and stems, fresh in salads (mild, spinach-like).",
    season: "Year-round, best spring.",
    warning: "Learn to distinguish from lookalikes; harvest from clean soil." },
  { name: "Purslane", latin: "Portulaca oleracea",
    id: "Succulent paddle-shaped leaves, reddish stems, grows flat along the ground.",
    edible: "Leaves and stems, fresh or lightly cooked; rich in omega-3s.",
    season: "Summer.",
    warning: "Contains oxalic acid — eat in moderation. Avoid sprayed areas." },
  { name: "Blackberry", latin: "Rubus fruticosus agg.",
    id: "Thorny arching canes; white/pink flowers; aggregate berries ripening red to black.",
    edible: "Ripe black berries, fresh or cooked.",
    season: "Late summer–autumn.",
    warning: "Only eat fully ripe berries; avoid low berries near paths sprayed or frequented by dogs." },
  { name: "Elder", latin: "Sambucus nigra",
    id: "Flat-topped clusters of creamy-white fragrant flowers; later black berries on red stalks.",
    edible: "Flowers (cordial, fritters); RIPE berries only, cooked (syrup, jam).",
    season: "Flowers: early summer; berries: autumn.",
    warning: "Unripe berries and other parts are toxic — cook ripe berries before eating." },
  { name: "Hawthorn", latin: "Crataegus monogyna",
    id: "Deeply lobed leaves; white spring blossom; red berries (haws) in autumn.",
    edible: "Ripe haws (jellies, ketchup); young leaves and buds in salads.",
    season: "Autumn (berries).",
    warning: "Seeds contain amygdalin — spit seeds out; eat berries in moderation." },
  { name: "Ribwort plantain", latin: "Plantago lanceolata",
    id: "Lance-shaped ribbed leaves in a rosette; brown flower spikes on tall stems.",
    edible: "Young leaves in salads; older leaves cooked.",
    season: "Spring–autumn.",
    warning: "Avoid plants from roadsides and chemically treated ground." },
  { name: "Common mallow", latin: "Malva sylvestris",
    id: "Round lobed leaves; pink-purple veined flowers; cheese-wheel seed pods.",
    edible: "Leaves and flowers in salads; seed pods as a snack.",
    season: "Spring–autumn.",
    warning: "Harvest from clean ground away from traffic and pesticides." },
  { name: "Wood sorrel", latin: "Oxalis acetosella",
    id: "Heart-shaped clover-like leaflets in threes; delicate white/pink flowers.",
    edible: "Leaves as a tangy nibble or garnish.",
    season: "Spring–summer.",
    warning: "Contains oxalic acid — only small amounts; avoid if prone to kidney stones." },
  { name: "Fat hen", latin: "Chenopodium album",
    id: "Dusty-green diamond-shaped leaves with a mealy coating; tall upright habit.",
    edible: "Young leaves and shoots, cooked like spinach.",
    season: "Summer.",
    warning: "Contains oxalic acid — cook and eat in moderation; avoid polluted soil." }
];

const $ = (id) => document.getElementById(id);
const icons = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

let log = [];
let editingId = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderPlants(query) {
  const q = query.trim().toLowerCase();
  const list = $("plant-list");
  const filtered = PLANTS.filter((p) =>
    !q || (p.name + " " + p.latin + " " + p.edible).toLowerCase().includes(q)
  );
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No plants match your search.</div>';
    return;
  }
  list.innerHTML = filtered.map((p) => `
    <div class="card">
      <h3>${esc(p.name)} <span class="latin">${esc(p.latin)}</span></h3>
      <div class="detail-row"><span class="k">Identify</span><span class="v">${esc(p.id)}</span></div>
      <div class="detail-row"><span class="k">Edible</span><span class="v">${esc(p.edible)}</span></div>
      <div class="detail-row"><span class="k">Season</span><span class="v">${esc(p.season)}</span></div>
      <div class="detail-row warn"><span class="k">Caution</span><span class="v">${esc(p.warning)}</span></div>
    </div>`).join("");
}

function renderLog(query) {
  const q = query.trim().toLowerCase();
  const list = $("log-list");
  const filtered = log
    .slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .filter((e) => !q || [e.name, e.spot, e.notes].join(" ").toLowerCase().includes(q));
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No finds logged yet. Record your first spot!</div>';
    return;
  }
  list.innerHTML = filtered.map((e) => `
    <div class="card" data-id="${esc(e.id)}">
      <div class="card-head">
        <div>
          <h3>${esc(e.name)}</h3>
          <div class="log-date">${esc(e.date || "no date")}${e.spot ? " · " + esc(e.spot) : ""}</div>
        </div>
        <div class="card-actions">
          <button data-act="edit" title="Edit">${icons.edit}</button>
          <button data-act="del" class="danger" title="Delete">${icons.trash}</button>
        </div>
      </div>
      ${e.notes ? `<div class="detail-row"><span class="k">Notes</span><span class="v">${esc(e.notes)}</span></div>` : ""}
    </div>`).join("");
}

async function saveLog() {
  await chrome.storage.local.set({ foragingLog: log });
}

function openEditor(entry) {
  editingId = entry ? entry.id : null;
  $("log-editor-title").textContent = entry ? "Edit find" : "Log a find";
  $("l-name").value = entry?.name || "";
  $("l-date").value = entry?.date || new Date().toISOString().slice(0, 10);
  $("l-spot").value = entry?.spot || "";
  $("l-notes").value = entry?.notes || "";
  $("log-editor").classList.remove("hidden");
  $("l-name").focus();
}

async function saveEditor() {
  const name = $("l-name").value.trim();
  if (!name) { $("l-name").focus(); return; }
  const entry = {
    id: editingId || "f-" + Date.now(),
    name,
    date: $("l-date").value,
    spot: $("l-spot").value.trim(),
    notes: $("l-notes").value.trim()
  };
  log = editingId ? log.map((e) => (e.id === editingId ? entry : e)) : [...log, entry];
  await saveLog();
  $("log-editor").classList.add("hidden");
  renderLog($("log-search").value);
}

function init() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $("tab-" + t.dataset.tab).classList.add("active");
    });
  });

  $("plant-search").addEventListener("input", (e) => renderPlants(e.target.value));
  $("log-search").addEventListener("input", (e) => renderLog(e.target.value));
  $("log-add-btn").addEventListener("click", () => openEditor(null));
  $("log-cancel").addEventListener("click", () => $("log-editor").classList.add("hidden"));
  $("log-save").addEventListener("click", saveEditor);
  $("log-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest(".card").dataset.id;
    if (btn.dataset.act === "edit") {
      openEditor(log.find((x) => x.id === id));
    } else if (btn.dataset.act === "del") {
      log = log.filter((x) => x.id !== id);
      await saveLog();
      renderLog($("log-search").value);
    }
  });

  chrome.storage.local.get("foragingLog").then((d) => {
    log = d.foragingLog || [];
    renderPlants("");
    renderLog("");
  });
}

document.addEventListener("DOMContentLoaded", init);
