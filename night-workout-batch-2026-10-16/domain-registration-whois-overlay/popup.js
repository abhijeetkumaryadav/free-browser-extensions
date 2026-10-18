/* RDAP Domain Info — popup logic.
 * Reads the current tab's hostname and queries the public rdap.org proxy.
 * Graceful failure: rate limits, non-domain pages, and network errors all
 * produce a friendly message instead of a crash. Nothing is cached. */
"use strict";

const RDAP_BASE = "https://rdap.org/domain/";

/** Extract the registrable-ish hostname from a tab URL. */
function hostnameOf(url) {
  try {
    const u = new URL(url);
    if (!u.hostname || u.protocol === "chrome:" || u.protocol === "about:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch { return null; }
}

function pick(v) {
  if (!v) return "—";
  if (typeof v === "string") return v || "—";
  return "—";
}

/** Pull a readable value out of an RDAP entity (registrant/registrar/technical). */
function entityValue(entities, role) {
  if (!Array.isArray(entities)) return null;
  const ent = entities.find((e) => Array.isArray(e.roles) && e.roles.includes(role));
  if (!ent) return null;
  if (ent.vcardArray && Array.isArray(ent.vcardArray[1])) {
    const fn = ent.vcardArray[1].find((p) => p[0] === "fn");
    if (fn && fn[3]) return String(fn[3]);
  }
  return ent.handle ? `handle: ${ent.handle}` : null;
}

/** Format an ISO-ish RDAP date as a short local date. */
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function addRow(dl, label, value, cls) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  if (cls) dd.className = cls;
  dl.append(dt, dd);
}

function showError(msg) {
  const err = document.getElementById("error");
  err.textContent = msg;
  err.hidden = false;
  document.getElementById("loading").hidden = true;
  document.getElementById("results").hidden = true;
  document.getElementById("fullLink").hidden = true;
}

async function lookup(domain) {
  const loading = document.getElementById("loading");
  const err = document.getElementById("error");
  const results = document.getElementById("results");
  const fullLink = document.getElementById("fullLink");

  err.hidden = true;
  results.hidden = true;
  fullLink.hidden = true;
  loading.hidden = false;

  const url = RDAP_BASE + encodeURIComponent(domain);
  let data;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.status === 429) {
      showError("Rate-limited by rdap.org. Wait a minute and try again, or use the full lookup link below.");
      return;
    }
    if (resp.status === 404) {
      showError(`No RDAP record found for “${domain}”. It may be unregistered or use a registry RDAP doesn't cover.`);
      return;
    }
    if (!resp.ok) {
      showError(`RDAP lookup failed (HTTP ${resp.status}). Try the full lookup link below.`);
      return;
    }
    data = await resp.json();
  } catch (e) {
    showError(e.name === "AbortError"
      ? "The RDAP request timed out. Try again, or use the full lookup link below."
      : "Network error reaching rdap.org. Check your connection or use the full lookup link below.");
    return;
  }

  loading.hidden = true;
  results.innerHTML = "";

  const events = {};
  if (Array.isArray(data.events)) {
    for (const ev of data.events) {
      if (ev.eventAction && ev.eventDate) events[ev.eventAction] = ev.eventDate;
    }
  }
  const ns = Array.isArray(data.nameservers)
    ? data.nameservers.map((n) => n.ldhName || n.unicodeName).filter(Boolean)
    : [];
  const status = Array.isArray(data.status) ? data.status.join(", ") : null;
  const registrar = entityValue(data.entities, "registrar");

  addRow(results, "Domain", pick(data.ldhName || data.unicodeName));
  addRow(results, "Registrar", registrar || "—");
  addRow(results, "Registered", fmtDate(events.registration));
  addRow(results, "Updated", fmtDate(events.lastChanged || events["last changed"]));
  addRow(results, "Expires", fmtDate(events.expiration));
  addRow(results, "Status", status || "—");
  addRow(results, "Name servers", ns.length ? ns.slice(0, 4).join(", ") : "—");
  const dnssec = data.secureDNS;
  if (dnssec && dnssec.delegationSigned !== undefined) {
    addRow(results, "DNSSEC", dnssec.delegationSigned ? "Signed" : "Not signed",
      dnssec.delegationSigned ? "ok" : "warn");
  }

  results.hidden = false;
  fullLink.href = url;
  fullLink.hidden = false;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domainEl = document.getElementById("domain");
  const btn = document.getElementById("lookupBtn");
  const domain = tab && tab.url ? hostnameOf(tab.url) : null;

  if (!domain) {
    domainEl.textContent = "No domain on this tab";
    btn.disabled = true;
    showError("Open a regular website tab, then open this popup to look up its domain.");
    return;
  }
  domainEl.textContent = domain;
  btn.addEventListener("click", () => lookup(domain));
  lookup(domain); // auto-run once the popup opens
}

document.addEventListener("DOMContentLoaded", init);
