// Job Board Insight Overlay — popup logic. Scanner runs only on the viewed page.

// Injected into the active tab; must be fully self-contained.
function extractJobs() {
  const SALARY_RE = /([$€£₹]\s?[\d,.]+[kK]?|\d+(?:\.\d+)?\s?(?:LPA|lakh|Lakh|k|K)\b)/;
  const jobs = [];
  const seen = new Set();
  const anchors = Array.from(document.querySelectorAll("a[href]")).filter((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    return /job|vacancy|position|career/.test(href) && (a.innerText || "").trim().length > 2;
  });
  for (const a of anchors) {
    let node = a;
    for (let i = 0; i < 3 && node && node !== document.body; i++) node = node.parentElement;
    const box = node || a;
    const url = a.href.split("?")[0];
    if (seen.has(url)) continue;
    seen.add(url);
    const title = (a.innerText || a.textContent || "").trim().split("\n")[0].slice(0, 120);
    const boxText = (box.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const titleIdx = boxText.findIndex((l) => title && l.includes(title.slice(0, 25)));
    const rest = boxText.filter((_, i) => i !== titleIdx);
    const company = rest[0] ? rest[0].slice(0, 80) : "";
    const location = rest.find((l) => /remote|hybrid|,/.test(l)) ? rest.find((l) => /remote|hybrid|,/.test(l)).slice(0, 80) : "";
    const salaryMatch = (box.innerText || "").match(SALARY_RE);
    jobs.push({ title, company, location, salary: salaryMatch ? salaryMatch[0] : "", url });
    if (jobs.length >= 60) break;
  }
  return { host: location.hostname, jobs };
}

const $ = (id) => document.getElementById(id);
let lastScan = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("filter").addEventListener("input", () => render(lastScan));
  $("export").addEventListener("click", exportCsv);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true;
  btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobs });
    const { host, jobs } = (res && res.result) || { host: "", jobs: [] };
    lastScan = jobs;
    // mark new-since-last-visit
    const key = "seen_" + host.replace(/\W+/g, "_");
    const { [key]: seenBefore = [] } = await chrome.storage.local.get(key);
    const seenSet = new Set(seenBefore);
    let newCount = 0;
    for (const j of lastScan) {
      const id = j.url + "|" + j.title;
      j.isNew = !seenSet.has(id);
      if (j.isNew) newCount++;
      seenSet.add(id);
    }
    await chrome.storage.local.set({ [key]: Array.from(seenSet).slice(-500) });
    $("newCount").hidden = newCount === 0;
    $("newCount").textContent = newCount ? `${newCount} new` : "";
    $("export").hidden = lastScan.length === 0;
    render(lastScan);
  } catch (e) {
    $("rows").innerHTML = `<div class="empty">Couldn't scan this page — try a job search results page on a regular job board.</div>`;
    $("count").textContent = "Scan failed";
  } finally {
    btn.disabled = false;
    btn.textContent = "Scan page";
  }
}

function render(jobs) {
  const terms = $("filter").value.toLowerCase().split(/\s+/).filter(Boolean);
  const box = $("rows");
  box.innerHTML = "";
  const filtered = jobs.filter((j) => {
    if (!terms.length) return true;
    const hay = `${j.title} ${j.company} ${j.location}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  $("count").textContent = jobs.length
    ? `${filtered.length} of ${jobs.length} listings`
    : "No job cards found on this page";
  if (!filtered.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = jobs.length ? "No listings match your filter." : "Hit “Scan page” on a job board search page.";
    box.appendChild(d);
    return;
  }
  for (const j of filtered) {
    const a = document.createElement("a");
    a.className = "job" + (j.isNew ? " is-new" : "");
    a.href = j.url;
    a.target = "_blank";
    a.rel = "noopener";
    const t = document.createElement("div");
    t.className = "t";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.title = "New since last scan";
    const tt = document.createElement("span");
    tt.textContent = j.title || "(untitled listing)";
    t.append(dot, tt);
    const c = document.createElement("div");
    c.className = "c";
    c.textContent = [j.company, j.location].filter(Boolean).join(" · ");
    a.append(t);
    if (c.textContent) a.append(c);
    if (j.salary) {
      const s = document.createElement("div");
      s.className = "s";
      s.textContent = j.salary;
      a.append(s);
    }
    box.appendChild(a);
  }
}

function exportCsv() {
  const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
  const csv = [
    ["title", "company", "location", "salary", "url", "new"],
    ...lastScan.map((j) => [j.title, j.company, j.location, j.salary, j.url, j.isNew ? "yes" : "no"]),
  ].map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "job-board-scan.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
