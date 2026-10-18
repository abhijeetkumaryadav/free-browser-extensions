// Document Citation Verifier — popup logic.
// collectLinks() is injected into the page; it must stay self-contained (no closures).

function collectLinks() {
  const seen = new Set();
  const out = [];
  const pageHost = location.hostname;
  for (const a of document.querySelectorAll("a[href]")) {
    let href = (a.getAttribute("href") || "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    let url;
    try { url = new URL(href, location.href); } catch (e) { continue; }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    url.hash = "";
    const key = url.href;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: key,
      text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 120),
      external: url.hostname !== pageHost,
    });
    if (out.length >= 60) break;
  }
  return out;
}

const $ = (id) => document.getElementById(id);
const VERIFY_TIMEOUT_MS = 15000;
let results = [];
let running = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("start").addEventListener("click", startVerify);
  $("csvBtn").addEventListener("click", exportCsv);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
}

// Wait until a tab reports status "complete", or time out.
function waitForComplete(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { cleanup(); resolve(false); }, VERIFY_TIMEOUT_MS);
    function onUpdated(id, info) {
      if (id === tabId && info.status === "complete") { cleanup(); resolve(true); }
    }
    function cleanup() { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(onUpdated); }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

// Best-effort check of a single link in a hidden tab.
async function verifyOne(link) {
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url: link.url, active: false });
    tabId = tab.id;
    const loaded = await waitForComplete(tabId);
    let tabInfo;
    try { tabInfo = await chrome.tabs.get(tabId); } catch (e) { return { ...link, status: "unknown", title: "" }; }
    const url = tabInfo.url || "";
    if (url.startsWith("chrome-error://")) {
      return { ...link, status: "dead", title: "Connection failed" };
    }
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({ title: document.title || "", ok: true }),
      });
      if (res && res.result && res.result.ok) {
        return { ...link, status: "alive", title: res.result.title.slice(0, 140) };
      }
    } catch (e) {
      // Injection blocked (store pages, restricted schemes) — the page may still
      // be alive, we just can't inspect it.
      if (!loaded) return { ...link, status: "unknown", title: "" };
      return { ...link, status: "unknown", title: tabInfo.title || "" };
    }
    return { ...link, status: "unknown", title: "" };
  } catch (e) {
    return { ...link, status: "dead", title: "Could not open" };
  } finally {
    if (tabId != null) { try { await chrome.tabs.remove(tabId); } catch (e) {} }
  }
}

async function startVerify() {
  if (running) return;
  const btn = $("start");
  running = true;
  btn.disabled = true; btn.textContent = "Verifying…";
  $("resCard").hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectLinks });
    const links = (res && res.result) || [];
    if (!links.length) throw new Error("no-links");
    $("empty").style.display = "none";
    $("progCard").hidden = false;
    results = [];
    for (let i = 0; i < links.length; i++) {
      const r = await verifyOne(links[i]);
      results.push(r);
      const pct = Math.round(((i + 1) / links.length) * 100);
      $("progLabel").textContent = `Checking ${i + 1} of ${links.length}…`;
      $("progPct").textContent = pct + "%";
      $("barFill").style.width = pct + "%";
    }
    $("progCard").hidden = true;
    renderResults();
    const { history = [] } = await chrome.storage.local.get("history");
    history.unshift({ at: Date.now(), host: $("pageHost").textContent, total: links.length, results });
    await chrome.storage.local.set({ history: history.slice(0, 10) });
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = e.message === "no-links"
      ? "No outbound links found on this page."
      : "Couldn’t read this page — it may restrict extensions (e.g. chrome:// pages).";
    $("progCard").hidden = true;
  } finally {
    running = false;
    btn.disabled = false; btn.textContent = "Verify links";
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderResults() {
  const card = $("resCard"), box = $("results");
  box.innerHTML = "";
  card.hidden = results.length === 0;
  const alive = results.filter((r) => r.status === "alive").length;
  const dead = results.filter((r) => r.status === "dead").length;
  $("resCount").textContent = `(${results.length} links · ${alive} alive · ${dead} dead)`;
  for (const r of results) {
    const row = document.createElement("div");
    row.className = "res-row";
    const st = document.createElement("span");
    st.className = "st " + r.status;
    st.textContent = r.status;
    const u = document.createElement("div");
    u.className = "u";
    let domain = "";
    try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch (e) {}
    const b = document.createElement("b");
    b.textContent = r.title || domain;
    b.title = r.title || r.url;
    const s = document.createElement("span");
    s.textContent = domain + (r.external ? "" : " · same site");
    s.title = r.url;
    u.append(b, s);
    const a = document.createElement("a");
    a.href = r.url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = "↗"; a.title = "Open link";
    row.append(st, u, a);
    box.appendChild(row);
  }
}

function exportCsv() {
  if (!results.length) return;
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [["url", "status", "page_title", "external"]]
    .concat(results.map((r) => [r.url, r.status, r.title || "", r.external ? "yes" : "no"]))
    .map((row) => row.map(q).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "citation-verification.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
