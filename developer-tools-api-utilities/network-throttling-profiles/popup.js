// Network Throttling Profiles — popup logic (measurement only; nothing is throttled).
// collectTimings() is injected into the page; keep it self-contained.

function collectTimings() {
  const entries = performance.getEntriesByType("resource") || [];
  const nav = (performance.getEntriesByType("navigation") || [])[0] || null;
  const resources = entries.map((e) => ({
    name: e.name || "",
    type: e.initiatorType || "other",
    size: e.transferSize || 0,
    duration: e.duration || 0,
    dns: Math.max(0, (e.domainLookupEnd || 0) - (e.domainLookupStart || 0)),
    connect: Math.max(0, (e.connectEnd || 0) - (e.connectStart || 0)),
    ttfb: Math.max(0, (e.responseStart || 0) - (e.requestStart || 0)),
    download: Math.max(0, (e.responseEnd || 0) - (e.responseStart || 0)),
  }));
  return {
    nav: nav ? {
      domContentLoaded: nav.domContentLoadedEventEnd || 0,
      load: nav.loadEventEnd || 0,
      encoded: nav.encodedBodySize || 0,
    } : null,
    resources,
  };
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("measure").addEventListener("click", measure);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, "") + " · measurement only"; } catch (e) {}
  }
  const { lastReport } = await chrome.storage.local.get("lastReport");
  if (lastReport) render(lastReport);
}

async function measure() {
  const btn = $("measure");
  btn.disabled = true; btn.textContent = "Measuring…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) throw new Error("bad-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectTimings });
    const report = res && res.result;
    if (!report) throw new Error("no-data");
    report.at = Date.now();
    await chrome.storage.local.set({ lastReport: report });
    render(report);
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Can’t measure this page — try a regular <b>http(s)</b> page, not a store or system tab.";
  } finally {
    btn.disabled = false; btn.textContent = "Measure this page";
  }
}

function fmtSize(b) {
  if (!b) return "—";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}
function fmtMs(ms) {
  if (ms == null || isNaN(ms)) return "—";
  return ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : Math.round(ms) + " ms";
}
function shortName(url) {
  try {
    const u = new URL(url);
    const path = (u.pathname + u.search).slice(0, 60);
    return u.hostname + (path === "/" ? "" : path);
  } catch (e) { return (url || "").slice(-60); }
}

function render(report) {
  $("empty").style.display = "none";
  $("results").hidden = false;
  const rs = report.resources || [];
  const totalSize = rs.reduce((a, r) => a + (r.size || 0), 0);
  $("stReq").textContent = rs.length;
  $("stSize").textContent = fmtSize(totalSize);
  $("stDom").textContent = report.nav ? fmtMs(report.nav.domContentLoaded) : "—";
  $("stLoad").textContent = report.nav ? fmtMs(report.nav.load) : "—";

  // breakdown: average of each phase across resources that reported it
  const phases = [["DNS", "dns"], ["Connect", "connect"], ["TTFB", "ttfb"], ["Download", "download"]];
  const box = $("breakdown");
  box.innerHTML = "";
  const avgs = phases.map(([label, key]) => {
    const vals = rs.map((r) => r[key]).filter((v) => v > 0);
    return { label, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
  });
  const max = Math.max(...avgs.map((a) => a.avg), 1);
  for (const { label, avg } of avgs) {
    const row = document.createElement("div");
    row.className = "bd-row";
    const lbl = document.createElement("div");
    lbl.className = "lbl";
    lbl.innerHTML = `<span>${label}</span><b>${avg ? fmtMs(avg) : "—"}</b>`;
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = Math.max(2, (avg / max) * 100) + "%";
    bar.appendChild(fill);
    row.append(lbl, bar);
    box.appendChild(row);
  }

  // slowest resources
  const slow = $("slowest");
  slow.innerHTML = "";
  const top = [...rs].sort((a, b) => b.duration - a.duration).slice(0, 10);
  if (!top.length) {
    slow.innerHTML = '<p class="note">No resource timings captured for this page.</p>';
    return;
  }
  const maxD = Math.max(...top.map((r) => r.duration), 1);
  for (const r of top) {
    const el = document.createElement("div");
    el.className = "res";
    const topRow = document.createElement("div");
    topRow.className = "top";
    const nm = document.createElement("div");
    nm.className = "nm"; nm.textContent = shortName(r.name); nm.title = r.name;
    const tm = document.createElement("div");
    tm.className = "tm"; tm.textContent = fmtMs(r.duration);
    topRow.append(nm, tm);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span class="type">${esc(r.type)}</span><span>${fmtSize(r.size)} transferred</span><span>TTFB ${fmtMs(r.ttfb)}</span>`;
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = Math.max(2, (r.duration / maxD) * 100) + "%";
    bar.appendChild(fill);
    el.append(topRow, meta, bar);
    slow.appendChild(el);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
