// Marketplace Niche Scraper — popup logic.
// scrapeListings() is injected into the page; keep it self-contained.

function scrapeListings() {
  const PRICE_RE = /[$€£₹]\s?[\d,]+(?:\.\d{2})?/;
  const seen = new Set();
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode()) && out.length < 150) {
    const text = (node.nodeValue || "").trim();
    if (text.length > 40 || !PRICE_RE.test(text)) continue;
    const m = text.match(/([\d,]+(?:\.\d{2})?)/);
    if (!m) continue;
    const price = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(price) || price <= 0) continue;

    // Climb to a card-like container holding a title link/heading.
    let card = node.parentElement;
    for (let i = 0; i < 6 && card && card !== document.body; i++) {
      if (card.querySelector("h2, h3, a[title]")) break;
      card = card.parentElement;
    }
    if (!card || card === document.body) continue;
    const titleEl =
      card.querySelector("h2") ||
      card.querySelector("h3") ||
      card.querySelector("a[title]") ||
      card.querySelector("a");
    const title = (
      (titleEl && (titleEl.getAttribute("title") || titleEl.innerText)) ||
      ""
    ).trim().replace(/\s+/g, " ").slice(0, 140);
    if (!title || seen.has(title)) continue;
    seen.add(title);

    // Rating: aria labels like "4.5 out of 5 stars", or nearby "4.5" text.
    let rating = null;
    try {
      const rEl = card.querySelector('[aria-label*="out of 5"], [aria-label*="star"]');
      if (rEl) {
        const rm = (rEl.getAttribute("aria-label") || "").match(/([\d.]+)/);
        if (rm) rating = parseFloat(rm[1]);
      }
      if (rating == null) {
        const rm2 = (card.innerText || "").match(/(\d\.\d)\s*(?:out of 5|\/ ?5|stars?)/i);
        if (rm2) rating = parseFloat(rm2[1]);
      }
    } catch (e) { /* ignore */ }
    if (rating != null && (rating < 0 || rating > 5)) rating = null;

    out.push({ title, price, rating });
  }
  return { listings: out, url: location.href, host: location.hostname.replace(/^www\./, "") };
}

const $ = (id) => document.getElementById(id);
let rows = [];
let sortKey = "price";
let sortDir = 1;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("csv").addEventListener("click", exportCsv);
  document.querySelectorAll("th[data-k]").forEach((th) =>
    th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (sortKey === k) sortDir *= -1;
      else { sortKey = k; sortDir = k === "title" ? 1 : -1; }
      renderTable();
    })
  );
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeListings,
    });
    const data = res && res.result;
    if (!data || !data.listings.length) throw new Error("none");
    rows = data.listings;
    sortKey = "price"; sortDir = 1;
    renderSummary();
    renderTable();
    $("empty").style.display = "none";
    $("summary").hidden = false;
    $("tableCard").hidden = false;
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "No listings found — open a marketplace search or category page and try again.";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function renderSummary() {
  const prices = rows.map((r) => r.price);
  const ratings = rows.map((r) => r.rating).filter((r) => r != null);
  $("stCount").textContent = rows.length;
  $("stRange").textContent =
    prices.length ? `${fmtP(Math.min(...prices))} – ${fmtP(Math.max(...prices))}` : "—";
  $("stRating").textContent =
    ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) + " ★" : "n/a";
}

function fmtP(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 1000 ? 2 : 0 });
}

function renderTable() {
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string") return sortDir * av.localeCompare(bv);
    return sortDir * (av - bv);
  });
  document.querySelectorAll("th[data-k]").forEach((th) => {
    th.querySelector(".arr").textContent =
      th.dataset.k === sortKey ? (sortDir === 1 ? " ▲" : " ▼") : "";
  });
  const tb = $("rows");
  tb.innerHTML = "";
  for (const r of sorted) {
    const tr = document.createElement("tr");
    const tdT = document.createElement("td");
    tdT.className = "t"; tdT.textContent = r.title; tdT.title = r.title;
    const tdP = document.createElement("td");
    tdP.className = "num"; tdP.textContent = fmtP(r.price);
    const tdR = document.createElement("td");
    tdR.className = "num r"; tdR.textContent = r.rating != null ? r.rating.toFixed(1) : "—";
    tr.append(tdT, tdP, tdR);
    tb.appendChild(tr);
  }
}

function exportCsv() {
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const csv = [["title", "price", "rating"],
    ...rows.map((r) => [r.title, r.price, r.rating == null ? "" : r.rating])
  ].map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "niche-listings.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
