/* Bortle Scale Rater — popup logic. Fully local, chrome.storage.local only. */
"use strict";

// ENGINE-START — pure, headless-testable rating engine
/** Bortle scale reference: 1 = darkest … 9 = inner-city. */
const BORTLE = [
  { n: 1, title: "Excellent dark site", desc: "The zodiacal light, gegenschein and Milky Way cast shadows. M33 is an obvious naked-eye object." },
  { n: 2, title: "Typical true dark site", desc: "The summer Milky Way is highly structured. M33 is fairly easy with averted vision." },
  { n: 3, title: "Rural sky", desc: "Some light pollution on the horizon. The Milky Way still shows complex structure." },
  { n: 4, title: "Rural/suburban transition", desc: "Light-pollution domes rise in several directions. The Milky Way is impressive but washed out overhead." },
  { n: 5, title: "Suburban sky", desc: "The Milky Way is faint near the horizon and looks washed out overhead. Sky glow visible in all directions." },
  { n: 6, title: "Bright suburban sky", desc: "The Milky Way is visible only near the zenith. The sky glows grayish-white up to 35°." },
  { n: 7, title: "Suburban/urban transition", desc: "The entire sky has a grayish-white hue. The Milky Way is invisible or nearly so." },
  { n: 8, title: "City sky", desc: "The sky glows orange; you can read headlines at night. M31 and M44 may be glimpsed with effort." },
  { n: 9, title: "Inner-city sky", desc: "The entire sky is brightly lit. Only the Moon, planets and bright clusters punch through." }
];

/** Look up a Bortle class entry (1–9). Returns null for anything else. */
function bortleInfo(n) {
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1 || k > 9) return null;
  return BORTLE[k - 1];
}

/** Badge color: deep indigo (1) → bright orange (9). */
function ratingColor(n) {
  const clamped = Math.min(9, Math.max(1, Math.round(Number(n) || 5)));
  // interpolate: 1 => #3b82f6-ish dark blue … 9 => #fb923c orange
  const t = (clamped - 1) / 8;
  const r = Math.round(59 + (251 - 59) * t);
  const g = Math.round(130 + (146 - 130) * t);
  const b = Math.round(246 + (60 - 246) * t);
  return "rgb(" + r + "," + g + "," + b + ")";
}

/** Build a rating entry. Returns null when invalid. */
function makeRating(name, bortle, notes, whenMs) {
  const nm = (name || "").trim();
  if (!nm) return null;
  if (!bortleInfo(bortle)) return null;
  const t = whenMs == null ? Date.now() : Number(whenMs);
  if (Number.isNaN(t)) return null;
  return {
    id: "r" + t + "-" + Math.floor(Math.random() * 1e6),
    name: nm,
    bortle: Number(bortle),
    notes: (notes || "").trim(),
    when: t
  };
}

/** Newest-first sort; returns a new array. */
function sortRatings(list) {
  return (list || []).slice().sort((a, b) => b.when - a.when);
}

/** Mean Bortle of the list, rounded to 1 decimal; null when empty. */
function avgRating(list) {
  if (!list || !list.length) return null;
  const sum = list.reduce((s, r) => s + r.bortle, 0);
  return Math.round((sum / list.length) * 10) / 10;
}

/** The darkest (lowest Bortle) entry; ties broken by newest. Null when empty. */
function darkestSpot(list) {
  if (!list || !list.length) return null;
  return list.slice().sort((a, b) => a.bortle - b.bortle || b.when - a.when)[0];
}

/** Friendly date for a stored timestamp. */
function fmtDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  });
}
// ENGINE-END

/* ---------------- UI ---------------- */
const $ = (id) => document.getElementById(id);
const STORE_KEY = "bortleRatings";
let selectedBortle = 5;

async function loadRatings() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : [];
}
async function saveRatings(list) {
  await chrome.storage.local.set({ [STORE_KEY]: list });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const trashSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

function buildPicker() {
  const picker = $("bortlePicker");
  picker.innerHTML = "";
  for (let n = 1; n <= 9; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bortle-btn" + (n === selectedBortle ? " sel" : "");
    b.textContent = String(n);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", n === selectedBortle ? "true" : "false");
    b.title = bortleInfo(n).title;
    b.addEventListener("click", () => {
      selectedBortle = n;
      picker.querySelectorAll(".bortle-btn").forEach((x, i) => {
        const on = i + 1 === n;
        x.classList.toggle("sel", on);
        x.setAttribute("aria-checked", on ? "true" : "false");
      });
    });
    picker.appendChild(b);
  }
}

function buildGuide() {
  const box = $("guideList");
  box.innerHTML = "";
  for (const entry of BORTLE) {
    const div = document.createElement("div");
    div.className = "item guide-item";
    div.innerHTML =
      '<div class="badge" style="background:' + ratingColor(entry.n) + '">' + entry.n + "</div>" +
      '<div class="grow">' +
        "<div class='nm'>Class " + entry.n + " — " + esc(entry.title) + "</div>" +
        '<div class="nt">' + esc(entry.desc) + "</div>" +
      "</div>";
    box.appendChild(div);
  }
}

async function render() {
  const list = sortRatings(await loadRatings());

  // Stats
  $("statCount").textContent = String(list.length);
  const avg = avgRating(list);
  $("statAvg").textContent = avg === null ? "—" : avg.toFixed(1);
  const dark = darkestSpot(list);
  $("statBest").textContent = dark ? "B" + dark.bortle : "—";
  $("statBest").title = dark ? dark.name : "";

  // Journal list
  const box = $("list");
  box.innerHTML = "";
  $("emptyMsg").style.display = list.length ? "none" : "block";
  for (const r of list) {
    const info = bortleInfo(r.bortle);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML =
      '<div class="badge" style="background:' + ratingColor(r.bortle) + '">' + r.bortle + "</div>" +
      '<div class="grow">' +
        '<div class="nm">' + esc(r.name) + "</div>" +
        '<div class="dt">' + esc(fmtDate(r.when)) + " · " + esc(info.title) + "</div>" +
        (r.notes ? '<div class="nt">' + esc(r.notes) + "</div>" : "") +
      "</div>" +
      '<button class="del" title="Delete" aria-label="Delete rating">' + trashSvg + "</button>";
    div.querySelector(".del").addEventListener("click", async () => {
      const cur = await loadRatings();
      await saveRatings(cur.filter((x) => x.id !== r.id));
      render();
    });
    box.appendChild(div);
  }
}

function wireTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
      t.classList.add("active");
      t.setAttribute("aria-selected", "true");
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.remove("active"));
      $("tab-" + t.dataset.tab).classList.add("active");
    });
  });
}

function wireForm() {
  $("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = makeRating($("inName").value, selectedBortle, $("inNotes").value);
    if (!entry) return;
    const list = await loadRatings();
    list.push(entry);
    await saveRatings(list);
    $("inName").value = "";
    $("inNotes").value = "";
    render();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  buildPicker();
  buildGuide();
  wireTabs();
  wireForm();
  render();
});
