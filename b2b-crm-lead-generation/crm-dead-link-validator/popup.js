// CRM Dead Link Validator — popup logic.
// Checks each URL in a background tab (active:false), flags browser error
// pages / error-like titles as dead, closes the tab, moves on.

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOAD_TIMEOUT = 15000;
const ERROR_URL_PREFIXES = ["chrome-error://", "edge://", "about:neterror", "about:blocked"];
const ERROR_TITLE_PATTERNS = [
  /can't be reached/i,
  /err_/i,
  /\b404\b/,
  /not found/i,
  /server .* could not be found/i,
  /connection (was )?(refused|timed out|reset|aborted)/i,
  /\bdns\b/i,
  /this site can'?t provide a secure connection/i,
  /no internet/i,
  /webpage is not available/i,
];

let cancelled = false;
let results = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("run").addEventListener("click", runValidation);
  $("cancel").addEventListener("click", () => { cancelled = true; });
  $("export").addEventListener("click", exportCsv);
  $("clear").addEventListener("click", async () => {
    results = [];
    await chrome.storage.local.remove("lastResults");
    render();
  });
  const { lastResults = [] } = await chrome.storage.local.get("lastResults");
  if (lastResults.length) { results = lastResults; render(); }
}

// Normalize one pasted line into a URL, or null if unusable.
function normalize(line) {
  const t = line.trim();
  if (!t) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
  return "https://" + t;
}

async function checkUrl(url) {
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;
    const deadline = Date.now() + LOAD_TIMEOUT;
    let info = tab;
    while (Date.now() < deadline) {
      info = await chrome.tabs.get(tabId);
      if (info.status === "complete") break;
      await sleep(400);
    }
    info = await chrome.tabs.get(tabId);
    const title = (info.title || "").trim();
    const finalUrl = info.url || "";
    if (ERROR_URL_PREFIXES.some((p) => finalUrl.startsWith(p))) {
      return { url, status: "dead", detail: title || "Browser error page" };
    }
    if (ERROR_TITLE_PATTERNS.some((re) => re.test(title))) {
      return { url, status: "dead", detail: title };
    }
    if (info.status !== "complete") {
      return { url, status: "unknown", detail: "Timed out waiting for load" };
    }
    return { url, status: "alive", detail: title.slice(0, 100) || "Loaded OK" };
  } catch (e) {
    return { url, status: "unknown", detail: String((e && e.message) || e) };
  } finally {
    if (tabId != null) {
      try { await chrome.tabs.remove(tabId); } catch (e) { /* already gone */ }
    }
  }
}

async function runValidation() {
  const lines = $("urls").value.split(/\r?\n/).map(normalize).filter(Boolean);
  const unique = [...new Set(lines)];
  if (!unique.length) { $("urls").focus(); return; }
  cancelled = false;
  results = [];
  $("run").disabled = true;
  $("cancel").hidden = false;
  $("progress").hidden = false;
  render();

  for (let i = 0; i < unique.length; i++) {
    if (cancelled) break;
    $("plabel").textContent = `${i + 1} / ${unique.length}`;
    $("bar").style.width = `${Math.round((i / unique.length) * 100)}%`;
    const r = await checkUrl(unique[i]);
    results.push(r);
    render();
  }

  $("bar").style.width = "100%";
  $("plabel").textContent = `${results.length} / ${unique.length}`;
  $("run").disabled = false;
  $("cancel").hidden = true;
  if (!cancelled) $("progress").hidden = true;
  await chrome.storage.local.set({ lastResults: results.slice(0, 200) });
}

function render() {
  const card = $("resCard");
  const box = $("results");
  box.innerHTML = "";
  card.hidden = results.length === 0;
  const dead = results.filter((r) => r.status === "dead").length;
  const alive = results.filter((r) => r.status === "alive").length;
  $("summary").textContent = `— ${alive} alive · ${dead} dead · ${results.length - alive - dead} unknown`;
  for (const r of results) {
    const row = document.createElement("div");
    row.className = "res";
    const badge = document.createElement("span");
    badge.className = "badge " + r.status;
    badge.textContent = r.status;
    const u = document.createElement("div");
    u.className = "u";
    const b = document.createElement("b");
    b.textContent = r.url; b.title = r.url;
    const s = document.createElement("span");
    s.textContent = r.detail; s.title = r.detail;
    u.append(b, s);
    row.append(badge, u);
    box.appendChild(row);
  }
}

function exportCsv() {
  if (!results.length) return;
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [["url", "status", "detail"],
    ...results.map((r) => [r.url, r.status, r.detail]),
  ].map((row) => row.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "link-validation-results.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
