// MV3 Compatibility Linter — popup logic. All rules run on-device.
//
// Each rule: { id, severity: 'error'|'warning'|'info', title, check(m) -> string|null (detail), fix }
// check() returns a human-readable detail when the issue is found, else null.

const REMOTE_RE = /^https?:\/\//i;

const RULES = [
  {
    id: "manifest-version", severity: "error",
    title: "Not a Manifest V3 manifest",
    check(m) {
      if (m.manifest_version !== 3) return `manifest_version is ${JSON.stringify(m.manifest_version)}; MV2 was removed from the Chrome Web Store.`;
      return null;
    },
    fix: "Set <b>\"manifest_version\": 3</b> and work through the findings below to migrate.",
  },
  {
    id: "background-scripts", severity: "error",
    title: "MV2 background scripts / page",
    check(m) {
      if (m.background && (m.background.scripts || m.background.page))
        return "background.scripts and background.page no longer exist in MV3.";
      return null;
    },
    fix: "Replace with <b>\"background\": { \"service_worker\": \"background.js\" }</b>. Move persistent state to chrome.storage; service workers are event-driven and can be stopped.",
  },
  {
    id: "background-persistent", severity: "warning",
    title: "background.persistent is ignored",
    check(m) {
      if (m.background && "persistent" in m.background)
        return "MV3 service workers are never persistent; this flag is silently ignored.";
      return null;
    },
    fix: "Remove <b>\"persistent\"</b>. Use alarms (chrome.alarms) and storage instead of setInterval / in-memory state.",
  },
  {
    id: "browser-action", severity: "error",
    title: "browser_action / page_action must be merged",
    check(m) {
      const bad = ["browser_action", "page_action"].filter((k) => m[k]);
      if (bad.length) return `${bad.join(" and ")} ${bad.length > 1 ? "were" : "was"} removed in MV3.`;
      return null;
    },
    fix: "Merge both into a single <b>\"action\"</b> key (default_popup, default_icon, default_title).",
  },
  {
    id: "webrequest-blocking", severity: "error",
    title: "webRequestBlocking is gone",
    check(m) {
      const p = m.permissions || [];
      if (p.includes("webRequestBlocking")) return "\"webRequestBlocking\" cannot be requested in MV3.";
      return null;
    },
    fix: "Switch blocking logic to <b>declarativeNetRequest</b> (static rules + dynamic rules). Keep plain \"webRequest\" only for observation.",
  },
  {
    id: "remote-code", severity: "error",
    title: "Remotely-hosted code is banned",
    check(m) {
      const hits = [];
      const scan = (files, where) => (files || []).forEach((f) => {
        if (typeof f === "string" && REMOTE_RE.test(f)) hits.push(`${where}: ${f}`);
      });
      scan(m.background && m.background.scripts, "background.scripts");
      scan(m.background && m.background.service_worker ? [m.background.service_worker] : [], "background.service_worker");
      (m.content_scripts || []).forEach((cs, i) => {
        scan(cs.js, `content_scripts[${i}].js`);
        scan(cs.css, `content_scripts[${i}].css`);
      });
      if (hits.length) return `${hits.length} remote file${hits.length > 1 ? "s" : ""} referenced — e.g. ${hits[0]}.`;
      return null;
    },
    fix: "Bundle every JS/CSS file inside the extension package. Remote <b>&lt;script src&gt;</b> in extension pages is also forbidden.",
  },
  {
    id: "war-format", severity: "warning",
    title: "Old web_accessible_resources format",
    check(m) {
      if (Array.isArray(m.web_accessible_resources))
        return "The string-array format was replaced in MV3.";
      return null;
    },
    fix: "Use objects: <b>[{ \"resources\": [...], \"matches\": [\"https://.../*\"] }]</b> so resources are only exposed where needed.",
  },
  {
    id: "csp-format", severity: "warning",
    title: "Old content_security_policy format",
    check(m) {
      if (typeof m.content_security_policy === "string")
        return "The single-string CSP was replaced in MV3.";
      return null;
    },
    fix: "Use <b>{ \"extension_pages\": \"script-src 'self'; object-src 'self'\", ... }</b>. 'unsafe-eval' is no longer allowed for extension pages.",
  },
  {
    id: "offline-enabled", severity: "warning",
    title: "offline_enabled is deprecated",
    check(m) {
      if ("offline_enabled" in m) return "This key is deprecated and ignored.";
      return null;
    },
    fix: "Remove <b>\"offline_enabled\"</b> — all extensions are treated as offline-capable.",
  },
  {
    id: "min-chrome", severity: "warning",
    title: "minimum_chrome_version below 88",
    check(m) {
      const v = parseInt(m.minimum_chrome_version, 10);
      if (!isNaN(v) && v < 88) return `minimum_chrome_version is ${v}; MV3 requires Chrome 88+.`;
      return null;
    },
    fix: "Set <b>\"minimum_chrome_version\": \"88\"</b> or higher.",
  },
  {
    id: "host-permissions", severity: "warning",
    title: "URL patterns belong in host_permissions",
    check(m) {
      const p = m.permissions || [];
      const urls = p.filter((x) => typeof x === "string" && (x.includes("://") || x === "<all_urls>"));
      if (urls.length) return `${urls.length} URL pattern${urls.length > 1 ? "s" : ""} found in \"permissions\".`;
      return null;
    },
    fix: "Move URL patterns to <b>\"host_permissions\"</b>. Keep \"permissions\" for API names only.",
  },
  {
    id: "chrome-app", severity: "error",
    title: "Chrome Apps are discontinued",
    check(m) {
      if (m.app) return "The \"app\" key targets Chrome Apps, which were removed.";
      return null;
    },
    fix: "Rebuild as an MV3 extension or a web app; there is no migration path for the \"app\" key.",
  },
  {
    id: "plugins", severity: "error",
    title: "NPAPI plugins are long gone",
    check(m) {
      if (m.plugins) return "The \"plugins\" key references NPAPI, removed years ago.";
      return null;
    },
    fix: "Remove <b>\"plugins\"</b>. Use Web APIs or Native Messaging instead.",
  },
  {
    id: "options-page", severity: "info",
    title: "Consider options_ui over options_page",
    check(m) {
      if (m.options_page && !m.options_ui) return "options_page still works but opens a full tab.";
      return null;
    },
    fix: "Prefer <b>\"options_ui\": { \"page\": \"options.html\", \"open_in_tab\": false }</b> for an embedded options dialog.",
  },
  {
    id: "webrequest-observe", severity: "info",
    title: "Plain webRequest is observation-only",
    check(m) {
      const p = m.permissions || [];
      if (p.includes("webRequest") && !p.includes("webRequestBlocking"))
        return "\"webRequest\" without blocking is fine for observing traffic in MV3.";
      return null;
    },
    fix: "No change needed unless you modify requests — then use <b>declarativeNetRequest</b>.",
  },
  {
    id: "dev-key", severity: "info",
    title: "\"key\" field present",
    check(m) {
      if (m.key) return "A hardcoded \"key\" pins the extension ID — fine for development, remove before publishing.";
      return null;
    },
    fix: "Remove <b>\"key\"</b> from release builds; the store assigns the ID.",
  },
  {
    id: "no-background", severity: "info",
    title: "No background context declared",
    check(m) {
      if (m.manifest_version === 3 && !m.background)
        return "No background.service_worker — fine for popup-only extensions.";
      return null;
    },
    fix: "Nothing to do unless you need events, alarms, or network rules.",
  },
];

const SCORE_COST = { error: 12, warning: 5, info: 1 };

const SAMPLE_V2 = {
  manifest_version: 2,
  name: "Sample Old Extension",
  version: "1.0",
  description: "An MV2 manifest full of issues.",
  minimum_chrome_version: "70",
  browser_action: { default_popup: "popup.html" },
  background: { scripts: ["https://cdn.example.com/lib.js", "bg.js"], persistent: false },
  permissions: ["webRequest", "webRequestBlocking", "https://api.example.com/*", "storage"],
  content_security_policy: "script-src 'self' 'unsafe-eval'; object-src 'self'",
  web_accessible_resources: ["images/*.png"],
  options_page: "options.html",
  offline_enabled: true,
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC",
};

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("lint").addEventListener("click", runLint);
  $("sample").addEventListener("click", () => { $("input").value = JSON.stringify(SAMPLE_V2, null, 2); });
  $("copy").addEventListener("click", copyReport);
  chrome.storage.local.get("lastManifest").then(({ lastManifest }) => {
    if (lastManifest) $("input").value = lastManifest;
  });
});

let lastReport = null;

async function runLint() {
  const raw = $("input").value.trim();
  const box = $("results");
  box.hidden = false;
  if (!raw) { renderFindings([], "Paste a manifest first."); return; }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    renderFindings([], null, "Invalid JSON: " + e.message);
    return;
  }
  if (typeof manifest !== "object" || Array.isArray(manifest)) {
    renderFindings([], null, "A manifest must be a JSON object.");
    return;
  }
  await chrome.storage.local.set({ lastManifest: raw.slice(0, 20000) });
  const findings = [];
  for (const rule of RULES) {
    try {
      const detail = rule.check(manifest);
      if (detail) findings.push({ ...rule, detail });
    } catch (e) { /* a malformed manifest shouldn't crash a rule */ }
  }
  lastReport = { manifest, findings };
  renderFindings(findings);
}

function gradeFor(score) {
  if (score >= 90) return ["Ready for MV3", "This manifest looks MV3-clean."];
  if (score >= 70) return ["Mostly ready", "A few issues to fix before migrating."];
  if (score >= 50) return ["Needs work", "Fix the errors below, then re-lint."];
  return ["Not ready", "Significant MV3 migration work required."];
}

function renderFindings(findings, emptyMsg, parseErr) {
  const wrap = $("findings");
  wrap.innerHTML = "";
  const ring = document.querySelector(".score-ring");
  if (parseErr) {
    $("scoreNum").textContent = "–";
    ring.style.setProperty("--pct", "0%");
    $("grade").textContent = "Couldn't parse";
    $("scoreSub").textContent = "Fix the JSON and lint again.";
    const d = document.createElement("div");
    d.className = "parse-err"; d.textContent = parseErr;
    wrap.appendChild(d);
    return;
  }
  let score = 100;
  for (const f of findings) score -= SCORE_COST[f.severity];
  score = Math.max(0, score);
  $("scoreNum").textContent = score;
  ring.style.setProperty("--pct", score + "%");
  const [grade, sub] = gradeFor(score);
  $("grade").textContent = grade;
  $("scoreSub").textContent = sub;
  const order = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  if (!findings.length) {
    const d = document.createElement("div");
    d.className = "clean"; d.textContent = "✓ No MV3 issues found.";
    wrap.appendChild(d);
    return;
  }
  if (emptyMsg) {
    const d = document.createElement("div");
    d.className = "note"; d.textContent = emptyMsg;
    wrap.appendChild(d);
  }
  for (const f of findings) {
    const el = document.createElement("div");
    el.className = "finding " + f.severity;
    const tag = document.createElement("div"); tag.className = "tag"; tag.textContent = f.severity;
    const h = document.createElement("h3"); h.textContent = f.title;
    const p = document.createElement("p"); p.textContent = f.detail;
    const fix = document.createElement("div"); fix.className = "fix";
    fix.innerHTML = "<b>Fix:</b> " + f.fix;
    el.append(tag, h, p, fix);
    wrap.appendChild(el);
  }
}

async function copyReport() {
  if (!lastReport) return;
  const { manifest, findings } = lastReport;
  const name = manifest.name || "manifest";
  const lines = [
    `# MV3 lint report: ${name}`,
    "",
    ...findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title} — ${f.detail}`),
    "",
    findings.length ? "Generated on-device by MV3 Compatibility Linter." : "No MV3 issues found.",
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    $("copy").textContent = "Copied!";
    setTimeout(() => { $("copy").textContent = "Copy report"; }, 1500);
  } catch (e) {
    $("copy").textContent = "Copy failed";
    setTimeout(() => { $("copy").textContent = "Copy report"; }, 1500);
  }
}
