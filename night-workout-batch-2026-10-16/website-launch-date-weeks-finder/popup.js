/* Site Age Tracker — popup logic.
 * Stores user-recorded launch dates in chrome.storage.local and renders
 * each site's age in weeks + remaining days. Cannot discover real dates. */
"use strict";

const STORAGE_KEY = "siteAgeTracker.sites";

/** Load all tracked sites as an object: { domain: "YYYY-MM-DD" } */
async function loadSites() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function saveSites(sites) {
  await chrome.storage.local.set({ [STORAGE_KEY]: sites });
}

/** Normalize a user-typed domain: trim, strip scheme/www, lowercase. */
function normalizeDomain(raw) {
  let d = (raw || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0];
  return d;
}

/** Whole days between a YYYY-MM-DD launch date and now. */
function daysSince(launchDate) {
  const start = new Date(launchDate + "T00:00:00");
  const now = new Date();
  const ms = now - start;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function formatAge(totalDays) {
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const weekWord = weeks === 1 ? "week" : "weeks";
  const dayWord = days === 1 ? "day" : "days";
  return { line1: `${weeks} ${weekWord}`, line2: `+ ${days} ${dayWord}` };
}

function formatDate(iso) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso; }
}

/** Render the site list, optionally filtered by a search string. */
async function render(filter = "") {
  const sites = await loadSites();
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");
  list.innerHTML = "";

  const entries = Object.entries(sites)
    .filter(([domain]) => domain.includes(filter.trim().toLowerCase()))
    .sort((a, b) => b[1].localeCompare(a[1])); // newest launch first

  count.textContent = entries.length ? `(${entries.length})` : "";

  if (!entries.length) {
    empty.hidden = false;
    empty.textContent = filter.trim()
      ? "No sites match your search."
      : "No sites yet. Add your first launch date above.";
    return;
  }
  empty.hidden = true;

  for (const [domain, launchDate] of entries) {
    const days = daysSince(launchDate);
    const age = formatAge(days);

    const li = document.createElement("li");

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "domain";
    name.textContent = domain;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Launched ${formatDate(launchDate)} · ${days} days ago`;
    info.append(name, meta);

    const ageBox = document.createElement("div");
    ageBox.className = "age";
    const big = document.createElement("b");
    big.textContent = age.line1;
    const small = document.createElement("span");
    small.textContent = age.line2;
    ageBox.append(big, small);

    const del = document.createElement("button");
    del.className = "icon";
    del.title = `Remove ${domain}`;
    del.setAttribute("aria-label", `Remove ${domain}`);
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';
    del.addEventListener("click", async () => {
      const current = await loadSites();
      delete current[domain];
      await saveSites(current);
      render(document.getElementById("search").value);
    });

    li.append(info, ageBox, del);
    list.appendChild(li);
  }
}

function showError(msg) {
  const el = document.getElementById("formErr");
  el.textContent = msg;
  el.hidden = !msg;
}

async function addSite() {
  const domain = normalizeDomain(document.getElementById("domain").value);
  const launchDate = document.getElementById("launchDate").value;

  if (!domain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    showError("Enter a valid domain, e.g. example.com");
    return;
  }
  if (!launchDate) {
    showError("Pick the launch date you recorded.");
    return;
  }
  if (new Date(launchDate + "T00:00:00") > new Date()) {
    showError("Launch date is in the future — pick a past date.");
    return;
  }

  const sites = await loadSites();
  sites[domain] = launchDate;
  await saveSites(sites);

  document.getElementById("domain").value = "";
  document.getElementById("launchDate").value = "";
  showError("");
  render(document.getElementById("search").value);
}

document.getElementById("addBtn").addEventListener("click", addSite);
document.getElementById("domain").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});
document.getElementById("search").addEventListener("input", (e) => render(e.target.value));

render();
