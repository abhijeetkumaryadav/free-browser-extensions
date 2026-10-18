/* Typing Speed Test Overlay — popup logic
 * Chooses a passage + difficulty, asks the background worker to inject the
 * overlay on the active tab, and shows local history/best scores.
 */

// ---------------------------------------------------------------------------
// Bundled passages (no network). difficulty: easy | medium | hard
// ---------------------------------------------------------------------------
const PASSAGES = [
  // Easy — short words, simple sentences
  { title: "Morning Light", difficulty: "easy",
    text: "The sun rose over the quiet town. Birds sang in the tall trees. A cat walked down the empty street and sat in the warm light." },
  { title: "Rainy Day", difficulty: "easy",
    text: "Rain fell on the roof all night. In the morning, the grass was wet and green. Small drops hung from every leaf." },
  { title: "The Old Dog", difficulty: "easy",
    text: "The old dog slept by the fire. His ears moved when he heard a sound. He opened one eye, then went back to sleep." },
  // Medium — longer sentences, varied vocabulary
  { title: "The Lighthouse Keeper", difficulty: "medium",
    text: "Every evening the keeper climbed the narrow stairs to the lamp room. He polished the great lens until it gleamed, then lit the lamp as the fog rolled in from the sea." },
  { title: "Market Morning", difficulty: "medium",
    text: "Vendors arranged bright fruit in neat pyramids while shoppers wandered between the stalls. The air smelled of fresh bread and ripe oranges." },
  { title: "A Letter Home", difficulty: "medium",
    text: "Dear Mother, the train journey was longer than expected, but the countryside looked beautiful through the window. I will write again soon." },
  // Hard — punctuation, longer words, complex structure
  { title: "The Expedition", difficulty: "hard",
    text: "After months of preparation, the expedition finally departed — eleven scientists, four guides, and a convoy of sleds loaded with provisions, instruments, and the peculiar equipment required for polar research." },
  { title: "Clockwork", difficulty: "hard",
    text: "Inside the brass casing, hundreds of interlocking gears turned in perfect synchronization: each tooth, however minute, fulfilling its precise and indispensable function." },
  { title: "The Manuscript", difficulty: "hard",
    text: "She discovered the manuscript beneath a stack of yellowed newspapers: its margins crowded with annotations — questions, exclamations, and a single, enigmatic diagram drawn in faded blue ink." },
];

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const els = {
  statWpm: $("statWpm"), statAcc: $("statAcc"), statTests: $("statTests"),
  passageSelect: $("passageSelect"), difficultySeg: $("difficultySeg"),
  btnStart: $("btnStart"), note: $("note"),
  history: $("history"), btnClear: $("btnClear"),
};

let difficulty = "easy";

// ---------------------------------------------------------------------------
// Storage helpers (local only)
// ---------------------------------------------------------------------------
function getHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ tst_history: [] }, (res) => resolve(res.tst_history));
  });
}
function setHistory(list) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ tst_history: list }, resolve);
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderPassageOptions() {
  els.passageSelect.innerHTML = "";
  PASSAGES.filter((p) => p.difficulty === difficulty).forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = PASSAGES.indexOf(p);
    opt.textContent = p.title;
    els.passageSelect.appendChild(opt);
  });
}

function renderStats(history) {
  els.statTests.textContent = history.length;
  if (!history.length) {
    els.statWpm.textContent = "–";
    els.statAcc.textContent = "–";
    return;
  }
  const bestWpm = Math.max(...history.map((h) => h.wpm));
  const bestAcc = Math.max(...history.map((h) => h.acc));
  els.statWpm.textContent = bestWpm.toFixed(0);
  els.statAcc.textContent = bestAcc.toFixed(1) + "%";
}

function renderHistory(history) {
  els.history.innerHTML = "";
  if (!history.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No tests yet — start one!";
    els.history.appendChild(li);
    return;
  }
  history.slice(0, 10).forEach((h) => {
    const li = document.createElement("li");
    const wpm = document.createElement("span");
    wpm.className = "wpm";
    wpm.textContent = h.wpm.toFixed(0) + " WPM";
    const acc = document.createElement("span");
    acc.className = "acc";
    acc.textContent = h.acc.toFixed(1) + "% · " + h.difficulty;
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = new Date(h.at).toLocaleDateString();
    li.append(wpm, acc, date);
    els.history.appendChild(li);
  });
}

async function refresh() {
  const history = await getHistory();
  renderStats(history);
  renderHistory(history);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
els.difficultySeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg");
  if (!btn) return;
  difficulty = btn.dataset.diff;
  els.difficultySeg.querySelectorAll(".seg").forEach((s) => s.classList.toggle("active", s === btn));
  renderPassageOptions();
});

els.btnStart.addEventListener("click", async () => {
  const passage = PASSAGES[parseInt(els.passageSelect.value, 10)];
  if (!passage) return;
  els.btnStart.disabled = true;
  els.note.textContent = "";
  try {
    const res = await chrome.runtime.sendMessage({
      type: "start-test",
      text: passage.text,
      title: passage.title,
      difficulty,
    });
    if (!res || !res.ok) {
      els.note.textContent = (res && res.error) ||
        "Could not start the test on this tab (internal browser pages are off-limits).";
    } else {
      window.close(); // overlay is running on the tab now
    }
  } catch (err) {
    els.note.textContent = "Could not reach the background worker. Try reopening the popup.";
  }
  els.btnStart.disabled = false;
});

els.btnClear.addEventListener("click", async () => {
  await setHistory([]);
  refresh();
});

// Receive a finished result from the overlay
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "test-result") {
    getHistory().then(async (history) => {
      history.unshift({
        wpm: msg.wpm, acc: msg.acc, difficulty: msg.difficulty,
        title: msg.title, at: Date.now(),
      });
      await setHistory(history.slice(0, 50));
      refresh();
    });
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
renderPassageOptions();
refresh();
