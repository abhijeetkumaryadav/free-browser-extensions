// Flashdeck SRS — simplified SM-2 spaced repetition, fully local.

// ENGINE-START
const DAY_MS = 86400000;

// New card state.
function newCardState() {
  return { ease: 2.5, interval: 0, reps: 0, nextDue: 0 };
}
// Grade one card; returns the updated scheduling fields. `now` = epoch ms.
function gradeCard(card, grade, now = Date.now()) {
  const c = { ease: card.ease, interval: card.interval, reps: card.reps };
  if (grade === "again") {
    c.reps = 0;
    c.interval = 0;                        // review again today
    c.ease = Math.max(1.3, c.ease - 0.2);
  } else if (grade === "good") {
    c.reps += 1;
    if (c.reps === 1) c.interval = 1;
    else if (c.reps === 2) c.interval = 6;
    else c.interval = Math.round(c.interval * c.ease);
  } else if (grade === "easy") {
    c.reps += 1;
    c.ease = c.ease + 0.15;
    if (c.reps === 1) c.interval = 4;
    else if (c.reps === 2) c.interval = 8;
    else c.interval = Math.round(c.interval * c.ease * 1.3);
  }
  return { ...c, nextDue: now + c.interval * DAY_MS };
}
// Is this card due as of `now`?
function isDue(card, now = Date.now()) {
  return card.nextDue <= now;
}
// Number of due cards in a deck.
function dueCount(deck, now = Date.now()) {
  return deck.cards.filter((c) => isDue(c, now)).length;
}
// ENGINE-END

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

let decks = [];          // [{id, name, cards:[{id, front, back, ...state}]}]
let openDeckId = null;
let reviewQueue = [];    // [{deckId, cardId}]

// --- persistence ---
async function load() {
  const s = await chrome.storage.local.get({ decks: [] });
  decks = s.decks;
}
async function save() {
  await chrome.storage.local.set({ decks });
}
const openDeck = () => decks.find((d) => d.id === openDeckId);

// --- views ---
function show(id) {
  for (const v of ["viewDecks", "viewDeck", "viewReview"]) $(v).classList.toggle("hidden", v !== id);
}

function renderDecks() {
  show("viewDecks");
  const list = $("deckList");
  list.innerHTML = "";
  $("decksEmpty").style.display = decks.length ? "none" : "block";
  for (const d of decks) {
    const row = document.createElement("div");
    row.className = "deck-row";
    const due = dueCount(d);
    row.innerHTML = `<span class="name"></span><span class="badge ${due ? "" : "zero"}">${due} due</span><span class="muted">${d.cards.length} cards</span>`;
    row.querySelector(".name").textContent = d.name;
    row.addEventListener("click", () => { openDeckId = d.id; renderDeck(); });
    list.appendChild(row);
  }
}

function renderDeck() {
  const d = openDeck();
  if (!d) return renderDecks();
  show("viewDeck");
  $("deckTitle").textContent = d.name;
  const list = $("cardList");
  list.innerHTML = "";
  for (const c of d.cards) {
    const row = document.createElement("div");
    row.className = "deck-row card-row";
    row.innerHTML = `<span class="front"></span><button class="icon-btn" title="Delete card">✕</button>`;
    row.querySelector(".front").textContent = c.front;
    row.querySelector(".icon-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      d.cards = d.cards.filter((x) => x.id !== c.id);
      await save(); renderDeck();
    });
    list.appendChild(row);
  }
  const due = dueCount(d);
  $("reviewBtn").textContent = due ? `Review (${due})` : "Review";
}

// --- review ---
function startReview() {
  const d = openDeck();
  if (!d) return;
  reviewQueue = d.cards.filter((c) => isDue(c)).map((c) => c.id);
  // shuffle lightly
  reviewQueue.sort(() => Math.random() - 0.5);
  show("viewReview");
  nextReviewCard();
}

function nextReviewCard() {
  const d = openDeck();
  const done = reviewQueue.length === 0;
  $("reviewDone").classList.toggle("hidden", !done);
  $("flashcard").style.display = done ? "none" : "flex";
  $("revealBtn").classList.toggle("hidden", done);
  $("gradeRow").classList.add("hidden");
  $("reviewProgress").textContent = done ? "" : `${reviewQueue.length} left`;
  if (done) return;
  const card = d.cards.find((c) => c.id === reviewQueue[0]);
  $("cardFront").textContent = card.front;
  $("cardBack").textContent = card.back;
  $("cardBack").classList.add("hidden");
}

$("revealBtn").addEventListener("click", () => {
  $("cardBack").classList.remove("hidden");
  $("revealBtn").classList.add("hidden");
  $("gradeRow").classList.remove("hidden");
});

document.querySelectorAll(".btn.grade").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const d = openDeck();
    const card = d.cards.find((c) => c.id === reviewQueue[0]);
    Object.assign(card, gradeCard(card, btn.dataset.g));
    reviewQueue.shift();
    await save();
    nextReviewCard();
  });
});

// --- deck & card CRUD ---
$("addDeckBtn").addEventListener("click", async () => {
  const name = prompt("Deck name:", "New deck");
  if (name === null) return;
  decks.push({ id: uid(), name: name.trim() || "Untitled deck", cards: [] });
  await save(); renderDecks();
});
$("backBtn").addEventListener("click", renderDecks);
$("addCardBtn").addEventListener("click", async () => {
  const d = openDeck();
  const front = $("frontInput").value.trim();
  const back = $("backInput").value.trim();
  if (!front || !back) return;
  d.cards.push({ id: uid(), front, back, ...newCardState() });
  $("frontInput").value = ""; $("backInput").value = "";
  await save(); renderDeck();
});
$("deleteDeckBtn").addEventListener("click", async () => {
  if (!confirm("Delete this deck and all its cards?")) return;
  decks = decks.filter((d) => d.id !== openDeckId);
  openDeckId = null;
  await save(); renderDecks();
});
$("reviewBtn").addEventListener("click", startReview);
$("quitReviewBtn").addEventListener("click", renderDeck);

// --- export / import ---
$("exportBtn").addEventListener("click", () => {
  const d = openDeck();
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = d.name.replace(/[^\w-]+/g, "_") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const d = openDeck();
    const parsed = JSON.parse(await f.text());
    const cards = Array.isArray(parsed) ? parsed : parsed.cards || [];
    for (const c of cards) {
      if (!c.front || !c.back) continue;
      d.cards.push({ id: uid(), front: String(c.front), back: String(c.back), ...newCardState() });
    }
    await save(); renderDeck();
  } catch { alert("Could not import that file."); }
  e.target.value = "";
});

document.addEventListener("DOMContentLoaded", async () => { await load(); renderDecks(); });
