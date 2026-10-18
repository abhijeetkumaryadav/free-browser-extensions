/* Compare Cards — personal pros & cons comparison tool.
   All data is user-entered; scores come only from user-assigned weights.
   No research, no AI, no network. */

"use strict";

const STORAGE_KEY = "cbpc_cards_v1"; // array of card objects
const SELECTED_KEY = "cbpc_selected_v1"; // currently open card id

/* ------------------------------------------------------------------ */
/* ENGINE-START: pure scoring / export logic (headless-testable)       */
/* ------------------------------------------------------------------ */

// Card shape: { id, title, pros: [{id,text,weight}], cons: [{id,text,weight}] }
function scoreCard(card) {
  const proTotal = card.pros.reduce((s, b) => s + clampWeight(b.weight), 0);
  const conTotal = card.cons.reduce((s, b) => s + clampWeight(b.weight), 0);
  const net = proTotal - conTotal;
  return { proTotal, conTotal, net, verdict: verdictFor(net) };
}

function clampWeight(w) {
  const n = parseInt(w, 10);
  if (isNaN(n)) return 0;
  return Math.min(5, Math.max(1, n));
}

function verdictFor(net) {
  if (net > 0) return { text: "Leans positive", cls: "pos" };
  if (net < 0) return { text: "Leans negative", cls: "neg" };
  return { text: "Even", cls: "zero" };
}

// Plain-text summary for the "Text summary" export.
function exportText(cards) {
  const lines = ["COMPARE CARDS — personal notes export", ""];
  cards.forEach((card, i) => {
    const s = scoreCard(card);
    lines.push((i + 1) + ". " + card.title);
    lines.push("   Pros (" + s.proTotal + "):");
    card.pros.forEach((p) => lines.push("     + [" + clampWeight(p.weight) + "] " + p.text));
    lines.push("   Cons (" + s.conTotal + "):");
    card.cons.forEach((c) => lines.push("     - [" + clampWeight(c.weight) + "] " + c.text));
    lines.push("   Net: " + s.net + " — " + s.verdict.text);
    lines.push("");
  });
  lines.push("Scores come only from your own assigned weights — not researched data.");
  return lines.join("\n");
}
/* ENGINE-END */
/* ------------------------------------------------------------------ */

/* ------------------------- UI wiring ------------------------------ */

const $ = (id) => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

let cards = [];
let selectedId = null;

function save() {
  chrome.storage.local.set({ [STORAGE_KEY]: cards, [SELECTED_KEY]: selectedId });
}

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY, SELECTED_KEY], (data) => {
    cards = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    selectedId = data[SELECTED_KEY] || null;
    cb();
  });
}

function selectedCard() {
  return cards.find((c) => c.id === selectedId) || null;
}

/* ------------------------------ List view ------------------------- */

function renderList() {
  $("listView").classList.remove("hidden");
  $("detailView").classList.add("hidden");

  if (!cards.length) {
    $("cardList").innerHTML =
      '<li class="empty">No comparisons yet.<br>Add a topic above to start your first card.</li>';
    return;
  }

  $("cardList").innerHTML = cards.map((card) => {
    const s = scoreCard(card);
    const ncls = s.net > 0 ? "pos" : s.net < 0 ? "neg" : "zero";
    const sign = s.net > 0 ? "+" : "";
    return '<li class="card-item" data-id="' + card.id + '">' +
      '<span class="t">' + escapeHtml(card.title) + '</span>' +
      '<span class="n ' + ncls + '">' + sign + s.net + '</span></li>';
  }).join("");

  $("cardList").querySelectorAll(".card-item").forEach((el) => {
    el.addEventListener("click", () => {
      selectedId = el.dataset.id;
      save();
      renderDetail();
    });
  });
}

/* ----------------------------- Detail view ------------------------ */

function bulletHtml(b) {
  return '<li class="bullet" data-id="' + b.id + '">' +
    '<span class="bt" title="' + escapeHtml(b.text) + '">' + escapeHtml(b.text) + '</span>' +
    '<span class="bw">w' + clampWeight(b.weight) + '</span>' +
    '<button class="del" title="Remove">&times;</button></li>';
}

function renderBullets(listEl, items, side) {
  listEl.innerHTML = items.length
    ? items.map(bulletHtml).join("")
    : '<li class="empty">None yet.</li>';
  listEl.querySelectorAll(".bullet").forEach((el) => {
    el.querySelector(".del").addEventListener("click", (e) => {
      e.stopPropagation();
      const card = selectedCard();
      if (!card) return;
      card[side] = card[side].filter((b) => b.id !== el.dataset.id);
      save();
      renderDetail();
    });
  });
}

function renderDetail() {
  const card = selectedCard();
  if (!card) { renderList(); return; }

  $("listView").classList.add("hidden");
  $("detailView").classList.remove("hidden");
  $("cardTitle").value = card.title;

  const s = scoreCard(card);
  $("proTotal").textContent = s.proTotal;
  $("conTotal").textContent = s.conTotal;
  $("netScore").textContent = (s.net > 0 ? "+" : "") + s.net;

  // Score bar: proportion of pro weight vs total.
  const total = s.proTotal + s.conTotal;
  const pct = total === 0 ? 50 : Math.round((s.proTotal / total) * 100);
  $("scoreFill").style.width = pct + "%";
  const v = $("verdict");
  v.textContent = s.verdict.text;
  v.className = "verdict " + s.verdict.cls;

  renderBullets($("proList"), card.pros, "pros");
  renderBullets($("conList"), card.cons, "cons");
}

function addBullet(side, textInput, weightSelect) {
  const card = selectedCard();
  if (!card) return;
  const text = textInput.value.trim();
  if (!text) return;
  card[side].push({ id: uid(), text, weight: clampWeight(weightSelect.value) });
  textInput.value = "";
  save();
  renderDetail();
  textInput.focus();
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  load(() => {
    // If a card was open when the popup closed, reopen it.
    if (selectedCard()) renderDetail();
    else renderList();
  });

  $("addCard").addEventListener("click", () => {
    const title = $("newCardTitle").value.trim();
    if (!title) return;
    const card = { id: uid(), title, pros: [], cons: [] };
    cards.unshift(card);
    selectedId = card.id;
    $("newCardTitle").value = "";
    save();
    renderDetail();
  });
  $("newCardTitle").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("addCard").click();
  });

  $("backBtn").addEventListener("click", () => { selectedId = null; save(); renderList(); });

  $("cardTitle").addEventListener("input", () => {
    const card = selectedCard();
    if (!card) return;
    card.title = $("cardTitle").value;
    save(); // no re-render while typing
  });

  $("deleteCard").addEventListener("click", () => {
    const card = selectedCard();
    if (!card) return;
    if (!confirm('Delete "' + card.title + '" and all its notes?')) return;
    cards = cards.filter((c) => c.id !== card.id);
    selectedId = null;
    save();
    renderList();
  });

  $("addPro").addEventListener("click", () => addBullet("pros", $("proText"), $("proWeight")));
  $("addCon").addEventListener("click", () => addBullet("cons", $("conText"), $("conWeight")));
  $("proText").addEventListener("keydown", (e) => { if (e.key === "Enter") addBullet("pros", $("proText"), $("proWeight")); });
  $("conText").addEventListener("keydown", (e) => { if (e.key === "Enter") addBullet("cons", $("conText"), $("conWeight")); });

  $("exportJson").addEventListener("click", () => {
    download("compare-cards.json", JSON.stringify(cards, null, 2), "application/json");
  });
  $("exportTxt").addEventListener("click", () => {
    download("compare-cards.txt", exportText(cards), "text/plain");
  });
});
