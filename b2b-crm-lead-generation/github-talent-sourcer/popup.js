// GitHub Talent Sourcer — popup logic.
// extractProfile() is injected into the GitHub page; it must stay self-contained.

function extractProfile() {
  const q = (sel, root) => (root || document).querySelector(sel);
  const text = (el) => (el ? el.textContent.trim() : "");

  // Only profile-ish pages: github.com/<user> with a single path segment
  const parts = location.pathname.split("/").filter(Boolean);
  const username = parts.length === 1 ? parts[0] : null;
  if (!username || ["marketplace", "sponsors", "orgs", "settings", "explore"].includes(username)) {
    return { error: "not-profile" };
  }

  const name = text(q(".p-name")) || text(q("[itemprop='name']")) || null;
  const bio = text(q(".p-note.user-profile-bio")) || text(q("[itemprop='description']")) || null;
  const location = text(q('li[itemprop="homeLocation"] .p-label')) || text(q('li[itemprop="homeLocation"]')) || null;
  const company = text(q('li[itemprop="worksFor"] .p-label')) || null;

  const fEl = q('a[href$="tab=followers"] .text-bold') || q('a[href*="tab=followers"] .text-bold');
  const followers = text(fEl) || null;
  const rEl = q('a[href$="tab=repositories"] .Counter') || q('a[href*="tab=repositories"] .Counter');
  const repoCount = text(rEl) || null;

  // Pinned repositories (with graceful fallback)
  const repos = [];
  const pinned = q(".js-pinned-items-reorder-container");
  if (pinned) {
    const seen = new Set();
    pinned.querySelectorAll('a[href^="/"]').forEach((a) => {
      const m = a.getAttribute("href").match(/^\/([^/]+)\/([^/?#]+)$/);
      if (!m || m[1].toLowerCase() !== username.toLowerCase()) return;
      const repoName = m[2];
      if (seen.has(repoName)) return;
      seen.add(repoName);
      const card = a.closest(".Box, .pinned-item-list-item, li") || a.parentElement;
      const langEl = card ? card.querySelector('[itemprop="programmingLanguage"]') : null;
      const starEl = card ? card.querySelector('a[href$="/stargazers"]') : null;
      repos.push({ name: repoName, lang: text(langEl) || null, stars: text(starEl) || null });
    });
  }

  return { username, name, bio, location, company, followers, repoCount, repos: repos.slice(0, 6) };
}

const $ = (id) => document.getElementById(id);
let current = null; // last extracted candidate

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("extractBtn").addEventListener("click", runExtract);
  $("saveBtn").addEventListener("click", saveCandidate);
  $("csvBtn").addEventListener("click", exportCsv);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? tab.url : "";
  let host = "";
  try { host = new URL(url).hostname; } catch (e) {}
  if (/^(www\.)?github\.com$/.test(host)) {
    $("extract").hidden = false;
    $("pageInfo").textContent = "Ready to extract this profile";
  } else {
    $("notGh").hidden = false;
  }
  renderShortlist();
}

async function runExtract() {
  const btn = $("extractBtn");
  btn.disabled = true; btn.textContent = "Extracting…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractProfile });
    const p = res && res.result;
    if (!p || p.error || !p.username) throw new Error("not-profile");
    current = { ...p, notes: "", tags: [] };
    renderCard();
  } catch (e) {
    $("notGh").hidden = false;
    $("notGh").querySelector(".note").innerHTML =
      "Couldn’t extract a profile here — open a <b>github.com/&lt;username&gt;</b> page and try again.";
  } finally {
    btn.disabled = false; btn.textContent = "Extract this profile";
  }
}

function initials(name, username) {
  const src = (name || username || "?").trim();
  return src.split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function renderCard() {
  if (!current) return;
  $("extract").hidden = true;
  $("card").hidden = false;
  $("cAvatar").textContent = initials(current.name, current.username);
  $("cName").textContent = current.name || current.username;
  const link = $("cUser");
  link.textContent = "@" + current.username;
  link.href = "https://github.com/" + current.username;
  $("cBio").textContent = current.bio || "No bio listed.";
  const meta = $("cMeta");
  meta.innerHTML = "";
  [["📍", current.location], ["🏢", current.company], ["👥", current.followers && current.followers + " followers"], ["📦", current.repoCount && current.repoCount + " repos"]]
    .forEach(([icon, val]) => {
      if (!val) return;
      const s = document.createElement("span");
      s.textContent = icon + " " + val;
      meta.appendChild(s);
    });
  const box = $("cRepos");
  box.innerHTML = "";
  if (!current.repos.length) {
    const d = document.createElement("div");
    d.className = "note";
    d.textContent = "No pinned repositories on this profile.";
    box.appendChild(d);
  } else {
    for (const r of current.repos) {
      const row = document.createElement("div");
      row.className = "repo";
      const n = document.createElement("span");
      n.className = "n"; n.textContent = r.name;
      row.appendChild(n);
      if (r.lang) {
        const dot = document.createElement("span"); dot.className = "lang-dot";
        const l = document.createElement("span"); l.className = "l"; l.textContent = r.lang;
        row.append(dot, l);
      }
      if (r.stars) {
        const s = document.createElement("span"); s.className = "s"; s.textContent = "★ " + r.stars;
        row.appendChild(s);
      }
      box.appendChild(row);
    }
  }
  // pre-fill notes/tags if this username is already shortlisted
  chrome.storage.local.get("candidates").then(({ candidates = [] }) => {
    const prev = candidates.find((c) => c.username.toLowerCase() === current.username.toLowerCase());
    if (prev) {
      $("cNotes").value = prev.notes || "";
      $("cTags").value = (prev.tags || []).join(", ");
      $("saveBtn").textContent = "✓ Update";
    } else {
      $("cNotes").value = "";
      $("cTags").value = "";
      $("saveBtn").textContent = "＋ Shortlist";
    }
  });
}

async function saveCandidate() {
  if (!current) return;
  current.notes = $("cNotes").value.trim();
  current.tags = $("cTags").value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const { candidates = [] } = await chrome.storage.local.get("candidates");
  const i = candidates.findIndex((c) => c.username.toLowerCase() === current.username.toLowerCase());
  const record = { ...current, savedAt: Date.now() };
  if (i >= 0) candidates[i] = record; else candidates.unshift(record);
  await chrome.storage.local.set({ candidates: candidates.slice(0, 200) });
  $("saveBtn").textContent = "✓ Saved";
  setTimeout(() => { $("saveBtn").textContent = i >= 0 ? "✓ Update" : "＋ Shortlist"; }, 1200);
  renderShortlist();
}

async function renderShortlist() {
  const { candidates = [] } = await chrome.storage.local.get("candidates");
  $("slCount").textContent = candidates.length;
  const box = $("shortlist");
  box.innerHTML = "";
  if (!candidates.length) {
    const d = document.createElement("div");
    d.className = "empty-sl";
    d.textContent = "No candidates yet — extract a GitHub profile to start your shortlist.";
    box.appendChild(d);
    return;
  }
  for (const c of candidates) {
    const row = document.createElement("div");
    row.className = "sl-row";
    const av = document.createElement("div");
    av.className = "avatar"; av.textContent = initials(c.name, c.username);
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = c.name || c.username;
    b.title = (c.name || "") + " @" + c.username;
    t.appendChild(b);
    if ((c.tags || []).length) {
      const chips = document.createElement("div"); chips.className = "chips";
      c.tags.slice(0, 4).forEach((tag) => {
        const s = document.createElement("span"); s.textContent = tag; chips.appendChild(s);
      });
      t.appendChild(chips);
    }
    const open = document.createElement("a");
    open.className = "open"; open.textContent = "View";
    open.href = "https://github.com/" + c.username; open.target = "_blank"; open.rel = "noopener";
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { candidates: cur = [] } = await chrome.storage.local.get("candidates");
      await chrome.storage.local.set({ candidates: cur.filter((i) => i.username.toLowerCase() !== c.username.toLowerCase()) });
      renderShortlist();
    });
    row.append(av, t, open, x);
    box.appendChild(row);
  }
}

function exportCsv() {
  chrome.storage.local.get("candidates").then(({ candidates = [] }) => {
    if (!candidates.length) return;
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = [["username", "name", "bio", "location", "followers", "top_repos", "tags", "notes", "saved_at"]];
    for (const c of candidates) {
      rows.push([
        c.username, c.name, c.bio, c.location, c.followers,
        (c.repos || []).map((r) => r.name + (r.stars ? ` (${r.stars}★)` : "")).join("; "),
        (c.tags || []).join("; "), c.notes,
        new Date(c.savedAt).toISOString().slice(0, 10),
      ].map(esc));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    a.download = "talent-shortlist.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}
