/* Popup logic: inject content engine on click, render a horizontal timeline
 * bar chart plus a per-host list with load durations. */

const $ = (id) => document.getElementById(id);
const scanBtn = $("scan"), clearBtn = $("clear");
const metaEl = $("meta"), timelineEl = $("timeline"), listEl = $("list"), emptyEl = $("empty");

function fmtMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  return ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : ms.toFixed(0) + " ms";
}

function shortHost(host) {
  return host.length > 24 ? host.slice(0, 22) + "…" : host;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function guardPage(tab) {
  if (!tab || !tab.url) return "No active tab.";
  if (!/^https?:\/\//i.test(tab.url)) return "Internal pages (chrome://, about:) cannot be scanned.";
  return null;
}

function render(data) {
  const { pageHost, scripts } = data;
  listEl.innerHTML = "";
  timelineEl.innerHTML = "";

  metaEl.innerHTML = "";
  metaEl.classList.remove("hidden");
  const pills = [
    ["Page", pageHost || "—"],
    ["3rd-party scripts", "<b>" + scripts.length + "</b>"],
    ["Total load", "<b>" + fmtMs(scripts.reduce((s, x) => s + (x.durationMs || 0), 0)) + "</b>"]
  ];
  for (const [label, val] of pills) {
    const span = document.createElement("span");
    span.className = "pill";
    span.innerHTML = label + ": " + val;
    metaEl.appendChild(span);
  }

  if (!scripts.length) {
    timelineEl.classList.add("hidden");
    emptyEl.textContent = "No third-party scripts found in this tab's resource timing.";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  // Timeline: normalize against the full span of start→end.
  const min = Math.min(...scripts.map((s) => s.startMs));
  const max = Math.max(...scripts.map((s) => s.startMs + s.durationMs));
  const span = Math.max(max - min, 1);

  timelineEl.classList.remove("hidden");
  const frag = document.createDocumentFragment();
  for (const s of scripts.slice(0, 25)) {
    const row = document.createElement("div");
    row.className = "trow";
    const label = document.createElement("div");
    label.className = "tlabel";
    label.textContent = shortHost(s.host);
    label.title = s.host;
    const track = document.createElement("div");
    track.className = "ttrack";
    const bar = document.createElement("div");
    bar.className = "tbar";
    const left = ((s.startMs - min) / span) * 100;
    const width = Math.max((s.durationMs / span) * 100, 1.5);
    bar.style.left = left.toFixed(2) + "%";
    bar.style.width = width.toFixed(2) + "%";
    track.appendChild(bar);
    const ms = document.createElement("div");
    ms.className = "tms";
    ms.textContent = fmtMs(s.durationMs);
    row.append(label, track, ms);
    frag.appendChild(row);
  }
  timelineEl.appendChild(frag);

  // Per-host list.
  const byHost = new Map();
  for (const s of scripts) {
    const cur = byHost.get(s.host) || { count: 0, total: 0, worst: 0, url: s.url };
    cur.count += 1; cur.total += s.durationMs || 0;
    cur.worst = Math.max(cur.worst, s.durationMs || 0);
    byHost.set(s.host, cur);
  }
  const rows = [...byHost.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [host, info] of rows) {
    const item = document.createElement("div");
    item.className = "item";
    const h = document.createElement("div");
    h.className = "host";
    h.textContent = host;
    const r = document.createElement("div");
    r.className = "row";
    r.innerHTML = "<span>" + info.count + " script" + (info.count > 1 ? "s" : "") +
      " · slowest " + fmtMs(info.worst) + "</span><b>" + fmtMs(info.total) + "</b>";
    item.append(h, r);
    listEl.appendChild(item);
  }
}

scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning…";
  try {
    const tab = await activeTab();
    const blocked = guardPage(tab);
    if (blocked) throw new Error(blocked);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const res = await chrome.tabs.sendMessage(tab.id, { type: "TPS_SCAN" });
    if (!res || !res.ok) throw new Error((res && res.error) || "Scan failed.");
    render(res.data);
  } catch (e) {
    emptyEl.textContent = "Could not scan: " + (e.message || e);
    emptyEl.classList.remove("hidden");
    timelineEl.classList.add("hidden");
    metaEl.classList.add("hidden");
  } finally {
    scanBtn.disabled = false;
    scanBtn.innerHTML = "Scan this tab";
  }
});

clearBtn.addEventListener("click", () => {
  listEl.innerHTML = "";
  timelineEl.innerHTML = "";
  metaEl.classList.add("hidden");
  timelineEl.classList.add("hidden");
  emptyEl.innerHTML = "Click <strong>Scan this tab</strong> to list third-party scripts and their load times.";
  emptyEl.classList.remove("hidden");
});
