/* Popup logic: run the HTTPS hygiene check on click and render verdict,
 * per-check rows, and the insecure-subresource list. */

const $ = (id) => document.getElementById(id);
const checkBtn = $("check"), clearBtn = $("clear");
const verdictEl = $("verdict"), checksEl = $("checks");
const insecureWrap = $("insecure"), insecureList = $("insecureList"), emptyEl = $("empty");

const ICONS = {
  ok: '<svg class="icon ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
  warn: '<svg class="icon warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  bad: '<svg class="icon bad" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
};

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function render(data) {
  const { pageUrl, pageIsHttps, insecure, total } = data;
  checksEl.innerHTML = "";
  insecureList.innerHTML = "";

  const rows = [];
  // Check 1: scheme
  rows.push({
    status: pageIsHttps ? "ok" : "bad",
    title: pageIsHttps ? "Page served over HTTPS" : "Page NOT served over HTTPS",
    desc: pageIsHttps
      ? "The address bar URL uses the https:// scheme."
      : "The page itself is loaded over plain HTTP. Treat logins and forms here with care."
  });
  // Check 2: mixed content
  const mcStatus = !pageIsHttps ? "warn" : total === 0 ? "ok" : "bad";
  rows.push({
    status: mcStatus,
    title: total === 0 ? "No insecure subresources found" : total + " insecure subresource" + (total > 1 ? "s" : "") + " found",
    desc: !pageIsHttps
      ? "Mixed-content scan only applies to HTTPS pages."
      : total === 0
        ? "Scanned scripts, images, styles, frames, and media — all use https://."
        : "These load over http:// on an HTTPS page and may be blocked or tampered with."
  });
  // Check 3: disclosure of limits
  rows.push({
    status: "warn",
    title: "TLS details not visible to extensions",
    desc: "Cipher suites, certificate chains, and HSTS headers cannot be read by extensions. This is a hygiene check, not an SSL grade."
  });

  // Verdict
  let vClass = "ok", vTitle = "Looks clean", vDesc = "HTTPS page with no insecure subresources found.";
  if (!pageIsHttps) { vClass = "bad"; vTitle = "Not HTTPS"; vDesc = "This page is served over plain HTTP."; }
  else if (total > 0) { vClass = "bad"; vTitle = "Mixed content found"; vDesc = total + " http:// subresource(s) on an HTTPS page."; }
  verdictEl.className = "verdict " + vClass;
  verdictEl.innerHTML = '<span class="dot"></span><div><div class="vt">' + vTitle +
    '</div><div class="vd">' + vDesc + '</div></div>';
  verdictEl.classList.remove("hidden");

  checksEl.classList.remove("hidden");
  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "check";
    div.innerHTML = ICONS[r.status] + '<div><div class="ct">' + r.title +
      '</div><div class="cd">' + r.desc + '</div></div>';
    checksEl.appendChild(div);
  }

  if (total > 0) {
    insecureWrap.classList.remove("hidden");
    for (const item of insecure) {
      const d = document.createElement("div");
      d.className = "li";
      const kind = document.createElement("div");
      kind.className = "kind";
      kind.textContent = item.kind;
      const url = document.createElement("div");
      url.textContent = item.url;
      d.append(kind, url);
      insecureList.appendChild(d);
    }
    if (total > insecure.length) {
      const more = document.createElement("div");
      more.className = "li";
      more.textContent = "…and " + (total - insecure.length) + " more (list capped at 40).";
      insecureList.appendChild(more);
    }
  } else {
    insecureWrap.classList.add("hidden");
  }
  emptyEl.classList.add("hidden");
}

checkBtn.addEventListener("click", async () => {
  checkBtn.disabled = true;
  try {
    const tab = await activeTab();
    if (!tab || !tab.url) throw new Error("No active tab.");
    if (!/^https?:\/\//i.test(tab.url)) throw new Error("Internal pages (chrome://, about:) cannot be checked.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const res = await chrome.tabs.sendMessage(tab.id, { type: "HTTPS_SCAN" });
    if (!res || !res.ok) throw new Error((res && res.error) || "Check failed.");
    render(res.data);
  } catch (e) {
    emptyEl.textContent = "Could not check: " + (e.message || e);
    emptyEl.classList.remove("hidden");
    verdictEl.classList.add("hidden");
    checksEl.classList.add("hidden");
    insecureWrap.classList.add("hidden");
  } finally {
    checkBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  verdictEl.classList.add("hidden");
  checksEl.classList.add("hidden");
  insecureWrap.classList.add("hidden");
  emptyEl.innerHTML = "Click <strong>Check this tab</strong> to run the hygiene check.";
  emptyEl.classList.remove("hidden");
});
