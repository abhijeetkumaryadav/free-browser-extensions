/* Notion Database Index Speed Optimizer — popup logic.
 * Heuristic design reviewer. Parses "Name (Type)" property lines,
 * runs rule-based checks, shows a score, a checklist, and formula helpers.
 * No Notion API, no credentials, nothing leaves the device. */

const els = {
  input: document.getElementById("props-input"),
  analyze: document.getElementById("analyze"),
  sample: document.getElementById("load-sample"),
  results: document.getElementById("results"),
  ring: document.getElementById("score-ring"),
  scoreNum: document.getElementById("score-num"),
  verdict: document.getElementById("score-verdict"),
  sub: document.getElementById("score-sub"),
  suggestions: document.getElementById("suggestions"),
  checklist: document.getElementById("checklist"),
  formulas: document.getElementById("formulas"),
};

/* ---------- property parsing ---------- */
// Accepts "Name (Type)" lines; type is optional and normalized.
const TYPE_ALIASES = {
  title: "title", name: "title", text: "text", rich: "text", "rich text": "text",
  number: "number", num: "number", select: "select", multi: "multi-select",
  "multi-select": "multi-select", multiselect: "multi-select", date: "date",
  person: "person", people: "person", files: "files", "files & media": "files",
  media: "files", checkbox: "checkbox", check: "checkbox", url: "url", link: "url",
  email: "email", phone: "phone", formula: "formula", relation: "relation",
  rollup: "rollup", created: "created time", "created time": "created time",
  edited: "last edited time", "last edited time": "last edited time",
  "created by": "created by", "edited by": "last edited by",
  "last edited by": "last edited by", status: "status",
};

function parseProperties(text) {
  const props = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const name = m ? m[1].trim() : line;
    const rawType = m ? m[2].trim().toLowerCase() : "unknown";
    const type = TYPE_ALIASES[rawType] || rawType;
    props.push({ name, type, rawType: m ? m[2].trim() : "" });
  }
  return props;
}

/* ---------- heuristic rules ---------- */
function analyze(props) {
  const out = []; // { sev: good|warn|bad, html }
  let score = 100;
  const ding = (n) => { score = Math.max(0, score - n); };
  const byType = (t) => props.filter((p) => p.type === t);

  // 1. Title property presence
  const titles = byType("title");
  if (titles.length === 0) {
    ding(18);
    out.push({ sev: "bad", html: "<b>Missing Title property.</b> Every database needs exactly one Title — without it, page names fall back to “Untitled” and relations/filters get confusing." });
  } else if (titles.length > 1) {
    ding(10);
    out.push({ sev: "warn", html: `<b>${titles.length} Title properties found</b> (${titles.map((p) => esc(p.name)).join(", ")}). Notion only honors one as the true title; convert extras to Text.` });
  } else {
    out.push({ sev: "good", html: `<b>Title property present</b> (“${esc(titles[0].name)}”). Good foundation.` });
  }

  // 2. Relation count
  const relations = byType("relation");
  if (relations.length > 4) {
    ding(14);
    out.push({ sev: "bad", html: `<b>${relations.length} Relation properties</b> — each relation adds load cost on large databases. Consider whether some could be Selects, or split the database.` });
  } else if (relations.length > 2) {
    ding(6);
    out.push({ sev: "warn", html: `<b>${relations.length} Relations.</b> Fine for small bases; watch load times past ~2k rows and prefer two-way sync only where needed.` });
  } else if (relations.length > 0) {
    out.push({ sev: "good", html: `<b>${relations.length} Relation${relations.length > 1 ? "s" : ""}</b> — reasonable. Keep “show on” the other side only where you actually use it.` });
  }

  // 3. Rollup count
  const rollups = byType("rollup");
  if (rollups.length > 5) {
    ding(10);
    out.push({ sev: "warn", html: `<b>${rollups.length} Rollups.</b> Rollups recompute across relations — heavy ones (unique values over big relations) are the #1 slowdown. Audit each.` });
  }

  // 4. Formula count
  const formulas = byType("formula");
  if (formulas.length > 6) {
    ding(8);
    out.push({ sev: "warn", html: `<b>${formulas.length} Formulas.</b> Formulas evaluate per row on view load. Move static computations to the source database or simplify nested ifs.` });
  }

  // 5. Total property count
  if (props.length > 30) {
    ding(10);
    out.push({ sev: "warn", html: `<b>${props.length} properties is a lot.</b> Wide databases slow views and the API. Archive unused ones; move detail fields to the page body.` });
  } else if (props.length > 0) {
    out.push({ sev: "good", html: `<b>${props.length} properties</b> — a healthy width.` });
  }

  // 6. Long text in title-adjacent spots
  const longTextInTitle = props.filter((p) => p.type === "text" && p.name.length > 40);
  if (longTextInTitle.length > 0) {
    ding(4);
    out.push({ sev: "warn", html: `Very long property names (${longTextInTitle.map((p) => `“${esc(p.name)}”`).join(", ")}) eat horizontal space. Keep names short; explain in the description field.` });
  }

  // 7. Files & media
  const files = byType("files");
  if (files.length > 3) {
    ding(6);
    out.push({ sev: "warn", html: `<b>${files.length} Files properties.</b> Media-heavy columns bloat views — prefer one Files column or page-body attachments.` });
  }

  // 8. Select option hygiene (can't see options; generic nudge)
  const selects = [...byType("select"), ...byType("multi-select"), ...byType("status")];
  if (selects.length > 8) {
    ding(4);
    out.push({ sev: "warn", html: `<b>${selects.length} select-type properties.</b> Consolidate where possible — dozens of option lists slow the filter UI.` });
  }

  // 9. Unknown types
  const unknown = props.filter((p) => p.type === "unknown");
  if (unknown.length > 0) {
    out.push({ sev: "warn", html: `Couldn’t recognize types for: ${unknown.map((p) => `“${esc(p.name)}”`).join(", ")}. Use the “Name (Type)” format, e.g. “Due (Date)”.` });
  }

  // 10. Empty input
  if (props.length === 0) {
    score = 0;
    out.length = 0;
    out.push({ sev: "warn", html: "Paste a property list first — one per line, like <b>Name (Title)</b>." });
  }

  return { score, suggestions: out };
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function verdictFor(score) {
  if (score >= 85) return "Lean & fast";
  if (score >= 65) return "Solid, minor drag";
  if (score >= 40) return "Getting heavy";
  return "Needs a diet";
}

/* ---------- static content: checklist ---------- */
const CHECKLIST = [
  "One Title property only — convert extras to Text",
  "Cap relations at ~4 per database; disable unused two-way sync",
  "Audit rollups — avoid “unique values” over large relations",
  "Move static formula results to a plain property where possible",
  "Archive unused properties instead of hiding them",
  "Keep default view lean — put heavy columns in secondary views",
  "Use filters to cap rows per view (aim < 2k visible rows)",
  "Prefer page body over extra properties for long-form detail",
];

async function renderChecklist() {
  const stored = await chrome.storage.local.get("checklist");
  const done = new Set(stored.checklist || []);
  els.checklist.innerHTML = "";
  CHECKLIST.forEach((text, i) => {
    const label = document.createElement("label");
    label.className = "check-item" + (done.has(i) ? " done" : "");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = done.has(i);
    box.setAttribute("aria-label", text);
    box.addEventListener("change", () => {
      const next = new Set(done);
      if (box.checked) next.add(i); else next.delete(i);
      chrome.storage.local.set({ checklist: [...next] });
      label.classList.toggle("done", box.checked);
    });
    const span = document.createElement("span");
    span.textContent = text;
    label.append(box, span);
    els.checklist.appendChild(label);
  });
}

/* ---------- static content: formula helpers ---------- */
const FORMULAS = [
  { name: "Days until due", desc: "Whole days remaining on a Date property.", code: 'dateBetween(prop("Due"), now(), "days")' },
  { name: "Overdue flag", desc: "True when Due is past and Status isn't Done.", code: 'and(prop("Due") < now(), prop("Status") != "Done")' },
  { name: "Progress bar", desc: "Text progress bar from Done/Total numbers.", code: 'repeat("▓", round(prop("Done") / prop("Total") * 10)) +\nrepeat("░", 10 - round(prop("Done") / prop("Total") * 10))' },
  { name: "Auto status from checkbox", desc: "Derive a Status label from a Checkbox.", code: 'if(prop("Shipped"), "✅ Shipped", "🕐 Pending")' },
  { name: "Title-case name", desc: "Capitalize first letter of a Text property.", code: 'upper(slice(prop("Name"), 0, 1)) + slice(prop("Name"), 1)' },
];

function renderFormulas() {
  els.formulas.innerHTML = "";
  for (const f of FORMULAS) {
    const wrap = document.createElement("div");
    wrap.className = "formula";
    const name = document.createElement("div");
    name.className = "fname";
    name.textContent = f.name;
    const desc = document.createElement("div");
    desc.className = "fdesc";
    desc.textContent = f.desc;
    const code = document.createElement("code");
    code.textContent = f.code;
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(f.code);
        btn.textContent = "Copied ✓";
      } catch { btn.textContent = "Copy failed"; }
      setTimeout(() => { btn.textContent = "Copy"; }, 1200);
    });
    wrap.append(name, desc, code, btn);
    els.formulas.appendChild(wrap);
  }
}

/* ---------- actions ---------- */
els.analyze.addEventListener("click", () => {
  const props = parseProperties(els.input.value);
  const { score, suggestions } = analyze(props);
  chrome.storage.local.set({ lastInput: els.input.value });

  els.results.classList.remove("hidden");
  els.scoreNum.textContent = score;
  els.ring.style.setProperty("--pct", `${score}%`);
  els.ring.style.setProperty("--accent",
    score >= 65 ? "#10b981" : score >= 40 ? "#f59e0b" : "#f87171");
  els.verdict.textContent = verdictFor(score);
  els.sub.textContent = `${props.length} propert${props.length === 1 ? "y" : "ies"} reviewed · heuristic only`;

  els.suggestions.innerHTML = "";
  for (const s of suggestions) {
    const div = document.createElement("div");
    div.className = "suggestion";
    const sev = document.createElement("span");
    sev.className = `sev sev-${s.sev}`;
    sev.textContent = s.sev === "good" ? "Good" : s.sev === "warn" ? "Watch" : "Fix";
    const p = document.createElement("p");
    p.innerHTML = s.html; // built from our own strings + esc()'d user input
    div.append(sev, p);
    els.suggestions.appendChild(div);
  }
});

els.sample.addEventListener("click", () => {
  els.input.value = [
    "Task (Title)", "Status (Status)", "Assignee (Person)", "Due (Date)",
    "Project (Relation)", "Subtasks (Relation)", "Client (Relation)",
    "Estimate (Number)", "Priority (Select)", "Tags (Multi-select)",
    "Notes (Text)", "Attachments (Files)", "Score (Formula)",
    "Rollup Total (Rollup)", "Created (Created time)",
  ].join("\n");
  els.analyze.click();
});

/* ---------- init ---------- */
(async function init() {
  renderChecklist();
  renderFormulas();
  const stored = await chrome.storage.local.get("lastInput");
  if (stored.lastInput) els.input.value = stored.lastInput;
})();
