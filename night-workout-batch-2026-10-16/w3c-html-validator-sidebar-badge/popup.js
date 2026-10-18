// popup.js — runs lintPage() in the active tab on click; shows badge count.
const siteLabel = document.getElementById("siteLabel");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const issueCountEl = document.getElementById("issueCount");
const issueListEl = document.getElementById("issueList");

function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (cls ? " " + cls : "");
}
function isHttpUrl(url) { return /^https?:\/\//i.test(url || ""); }

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Serialize the lint engine from content.js by importing its source text.
// We inject the file itself so the function is defined in-page, then call it.
async function runLint(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (typeof lintPage === "function" ? lintPage() : [{ rule: "no-engine", severity: "err", detail: "Lint engine failed to load." }])
  });
  return res.result || [];
}

function renderIssues(issues) {
  resultsEl.classList.remove("hidden");
  issueCountEl.textContent = issues.length;
  issueListEl.innerHTML = "";
  if (!issues.length) {
    const li = document.createElement("li");
    li.innerHTML = '<span class="tag" style="background:rgba(52,211,153,.18);color:#6ee7b7">pass</span> No issues found by the heuristic checks.';
    issueListEl.appendChild(li);
    return;
  }
  for (const it of issues) {
    const li = document.createElement("li");
    const tag = document.createElement("span");
    tag.className = "tag " + (it.severity === "err" ? "err" : "warn");
    tag.textContent = it.severity === "err" ? "error" : "warning";
    li.appendChild(tag);
    li.appendChild(document.createTextNode(it.rule));
    const d = document.createElement("span");
    d.className = "detail";
    d.textContent = it.detail;
    li.appendChild(d);
    issueListEl.appendChild(li);
  }
}

async function setBadge(count) {
  const tab = await currentTab();
  if (!tab) return;
  await chrome.action.setBadgeText({ tabId: tab.id, text: count > 0 ? String(Math.min(count, 99)) : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#f59e0b" });
}

document.getElementById("scanBtn").addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    if (!tab || !isHttpUrl(tab.url)) { setStatus("Open a normal web page first.", "err"); return; }
    setStatus("Scanning…");
    const issues = await runLint(tab.id);
    renderIssues(issues);
    await setBadge(issues.length);
    setStatus("Scan complete: " + issues.length + " issue(s).", "ok");
  } catch (e) {
    setStatus(String(e.message || e), "err");
  }
});

document.getElementById("clearBtn").addEventListener("click", async () => {
  const tab = await currentTab();
  if (tab) await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  resultsEl.classList.add("hidden");
  setStatus("Badge cleared.", "ok");
});

(async () => {
  const tab = await currentTab();
  siteLabel.textContent = tab && isHttpUrl(tab.url) ? new URL(tab.url).hostname : "No web page active";
})();
