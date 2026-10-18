// TetraFall popup — open the full game board, render top high scores.
const playBtn = document.getElementById("playBtn");
const scoresEl = document.getElementById("scores");

playBtn.addEventListener("click", () => {
  // chrome.tabs.create needs no "tabs" permission; opens the game board page.
  chrome.tabs.create({ url: chrome.runtime.getURL("game.html") });
  window.close();
});

async function loadScores() {
  const { highScores = [] } = await chrome.storage.local.get("highScores");
  scoresEl.innerHTML = "";
  if (!highScores.length) {
    scoresEl.innerHTML = '<li class="empty">No games yet — play one!</li>';
    return;
  }
  highScores.slice(0, 5).forEach((s, i) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.innerHTML = `<span class="rank">${i + 1}</span><span class="pts">${s.score.toLocaleString()}</span>`;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `Lvl ${s.level} · ${s.lines} lines`;
    li.append(left, meta);
    scoresEl.appendChild(li);
  });
}

loadScores();
