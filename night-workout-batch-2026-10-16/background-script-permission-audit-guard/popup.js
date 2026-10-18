/* Permission Audit Guard — popup logic.
 * Read-only: lists installed extensions via chrome.management and scores
 * their declared permissions with plain-language explanations.
 * Nothing is ever modified, disabled, or removed.
 */
"use strict";

/* permission -> { weight, plain-language explanation } */
const PERM_INFO = {
  "<all_urls>":      { w: 3, why: "Can read and change your data on every website you visit." },
  "debugger":        { w: 3, why: "Full debugging access — can inspect and control what pages do." },
  "scripting":       { w: 2, why: "Can inject and run code inside the pages you visit." },
  "nativeMessaging": { w: 2, why: "Can exchange messages with native apps outside the browser." },
  "management":      { w: 2, why: "Can enable, disable, or uninstall your other extensions." },
  "webRequestBlocking": { w: 2, why: "Can block, redirect, or modify network requests (legacy capability)." },
  "proxy":           { w: 2, why: "Can route all of your traffic through a proxy server." },
  "webRequest":      { w: 1, why: "Can observe the URLs your browser requests." },
  "cookies":         { w: 1, why: "Can read and modify cookies, including login sessions." },
  "history":         { w: 1, why: "Can read your browsing history." },
  "tabs":            { w: 1, why: "Can read the URLs of your open tabs." },
  "bookmarks":       { w: 1, why: "Can read and change your bookmarks." },
  "downloads":       { w: 1, why: "Can start and manage downloads." },
  "clipboardRead":   { w: 1, why: "Can read what you copy to the clipboard." },
  "clipboardWrite":  { w: 1, why: "Can write to your clipboard." },
  "identity":        { w: 1, why: "Can access your signed-in browser account identity." },
  "privacy":         { w: 1, why: "Can change browser privacy-related settings." },
  "geolocation":     { w: 1, why: "Can access your physical location." },
  "notifications":   { w: 0, why: "Can show notifications." },
  "storage":         { w: 0, why: "Can store its own settings locally." },
  "alarms":          { w: 0, why: "Can schedule background wake-ups." },
  "contextMenus":    { w: 0, why: "Can add right-click menu items." },
  "activeTab":       { w: 0, why: "Temporary access to the tab you click it on." },
  "declarativeNetRequest": { w: 1, why: "Can declare rules that block or redirect requests." },
};

/* Dangerous combos flagged explicitly, regardless of score. */
const COMBOS = [
  { perms: ["<all_urls>", "scripting"], note: "Can rewrite any page you visit — the classic over-privilege pattern." },
  { perms: ["debugger", "<all_urls>"], note: "Debugger plus full-site access can silently control your browsing." },
  { perms: ["management", "<all_urls>"], note: "Can tamper with your other extensions while watching all traffic." },
  { perms: ["nativeMessaging", "cookies"], note: "Can pipe your login cookies out to a native app." },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function levelOf(score) {
  if (score >= 6) return "critical";
  if (score >= 4) return "high";
  if (score >= 2) return "elevated";
  return "low";
}

function auditExtension(ext) {
  const declared = [...(ext.permissions || []), ...(ext.hostPermissions || [])];
  const flagged = [];
  let score = 0;
  for (const p of declared) {
    const info = PERM_INFO[p];
    if (info && info.w > 0) {
      flagged.push({ perm: p, weight: info.w, why: info.why });
      score += info.w;
    }
  }
  const comboNotes = COMBOS
    .filter((c) => c.perms.every((p) => declared.includes(p)))
    .map((c) => c.note);
  return { ext, declared, flagged, comboNotes, score, level: levelOf(score) };
}

let lastReport = null;

async function scan() {
  $("cards").innerHTML = '<div class="empty">Scanning…</div>';
  const self = await chrome.management.getSelf();
  const all = await chrome.management.getAll();
  const exts = all.filter((e) => e.type === "extension" && e.id !== self.id);

  const results = exts.map(auditExtension)
    .sort((a, b) => b.score - a.score || a.ext.name.localeCompare(b.ext.name));

  const counts = { critical: 0, high: 0, elevated: 0, low: 0 };
  results.forEach((r) => { counts[r.level]++; });

  $("sumTotal").textContent = results.length;
  $("sumCrit").textContent = counts.critical;
  $("sumHigh").textContent = counts.high;
  $("sumElev").textContent = counts.elevated;
  $("sumLow").textContent = counts.low;
  const now = new Date();
  $("scannedAt").textContent = "Scanned " + now.toLocaleString();

  lastReport = {
    generatedAt: now.toISOString(),
    tool: "Permission Audit Guard 1.0.0",
    note: "Read-only audit. Scores are heuristic, not verdicts — a high score means 'review carefully', not 'malicious'.",
    summary: { total: results.length, ...counts },
    extensions: results.map((r) => ({
      name: r.ext.name, version: r.ext.version,
      enabled: r.ext.enabled, mayDisable: r.ext.mayDisable,
      riskLevel: r.level, riskScore: r.score,
      flaggedPermissions: r.flagged,
      dangerousCombos: r.comboNotes,
      allDeclared: r.declared
    }))
  };
  try { await chrome.storage.local.set({ lastReport }); } catch {}

  if (!results.length) {
    $("cards").innerHTML = '<div class="empty">No other extensions installed.</div>';
    return;
  }

  $("cards").innerHTML = results.map((r) => {
    const perms = r.flagged.map((f) =>
      `<li><b>${esc(f.perm)}</b><span>${esc(f.why)}</span></li>`).join("");
    const combos = r.comboNotes.map((n) =>
      `<li><b>⚠ combo</b><span>${esc(n)}</span></li>`).join("");
    const why = r.level === "low"
      ? "No risky permissions detected. Nothing to review here."
      : "Review the flagged permissions below — decide if this extension truly needs them.";
    return `<div class="card ${r.level}">
      <div class="c1">
        <span class="nm" title="${esc(r.ext.name)}">${esc(r.ext.name)}</span>
        <span class="ver">v${esc(r.ext.version || "?")}</span>
        ${r.ext.enabled ? "" : '<span class="off">disabled</span>'}
        <span class="risk ${r.level}">${r.level}</span>
      </div>
      <div class="why">${why}</div>
      ${(perms || combos) ? `<ul class="perms">${combos}${perms}</ul>` : ""}
    </div>`;
  }).join("");
}

function exportReport() {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "permission-audit-report.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

document.addEventListener("DOMContentLoaded", () => {
  $("rescan").addEventListener("click", scan);
  $("exportBtn").addEventListener("click", exportReport);
  scan();
});
