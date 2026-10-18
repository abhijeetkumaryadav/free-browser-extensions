/* popup.js — Neutral Salutations popup logic.
   Modules: rule engine (matchSalutations), rendering (flags + reference list),
   page interaction (grab active field via click-only injection). */

const $ = (id) => document.getElementById(id);
const inputEl = $("input");
const resultsEl = $("results");
const checkBtn = $("check");
const grabBtn = $("grab");
const toastEl = $("toast");

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), 1600);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- rule engine: match bundled patterns against text ---------- */
// ENGINE-START
function matchSalutations(text) {
  const raw = [];
  for (const rule of SALUTATION_RULES) {
    const m = text.match(rule.pattern);
    if (m) raw.push({ rule, match: m[0], index: m.index });
  }
  // Drop hits fully subsumed by a longer overlapping hit (e.g. "Dear Sir"
  // inside "Dear Sir/Madam").
  const hits = raw.filter((h) =>
    !raw.some((o) => o !== h &&
      o.index <= h.index && o.index + o.match.length >= h.index + h.match.length &&
      o.match.length > h.match.length)
  );
  return hits.map(({ rule, match, index }) => {
    // Show the matched snippet with ~40 chars of context.
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + match.length + 30);
    const before = (start > 0 ? "…" : "") + text.slice(start, index);
    const after = text.slice(index + match.length, end) + (end < text.length ? "…" : "");
    return { rule, match, before, after };
  });
}
// ENGINE-END

/* ---------- rendering ---------- */
function renderResults(hits) {
  if (!hits.length) {
    resultsEl.innerHTML = `<div class="clean">No gendered salutations found.<br>Checked against ${SALUTATION_RULES.length} bundled patterns — remember this is heuristic, not AI.</div>`;
    return;
  }
  resultsEl.innerHTML = hits.map((h, i) => `
    <div class="flag">
      <div class="found">${esc(h.before)}<mark>${esc(h.match)}</mark>${esc(h.after)}</div>
      <div class="why"><strong>${esc(h.rule.label)}</strong> — ${esc(h.rule.note)}</div>
      <div class="alts">${h.rule.alternatives.map((a) => `<button class="alt" data-alt="${esc(a)}" title="Copy">${esc(a)}</button>`).join("")}</div>
    </div>`).join("");
  resultsEl.querySelectorAll(".alt").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(btn.dataset.alt); toast("Copied: " + btn.dataset.alt); }
      catch { toast("Copy blocked — select the text manually"); }
    });
  });
}

function renderReference() {
  $("ruleCount").textContent = SALUTATION_RULES.length;
  $("ruleList").innerHTML = SALUTATION_RULES.map((r) =>
    `<div class="rule"><b>${esc(r.label)}</b> — ${esc(r.note)}<br>Try: ${r.alternatives.slice(0, 2).map(esc).join(" · ")}</div>`
  ).join("");
}

/* ---------- actions ---------- */
function check() {
  const text = inputEl.value || "";
  if (!text.trim()) { toast("Paste some text first"); return; }
  renderResults(matchSalutations(text));
}

/** Read the focused input/textarea on the active tab (explicit click only). */
async function grabField() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) { toast("Not available on this page"); return; }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const [resp] = await chrome.tabs.sendMessage(tab.id, { type: "NS_GRAB" });
    if (resp && resp.text) {
      inputEl.value = resp.text;
      toast("Field text grabbed — now check it");
    } else {
      toast("Focus a text field on the page first");
    }
  } catch {
    toast("Could not read the page");
  }
}

/* ---------- tabs ---------- */
const tabPaste = $("tabPaste"), tabField = $("tabField");
function setTab(which) {
  const paste = which === "paste";
  tabPaste.classList.toggle("active", paste);
  tabField.classList.toggle("active", !paste);
  inputEl.style.display = paste ? "" : "none";
  grabBtn.style.display = paste ? "none" : "";
  if (!paste) grabField();
}
tabPaste.addEventListener("click", () => setTab("paste"));
tabField.addEventListener("click", () => setTab("field"));

/* ---------- events ---------- */
checkBtn.addEventListener("click", check);
grabBtn.addEventListener("click", grabField);
inputEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") check();
});

/* ---------- init ---------- */
renderReference();
renderResults([]);
