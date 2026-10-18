/* MashMoji — popup logic.
 * Pick two emoji (Slot A, Slot B) from a categorized palette, render a composite
 * tile on canvas (side-by-side on a gradient card), copy as PNG via ClipboardItem,
 * download via blob, favorites persisted in chrome.storage.local. Zero network.
 */
"use strict";

/* ---- Categorized palette (emoji -> keywords for search) ---- */
const CATEGORIES = {
  Faces: ["😀","😁","😂","🤣","😊","😍","😎","🤔","😴","🥳","😜","🤯","🥺","😱","🤠","🥸","😇","🤖","👻","💀"],
  Gestures: ["👍","👎","👏","🙏","👌","🤝","👋","✌️","🤟","👊","💪","🖐️","👀","🧠","🫶","🤞","👈","👉","🫡","👋"],
  Animals: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵","🐔","🐧","🦄","🐝","🦋","🐙","🦖"],
  Food: ["🍕","🍔","🍟","🌮","🍩","🍦","🍎","🍉","🍓","🥑","🍿","🥤","☕","🧁","🍰","🍪","🌶️","🧀","🍇","🍯"],
  Travel: ["🚗","✈️","🚀","⛵","🚲","🏝️","🗼","🎡","🚁","🛸","🏔️","🌋","🗽","🚂","🚢","🛰️","🌈","☀️","🌙","⭐"],
  Objects: ["💡","🎁","🎈","🎮","📱","💻","📷","🎧","🔑","🧸","🕹️","📚","✏️","🖥️","🔋","💎","🔮","🧲","🪂","🎲"],
  Nature: ["🌸","🌺","🌻","🍀","🌵","🍄","🌊","🔥","❄️","⚡","🌪️","🌅","🏜️","🌌","💧","🍂","🌾","🪷","🌱","🌷"],
  Symbols: ["❤️","💔","💯","✨","🔥","💥","💫","🎉","🎊","🏆","🥇","❌","✅","⚠️","🚫","💤","💢","🌀","♾️","☮️"]
};

/* ---- State ---- */
const state = { a: null, b: null, target: "a", favorites: [] };

/* ---- DOM refs ---- */
const $ = (id) => document.getElementById(id);
const grid = $("grid"), tabs = $("tabs"), favGrid = $("favGrid"), favPanel = $("favPanel");
const slotA = $("slotA"), slotB = $("slotB");
const canvas = $("mashCanvas");
const ctx = canvas.getContext("2d");
const status = $("status");
const searchInput = $("search");

let activeTab = "All";

/* ---- Rendering ---- */

/** Draw the composite tile: gradient card + emoji A (left) + emoji B (right). */
function drawMash() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#2b2b35");
  grad.addColorStop(1, "#15151b");
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, W, H, 32);
  ctx.fill();

  // Subtle accent ring
  ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
  ctx.lineWidth = 6;
  roundRect(ctx, 8, 8, W - 16, H - 16, 26);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "110px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  ctx.fillText(state.a || "❓", W * 0.31, H * 0.54);
  ctx.fillText(state.b || "❓", W * 0.69, H * 0.54);

  slotA.textContent = state.a || "❓";
  slotB.textContent = state.b || "❓";
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function setStatus(msg, ok) {
  status.textContent = msg;
  status.classList.toggle("ok", !!ok);
}

/* ---- Palette grid ---- */

function allEmoji() {
  const list = [];
  for (const [cat, emojis] of Object.entries(CATEGORIES)) {
    for (const e of emojis) list.push({ emoji: e, cat });
  }
  return list;
}

function renderGrid() {
  const q = searchInput.value.trim().toLowerCase();
  grid.innerHTML = "";
  for (const { emoji, cat } of allEmoji()) {
    if (activeTab !== "All" && cat !== activeTab) continue;
    if (q && !emoji.includes(q) && cat.toLowerCase().indexOf(q) === -1) continue;
    const btn = document.createElement("button");
    btn.className = "emoji";
    btn.textContent = emoji;
    btn.title = `${emoji} (${cat}) — fill slot ${state.target.toUpperCase()}`;
    if (state.a === emoji) btn.classList.add("selected-a");
    if (state.b === emoji) btn.classList.add("selected-b");
    btn.addEventListener("click", () => pickEmoji(emoji));
    grid.appendChild(btn);
  }
  if (!grid.children.length) {
    grid.innerHTML = '<p class="hint" style="grid-column: 1 / -1; text-align:center;">No emoji match.</p>';
  }
}

function renderTabs() {
  tabs.innerHTML = "";
  for (const name of ["All", ...Object.keys(CATEGORIES)]) {
    const t = document.createElement("button");
    t.className = "tab" + (name === activeTab ? " active" : "");
    t.textContent = name;
    t.setAttribute("role", "tab");
    t.addEventListener("click", () => { activeTab = name; renderTabs(); renderGrid(); });
    tabs.appendChild(t);
  }
}

/** Fill slot A first, then slot B; clicking the same emoji twice clears that slot. */
function pickEmoji(emoji) {
  if (state.a === emoji) { state.a = null; state.target = "a"; }
  else if (state.b === emoji) { state.b = null; state.target = "b"; }
  else if (state.target === "a") { state.a = emoji; state.target = "b"; }
  else { state.b = emoji; state.target = "a"; }
  drawMash();
  renderGrid();
  if (state.a && state.b) setStatus("Nice mash! Copy, download, or favorite it.", true);
  else setStatus(`Pick emoji for Slot ${state.target.toUpperCase()}`, false);
}

/* ---- Copy / download / favorites ---- */

function canvasToBlob() {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function copyPNG() {
  if (!state.a || !state.b) { setStatus("Pick two emoji first.", false); return; }
  try {
    const blob = await canvasToBlob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("Copied composite PNG to clipboard.", true);
  } catch (err) {
    setStatus("Copy failed — your browser blocked clipboard access. Try Download.", false);
  }
}

async function downloadPNG() {
  if (!state.a || !state.b) { setStatus("Pick two emoji first.", false); return; }
  const blob = await canvasToBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mashmoji-${Date.now()}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  setStatus("Downloaded composite PNG.", true);
}

async function loadFavorites() {
  try {
    const data = await chrome.storage.local.get({ mashmojiFavorites: [] });
    state.favorites = data.mashmojiFavorites;
  } catch { state.favorites = []; }
  renderFavorites();
}

async function addFavorite() {
  if (!state.a || !state.b) { setStatus("Pick two emoji first.", false); return; }
  const key = state.a + "+" + state.b;
  if (state.favorites.some((f) => f.a + "+" + f.b === key)) {
    setStatus("Already in favorites.", false); return;
  }
  state.favorites.unshift({ a: state.a, b: state.b });
  await chrome.storage.local.set({ mashmojiFavorites: state.favorites });
  renderFavorites();
  setStatus("Saved to favorites.", true);
}

function renderFavorites() {
  favGrid.innerHTML = "";
  favPanel.style.display = state.favorites.length ? "" : "none";
  $("favEmpty").style.display = state.favorites.length ? "none" : "";
  for (const f of state.favorites) {
    const wrap = document.createElement("div");
    wrap.className = "fav-item";
    const btn = document.createElement("button");
    btn.textContent = f.a + f.b;
    btn.title = `Load ${f.a} + ${f.b}`;
    btn.addEventListener("click", () => {
      state.a = f.a; state.b = f.b; state.target = "a";
      drawMash(); renderGrid();
      setStatus("Loaded from favorites.", true);
    });
    const label = document.createElement("span");
    label.textContent = f.a + " + " + f.b;
    wrap.appendChild(btn);
    wrap.appendChild(label);
    favGrid.appendChild(wrap);
  }
}

/* ---- Events ---- */

$("copyBtn").addEventListener("click", copyPNG);
$("downloadBtn").addEventListener("click", downloadPNG);
$("favBtn").addEventListener("click", addFavorite);
searchInput.addEventListener("input", renderGrid);
slotA.parentElement.addEventListener("click", () => { if (state.a) { state.a = null; state.target = "a"; drawMash(); renderGrid(); } });
slotB.parentElement.addEventListener("click", () => { if (state.b) { state.b = null; state.target = "b"; drawMash(); renderGrid(); } });

/* ---- Init ---- */
renderTabs();
renderGrid();
drawMash();
loadFavorites();
