// XING to LinkedIn Bridge — popup logic.
// NOTE: extractXingProfile() is injected into the page via chrome.scripting,
// so it must stay fully self-contained (no references to popup scope).

/**
 * Reads the public profile fields of the XING profile the user is viewing.
 * Best-effort: combines Open Graph meta tags, JSON-LD Person data, and
 * common DOM patterns. Only reads what is already visible on the page.
 */
function extractXingProfile() {
  function metaContent(sel) {
    const el = document.querySelector(sel);
    return el ? (el.getAttribute("content") || "").trim() : "";
  }
  function stripXing(t) {
    return t.replace(/\s*[-–|]\s*XING.*$/i, "").trim();
  }

  let name = stripXing(metaContent('meta[property="og:title"]') || document.title || "");
  const description =
    metaContent('meta[name="description"]') ||
    metaContent('meta[property="og:description"]') ||
    "";
  let headline = "";
  let company = "";
  let location = "";

  // 1) JSON-LD Person — the most reliable structured source.
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      let data;
      try {
        data = JSON.parse(s.textContent);
      } catch (err) {
        continue;
      }
      const nodes = Array.isArray(data)
        ? data
        : data["@graph"]
          ? data["@graph"]
          : [data];
      for (const n of nodes) {
        if (!n || !/Person/i.test(n["@type"] || "")) continue;
        if (!name && n.name) name = String(n.name).trim();
        if (!headline && n.jobTitle) headline = String(n.jobTitle).trim();
        const org = n.worksFor || n.affiliation;
        if (!company && org) company = String(org.name || org).trim();
        const loc = n.homeLocation || n.address;
        if (!location && loc)
          location = String(loc.name || loc.addressLocality || "").trim();
      }
    }
  } catch (e) {
    /* best-effort: ignore structured-data errors */
  }

  // 2) DOM fallbacks.
  if (!name) {
    const h1 = document.querySelector("h1");
    if (h1) name = stripXing(h1.innerText.trim().split("\n")[0]);
  }
  if (!headline) {
    const el = document.querySelector(
      '[class*="headline" i], [class*="occupation" i], [class*="job-title" i]'
    );
    if (el) headline = el.innerText.trim().split("\n")[0];
  }

  // 3) Split "Job title bei Company" style headlines (common on XING).
  if (!company && /\sbei\s/i.test(headline)) {
    const parts = headline.split(/\s+bei\s+/i);
    headline = parts[0].trim();
    company = parts.slice(1).join(" bei ").trim();
  }
  if (!location) {
    const m = (headline + " " + description).match(
      /\bin\s+([A-ZÀ-Þ][\wÀ-Þà-þ.'\- ]{1,40}?)(?:\.|,|$)/
    );
    if (m) location = m[1].trim();
  }

  return {
    name,
    headline,
    company,
    location,
    url: window.location ? window.location.href : "",
  };
}

const $ = (id) => document.getElementById(id);
let profile = null;

document.addEventListener("DOMContentLoaded", () => {
  $("readBtn").addEventListener("click", readProfile);
  $("searchBtn").addEventListener("click", openLinkedInSearch);
  $("copyBtn").addEventListener("click", copySummary);
});

async function readProfile() {
  const btn = $("readBtn");
  btn.disabled = true;
  btn.textContent = "Reading profile…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractXingProfile,
    });
    profile = (res && res.result) || null;
    render();
  } catch (e) {
    profile = null;
    render();
  } finally {
    btn.disabled = false;
    btn.textContent = "Read this XING profile";
  }
}

function render() {
  const ok = profile && profile.name;
  $("card").hidden = !ok;
  $("emptyState").hidden = ok;
  if (!ok) return;
  $("fName").textContent = profile.name || "—";
  $("fHeadline").textContent = profile.headline || "—";
  $("fCompany").textContent = profile.company || "—";
  $("fLocation").textContent = profile.location || "—";
  const link = $("profileUrl");
  link.textContent = profile.url || "—";
  link.href = profile.url || "#";
}

function linkedinSearchUrl() {
  const keywords = [profile.name, profile.company].filter(Boolean).join(" ");
  return (
    "https://www.linkedin.com/search/results/people/?keywords=" +
    encodeURIComponent(keywords)
  );
}

function openLinkedInSearch() {
  if (!profile) return;
  chrome.tabs.create({ url: linkedinSearchUrl() });
}

async function copySummary() {
  if (!profile) return;
  const text = [
    profile.name,
    profile.headline,
    [profile.company, profile.location].filter(Boolean).join(" · "),
    "XING: " + profile.url,
    "LinkedIn search: " + linkedinSearchUrl(),
  ]
    .filter(Boolean)
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const btn = $("copyBtn");
  btn.textContent = "Copied ✓";
  setTimeout(() => (btn.textContent = "Copy summary"), 1500);
}
