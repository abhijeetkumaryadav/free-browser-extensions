/* ColonPick — :shortcode: emoji picker.
 * Popup-only picker: search a curated offline dictionary, click to copy the
 * emoji (or the :shortcode:). It does NOT inject autocomplete into web pages.
 * Zero network; recent picks stored locally. */
"use strict";

/* Curated dictionary: [emoji, shortcode, keyword string] */
const EMOJI = [
  // Smileys
  ["😀","grinning","smile happy"], ["😁","grin","smile happy teeth"], ["😂","joy","laugh tears funny"],
  ["🤣","rofl","laugh rolling funny"], ["😊","blush","smile shy happy"], ["😍","heart_eyes","love crush"],
  ["😎","sunglasses","cool"], ["🤔","thinking","hmm"], ["😐","neutral_face","meh"],
  ["🙄","roll_eyes","whatever"], ["😴","sleeping","tired zzz"], ["🤯","exploding_head","mind blown"],
  ["🥳","partying_face","celebrate birthday"], ["😭","sob","cry tears"], ["😤","triumph","angry huff"],
  ["🤗","hugging_face","hug"], ["🤫","shushing_face","quiet secret"], ["🤐","zipper_mouth_face","silent"],
  ["😇","innocent","angel halo"], ["🤠","cowboy","yeehaw"], ["🥺","pleading_face","puppy eyes please"],
  // Gestures & people
  ["👍","thumbsup","+1 approve yes"], ["👎","thumbsdown","-1 no"], ["👏","clap","applause bravo"],
  ["🙏","pray","thanks please"], ["💪","muscle","strong flex"], ["👋","wave","hello hi bye"],
  ["✌️","v","peace victory"], ["🤝","handshake","deal agree"], ["👀","eyes","look watch"],
  ["🙌","raised_hands","hooray praise"], ["🤞","crossed_fingers","luck hope"], ["👌","ok_hand","perfect"],
  // Hearts & symbols
  ["❤️","heart","love red"], ["💔","broken_heart","heartbreak"], ["💯","100","perfect score"],
  ["🔥","fire","lit hot trending"], ["⭐","star","favorite"], ["✨","sparkles","shine new"],
  ["💡","bulb","idea"], ["⚡","zap","fast energy"], ["🎉","tada","party celebrate"],
  ["🎊","confetti_ball","party"], ["🏆","trophy","winner champion"], ["🥇","1st_place_medal","gold winner"],
  ["✅","white_check_mark","done yes"], ["❌","x","no wrong"], ["⚠️","warning","caution alert"],
  ["❓","question","help"], ["❗","exclamation","important"], ["💤","zzz","sleep"],
  // Objects & tools
  ["📎","paperclip","attach"], ["📌","pushpin","pin"], ["📝","memo","note write"],
  ["📅","calendar","date schedule"], ["⏰","alarm_clock","time reminder"], ["🔍","mag","search find"],
  ["🔒","lock","secure private"], ["🔑","key","password"], ["💻","computer","laptop work"],
  ["📱","iphone","phone mobile"], ["📧","email","mail"], ["📦","package","box delivery"],
  ["🛒","shopping_cart","buy shop"], ["💰","moneybag","cash rich"], ["💳","credit_card","pay"],
  ["🎧","headphones","music listen"], ["📸","camera","photo"], ["🎬","clapper","movie film"],
  ["🚀","rocket","launch ship fast"], ["🛰️","satellite","space"], ["🔧","wrench","fix tool"],
  ["⚙️","gear","settings"], ["🧲","magnet","attract"], ["💣","bomb","explode"],
  // Nature & animals
  ["🌞","sun_with_face","sunny weather"], ["🌙","crescent_moon","night"], ["☁️","cloud","weather"],
  ["🌧️","cloud_with_rain","rain"], ["❄️","snowflake","snow winter"], ["🌈","rainbow","pride"],
  ["🌸","cherry_blossom","flower spring"], ["🌵","cactus","desert"], ["🐶","dog","puppy pet"],
  ["🐱","cat","kitten pet"], ["🦊","fox","clever"], ["🐼","panda","cute"], ["🦄","unicorn","magic"],
  ["🐝","bee","buzz honey"], ["🦋","butterfly","pretty"], ["🐢","turtle","slow"],
  // Food & drink
  ["🍕","pizza","food"], ["🍔","hamburger","burger food"], ["🍩","doughnut","donut sweet"],
  ["☕","coffee","morning drink"], ["🍺","beer","drink cheers"], ["🍷","wine","drink"],
  ["🥑","avocado","healthy"], ["🍓","strawberry","fruit berry"], ["🎂","birthday","cake celebrate"],
  ["🍿","popcorn","movie snack"],
  // Activity & travel
  ["⚽","soccer","football sport"], ["🏀","basketball","sport"], ["🎮","video_game","gaming"],
  ["🎲","game_die","random dice"], ["✈️","airplane","travel flight"], ["🚗","car","drive"],
  ["🏖️","beach","vacation summer"], ["⛰️","mountain","hike"],
];

let copyShortcode = false;   // false = copy emoji, true = copy :shortcode:
let recents = [];            // array of shortcodes, most recent first

const $ = (id) => document.getElementById(id);
const searchInput = $("search"), grid = $("emojiGrid"), recentGrid = $("recentGrid");

/* ---------- Search ---------- */
function normalize(q) { return q.trim().toLowerCase().replace(/^:+|:+$/g, ""); }

function matches(entry, q) {
  if (!q) return true;
  const [, code, keys] = entry;
  return code.includes(q) || keys.split(" ").some((k) => k.startsWith(q)) || keys.includes(q);
}

function renderResults() {
  const q = normalize(searchInput.value);
  const hits = EMOJI.filter((e) => matches(e, q));
  $("clearSearch").classList.toggle("hidden", !searchInput.value);
  $("resultsTitle").textContent = q ? `Results for “:${q}”` : "All emoji";
  $("resultCount").textContent = hits.length;
  $("emptyState").classList.toggle("hidden", hits.length > 0);
  grid.innerHTML = "";
  hits.slice(0, 400).forEach((e) => grid.appendChild(makeButton(e)));
}

function makeButton([char, code]) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "emoji-btn"; b.textContent = char;
  b.setAttribute("aria-label", `Copy :${code}:`);
  const tip = document.createElement("span");
  tip.className = "tip"; tip.textContent = `:${code}:`;
  b.appendChild(tip);
  b.addEventListener("click", () => pick(char, code));
  return b;
}

/* ---------- Copy ---------- */
async function pick(char, code) {
  const text = copyShortcode ? `:${code}:` : char;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback for clipboard denial: temp textarea
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  toast(copyShortcode ? `Copied :${code}:` : `Copied ${char}`);
  pushRecent(code);
}

function pushRecent(code) {
  recents = [code, ...recents.filter((c) => c !== code)].slice(0, 16);
  chrome.storage.local.set({ colonpick_recents: recents }).catch(() => {});
  renderRecents();
}

function renderRecents() {
  const has = recents.length > 0;
  $("recentPanel").classList.toggle("hidden", !has);
  if (!has) return;
  recentGrid.innerHTML = "";
  const byCode = new Map(EMOJI.map((e) => [e[1], e]));
  recents.forEach((code) => {
    const e = byCode.get(code);
    if (e) recentGrid.appendChild(makeButton(e));
  });
}

/* ---------- Mode toggle ---------- */
$("modeToggle").addEventListener("click", () => {
  copyShortcode = !copyShortcode;
  $("modeValue").textContent = copyShortcode ? ":code:" : "😀 emoji";
  chrome.storage.local.set({ colonpick_mode: copyShortcode }).catch(() => {});
  toast(copyShortcode ? "Clicks now copy :shortcode:" : "Clicks now copy the emoji");
});

/* ---------- Search events ---------- */
searchInput.addEventListener("input", renderResults);
$("clearSearch").addEventListener("click", () => {
  searchInput.value = ""; renderResults(); searchInput.focus();
});

/* ---------- Init ---------- */
chrome.storage.local.get({ colonpick_recents: [], colonpick_mode: false }).then((r) => {
  recents = Array.isArray(r.colonpick_recents) ? r.colonpick_recents : [];
  copyShortcode = !!r.colonpick_mode;
  $("modeValue").textContent = copyShortcode ? ":code:" : "😀 emoji";
  renderRecents();
  renderResults();
  searchInput.focus();
});

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 1800);
}
