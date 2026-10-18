// XML Sitemap Product Extractor — popup logic.
// Two sources: fetch the current site's sitemap (same-origin, via content script)
// or parse user-pasted XML. All parsing is local; nothing leaves the device.

const $ = (id) => document.getElementById(id);

// Heuristic for product-like URL paths. Toggleable in the UI.
const PRODUCT_RE = /\/(products?|items?|goods|collections?|shop|store|catalog|sku|dp|pd|p)\b|\/(product|item)[-_]/i;

let allUrls = [];   // raw {loc, lastmod} from the last successful source

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("fetchBtn").addEventListener("click", fetchCurrentSite);
  $("parseBtn").addEventListener("click", parsePasted);
  $("prodOnly").addEventListener("change", render);
  $("csvBtn").addEventListener("click", exportCsv);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) $("siteHost").textContent = new URL(tab.url).hostname.replace(/^www\./, "");
  } catch (e) { /* ignore */ }
}

function setStatus(kind, msg) {
  const s = $("status");
  s.hidden = false;
  s.className = "status " + kind;
  s.textContent = msg;
}

async function fetchCurrentSite() {
  const btn = $("fetchBtn");
  btn.disabled = true;
  btn.textContent = "Fetching…";
  setStatus("ok", "");
  $("status").hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url || !/^https?:/.test(tab.url)) {
      throw new Error("Open a regular website first.");
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    const r = res && res.result;
    if (!r) throw new Error("No response from the page.");
    if (!r.ok) {
      throw new Error(r.error === "no-sitemap"
        ? "No sitemap found (checked robots.txt and /sitemap.xml)."
        : "Could not parse the sitemap.");
    }
    allUrls = r.urls || [];
    setStatus("ok", `Read ${allUrls.length.toLocaleString()} URLs from ${r.sitemap}`);
    render();
  } catch (e) {
    setStatus("err", "Couldn’t fetch: " + (e.message || "unknown error"));
  } finally {
    btn.disabled = false;
    btn.textContent = "Fetch this site's sitemap";
  }
}

function parsePasted() {
  const text = $("xmlInput").value.trim();
  if (!text) { setStatus("err", "Paste some sitemap XML first."); return; }
  try {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("bad-xml");
    const out = [];
    for (const ue of doc.getElementsByTagName("url")) {
      const loc = ue.getElementsByTagName("loc")[0];
      const lm = ue.getElementsByTagName("lastmod")[0];
      if (loc && loc.textContent.trim()) {
        out.push({ loc: loc.textContent.trim(), lastmod: lm ? lm.textContent.trim() : "" });
      }
    }
    allUrls = out;
    setStatus("ok", `Parsed ${allUrls.length.toLocaleString()} URLs from pasted XML.`);
    render();
  } catch (e) {
    setStatus("err", "That doesn’t look like valid sitemap XML.");
  }
}

function filtered() {
  if (!$("prodOnly").checked) return allUrls;
  return allUrls.filter((u) => {
    try { return PRODUCT_RE.test(new URL(u.loc).pathname); }
    catch (e) { return PRODUCT_RE.test(u.loc); }
  });
}

function render() {
  const rows = filtered();
  const card = $("resCard");
  card.hidden = allUrls.length === 0 && rows.length === 0;
  if (card.hidden) return;
  $("resTitle").textContent =
    `${rows.length.toLocaleString()} product URL${rows.length === 1 ? "" : "s"}` +
    ($("prodOnly").checked && rows.length !== allUrls.length
      ? ` · ${allUrls.length.toLocaleString()} total` : "");
  const box = $("list");
  box.innerHTML = "";
  const SHOW = 200;
  for (const u of rows.slice(0, SHOW)) {
    const div = document.createElement("div");
    div.className = "url-row";
    const a = document.createElement("a");
    a.href = u.loc;
    a.textContent = u.loc;
    a.target = "_blank";
    a.rel = "noopener";
    div.appendChild(a);
    if (u.lastmod) {
      const sp = document.createElement("span");
      sp.textContent = "lastmod " + u.lastmod;
      div.appendChild(sp);
    }
    box.appendChild(div);
  }
  if (rows.length > SHOW) {
    const more = document.createElement("div");
    more.className = "url-row";
    more.innerHTML = `<span>…and ${(rows.length - SHOW).toLocaleString()} more (included in CSV export)</span>`;
    box.appendChild(more);
  }
}

function exportCsv() {
  const rows = filtered();
  if (!rows.length) return;
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [["url", "lastmod"], ...rows.map((u) => [u.loc, u.lastmod])].map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "sitemap-products.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
