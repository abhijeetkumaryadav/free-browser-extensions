/* Context Clue Word Guesser — popup game logic
 * Fully local: bundled word/clue pairs, no network, best score in localStorage.
 */

// ---------------------------------------------------------------------------
// Bundled word/clue data — each clue hides the word (never names it directly)
// ---------------------------------------------------------------------------
const WORDS = [
  { word: "horizon", clue: "At sunset, sailors watch the sky meet the sea along this invisible line." },
  { word: "lantern", clue: "A portable light with a handle, often carried through the dark on old ships." },
  { word: "compass", clue: "This pocket tool always points north, no matter which way you turn." },
  { word: "echo", clue: "In a canyon, your shout comes back to you as this faint reply." },
  { word: "library", clue: "A quiet building full of shelves where you can borrow books for free." },
  { word: "volcano", clue: "A mountain that can suddenly erupt with lava, ash, and smoke." },
  { word: "astronaut", clue: "This person trains for years to travel beyond Earth's atmosphere." },
  { word: "umbrella", clue: "You open this on a rainy day to keep the drops off your head." },
  { word: "pyramid", clue: "Ancient Egyptians built these triangular tombs from giant stone blocks." },
  { word: "camera", clue: "Point, click — this device captures a moment as a photograph." },
  { word: "bridge", clue: "Cars and trains cross a river on this structure instead of swimming." },
  { word: "garden", clue: "Behind the house, flowers and vegetables grow in this patch of soil." },
  { word: "thunder", clue: "After lightning flashes, the sky rumbles with this deep sound." },
  { word: "kangaroo", clue: "This Australian animal carries its baby in a pouch and moves by hopping." },
  { word: "telescope", clue: "Point it at the night sky and distant planets look much closer." },
  { word: "feather", clue: "Light as air, birds are covered in these — they help them fly." },
  { word: "clock", clue: "On the wall it ticks, its hands always telling you the hour." },
  { word: "river", clue: "Water flows downhill through this channel until it reaches the sea." },
  { word: "keyboard", clue: "Your fingers dance across these keys to type words on a screen." },
  { word: "mountain", clue: "Climbers with ropes and gear ascend this towering peak of rock." },
  { word: "whisper", clue: "Say it very quietly — this soft speech barely makes a sound." },
  { word: "treasure", clue: "Pirates buried this chest of gold on a deserted island." },
  { word: "rocket", clue: "It blasts off from a launchpad, riding a pillar of fire into space." },
  { word: "desert", clue: "Camels cross this dry, sandy land where rain almost never falls." },
  { word: "orchestra", clue: "Dozens of musicians with violins, trumpets, and drums play together here." },
  { word: "village", clue: "Smaller than a town, this quiet community has just a few hundred people." },
  { word: "shadow", clue: "On a sunny day, this dark shape follows you everywhere you go." },
  { word: "guitar", clue: "Strum its six strings and this instrument sings with music." },
  { word: "snowflake", clue: "No two of these tiny ice crystals are ever exactly alike." },
  { word: "detective", clue: "This investigator follows clues to solve the mystery of the crime." },
  { word: "penguin", clue: "This flightless bird waddles on ice and swims like a torpedo." },
  { word: "sunrise", clue: "Each morning the sky glows pink and gold as the day begins with this." },
  { word: "harbor", clue: "Ships drop anchor in this sheltered bay to escape the storm." },
  { word: "mirror", clue: "Look into this glass and you will see your own reflection." },
  { word: "lighthouse", clue: "Its beam sweeps the sea at night, warning ships away from the rocks." },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  word: "",
  revealed: [],      // booleans per character
  guessed: new Set(),
  lives: 5,
  score: 0,
  streak: 0,
  round: 1,
  best: 0,
  usedIndices: [],
  over: false,
};

const POINTS_LETTER = 10;
const POINTS_WIN = 100;
const STREAK_BONUS_STEP = 5; // streak >= 5 doubles letter points
const HINT_COST = 15;

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const els = {
  clue: $("clue"), wordDisplay: $("wordDisplay"), feedback: $("feedback"),
  alphabet: $("alphabet"), lives: $("lives"),
  statScore: $("statScore"), statStreak: $("statStreak"),
  statRound: $("statRound"), statBest: $("statBest"),
  screenGame: $("screenGame"), screenReveal: $("screenReveal"),
  revealEmoji: $("revealEmoji"), revealTitle: $("revealTitle"),
  revealWord: $("revealWord"), revealPoints: $("revealPoints"),
  btnHint: $("btnHint"), btnSkip: $("btnSkip"), btnNewGame: $("btnNewGame"), btnNext: $("btnNext"),
};

// ---------------------------------------------------------------------------
// Persistence (local only)
// ---------------------------------------------------------------------------
function loadBest() {
  try { state.best = parseInt(localStorage.getItem("ccwg_best") || "0", 10) || 0; }
  catch { state.best = 0; }
}
function saveBest() {
  try { localStorage.setItem("ccwg_best", String(state.best)); } catch { /* private mode */ }
}

// ---------------------------------------------------------------------------
// Round setup
// ---------------------------------------------------------------------------
function pickWord() {
  if (state.usedIndices.length >= WORDS.length) state.usedIndices = [];
  let idx;
  do { idx = Math.floor(Math.random() * WORDS.length); }
  while (state.usedIndices.includes(idx));
  state.usedIndices.push(idx);
  return WORDS[idx];
}

function newRound() {
  const entry = pickWord();
  state.word = entry.word.toLowerCase();
  state.revealed = Array.from(state.word, () => false);
  state.guessed = new Set();
  state.lives = 5;
  state.over = false;
  els.screenGame.classList.remove("hidden");
  els.screenReveal.classList.add("hidden");
  els.clue.textContent = entry.clue;
  setFeedback("");
  renderAlphabet();
  renderWord();
  renderStats();
  renderLives();
  updateHintButton();
}

function newGame() {
  state.score = 0; state.streak = 0; state.round = 1; state.usedIndices = [];
  newRound();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderWord() {
  els.wordDisplay.innerHTML = "";
  state.word.split("").forEach((ch, i) => {
    const slot = document.createElement("div");
    slot.className = "letter-slot" + (state.revealed[i] ? " revealed" : "");
    slot.textContent = state.revealed[i] ? ch : "";
    els.wordDisplay.appendChild(slot);
  });
}

function renderAlphabet() {
  els.alphabet.innerHTML = "";
  for (let c = 97; c <= 122; c++) {
    const letter = String.fromCharCode(c);
    const key = document.createElement("button");
    key.className = "key";
    key.textContent = letter;
    key.dataset.letter = letter;
    if (state.guessed.has(letter)) {
      key.disabled = true;
      key.classList.add(state.word.includes(letter) ? "correct" : "wrong");
    }
    key.addEventListener("click", () => guessLetter(letter));
    els.alphabet.appendChild(key);
  }
}

function renderLives() {
  els.lives.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const heart = document.createElement("span");
    heart.className = "life" + (i < state.lives ? "" : " lost");
    heart.textContent = "❤️";
    els.lives.appendChild(heart);
  }
}

function renderStats() {
  els.statScore.textContent = state.score;
  els.statStreak.textContent = state.streak;
  els.statRound.textContent = state.round;
  els.statBest.textContent = state.best;
}

function setFeedback(msg, kind = "") {
  els.feedback.textContent = msg;
  els.feedback.className = "feedback" + (kind ? " " + kind : "");
}

function updateHintButton() {
  els.btnHint.disabled = state.over || state.score < HINT_COST || allRevealed();
}

// ---------------------------------------------------------------------------
// Game logic
// ---------------------------------------------------------------------------
function allRevealed() {
  return state.revealed.every(Boolean);
}

function letterPoints() {
  return POINTS_LETTER * (state.streak >= STREAK_BONUS_STEP ? 2 : 1);
}

function guessLetter(letter) {
  if (state.over || state.guessed.has(letter)) return;
  state.guessed.add(letter);

  const key = els.alphabet.querySelector(`[data-letter="${letter}"]`);
  if (state.word.includes(letter)) {
    let newly = 0;
    state.word.split("").forEach((ch, i) => {
      if (ch === letter && !state.revealed[i]) { state.revealed[i] = true; newly++; }
    });
    const pts = letterPoints() * newly;
    state.score += pts;
    setFeedback(`Nice! “${letter.toUpperCase()}” ×${newly} — +${pts}`, "good");
    if (key) { key.disabled = true; key.classList.add("correct"); }
  } else {
    state.lives--;
    state.streak = 0;
    setFeedback(`No “${letter.toUpperCase()}” in this word.`, "bad");
    if (key) { key.disabled = true; key.classList.add("wrong"); }
    renderLives();
  }

  if (state.score > state.best) { state.best = state.score; saveBest(); }
  renderWord(); renderStats(); updateHintButton();

  if (allRevealed()) winRound();
  else if (state.lives <= 0) loseRound();
}

function winRound() {
  state.over = true;
  const bonus = POINTS_WIN + state.lives * 10;
  state.streak++;
  state.score += bonus;
  if (state.score > state.best) { state.best = state.score; saveBest(); }
  renderStats();
  showReveal(true, `The word was “${state.word.toUpperCase()}”.`, bonus);
}

function loseRound() {
  state.over = true;
  state.streak = 0;
  renderStats();
  showReveal(false, `The word was “${state.word.toUpperCase()}”.`, 0);
}

function showReveal(won, line, bonus) {
  els.screenGame.classList.add("hidden");
  els.screenReveal.classList.remove("hidden");
  els.revealEmoji.textContent = won ? "🎉" : "💡";
  els.revealTitle.textContent = won ? "You got it!" : "Out of lives";
  els.revealWord.textContent = state.word.toUpperCase();
  els.revealPoints.textContent = won
    ? `${line} +${bonus} points (win + life bonus)`
    : `${line} Better luck next round!`;
}

// Hint: reveal one unrevealed letter at a cost
function useHint() {
  if (state.over || state.score < HINT_COST || allRevealed()) return;
  const hiddenIdx = state.revealed
    .map((r, i) => (r ? -1 : i))
    .filter((i) => i >= 0);
  if (!hiddenIdx.length) return;
  const i = hiddenIdx[Math.floor(Math.random() * hiddenIdx.length)];
  const letter = state.word[i];
  state.score -= HINT_COST;
  state.word.split("").forEach((ch, j) => {
    if (ch === letter) state.revealed[j] = true;
  });
  state.guessed.add(letter);
  setFeedback(`Hint revealed “${letter.toUpperCase()}” (−${HINT_COST} pts)`, "good");
  renderAlphabet(); renderWord(); renderStats(); updateHintButton();
  if (allRevealed()) winRound();
}

// Skip: move on, streak resets
function skipWord() {
  if (state.over) return;
  state.streak = 0;
  state.round++;
  newRound();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
els.btnHint.addEventListener("click", useHint);
els.btnSkip.addEventListener("click", skipWord);
els.btnNewGame.addEventListener("click", newGame);
els.btnNext.addEventListener("click", () => { state.round++; newRound(); });

// Physical keyboard support
document.addEventListener("keydown", (e) => {
  if (!/^[a-zA-Z]$/.test(e.key)) return;
  if (els.screenReveal.classList.contains("hidden")) guessLetter(e.key.toLowerCase());
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
loadBest();
newGame();
