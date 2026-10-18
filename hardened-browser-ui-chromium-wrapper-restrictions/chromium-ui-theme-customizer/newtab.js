/* TabForge new-tab page behavior: clock, search, quick-link tiles. */
"use strict";

const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("date");
const greetingEl = document.getElementById("greeting");
const tilesEl = document.getElementById("tiles");
const themeNameEl = document.getElementById("themeName");

/** Start the live clock with greeting. */
function startClock() {
  const tick = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    dateEl.textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    const h = now.getHours();
    greetingEl.textContent = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  };
  tick();
  setInterval(tick, 1000);
}

/** Escape helper for injecting user strings into HTML. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Render quick-link tiles from storage. */
async function renderTiles() {
  const { tiles = [] } = await chrome.storage.local.get("tiles");
  tilesEl.innerHTML = "";
  for (const [i, t] of tiles.entries()) {
    const a = document.createElement("a");
    a.className = "tile";
    a.href = t.url;
    a.title = t.url;
    a.innerHTML = `<span class="glyph">${esc((t.title || "?")[0].toUpperCase())}</span>
                   <span class="label">${esc(t.title)}</span>`;
    const del = document.createElement("button");
    del.className = "del";
    del.type = "button";
    del.textContent = "×";
    del.setAttribute("aria-label", `Remove ${t.title}`);
    del.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = (await chrome.storage.local.get("tiles")).tiles || [];
      cur.splice(i, 1);
      await chrome.storage.local.set({ tiles: cur });
      renderTiles();
    });
    a.appendChild(del);
    tilesEl.appendChild(a);
  }
}

// --- Search: user-initiated navigation to their engine of choice (Google). ---
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if (q) window.location.href = "https://www.google.com/search?q=" + encodeURIComponent(q);
});

// --- Add-tile dialog ---
const dialog = document.getElementById("tileDialog");
document.getElementById("addTileBtn").addEventListener("click", () => { dialog.hidden = false; });
document.getElementById("tileCancel").addEventListener("click", () => { dialog.hidden = true; });
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.hidden = true; });
document.getElementById("tileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("tileTitle").value.trim();
  let url = document.getElementById("tileUrl").value.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const { tiles = [] } = await chrome.storage.local.get("tiles");
  tiles.push({ title, url });
  await chrome.storage.local.set({ tiles });
  dialog.hidden = true;
  e.target.reset();
  renderTiles();
});

// --- Init: apply theme, name, visibility toggles, then start. ---
(async function init() {
  const theme = await loadTheme();
  applyThemeToRoot(theme);
  const { themeName } = await chrome.storage.local.get("themeName");
  themeNameEl.textContent = themeName || "Default";
  if (!theme.showClock) document.getElementById("clockWrap").style.display = "none";
  if (!theme.showSearch) document.getElementById("searchForm").style.display = "none";
  startClock();
  renderTiles();
})();
