/* Permission Audit — read-only security audit of installed extensions.
   Uses chrome.management (getAll) to inventory permissions and scores risk
   locally. Nothing is ever modified or transmitted. */
"use strict";

/* Risky permission catalog: pattern -> { level: 'high'|'med', label, why } */
const RISK_RULES = [
  { match: /^<all_urls>$/, level: "high", label: "All sites", why: "Can read and modify data on every website you visit." },
  { match: /^http:\/\/\*\/?$/, level: "high", label: "All HTTP sites", why: "Broad access to every unencrypted site." },
  { match: /^https:\/\/\*\/?$/, level: "high", label: "All HTTPS sites", why: "Broad access to every encrypted site." },
  { match: /^\*:\/\/\*\//, level: "high", label: "All URLs", why: "Wildcard access to all sites and schemes." },
  { match: /^webRequestBlocking$/, level: "high", label: "Block requests", why: "Can intercept and block any network request." },
  { match: /^webRequest$/, level: "med", label: "Observe traffic", why: "Can observe network traffic metadata." },
  { match: /^declarativeNetRequestWithHostAccess$/, level: "med", label: "Modify traffic", why: "Can redirect or block requests on permitted sites." },
  { match: /^debugger$/, level: "high", label: "Debugger", why: "Full DevTools-level control over tabs — very powerful." },
  { match: /^nativeMessaging$/, level: "high", label: "Native apps", why: "Can talk to programs installed on your computer." },
  { match: /^proxy$/, level: "high", label: "Proxy control", why: "Can reroute all browser traffic through a proxy." },
  { match: /^cookies$/, level: "med", label: "Cookies", why: "Can read and modify cookies, including session cookies." },
  { match: /^history$/, level: "med", label: "History", why: "Can read your full browsing history." },
  { match: /^bookmarks$/, level: "med", label: "Bookmarks", why: "Can read and modify your bookmarks." },
  { match: /^tabs$/, level: "med", label: "Tab data", why: "Can read URLs and titles of open tabs." },
  { match: /^topSites$/, level: "med", label: "Top sites", why: "Can read your most-visited sites." },
  { match: /^clipboardRead$/, level: "med", label: "Read clipboard", why: "Can read whatever you copy." },
  { match: /^geolocation$/, level: "med", label: "Location", why: "Can access your physical location." },
  { match: /^management$/, level: "med", label: "Manage extensions", why: "Can enable/disable other extensions." },
  { match: /^privacy$/, level: "med", label: "Privacy settings", why: "Can change browser privacy settings." },
  { match: /^contentSettings$/, level: "med", label: "Content settings", why: "Can change per-site permissions." },
  { match: /^scripting$/, level: "med", label: "Script injection", why: "Can inject scripts into pages it has access to." },
  { match: /^activeTab$/, level: "low", label: "Active tab", why: "Temporary access to the tab you click it on." },
  { match: /^storage$/, level: "low", label: "Storage", why: "Local storage for its own settings." },
  { match: /^alarms$/, level: "low", label: "Alarms", why: "Scheduling only, no data access." },
  { match: /^notifications$/, level: "low", label: "Notifications", why: "Can show notifications." },
  { match: /^contextMenus$/, level: "low", label: "Context menus", why: "Adds right-click menu items." },
];

/* Score one permission: returns { score, level, label, why } or null */
function scorePermission(perm) {
  for (const rule of RISK_RULES) {
    if (rule.match.test(perm)) {
      const score = rule.level === "high" ? 25 : rule.level === "med" ? 12 : 3;
      return { perm, score, level: rule.level, label: rule.label, why: rule.why };
    }
  }
  // Unknown host pattern like https://example.com/* -> mild
  if (/^(\*|https?|file|ftp):\/\//.test(perm)) {
    return { perm, score: 6, level: "low", label: "Site access", why: "Access limited to specific sites." };
  }
  return { perm, score: 2, level: "low", label: perm, why: "Standard capability permission." };
}

function riskClass(score) {
  return score >= 50 ? "high" : score >= 20 ? "med" : "low";
}

function iconUrl(ext) {
  if (ext.icons && ext.icons.length) {
    const best = ext.icons.slice().sort((a, b) => b.size - a.size)[0];
    return best.url;
  }
  return null;
}

let extensions = [];
let sortMode = "risk";

/* ---- Render ---- */
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";
  if (!extensions.length) {
    list.innerHTML = '<div class="empty">No other extensions found.<br>Install some to audit them here.</div>';
    return;
  }
  const sorted = [...extensions].sort((a, b) =>
    sortMode === "risk" ? b.score - a.score
    : sortMode === "name" ? a.name.localeCompare(b.name)
    : b.permCount - a.permCount
  );
  for (const ext of sorted) {
    const card = document.createElement("div");
    card.className = "card";
    const cls = riskClass(ext.score);
    const badges = ext.flags
      .filter(f => f.level !== "low")
      .slice(0, 4)
      .map(f => `<span class="badge ${f.level}">${escapeHtml(f.label)}</span>`)
      .join("");
    card.innerHTML = `
      <div class="card-head">
        ${iconUrl(ext) ? `<img class="card-icon" src="${escapeHtml(iconUrl(ext))}" alt="">` : `<span class="card-icon" style="background:rgba(255,255,255,.06)"></span>`}
        <div class="card-meta">
          <div class="card-name">${escapeHtml(ext.name)}</div>
          <div class="card-ver">v${escapeHtml(ext.version)} · ${ext.permCount} permission${ext.permCount === 1 ? "" : "s"}</div>
        </div>
        <span class="score ${cls}" title="Risk score ${ext.score}/100">${ext.score}</span>
      </div>
      ${badges ? `<div class="badge-row">${badges}</div>` : ""}
      <div class="card-detail">
        <div class="detail-title">Permission inventory</div>
        ${ext.flags.map(f => `
          <div class="perm">
            <span class="dot ${f.level}"></span>
            <code style="flex:1">${escapeHtml(f.perm)}</code>
          </div>
          ${f.level !== "low" ? `<div class="perm" style="padding-top:0"><span></span><span style="flex:1">${escapeHtml(f.why)}</span></div>` : ""}
        `).join("")}
      </div>`;
    card.querySelector(".card-head").addEventListener("click", () => card.classList.toggle("open"));
    list.appendChild(card);
  }
}

function renderSummary() {
  const total = extensions.length;
  const risky = extensions.filter(e => riskClass(e.score) === "high").length;
  const avg = total ? Math.round(extensions.reduce((s, e) => s + e.score, 0) / total) : 0;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statRisky").textContent = risky;
  document.getElementById("statAvg").textContent = total ? avg : "–";
}

/* ---- Scan ---- */
async function scan() {
  const btn = document.getElementById("rescan");
  btn.classList.add("spin");
  try {
    const all = await chrome.management.getAll();
    // Exclude self from the audit list
    const selfId = chrome.runtime.id;
    extensions = all
      .filter(e => e.id !== selfId && e.type === "extension")
      .map(e => {
        const perms = [...(e.permissions || []), ...(e.hostPermissions || [])];
        const flags = perms.map(scorePermission);
        const score = Math.min(100, flags.reduce((s, f) => s + f.score, 0));
        return { id: e.id, name: e.shortName || e.name, version: e.version, icons: e.icons, permCount: perms.length, flags, score };
      });
    renderSummary();
    render();
  } catch (err) {
    document.getElementById("list").innerHTML =
      `<div class="empty">Scan failed: ${escapeHtml(err.message)}<br>Grant the management permission and retry.</div>`;
  } finally {
    setTimeout(() => btn.classList.remove("spin"), 700);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---- Wire up ---- */
document.getElementById("rescan").addEventListener("click", scan);
document.getElementById("openExtensions").addEventListener("click", e => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions" });
});
document.getElementById("sortSeg").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  document.querySelectorAll("#sortSeg button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  sortMode = btn.dataset.sort;
  render();
});

scan();
