// Unsubscribed Domain Warner — popup logic: manage blocklist, block current site.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("blockThis").addEventListener("click", blockCurrentSite);
  $("addBtn").addEventListener("click", addManual);
  $("manual").addEventListener("keydown", (e) => { if (e.key === "Enter") addManual(); });
  $("enabled").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
  });
  const host = await currentHost();
  $("pageHost").textContent = host || "This page";
  const btn = $("blockThis");
  if (!host) { btn.disabled = true; btn.textContent = "Can't block this page"; }
  else {
    const { blocklist = [] } = await chrome.storage.local.get("blocklist");
    if (matchesBlocklist(host, blocklist)) { btn.disabled = true; btn.textContent = "Already blocked"; }
  }
  const { enabled = true } = await chrome.storage.local.get("enabled");
  $("enabled").checked = enabled;
  render();
}

async function currentHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:/.test(tab.url)) return null;
    return new URL(tab.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (e) { return null; }
}

function normalizeDomain(raw) {
  let d = (raw || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0].split(":")[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null;
}

function matchesBlocklist(host, list) {
  return list.some((d) => host === d || host.endsWith("." + d));
}

async function addDomain(domain) {
  const { blocklist = [] } = await chrome.storage.local.get("blocklist");
  if (!blocklist.includes(domain)) {
    blocklist.push(domain);
    blocklist.sort();
    await chrome.storage.local.set({ blocklist: blocklist.slice(0, 500) });
  }
  render();
}

async function blockCurrentSite() {
  const host = await currentHost();
  if (!host) return;
  await addDomain(host);
  const btn = $("blockThis");
  btn.disabled = true; btn.textContent = "Blocked ✓";
}

async function addManual() {
  const d = normalizeDomain($("manual").value);
  if (!d) { $("manual").focus(); return; }
  $("manual").value = "";
  await addDomain(d);
}

async function render() {
  const { blocklist = [] } = await chrome.storage.local.get("blocklist");
  $("count").textContent = blocklist.length;
  const box = $("list");
  box.innerHTML = "";
  if (!blocklist.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "Blocklist is empty — nothing will trigger a warning.";
    box.appendChild(d);
    return;
  }
  for (const d of blocklist) {
    const row = document.createElement("div");
    row.className = "dom-row";
    const name = document.createElement("div");
    name.className = "d"; name.textContent = d; name.title = d;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Remove";
    x.addEventListener("click", async () => {
      const { blocklist: cur = [] } = await chrome.storage.local.get("blocklist");
      await chrome.storage.local.set({ blocklist: cur.filter((i) => i !== d) });
      const host = await currentHost();
      const btn = $("blockThis");
      if (host && !matchesBlocklist(host, cur.filter((i) => i !== d))) {
        btn.disabled = false; btn.textContent = "Block this site";
      }
      render();
    });
    row.append(name, x);
    box.appendChild(row);
  }
}
