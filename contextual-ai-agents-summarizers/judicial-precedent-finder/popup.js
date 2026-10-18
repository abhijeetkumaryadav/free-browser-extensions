// Judicial Precedent Finder — popup logic. Opens public databases with
// prefilled queries; nothing is scraped. Briefs are stored on-device.

// Launcher definitions per jurisdiction: label + URL builder.
const LAUNCHERS = {
  india: [
    ["Indian Kanoon", (q) => "https://indiankanoon.org/search/?formInput=" + encodeURIComponent(q)],
    ["Google Scholar", (q) => "https://scholar.google.com/scholar?q=" + encodeURIComponent(q + " India case law")],
    ["CourtListener", (q) => "https://www.courtlistener.com/?q=" + encodeURIComponent(q) + "&type=o"],
  ],
  us: [
    ["Justia", (q) => "https://search.justia.com/search?query=" + encodeURIComponent(q)],
    ["CourtListener", (q) => "https://www.courtlistener.com/?q=" + encodeURIComponent(q) + "&type=o"],
    ["Google Scholar", (q) => "https://scholar.google.com/scholar?q=" + encodeURIComponent(q + " US case law")],
  ],
  uk: [
    ["BAILII", (q) => "https://www.bailii.org/cgi-bin/search.pl?query=" + encodeURIComponent(q)],
    ["Google Scholar", (q) => "https://scholar.google.com/scholar?q=" + encodeURIComponent(q + " UK case law")],
    ["CourtListener", (q) => "https://www.courtlistener.com/?q=" + encodeURIComponent(q) + "&type=o"],
  ],
  eu: [
    ["EUR-Lex", (q) => "https://eur-lex.europa.eu/search.html?qid=&text=" + encodeURIComponent(q)],
    ["Google Scholar", (q) => "https://scholar.google.com/scholar?q=" + encodeURIComponent(q + " EU case law")],
  ],
  intl: [
    ["Google Scholar", (q) => "https://scholar.google.com/scholar?q=" + encodeURIComponent(q + " case law")],
    ["CourtListener", (q) => "https://www.courtlistener.com/?q=" + encodeURIComponent(q) + "&type=o"],
    ["Indian Kanoon", (q) => "https://indiankanoon.org/search/?formInput=" + encodeURIComponent(q)],
  ],
};
const JURIS_LABEL = { india: "India", us: "United States", uk: "United Kingdom", eu: "European Union", intl: "International" };

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("launch").addEventListener("click", buildLaunchers);
  $("saveBrief").addEventListener("click", saveBrief);
  renderBriefs();
}

function buildLaunchers() {
  const topic = $("topic").value.trim();
  if (!topic) { $("topic").focus(); return; }
  const juris = $("juris").value;
  const box = $("launchers");
  box.innerHTML = "";
  for (const [label, urlFor] of LAUNCHERS[juris]) {
    const b = document.createElement("button");
    b.textContent = label + " ↗";
    b.addEventListener("click", () => chrome.tabs.create({ url: urlFor(topic) }));
    box.appendChild(b);
  }
  box.hidden = false;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function saveBrief() {
  const title = $("bTitle").value.trim();
  if (!title) { $("bTitle").focus(); return; }
  const brief = {
    id: "brief-" + Date.now(),
    title,
    topic: $("topic").value.trim(),
    juris: JURIS_LABEL[$("juris").value],
    facts: $("bFacts").value.trim(),
    issue: $("bIssue").value.trim(),
    holding: $("bHolding").value.trim(),
    reasoning: $("bReasoning").value.trim(),
    savedAt: Date.now(),
  };
  const { briefs = [] } = await chrome.storage.local.get("briefs");
  briefs.unshift(brief);
  await chrome.storage.local.set({ briefs: briefs.slice(0, 100) });
  $("bTitle").value = $("bFacts").value = $("bIssue").value = $("bHolding").value = $("bReasoning").value = "";
  renderBriefs();
}

function briefText(b) {
  return `${b.title}\n${b.juris}${b.topic ? " · " + b.topic : ""}\n\nFACTS\n${b.facts || "—"}\n\nISSUE\n${b.issue || "—"}\n\nHOLDING\n${b.holding || "—"}\n\nREASONING\n${b.reasoning || "—"}`;
}

async function renderBriefs() {
  const { briefs = [] } = await chrome.storage.local.get("briefs");
  const card = $("briefCard"), box = $("briefs");
  box.innerHTML = "";
  card.hidden = briefs.length === 0;
  for (const b of briefs) {
    const el = document.createElement("div");
    el.className = "brief";
    const meta = [b.juris, b.topic].filter(Boolean).join(" · ");
    const dl = document.createElement("dl");
    for (const [label, key] of [["Facts", "facts"], ["Issue", "issue"], ["Holding", "holding"], ["Reasoning", "reasoning"]]) {
      if (!b[key]) continue;
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = b[key];
      dl.append(dt, dd);
    }
    const row = document.createElement("div");
    row.className = "row";
    const copy = document.createElement("button");
    copy.textContent = "Copy brief";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(briefText(b));
        copy.textContent = "Copied ✓";
        setTimeout(() => copy.textContent = "Copy brief", 1500);
      } catch (e) {}
    });
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      const { briefs: cur = [] } = await chrome.storage.local.get("briefs");
      await chrome.storage.local.set({ briefs: cur.filter((x) => x.id !== b.id) });
      renderBriefs();
    });
    row.append(copy, del);
    const h = document.createElement("h3"); h.textContent = b.title;
    const m = document.createElement("div"); m.className = "meta"; m.textContent = meta;
    el.append(h, m, dl, row);
    box.appendChild(el);
  }
}
