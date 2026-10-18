/* IPLocate — IP geolocation via the free no-key ip-api.com endpoint.
 * Data is attributed in the popup + README. Approximate ISP-level results only. */
"use strict";

const API_BASE = "http://ip-api.com/json/";
const FIELDS = "status,message,query,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as";

const $ = (id) => document.getElementById(id);
const els = {
  ipInput: $("ipInput"), lookupBtn: $("lookupBtn"), myIpBtn: $("myIpBtn"),
  copyBtn: $("copyBtn"), loadingPanel: $("loadingPanel"),
  resultPanel: $("resultPanel"), resIp: $("resIp"),
  resCountryCode: $("resCountryCode"), detailsList: $("detailsList"),
  errorPanel: $("errorPanel"), errorText: $("errorText"),
};

let lastResult = null;

// Very loose sanity check — the API itself is the real validator.
function looksLikeIp(s) {
  return /^[0-9a-fA-F:.]+$/.test(s) && s.length <= 45;
}

function showError(msg) {
  els.errorText.textContent = msg;
  els.errorPanel.hidden = false;
  els.resultPanel.hidden = true;
}
function hidePanels() {
  els.errorPanel.hidden = true;
  els.resultPanel.hidden = true;
  els.loadingPanel.hidden = true;
}

function row(label, value, mono = false) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  if (mono) dd.classList.add("mono");
  const wrap = document.createElement("div");
  wrap.className = "row";
  wrap.append(dt, dd);
  return wrap;
}

function render(data) {
  lastResult = data;
  els.resIp.textContent = data.query || "—";
  els.resCountryCode.textContent = data.countryCode || "—";

  const list = els.detailsList;
  list.textContent = "";
  const lat = typeof data.lat === "number" ? data.lat.toFixed(4) : "—";
  const lon = typeof data.lon === "number" ? data.lon.toFixed(4) : "—";
  const rows = [
    ["Country", data.country || "—"],
    ["Region", data.regionName || data.region || "—"],
    ["City", data.city || "—"],
    ["ZIP / Postal", data.zip || "—"],
    ["Coordinates", `${lat}, ${lon}`, true],
    ["Timezone", data.timezone || "—"],
    ["ISP", data.isp || "—"],
    ["Organization", data.org || "—"],
    ["ASN", data.as || "—", true],
  ];
  for (const [label, value, mono] of rows) list.append(row(label, value, mono));

  els.resultPanel.hidden = false;
  els.copyBtn.hidden = false;
}

async function lookup(rawIp) {
  hidePanels();
  const ip = rawIp.trim();
  if (ip && !looksLikeIp(ip)) {
    showError("That doesn't look like an IP address. IPv4 or IPv6 only.");
    return;
  }

  els.loadingPanel.hidden = false;
  els.lookupBtn.disabled = true;

  try {
    const url = API_BASE + encodeURIComponent(ip) + "?fields=" + FIELDS;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();

    if (data.status !== "success") {
      const msg = String(data.message || "lookup failed");
      if (/rate limited/i.test(msg)) {
        showError("Rate-limited by ip-api.com (free tier ≈ 45/min). Wait a minute and retry.");
      } else if (/private range|reserved range/i.test(msg)) {
        showError("Private/reserved IPs can't be geolocated: " + msg + ".");
      } else if (/invalid query/i.test(msg)) {
        showError("Invalid IP address: please check the format and retry.");
      } else {
        showError("Lookup failed: " + msg + ".");
      }
      return;
    }

    render(data);
    try { await chrome.storage.local.set({ iplocate: { lastIp: ip } }); } catch { /* ignore */ }
  } catch (e) {
    showError("Couldn't reach ip-api.com. Check your connection and retry.");
  } finally {
    els.loadingPanel.hidden = true;
    els.lookupBtn.disabled = false;
  }
}

async function copyResult() {
  if (!lastResult) return;
  const text = [
    `IP: ${lastResult.query || ""}`,
    `Country: ${lastResult.country || ""} (${lastResult.countryCode || ""})`,
    `Region: ${lastResult.regionName || ""}`,
    `City: ${lastResult.city || ""}`,
    `ZIP: ${lastResult.zip || ""}`,
    `Lat/Lon: ${lastResult.lat ?? ""}, ${lastResult.lon ?? ""}`,
    `Timezone: ${lastResult.timezone || ""}`,
    `ISP: ${lastResult.isp || ""}`,
    `Org: ${lastResult.org || ""}`,
    `ASN: ${lastResult.as || ""}`,
    `Source: ip-api.com (approximate)`,
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    els.copyBtn.textContent = "Copied ✓";
    setTimeout(() => { els.copyBtn.textContent = "Copy result"; }, 1500);
  } catch {
    // Clipboard fallback for older contexts.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  }
}

els.lookupBtn.addEventListener("click", () => lookup(els.ipInput.value));
els.myIpBtn.addEventListener("click", () => {
  els.ipInput.value = "";
  lookup("");
});
els.copyBtn.addEventListener("click", copyResult);
els.ipInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") lookup(els.ipInput.value);
});

// Restore last query.
(async () => {
  try {
    const d = await chrome.storage.local.get("iplocate");
    if (d.iplocate && typeof d.iplocate.lastIp === "string") {
      els.ipInput.value = d.iplocate.lastIp;
    }
  } catch { /* ignore */ }
})();
