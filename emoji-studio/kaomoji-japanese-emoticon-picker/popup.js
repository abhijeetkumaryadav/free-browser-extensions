/* Kaomoji Picker — popup logic.
 * Searchable, categorized kaomoji collection. Click any kaomoji to copy it to
 * the clipboard; copied items land in a "Recently used" tray persisted in
 * chrome.storage.local. All local, zero network.
 */
"use strict";

/* ---- Kaomoji data: category -> [kaomoji, ...] ---- */
const CATEGORIES = {
  Happy: ["(＾▽＾)", "＼(^o^)／", "(≧◡≦)", "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "(⌒▽⌒)☆", "(*^▽^*)", "(✿◠‿◠)", "o(≧▽≦)o", "(o^▽^o)", "٩(◕‿◕)۶", "ヽ(・∀・)ﾉ", "(☆▽☆)", "(´∀｀)♡", "(◕‿◕✿)", "＼(＾▽＾)／", "(˘▽˘)"],
  Sad: ["(T_T)", "(;_;)", "(ಥ﹏ಥ)", "(｡•́︿•̀｡)", "(╥﹏╥)", "(つ﹏<。)", "(´-ω-`)", "(._.`)","(っ- ‸ - ς)", "(ﾉД`)", "(￣□￣」)", "(´°̥̥̥̥̥̥̥̥ω°̥̥̥̥̥̥̥̥｀)", "( ´•̥̥̥ω•̥̥̥`)", "(；ω；)"],
  Love: ["(❤ω❤)", "(˘⌣˘)♡(˘⌣˘)", "(♥_♥)", "(๑>ᴗ<๑)", "♡(˃͈ દ ˂͈ ༶ )", "(♡‿♡)", "(ෆ˘ ‿ ˘ෆ)", "(💘‿💘)", "(ꈍᴗꈍ)♡", "(´ε｀ )♡", "(◦˘ З(◦’ںˉ◦)♡", "(♥ω♥*)", "💕(๑•́ ₃ •̀๑)💕", "(˶ᵔᵕᵔ˶)"],
  Angry: ["(╬ಠ益ಠ)", "ヽ(｀⌒´)ノ", "(¬_¬)", "(¬‿¬)", "(・`ω´・)", "凸(｀0´)凸", "(# ﾟДﾟ)", "(¬､¬)", "(╯°□°)╯︵ ┻━┻", "(ಠ_ಠ)", "(-_-)", "(；一_一)", "(→_→)", "(￣ヘ￣)"],
  Surprised: ["(⊙_⊙)", "(ﾟДﾟ)", "(°o°)", "Σ(ﾟДﾟ)", "Σ(°ロ°)", "( ﾟoﾟ)", "(°◇°)", "(´⊙ω⊙`)", "(⊙.⊙)", "(◐‿◑)", "（・□・；）", "(⁰_⁰)", "(●__●)", "w(ﾟДﾟ)w"],
  Sleepy: ["(－‿◦)", "(。-ω-)zzz", "(￣o￣) zzZZzzZZ", "(ᴗ˳ᴗ)", "(－_－) zzZ", "(´-ω-`)", "(¦3[▓▓]", "(ㅅ˘︶˘)", "(つ-`ω´-)", "(o-_-o)", "(_ _).｡o○", "(・_・)"],
  Animals: ["(=^･ω･^=)", "(=^･ｪ･^=)", "(ʘᴥʘ)", "(◕ᴥ◕)", "(ᵔᴥᵔ)", "ʕ•ᴥ•ʔ", "ʕ·ᴥ·ʔ", "(=；ｪ；=)", "ฅʕ•̫͡•ʔฅ", "(=ﾟωﾟ)=", "(^._.^)ﾉ", "(ΦωΦ)", "(ↀДↀ)", "（＝・ω・＝）"],
  Special: ["(☞ﾟヮﾟ)☞", "☜(ﾟヮﾟ☜)", "(ﾉ´ヮ`)ﾉ*: ･ﾟ", "✧･ﾟ: *✧･ﾟ:*", "(〃ω〃)", "(・∀・)", "(´･ω･`)", "(｡･ω･｡)", "(^ω^)", "(>ω^)", "(⌒ω⌒)", "(=￣ω￣=)", "(/ω＼)", "(〃￣ω￣〃ゞ)"]
};

/* ---- State ---- */
let activeTab = "All";
let recent = [];

/* ---- DOM refs ---- */
const $ = (id) => document.getElementById(id);
const grid = $("grid"), tabs = $("tabs"), recentGrid = $("recentGrid");
const recentPanel = $("recentPanel"), recentEmpty = $("recentEmpty");
const status = $("status"), searchInput = $("search");

/* ---- Rendering ---- */

function allItems() {
  const items = [];
  for (const [cat, list] of Object.entries(CATEGORIES)) {
    for (const k of list) items.push({ kaomoji: k, cat });
  }
  return items;
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

function renderGrid() {
  const q = searchInput.value.trim();
  grid.innerHTML = "";
  let count = 0;
  for (const { kaomoji, cat } of allItems()) {
    if (activeTab !== "All" && cat !== activeTab) continue;
    if (q && !kaomoji.includes(q)) continue;
    grid.appendChild(makeChip(kaomoji, cat));
    count++;
  }
  if (!count) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No kaomoji match.";
    grid.appendChild(p);
  }
}

function makeChip(kaomoji, cat) {
  const b = document.createElement("button");
  b.className = "chip";
  b.textContent = kaomoji;
  b.title = `Copy ${kaomoji}${cat ? " (" + cat + ")" : ""}`;
  b.addEventListener("click", () => copyKaomoji(kaomoji, b));
  return b;
}

function renderRecent() {
  recentGrid.innerHTML = "";
  recentPanel.style.display = recent.length ? "" : "none";
  recentEmpty.style.display = recent.length ? "none" : "";
  for (const k of recent) recentGrid.appendChild(makeChip(k, ""));
}

/* ---- Copy ---- */

async function copyKaomoji(kaomoji, el) {
  try {
    await navigator.clipboard.writeText(kaomoji);
  } catch (err) {
    // Fallback for environments without async clipboard
    const ta = document.createElement("textarea");
    ta.value = kaomoji;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  }
  el.classList.add("copied");
  setTimeout(() => el.classList.remove("copied"), 500);
  status.textContent = `Copied ${kaomoji}`;
  // Move to front of recent list
  recent = [kaomoji, ...recent.filter((k) => k !== kaomoji)].slice(0, 16);
  try { await chrome.storage.local.set({ kaomojiRecent: recent }); } catch { /* ignore */ }
  renderRecent();
}

/* ---- Storage ---- */

async function loadRecent() {
  try {
    const data = await chrome.storage.local.get({ kaomojiRecent: [] });
    recent = data.kaomojiRecent;
  } catch { recent = []; }
  renderRecent();
}

/* ---- Events ---- */
searchInput.addEventListener("input", renderGrid);

/* ---- Init ---- */
renderTabs();
renderGrid();
loadRecent();
