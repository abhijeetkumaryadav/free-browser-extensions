// Buying Intent Tracker — popup logic.
// detectSignals() is injected into the page; keep it self-contained.

function detectSignals() {
  function meta(prop) {
    const el = document.querySelector(
      `meta[property="${prop}"], meta[name="${prop}"]`
    );
    return el ? el.getAttribute("content") : null;
  }
  const out = {
    title: meta("og:title") || (document.title || "").split("|")[0].trim(),
    price: null,
    listPrice: null,
    currency: null,
    rating: null,
    reviewCount: null,
    availability: "unknown", // in-stock | low-stock | out-of-stock | unknown
    lowStockQty: null,
    imageCount: 0,
    host: location.hostname.replace(/^www\./, ""),
  };

  // JSON-LD Product
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    outer: for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const graph = it["@graph"] || [it];
        for (const n of Array.isArray(graph) ? graph : [graph]) {
          if (!n || !/Product/i.test(n["@type"] || "")) continue;
          if (!out.title && n.name) out.title = n.name;
          const offers = n.offers
            ? Array.isArray(n.offers) ? n.offers[0] : n.offers
            : null;
          if (offers) {
            if (offers.price != null) out.price = String(offers.price);
            if (offers.highPrice != null) out.listPrice = String(offers.highPrice);
            if (offers.priceCurrency) out.currency = offers.priceCurrency;
            const av = String(offers.availability || "");
            if (/InStock/i.test(av)) out.availability = "in-stock";
            else if (/OutOfStock/i.test(av)) out.availability = "out-of-stock";
            else if (/LimitedAvailability/i.test(av)) out.availability = "low-stock";
          }
          const agg = n.aggregateRating;
          if (agg) {
            if (agg.ratingValue != null) out.rating = parseFloat(agg.ratingValue);
            if (agg.reviewCount != null) out.reviewCount = parseInt(agg.reviewCount, 10);
          }
          break outer;
        }
      }
    }
  } catch (e) { /* malformed JSON-LD */ }

  if (out.price == null) {
    out.price =
      meta("product:price:amount") ||
      (document.querySelector("[itemprop=price]") || {}).content ||
      null;
  }
  if (out.rating == null) {
    const r = document.querySelector("[itemprop=ratingValue]");
    if (r) out.rating = parseFloat(r.content || r.textContent);
  }
  if (out.reviewCount == null) {
    const r = document.querySelector("[itemprop=reviewCount]");
    if (r) out.reviewCount = parseInt(r.content || r.textContent, 10);
  }

  // list price from strikethrough elements
  if (out.listPrice == null) {
    const s = document.querySelector("s, del, .was-price, .list-price, .mrp");
    if (s) {
      const m = (s.textContent || "").match(/[\d,.]+/);
      if (m) out.listPrice = m[0].replace(/,/g, "");
    }
  }

  // scarcity / stock from visible text
  const bodyText = (document.body.innerText || "").slice(0, 20000);
  const low = bodyText.match(/only\s+(\d+)\s+left/i);
  if (low) {
    out.availability = "low-stock";
    out.lowStockQty = parseInt(low[1], 10);
  } else if (/out of stock|sold out|unavailable/i.test(bodyText.slice(0, 3000))) {
    if (out.availability === "unknown") out.availability = "out-of-stock";
  } else if (/in stock|add to cart|buy now/i.test(bodyText.slice(0, 3000))) {
    if (out.availability === "unknown") out.availability = "in-stock";
  }

  try {
    out.imageCount = document.images.length;
  } catch (e) { out.imageCount = 0; }

  return out;
}

const $ = (id) => document.getElementById(id);
let signals = null;
let scoreData = null;
const CIRC = 326.7;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("saveScan").addEventListener("click", saveScan);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  renderHistory();
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true;
  btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectSignals,
    });
    signals = res && res.result;
    if (!signals || !signals.title) throw new Error("no-product");
    scoreData = score(signals);
    renderReport();
    $("empty").style.display = "none";
    $("report").hidden = false;
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t read this page — try a product page on a regular store.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Scan page";
  }
}

// Weighted, explainable scoring. Weights sum to 100.
function score(s) {
  const factors = [];
  // Rating (25)
  let ratingPts = 10;
  if (s.rating != null && !isNaN(s.rating)) {
    ratingPts = s.rating >= 4.5 ? 25 : s.rating >= 4.0 ? 18 : s.rating >= 3.5 ? 10 : 4;
  }
  factors.push({ label: "Rating", detail: s.rating != null ? s.rating.toFixed(1) + " / 5" : "not found", pts: ratingPts, max: 25 });
  // Reviews (20)
  let revPts = 6;
  if (s.reviewCount != null && !isNaN(s.reviewCount)) {
    revPts = s.reviewCount >= 1000 ? 20 : s.reviewCount >= 100 ? 14 : s.reviewCount >= 10 ? 8 : 4;
  }
  factors.push({ label: "Reviews", detail: s.reviewCount != null ? s.reviewCount.toLocaleString() + " reviews" : "not found", pts: revPts, max: 20 });
  // Discount (15)
  let disc = 0;
  const p = parseFloat(s.price), lp = parseFloat(s.listPrice);
  if (p > 0 && lp > p) disc = Math.round(((lp - p) / lp) * 100);
  const discPts = disc >= 30 ? 15 : disc >= 15 ? 10 : disc > 0 ? 6 : 5;
  factors.push({ label: "Discount", detail: disc > 0 ? disc + "% off" : "no discount seen", pts: discPts, max: 15 });
  // Availability (25)
  let avPts = 12, avDetail = "unknown";
  if (s.availability === "low-stock") { avPts = 25; avDetail = s.lowStockQty ? `only ${s.lowStockQty} left` : "low stock"; }
  else if (s.availability === "in-stock") { avPts = 20; avDetail = "in stock"; }
  else if (s.availability === "out-of-stock") { avPts = 0; avDetail = "out of stock"; }
  factors.push({ label: "Availability", detail: avDetail, pts: avPts, max: 25 });
  // Imagery (15)
  const imgPts = s.imageCount >= 6 ? 15 : s.imageCount >= 3 ? 10 : 6;
  factors.push({ label: "Imagery", detail: s.imageCount + " images", pts: imgPts, max: 15 });

  const total = factors.reduce((a, f) => a + f.pts, 0);
  let verdict, cls;
  if (total >= 75) [verdict, cls] = ["HOT — strong buying intent", "hot"];
  else if (total >= 50) [verdict, cls] = ["WARM — decent demand", "warm"];
  else if (total >= 25) [verdict, cls] = ["COOL — weak signals", "cool"];
  else [verdict, cls] = ["COLD — skip it", "cold"];
  return { total, factors, verdict, cls };
}

function renderReport() {
  $("prodTitle").textContent = signals.title;
  $("prodTitle").title = signals.title;
  // animate ring + number
  requestAnimationFrame(() => {
    $("ringFill").style.strokeDashoffset = CIRC * (1 - scoreData.total / 100);
  });
  let n = 0;
  const target = scoreData.total;
  const tick = setInterval(() => {
    n += Math.max(1, Math.round((target - n) / 6));
    if (n >= target) { n = target; clearInterval(tick); }
    $("scoreNum").textContent = n;
  }, 40);
  const v = $("verdict");
  v.className = "verdict " + scoreData.cls;
  v.textContent = scoreData.verdict;

  const box = $("factors");
  box.innerHTML = "";
  for (const f of scoreData.factors) {
    const el = document.createElement("div");
    el.className = "factor";
    const fl = document.createElement("div");
    fl.className = "fl";
    const l = document.createElement("span"); l.textContent = f.label;
    const d = document.createElement("span"); d.textContent = `${f.detail} · ${f.pts}/${f.max}`;
    fl.append(l, d);
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    bar.appendChild(fill);
    el.append(fl, bar);
    box.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.width = (f.pts / f.max) * 100 + "%";
    }));
  }
}

async function saveScan() {
  if (!signals || !scoreData) return;
  const { scans = [] } = await chrome.storage.local.get("scans");
  scans.unshift({
    id: "scan-" + Date.now(),
    title: signals.title,
    score: scoreData.total,
    verdict: scoreData.verdict,
    at: Date.now(),
  });
  await chrome.storage.local.set({ scans: scans.slice(0, 30) });
  renderHistory();
}

async function renderHistory() {
  const { scans = [] } = await chrome.storage.local.get("scans");
  const card = $("histCard");
  const box = $("history");
  box.innerHTML = "";
  card.hidden = scans.length === 0;
  for (const s of scans) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = s.title; b.title = s.title;
    const sp = document.createElement("span");
    sp.textContent = new Date(s.at).toLocaleDateString() + " · " + s.verdict.split(" — ")[0];
    t.append(b, sp);
    const sc = document.createElement("div"); sc.className = "s"; sc.textContent = s.score;
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { scans: cur = [] } = await chrome.storage.local.get("scans");
      await chrome.storage.local.set({ scans: cur.filter((i) => i.id !== s.id) });
      renderHistory();
    });
    row.append(t, sc, x);
    box.appendChild(row);
  }
}
