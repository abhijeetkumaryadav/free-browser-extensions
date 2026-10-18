// PixelRun popup — level select + best times.
const LEVEL_NAMES = [
  "First Steps", "Coin Row", "Spike Alley",
  "Gap Jumps", "High Road", "Final Gauntlet"
];
const STORE_KEY = "pixelrun_best";

/** @returns {Promise<Object>} map of levelIndex -> best seconds */
async function getBest() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return data[STORE_KEY] || {};
}

function fmt(sec) {
  return sec.toFixed(1) + "s";
}

function openGame(level) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`game.html?level=${level}`) });
}

async function render() {
  const best = await getBest();
  const wrap = document.getElementById("levels");
  wrap.innerHTML = "";
  LEVEL_NAMES.forEach((name, i) => {
    const el = document.createElement("div");
    el.className = "level";
    el.innerHTML =
      `<div class="num">${i + 1}</div>` +
      `<div class="name">${name}</div>` +
      `<div class="best">${best[i] !== undefined ? "★ " + fmt(best[i]) : "—"}</div>`;
    el.addEventListener("click", () => openGame(i));
    wrap.appendChild(el);
  });
  document.getElementById("playBtn").addEventListener("click", () => openGame(0));
}

render();
