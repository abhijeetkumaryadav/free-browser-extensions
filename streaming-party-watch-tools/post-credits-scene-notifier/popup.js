// ─────────────────────────────────────────────────────────────
// CreditCheck popup logic
// Built-in static dataset (data.js) + user-added titles in storage.
// 100% offline — nothing leaves the device.
// ─────────────────────────────────────────────────────────────
"use strict";

const $ = (id) => document.getElementById(id);
const searchEl = $("search"), verdictEl = $("verdict"), resultsEl = $("results");

let customTitles = [];

/** Load user-added titles from storage. */
async function loadCustom() {
  const { customTitles: stored = [] } = await chrome.storage.local.get("customTitles");
  customTitles = stored;
  renderCustomList();
}

/** All titles: built-in first, then user additions. */
function allTitles() {
  return [
    ...CREDITS_DATA.map((d) => ({ ...d, custom: false })),
    ...customTitles.map((d) => ({ ...d, custom: true })),
  ];
}

/** Render verdict card for one movie. */
function showVerdict(movie) {
  const hasAny = movie.mid || movie.post;
  verdictEl.classList.remove("hidden");
  verdictEl.innerHTML = `
    <h2>${escapeHtml(movie.title)} <span class="year">(${movie.year || "—"})</span></h2>
    <div class="flags">
      <span class="flag ${movie.mid ? "yes" : "no"}">Mid-credits: ${movie.mid ? "YES" : "no"}</span>
      <span class="flag ${movie.post ? "yes" : "no"}">Post-credits: ${movie.post ? "YES" : "no"}</span>
    </div>
    <p class="note">${movie.custom ? "Your saved title. " : ""}${escapeHtml(movie.note || "")}</p>
    <p class="note" style="margin-top:4px;opacity:.75">
      ${hasAny ? "🎬 Stay in your seat — something's coming." : "🍿 Safe to leave when the credits roll."}
    </p>`;
}

/** Render search results list. */
function renderResults(query) {
  const q = query.trim().toLowerCase();
  const all = allTitles();
  const matches = all.filter((m) => !q || m.title.toLowerCase().includes(q));
  if (!matches.length) {
    resultsEl.innerHTML = `<p class="empty">No match. Add it below after you check — your note helps next time.</p>`;
    return;
  }
  resultsEl.innerHTML = matches.map((m) => {
    const cls = m.mid && m.post ? "yes" : m.mid || m.post ? "some" : "no";
    return `<div class="result" data-i="${all.indexOf(m)}" role="button" tabindex="0">
      <span class="t">${escapeHtml(m.title)}${m.custom ? " ✎" : ""}</span>
      <span class="y">${m.year || ""}</span>
      <span class="dot ${cls}" title="${m.mid || m.post ? "Has scenes" : "No scenes"}"></span>
    </div>`;
  }).join("");
  resultsEl.querySelectorAll(".result").forEach((el) => {
    const movie = all[+el.dataset.i];
    el.addEventListener("click", () => showVerdict(movie));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showVerdict(movie); }
    });
  });
}

/** Render the user-added list in the add form. */
function renderCustomList() {
  const list = $("custom-list");
  list.innerHTML = customTitles.map((m, i) => `
    <li><span>${escapeHtml(m.title)}${m.year ? ` (${m.year})` : ""}</span>
    <button class="del" data-i="${i}" aria-label="Delete">✕</button></li>`).join("");
  list.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", async () => {
      customTitles.splice(+b.dataset.i, 1);
      await chrome.storage.local.set({ customTitles });
      renderCustomList(); renderResults(searchEl.value);
    }));
}

/** HTML-escape user-controlled strings. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

searchEl.addEventListener("input", () => { verdictEl.classList.add("hidden"); renderResults(searchEl.value); });

$("add-btn").addEventListener("click", async () => {
  const title = $("new-title").value.trim();
  if (!title) return;
  customTitles.push({
    title,
    year: parseInt($("new-year").value, 10) || null,
    mid: $("new-mid").checked,
    post: $("new-post").checked,
    note: "Added by you.",
    custom: true,
  });
  await chrome.storage.local.set({ customTitles });
  $("new-title").value = ""; $("new-year").value = "";
  $("new-mid").checked = $("new-post").checked = false;
  renderCustomList(); renderResults(searchEl.value);
});

loadCustom().then(() => renderResults(""));
