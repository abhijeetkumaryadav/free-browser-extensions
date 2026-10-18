/* Image Check Journal — Reverse Search Launcher
 * Your journal: log images, launch reverse searches, record your verdict.
 * Launches searches in new tabs; analyzes nothing. Pure engine between markers. */

// ENGINE-START
// Reverse-search providers. `byUrl` templates need a direct image URL;
// `home` opens the provider's own search page for manual upload/paste.
const PROVIDERS = [
  { id: "google-lens", name: "Google Lens",
    byUrl: (u) => "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(u),
    home: "https://lens.google.com/" },
  { id: "tineye", name: "TinEye",
    byUrl: (u) => "https://tineye.com/search?url=" + encodeURIComponent(u),
    home: "https://tineye.com/" },
  { id: "bing", name: "Bing Visual",
    byUrl: (u) => "https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIRP&sbisrc=UrlPaste&q=imgurl:" + encodeURIComponent(u),
    home: "https://www.bing.com/visualsearch" },
];

const VERDICTS = ["Undecided", "Looks real", "Edited / manipulated", "Misattributed", "AI-generated"];

// Build the search URL for a provider, given an optional image URL.
function searchUrl(providerId, imageUrl) {
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (!p) return null;
  const u = (imageUrl || "").trim();
  return u ? p.byUrl(u) : p.home;
}

// Loose check: looks like an http(s) image-ish URL.
function looksLikeUrl(s) {
  return /^https?:\/\/\S+$/i.test((s || "").trim());
}

// Make a journal entry; returns null if invalid.
function makeEntry(desc, imageUrl, verdict, notes) {
  const d = (desc || "").trim();
  if (!d) return null;
  if (!VERDICTS.includes(verdict)) return null;
  const u = (imageUrl || "").trim();
  if (u && !looksLikeUrl(u)) return null;
  return {
    id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
    desc: d.slice(0, 300),
    imageUrl: u.slice(0, 2000),
    verdict,
    notes: (notes || "").trim().slice(0, 500),
    loggedAt: new Date().toISOString(),
  };
}

// Newest-first (pure).
function sortEntries(entries) {
  return [...entries].sort((a, b) => (b.loggedAt || "").localeCompare(a.loggedAt || ""));
}

// Filter by query across desc/notes/verdict (case-insensitive).
function filterEntries(entries, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    (e.desc + " " + (e.notes || "") + " " + e.verdict).toLowerCase().includes(q));
}

// Count per verdict.
function verdictCounts(entries) {
  const counts = {};
  for (const v of VERDICTS) counts[v] = 0;
  for (const e of entries) if (counts[e.verdict] !== undefined) counts[e.verdict]++;
  return counts;
}

function fmtWhen(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
// ENGINE-END

const $ = (id) => document.getElementById(id);
const LS_KEY = "imgcheck.entries.v1";

function getEntries() {
  return chrome.storage.local.get([LS_KEY]).then((r) => r[LS_KEY] || []);
}
function saveEntries(entries) {
  return chrome.storage.local.set({ [LS_KEY]: entries });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function renderEntries() {
  const entries = await getEntries();
  const q = $("filter").value;
  const list = sortEntries(filterEntries(entries, q));
  const wrap = $("entries");
  $("count").textContent = entries.length;
  if (!list.length) {
    wrap.innerHTML = entries.length
      ? '<p class="empty">No entries match the filter.</p>'
      : '<p class="empty">No entries yet.</p>';
    return;
  }
  wrap.innerHTML = "";
  for (const e of list) {
    const div = document.createElement("div");
    div.className = "entry";
    const srcLine = e.imageUrl ? `<div class="entry-src">${escapeHtml(e.imageUrl)}</div>` : "";
    const notes = e.notes ? `<div class="entry-notes">${escapeHtml(e.notes)}</div>` : "";
    const btns = PROVIDERS.map((p) =>
      `<button class="search-btn" data-p="${p.id}" data-u="${escapeHtml(e.imageUrl)}">${p.name}</button>`
    ).join("");
    div.innerHTML =
      `<div class="entry-top"><span class="entry-verdict">${escapeHtml(e.verdict)}</span>` +
      `<span class="entry-date">${escapeHtml(fmtWhen(e.loggedAt))}</span></div>` +
      `<div class="entry-desc">${escapeHtml(e.desc)}</div>${srcLine}${notes}` +
      `<div class="search-row">${btns}</div>` +
      `<div class="entry-foot"><button class="del-btn" data-id="${e.id}" title="Delete">×</button></div>`;
    wrap.appendChild(div);
  }
  wrap.querySelectorAll(".search-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const url = searchUrl(b.dataset.p, b.dataset.u);
      if (url) chrome.tabs.create({ url });
    })
  );
  wrap.querySelectorAll(".del-btn").forEach((b) =>
    b.addEventListener("click", async () => {
      const cur = await getEntries();
      await saveEntries(cur.filter((e) => e.id !== b.dataset.id));
      renderEntries();
    })
  );
}

function updateSave() {
  $("saveBtn").disabled = $("desc").value.trim().length === 0;
}

async function init() {
  await renderEntries();
  $("desc").addEventListener("input", updateSave);
  $("filter").addEventListener("input", renderEntries);
  $("saveBtn").addEventListener("click", async () => {
    const entry = makeEntry($("desc").value, $("src").value, $("verdict").value, $("notes").value);
    if (!entry) return;
    const cur = await getEntries();
    cur.push(entry);
    await saveEntries(cur);
    $("desc").value = ""; $("src").value = ""; $("notes").value = ""; $("verdict").value = "Undecided";
    updateSave();
    renderEntries();
  });
  $("clearBtn").addEventListener("click", async () => {
    if (!confirm("Delete all image-check entries?")) return;
    await saveEntries([]);
    renderEntries();
  });
}

document.addEventListener("DOMContentLoaded", init);
