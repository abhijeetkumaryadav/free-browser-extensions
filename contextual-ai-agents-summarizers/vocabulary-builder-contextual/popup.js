// Vocabulary Builder Contextual — flashcards + quiz + spaced review.
// All on-device in chrome.storage.local. Review order: least-recently
// reviewed first (simple spaced repetition).

const $ = (id) => document.getElementById(id);

let words = [];        // {id, word, meaning, context, source, correct, seen, lastReviewed}
let cardIdx = 0;
let cardOrder = [];
let quizQueue = [];
let quizStats = { correct: 0, total: 0 };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => switchTab(t.dataset.tab))
  );
  $("flip").addEventListener("click", () => $("flip").classList.toggle("flipped"));
  $("prev").addEventListener("click", () => stepCard(-1));
  $("next").addEventListener("click", () => stepCard(1));
  $("shuffle").addEventListener("click", shuffleCards);
  $("reveal").addEventListener("click", revealQuiz);
  $("knew").addEventListener("click", () => gradeQuiz(true));
  $("learning").addEventListener("click", () => gradeQuiz(false));
  $("saveWord").addEventListener("click", saveWord);

  const { words: saved = [] } = await chrome.storage.local.get("words");
  words = saved;
  resetCardOrder();
  renderCard();
  renderWordList();
  startQuiz();
}

async function persist() {
  await chrome.storage.local.set({ words: words.slice(0, 1000) });
}

/* ---------- tabs ---------- */
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === name)
  );
  ["cards", "quiz", "add"].forEach((t) => {
    $("tab-" + t).hidden = t !== name;
  });
}

/* ---------- flashcards ---------- */
function spacedOrder() {
  // least recently reviewed first; never-reviewed items first
  return [...words].sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0));
}

function resetCardOrder() {
  cardOrder = spacedOrder().map((w) => w.id);
  cardIdx = 0;
}

function shuffleCards() {
  for (let i = cardOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cardOrder[i], cardOrder[j]] = [cardOrder[j], cardOrder[i]];
  }
  cardIdx = 0;
  renderCard();
}

function currentCard() {
  return words.find((w) => w.id === cardOrder[cardIdx]);
}

function stepCard(d) {
  if (!cardOrder.length) return;
  cardIdx = (cardIdx + d + cardOrder.length) % cardOrder.length;
  renderCard();
}

async function renderCard() {
  const has = cardOrder.length > 0;
  $("emptyCards").style.display = has ? "none" : "";
  $("flip").style.display = has ? "" : "none";
  document.querySelector(".controls").style.display = has ? "" : "none";
  if (!has) { $("cardMeta").textContent = ""; return; }
  const w = currentCard();
  $("flip").classList.remove("flipped");
  $("cardWord").textContent = w.word;
  $("cardMeaning").textContent = w.meaning;
  $("cardContext").textContent = w.context ? "“" + w.context + "”" : "";
  $("cardMeta").textContent =
    `${cardIdx + 1} of ${cardOrder.length}` +
    (w.source ? ` · from ${w.source}` : "") +
    (w.seen ? ` · seen ${w.seen}× · ${w.correct}✓` : " · new");
  // mark as reviewed now (spaced ordering refreshes on next open)
  w.seen = (w.seen || 0) + 1;
  w.lastReviewed = Date.now();
  await persist();
}

/* ---------- quiz ---------- */
function startQuiz() {
  quizQueue = spacedOrder().map((w) => w.id);
  quizStats = { correct: 0, total: 0 };
  nextQuiz();
}

function nextQuiz() {
  const has = quizQueue.length > 0;
  $("qWord").textContent = has ? words.find((w) => w.id === quizQueue[0]).word : "—";
  $("qAnswer").hidden = true;
  $("reveal").hidden = !has;
  $("knew").hidden = true;
  $("learning").hidden = true;
  $("quizScore").textContent = quizStats.total
    ? `Score: ${quizStats.correct}/${quizStats.total}` : (has ? "Guess the meaning, then reveal." : "");
  if (!has) $("qWord").textContent = "Add words to start quizzing.";
}

function revealQuiz() {
  const w = words.find((x) => x.id === quizQueue[0]);
  if (!w) return;
  $("qMeaning").textContent = w.meaning;
  $("qContext").textContent = w.context ? "“" + w.context + "”" : "";
  $("qAnswer").hidden = false;
  $("reveal").hidden = true;
  $("knew").hidden = false;
  $("learning").hidden = false;
}

async function gradeQuiz(knewIt) {
  const w = words.find((x) => x.id === quizQueue[0]);
  quizQueue.shift();
  quizStats.total++;
  if (w) {
    w.seen = (w.seen || 0) + 1;
    w.lastReviewed = Date.now();
    if (knewIt) { w.correct = (w.correct || 0) + 1; quizStats.correct++; }
  }
  await persist();
  nextQuiz();
}

/* ---------- add / list ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function saveWord() {
  const word = $("wWord").value.trim();
  const meaning = $("wMeaning").value.trim();
  if (!word || !meaning) { $("wWord").focus(); return; }
  words.unshift({
    id: "w-" + Date.now(),
    word, meaning,
    context: $("wContext").value.trim(),
    source: $("wSource").value.trim(),
    correct: 0, seen: 0, lastReviewed: 0,
  });
  await persist();
  $("wWord").value = $("wMeaning").value = $("wContext").value = $("wSource").value = "";
  resetCardOrder();
  renderCard();
  renderWordList();
  startQuiz();
}

async function renderWordList() {
  const box = $("wordList");
  box.innerHTML = "";
  $("wcount").textContent = `· ${words.length}`;
  if (!words.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "No words yet.";
    box.appendChild(d);
    return;
  }
  for (const w of words) {
    const row = document.createElement("div");
    row.className = "wrow";
    const t = document.createElement("div");
    t.className = "t";
    const b = document.createElement("b");
    b.textContent = w.word;
    const s = document.createElement("span");
    s.textContent = w.meaning + (w.context ? " — “" + w.context + "”" : "");
    s.title = s.textContent;
    t.append(b, s);
    const score = document.createElement("div");
    score.className = "score";
    score.textContent = w.seen ? `${w.correct}/${w.seen}` : "new";
    const x = document.createElement("button");
    x.className = "x";
    x.textContent = "×";
    x.addEventListener("click", async () => {
      words = words.filter((i) => i.id !== w.id);
      await persist();
      resetCardOrder();
      renderCard();
      renderWordList();
      startQuiz();
    });
    row.append(t, score, x);
    box.appendChild(row);
  }
}
