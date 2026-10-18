/* HTML Tag Memory Match — game logic.
 * Match each <tag> card with its description card. Timer, move counter,
 * best scores per grid size persisted in chrome.storage.local. 100% local. */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const timeEl = document.getElementById("time");
  const matchedEl = document.getElementById("matched");
  const gridSelect = document.getElementById("gridSelect");
  const newGameBtn = document.getElementById("newGameBtn");
  const winBanner = document.getElementById("winBanner");
  const winSub = document.getElementById("winSub");
  const winBest = document.getElementById("winBest");
  const bestLine = document.getElementById("bestLine");

  const GRIDS = { "4x3": { cols: 4, rows: 3, pairs: 6 }, "4x4": { cols: 4, rows: 4, pairs: 8 }, "6x4": { cols: 6, rows: 4, pairs: 12 } };

  let cards = [];        // {id, kind: 'tag'|'desc', text, pairId, matched}
  let openCards = [];    // currently flipped card elements
  let lock = false;
  let moves = 0;
  let matchedPairs = 0;
  let totalPairs = 8;
  let seconds = 0;
  let timerId = null;
  let best = {};

  /** Fisher-Yates shuffle. */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return m + ":" + String(sec).padStart(2, "0");
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => { seconds++; timeEl.textContent = fmtTime(seconds); }, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function gridKey() { return gridSelect.value; }

  function loadBest(cb) {
    chrome.storage.local.get(["mm_best"], (res) => {
      best = res.mm_best || {};
      cb();
    });
  }

  function saveBest() {
    const key = gridKey();
    const cur = best[key];
    const improved = !cur || moves < cur.moves || (moves === cur.moves && seconds < cur.time);
    if (improved) {
      best[key] = { moves, time: seconds };
      chrome.storage.local.set({ mm_best: best });
    }
    return improved;
  }

  function renderBest() {
    const b = best[gridKey()];
    bestLine.textContent = b ? `${b.moves} moves · ${fmtTime(b.time)}` : "—";
  }

  function newGame() {
    const g = GRIDS[gridKey()];
    totalPairs = g.pairs;
    const pairs = shuffle(TAG_PAIRS.slice()).slice(0, g.pairs);

    cards = [];
    pairs.forEach((p, i) => {
      cards.push({ kind: "tag", text: p.tag, pairId: i, matched: false });
      cards.push({ kind: "desc", text: p.desc, pairId: i, matched: false });
    });
    shuffle(cards);

    moves = 0; matchedPairs = 0; seconds = 0;
    openCards = []; lock = false;
    movesEl.textContent = "0";
    timeEl.textContent = "0:00";
    matchedEl.textContent = `0/${totalPairs}`;
    winBanner.classList.add("hidden");

    boardEl.style.gridTemplateColumns = `repeat(${g.cols}, 1fr)`;
    boardEl.innerHTML = "";
    cards.forEach((c, idx) => boardEl.appendChild(makeCard(c, idx)));

    startTimer();
    renderBest();
  }

  function makeCard(c, idx) {
    const el = document.createElement("div");
    el.className = "card";
    el.setAttribute("role", "gridcell");
    el.dataset.idx = idx;
    const front = c.kind === "tag" ? `<code>&lt;${c.text}&gt;</code>` : escapeHtml(c.text);
    el.innerHTML = `<div class="card-inner">
      <div class="card-face card-back">?</div>
      <div class="card-face card-front">${front}</div>
    </div>`;
    el.addEventListener("click", () => flip(el));
    return el;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function flip(el) {
    if (lock) return;
    const c = cards[+el.dataset.idx];
    if (c.matched || el.classList.contains("flipped")) return;
    el.classList.add("flipped");
    openCards.push(el);
    if (openCards.length === 2) {
      moves++;
      movesEl.textContent = String(moves);
      const [a, b] = openCards.map((e) => cards[+e.dataset.idx]);
      if (a.pairId === b.pairId) {
        a.matched = b.matched = true;
        openCards.forEach((e) => e.classList.add("matched"));
        openCards = [];
        matchedPairs++;
        matchedEl.textContent = `${matchedPairs}/${totalPairs}`;
        if (matchedPairs === totalPairs) onWin();
      } else {
        lock = true;
        setTimeout(() => {
          openCards.forEach((e) => e.classList.remove("flipped"));
          openCards = [];
          lock = false;
        }, 700);
      }
    }
  }

  function onWin() {
    stopTimer();
    const isBest = saveBest();
    winSub.textContent = `Solved in ${moves} moves · ${fmtTime(seconds)}`;
    winBest.textContent = isBest ? "New best score!" : "";
    winBanner.classList.remove("hidden");
    renderBest();
  }

  newGameBtn.addEventListener("click", newGame);
  gridSelect.addEventListener("change", newGame);

  loadBest(() => { renderBest(); newGame(); });
})();
