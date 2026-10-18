/* Citation Quality Checklist — Source Rater
 * Heuristic checklist scoring. No network, no real impact factors.
 * Pure engine between markers is headless-testable. */

// ENGINE-START
// Checklist items: id, title, description, weight (points).
const CHECKS = [
  { id: "author",   title: "Identifiable author",   desc: "Named author or organization takes responsibility.", weight: 20 },
  { id: "date",     title: "Publication date given", desc: "You can tell when this was published.", weight: 15 },
  { id: "venue",    title: "Reputable venue",     desc: "Peer-reviewed journal, official body, or known publisher.", weight: 20 },
  { id: "refs",     title: "References listed",   desc: "Cites its own sources you could follow.", weight: 15 },
  { id: "method",   title: "Method or evidence shown", desc: "Explains how the claim was arrived at.", weight: 15 },
  { id: "conflict", title: "Conflicts disclosed", desc: "Funding / interests are stated, or clearly N/A.", weight: 10 },
  { id: "correction", title: "Corrections policy visible", desc: "Publisher issues corrections or retractions openly.", weight: 5 },
];

// Score = sum of weights of ticked checks (0..100).
function scoreChecks(tickedIds) {
  const set = new Set(tickedIds);
  return CHECKS.reduce((sum, c) => sum + (set.has(c.id) ? c.weight : 0), 0);
}

// Verdict bucket for a 0..100 score.
function verdictFor(score) {
  if (score >= 85) return "Strong signals";
  if (score >= 60) return "Mixed signals";
  if (score >= 35) return "Weak signals";
  return "Very weak signals";
}

// Make a saved entry object; returns null if invalid.
function makeEntry(citation, tickedIds, notes) {
  const c = (citation || "").trim();
  if (!c) return null;
  const score = scoreChecks(tickedIds);
  return {
    id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
    citation: c,
    ticked: [...new Set(tickedIds)],
    score,
    verdict: verdictFor(score),
    notes: (notes || "").trim().slice(0, 500),
    savedAt: new Date().toISOString(),
  };
}

// Newest-first sort (pure, does not mutate).
function sortEntries(entries) {
  return [...entries].sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
}

// Format an ISO date for display.
function fmtWhen(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
// ENGINE-END

const $ = (id) => document.getElementById(id);
const LS_KEY = "srcrater.entries.v1";
const LAST_KEY = "srcrater.last.v1";

function loadLast() {
  return chrome.storage.local.get([LS_KEY, LAST_KEY]).then((r) => ({
    entries: r[LS_KEY] || [],
    last: r[LAST_KEY] || null,
  }));
}

function saveEntries(entries) {
  return chrome.storage.local.set({ [LS_KEY]: entries });
}

function renderChecklist(ticked) {
  const wrap = $("checklist");
  wrap.innerHTML = "";
  const set = new Set(ticked);
  for (const c of CHECKS) {
    const label = document.createElement("label");
    label.className = "check-row";
    label.innerHTML =
      `<input type="checkbox" data-id="${c.id}" ${set.has(c.id) ? "checked" : ""}>` +
      `<span><span class="check-title">${c.title} <span class="count">(+${c.weight})</span></span>` +
      `<br><span class="check-desc">${c.desc}</span></span>`;
    wrap.appendChild(label);
  }
  wrap.addEventListener("change", updateScore, { once: true });
}

function tickedIds() {
  return [...document.querySelectorAll('#checklist input:checked')].map((i) => i.dataset.id);
}

function updateScore() {
  const score = scoreChecks(tickedIds());
  $("scoreNum").textContent = score;
  $("scoreRing").style.setProperty("--score", score);
  $("verdict").textContent = verdictFor(score);
  $("hint").textContent =
    "Ticked " + tickedIds().length + " of " + CHECKS.length +
    ". Heuristic only — you make the final call.";
  $("saveBtn").disabled = $("citation").value.trim().length === 0;
}

function renderEntries(entries) {
  const wrap = $("entries");
  $("count").textContent = entries.length;
  if (!entries.length) {
    wrap.innerHTML = '<p class="empty">No saved ratings yet.</p>';
    return;
  }
  wrap.innerHTML = "";
  for (const e of sortEntries(entries)) {
    const div = document.createElement("div");
    div.className = "entry";
    const notes = e.notes ? `<div class="entry-notes">${escapeHtml(e.notes)}</div>` : "";
    div.innerHTML =
      `<div class="entry-top"><span class="entry-score">${e.score}/100 · ${escapeHtml(e.verdict)}</span>` +
      `<span class="entry-date">${escapeHtml(fmtWhen(e.savedAt))}</span></div>` +
      `<div class="entry-cite">${escapeHtml(e.citation)}</div>${notes}` +
      `<div style="text-align:right"><button class="del-btn" data-id="${e.id}" title="Delete">×</button></div>`;
    wrap.appendChild(div);
  }
  wrap.querySelectorAll(".del-btn").forEach((b) =>
    b.addEventListener("click", async () => {
      const { entries: cur } = await loadLast();
      await saveEntries(cur.filter((e) => e.id !== b.dataset.id));
      renderEntries(sortEntries(cur.filter((e) => e.id !== b.dataset.id)));
      // simpler: reload below
      const fresh = await loadLast();
      renderEntries(fresh.entries);
    })
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function init() {
  const { entries, last } = await loadLast();
  renderChecklist(last ? last.ticked : []);
  if (last) {
    $("citation").value = last.citation || "";
    $("notes").value = last.notes || "";
  }
  renderEntries(entries);
  updateScore();

  $("citation").addEventListener("input", updateScore);
  $("notes").addEventListener("input", () =>
    chrome.storage.local.set({ [LAST_KEY]: { citation: $("citation").value, notes: $("notes").value, ticked: tickedIds() } })
  );
  $("checklist").addEventListener("change", () => {
    updateScore();
    chrome.storage.local.set({ [LAST_KEY]: { citation: $("citation").value, notes: $("notes").value, ticked: tickedIds() } });
  });

  $("saveBtn").addEventListener("click", async () => {
    const entry = makeEntry($("citation").value, tickedIds(), $("notes").value);
    if (!entry) return;
    const { entries: cur } = await loadLast();
    cur.push(entry);
    await saveEntries(cur);
    await chrome.storage.local.set({ [LAST_KEY]: { citation: "", notes: "", ticked: [] } });
    $("citation").value = "";
    $("notes").value = "";
    renderChecklist([]);
    updateScore();
    renderEntries(cur);
  });

  $("clearBtn").addEventListener("click", async () => {
    if (!confirm("Delete all saved ratings?")) return;
    await saveEntries([]);
    renderEntries([]);
  });
}

document.addEventListener("DOMContentLoaded", init);
