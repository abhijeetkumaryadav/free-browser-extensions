// HTML Validation Badge — popup logic.
// Serializes the active tab's DOM and runs best-effort on-device checks.

const $ = (id) => document.getElementById(id);

// Runs IN the page. Must stay self-contained — no outside references.
function scanPage() {
  const issues = [];
  const push = (sev, title, detail) => issues.push({ sev, title, detail });

  // 1. images missing alt
  const badImgs = Array.prototype.filter.call(document.images, (img) => {
    const a = img.getAttribute("alt");
    return a === null || a.trim() === "";
  });
  if (badImgs.length) {
    push("error",
      badImgs.length + " image" + (badImgs.length > 1 ? "s" : "") + " missing alt text",
      badImgs.slice(0, 5).map((i) => (i.getAttribute("src") || "(no src)").slice(0, 64)).join("\n"));
  }

  // 2. duplicate IDs
  const seen = Object.create(null);
  const dups = [];
  Array.prototype.forEach.call(document.querySelectorAll("[id]"), (el) => {
    if (seen[el.id]) { if (dups.indexOf(el.id) < 0) dups.push(el.id); }
    else seen[el.id] = 1;
  });
  if (dups.length) {
    push("error", dups.length + " duplicate id" + (dups.length > 1 ? "s" : ""),
      dups.slice(0, 8).join(", "));
  }

  // 3. lang attribute
  if (!document.documentElement.getAttribute("lang")) {
    push("warning", "Missing lang attribute", "<html> has no lang — hurts screen readers and SEO");
  }

  // 4. title
  if (!(document.title || "").trim()) {
    push("warning", "Missing or empty <title>", "Every page needs a descriptive title");
  }

  // 5. empty links
  const emptyLinks = Array.prototype.filter.call(document.querySelectorAll("a[href]"), (a) =>
    !a.textContent.trim() && !a.getAttribute("aria-label") && !a.querySelector("img,svg"));
  if (emptyLinks.length) {
    push("warning", emptyLinks.length + " empty link" + (emptyLinks.length > 1 ? "s" : ""),
      "Links with no text, aria-label, or image content");
  }

  // 6. empty buttons
  const emptyBtns = Array.prototype.filter.call(document.querySelectorAll("button"), (b) =>
    !b.textContent.trim() && !b.getAttribute("aria-label") && !b.querySelector("img,svg"));
  if (emptyBtns.length) {
    push("warning", emptyBtns.length + " empty button" + (emptyBtns.length > 1 ? "s" : ""),
      "Buttons with no accessible name");
  }

  // 7. viewport + 8. meta description
  if (!document.querySelector('meta[name="viewport"]')) {
    push("info", "No viewport meta tag", "Recommended for mobile rendering");
  }
  if (!document.querySelector('meta[name="description"]')) {
    push("info", "No meta description", "Recommended for search result snippets");
  }

  // 9. tag balance — best-effort comparison on the serialized DOM
  const html = document.documentElement.outerHTML;
  const tags = ["div","span","p","a","li","ul","ol","table","tr","td","th","section","article",
    "header","footer","main","nav","button","form","h1","h2","h3","select","option","label"];
  const mism = [];
  for (const tag of tags) {
    const open = (html.match(new RegExp("<" + tag + "[\\s>]", "gi")) || []).length;
    const close = (html.match(new RegExp("</" + tag + "\\s*>", "gi")) || []).length;
    if (open !== close) mism.push("<" + tag + "> " + open + " open / " + close + " close");
  }
  if (mism.length) {
    push("warning", "Possible tag mismatches (best-effort)", mism.slice(0, 6).join("\n"));
  }

  return {
    url: location.href,
    host: location.hostname.replace(/^www\./, ""),
    title: document.title || "(untitled)",
    issues,
  };
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", runScan);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  renderRecent();
}

async function runScan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanPage });
    if (!res || !res.result) throw new Error("no-result");
    renderResult(res.result);
    // remember in history
    const { history = [] } = await chrome.storage.local.get("history");
    const r = res.result;
    const score = scoreOf(r.issues);
    history.unshift({ host: r.host, title: r.title, score, at: Date.now(),
      err: count(r.issues, "error"), wrn: count(r.issues, "warning") });
    await chrome.storage.local.set({ history: history.slice(0, 10) });
    renderRecent();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t scan this page — try a regular http(s) page.";
  } finally {
    btn.disabled = false; btn.textContent = "Validate";
  }
}

function count(issues, sev) { return issues.filter((i) => i.sev === sev).length; }

function scoreOf(issues) {
  const s = 100 - 8 * count(issues, "error") - 4 * count(issues, "warning") - 1 * count(issues, "info");
  return Math.max(0, Math.min(100, s));
}

function verdictOf(score) {
  if (score >= 90) return ["Excellent", "This page is in great shape.", "#4ade80"];
  if (score >= 75) return ["Good", "A few things worth fixing.", "#a3e635"];
  if (score >= 55) return ["Needs work", "Several issues found below.", "#f5a623"];
  return ["Poor", "This page needs attention.", "#f06666"];
}

function renderResult(r) {
  $("empty").style.display = "none";
  $("results").hidden = false;
  const score = scoreOf(r.issues);
  const [verdict, sub, color] = verdictOf(score);
  $("scoreNum").textContent = score;
  const ring = $("ringProg");
  const C = 2 * Math.PI * 52;
  ring.style.strokeDasharray = C.toFixed(1);
  ring.style.strokeDashoffset = (C * (1 - score / 100)).toFixed(1);
  ring.style.stroke = color;
  $("verdict").innerHTML = "";
  const v = document.createElement("div"); v.textContent = verdict; v.style.color = color;
  const sm = document.createElement("small"); sm.textContent = r.title + " · " + sub;
  $("verdict").append(v, sm);
  $("cErr").textContent = count(r.issues, "error");
  $("cWrn").textContent = count(r.issues, "warning");
  $("cInf").textContent = count(r.issues, "info");

  const groups = $("groups");
  groups.innerHTML = "";
  const order = [["error", "Errors"], ["warning", "Warnings"], ["info", "Notices"]];
  let any = false;
  for (const [sev, label] of order) {
    const items = r.issues.filter((i) => i.sev === sev);
    if (!items.length) continue;
    any = true;
    const g = document.createElement("div");
    g.className = "grp " + (sev === "error" ? "err" : sev === "warning" ? "wrn" : "inf");
    const h = document.createElement("h3");
    h.innerHTML = escapeHtml(label) + ' <span class="n">' + items.length + "</span>";
    g.appendChild(h);
    for (const it of items) {
      const d = document.createElement("div");
      d.className = "issue";
      const b = document.createElement("b"); b.textContent = it.title;
      d.appendChild(b);
      if (it.detail) {
        const sp = document.createElement("span"); sp.textContent = it.detail;
        d.appendChild(sp);
      }
      g.appendChild(d);
    }
    groups.appendChild(g);
  }
  if (!any) {
    const d = document.createElement("div");
    d.className = "issue";
    d.innerHTML = "<b>No issues found 🎉</b>";
    groups.appendChild(d);
  }
}

async function renderRecent() {
  const { history = [] } = await chrome.storage.local.get("history");
  const card = $("recentCard"), box = $("recent");
  box.innerHTML = "";
  card.hidden = history.length === 0;
  for (const h of history) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div"); t.className = "h";
    t.textContent = h.host;
    const sp = document.createElement("span");
    sp.textContent = new Date(h.at).toLocaleString() + ` · ${h.err} err / ${h.wrn} warn`;
    t.appendChild(sp);
    const s = document.createElement("div"); s.className = "s";
    s.textContent = h.score;
    s.style.color = h.score >= 90 ? "#4ade80" : h.score >= 55 ? "#f5a623" : "#f06666";
    row.append(t, s);
    box.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
