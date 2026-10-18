/* Jira Ticket Auto Epics Linker — popup logic.
 * Offline organizer: parses ticket keys, groups by project prefix,
 * stores per-ticket epic labels, builds quick links from a user-set base URL.
 * Nothing is ever sent to Jira or anywhere else. */

const els = {
  baseUrl: document.getElementById("base-url"),
  keysInput: document.getElementById("keys-input"),
  addKeys: document.getElementById("add-keys"),
  parseNote: document.getElementById("parse-note"),
  search: document.getElementById("search"),
  groups: document.getElementById("groups"),
  empty: document.getElementById("empty"),
  clearAll: document.getElementById("clear-all"),
  copyGrouped: document.getElementById("copy-grouped"),
};

/** Stored shape: { baseUrl: string, tickets: [{ key, epic }] } */
let state = { baseUrl: "", tickets: [] };

/* ---------- persistence ---------- */
async function load() {
  const stored = await chrome.storage.local.get(["baseUrl", "tickets"]);
  state.baseUrl = stored.baseUrl || "";
  state.tickets = Array.isArray(stored.tickets) ? stored.tickets : [];
  els.baseUrl.value = state.baseUrl;
}
async function save() {
  await chrome.storage.local.set({ baseUrl: state.baseUrl, tickets: state.tickets });
}

/* ---------- parsing ---------- */
// Matches Jira-style keys like PROJ-123 (2+ uppercase letters, then digits).
const KEY_RE = /\b([A-Z][A-Z0-9_]{1,9})-(\d{1,8})\b/g;

function extractKeys(text) {
  const found = [];
  const seen = new Set();
  let m;
  KEY_RE.lastIndex = 0;
  while ((m = KEY_RE.exec(text)) !== null) {
    const key = `${m[1]}-${m[2]}`;
    if (!seen.has(key)) { seen.add(key); found.push(key); }
  }
  return found;
}

/* ---------- rendering ---------- */
function grouped(filter = "") {
  const f = filter.trim().toLowerCase();
  const map = new Map();
  for (const t of state.tickets) {
    if (f && !t.key.toLowerCase().includes(f) && !(t.epic || "").toLowerCase().includes(f)) continue;
    const project = t.key.split("-")[0];
    if (!map.has(project)) map.set(project, []);
    map.get(project).push(t);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function jiraLink(key) {
  if (!state.baseUrl) return null;
  const base = state.baseUrl.replace(/\/+$/, "");
  return `${base}/browse/${encodeURIComponent(key)}`;
}

function render() {
  const filter = els.search.value;
  const groups = grouped(filter);
  els.groups.innerHTML = "";

  els.empty.style.display = state.tickets.length === 0 ? "" : "none";

  for (const [project, tickets] of groups) {
    const group = document.createElement("div");
    group.className = "group";

    const title = document.createElement("div");
    title.className = "group-title";
    const chip = document.createElement("span");
    chip.className = "project-chip";
    chip.textContent = project;
    const count = document.createElement("span");
    count.className = "count-chip";
    count.textContent = `${tickets.length} ticket${tickets.length === 1 ? "" : "s"}`;
    title.append(chip, count);
    group.appendChild(title);

    for (const t of tickets) {
      const row = document.createElement("div");
      row.className = "ticket";

      const link = document.createElement("a");
      link.className = "ticket-key";
      link.textContent = t.key;
      const href = jiraLink(t.key);
      if (href) { link.href = href; link.target = "_blank"; link.rel = "noopener"; }
      else { link.href = "#"; link.title = "Set a Jira base URL above to enable links"; link.style.pointerEvents = "none"; link.style.opacity = "0.7"; }

      const epic = document.createElement("input");
      epic.className = "epic-input";
      epic.placeholder = "Epic label…";
      epic.value = t.epic || "";
      epic.setAttribute("aria-label", `Epic label for ${t.key}`);
      epic.addEventListener("change", () => {
        t.epic = epic.value.trim();
        save();
      });

      const remove = document.createElement("button");
      remove.className = "remove-btn";
      remove.textContent = "×";
      remove.title = `Remove ${t.key}`;
      remove.setAttribute("aria-label", `Remove ${t.key}`);
      remove.addEventListener("click", () => {
        state.tickets = state.tickets.filter((x) => x.key !== t.key);
        save().then(render);
      });

      row.append(link, epic, remove);
      group.appendChild(row);
    }
    els.groups.appendChild(group);
  }
}

/* ---------- actions ---------- */
els.addKeys.addEventListener("click", () => {
  const text = els.keysInput.value;
  const keys = extractKeys(text);
  const existing = new Set(state.tickets.map((t) => t.key));
  const fresh = keys.filter((k) => !existing.has(k));
  for (const k of fresh) state.tickets.push({ key: k, epic: "" });

  const note = els.parseNote;
  if (fresh.length > 0) {
    note.textContent = `Added ${fresh.length} ticket${fresh.length === 1 ? "" : "s"}${keys.length - fresh.length > 0 ? ` (${keys.length - fresh.length} duplicate${keys.length - fresh.length === 1 ? "" : "s"} skipped)` : ""}.`;
  } else if (keys.length > 0) {
    note.textContent = "All of those keys are already in the list.";
  } else {
    note.textContent = "No ticket keys found — use formats like PROJ-123.";
  }
  note.classList.remove("hidden");

  els.keysInput.value = "";
  save().then(render);
});

els.baseUrl.addEventListener("change", () => {
  state.baseUrl = els.baseUrl.value.trim();
  save().then(render);
});

els.search.addEventListener("input", render);

els.clearAll.addEventListener("click", () => {
  if (state.tickets.length === 0) return;
  if (confirm("Remove all saved tickets? Epic labels will be lost.")) {
    state.tickets = [];
    save().then(render);
  }
});

els.copyGrouped.addEventListener("click", async () => {
  const groups = grouped("");
  if (groups.length === 0) return;
  const lines = [];
  for (const [project, tickets] of groups) {
    lines.push(`## ${project}`);
    for (const t of tickets) {
      const href = jiraLink(t.key);
      lines.push(`- ${t.key}${t.epic ? ` — ${t.epic}` : ""}${href ? ` (${href})` : ""}`);
    }
    lines.push("");
  }
  try {
    await navigator.clipboard.writeText(lines.join("\n").trim());
    els.copyGrouped.innerHTML = "Copied ✓";
    setTimeout(() => location.reload(), 900);
  } catch {
    els.copyGrouped.innerHTML = "Copy failed";
    setTimeout(() => location.reload(), 1200);
  }
});

/* ---------- init ---------- */
load().then(render);
