// History Price Logger — popup logic.
// detectProduct() is injected into the page; keep it self-contained.

function detectProduct() {
  function meta(prop) {
    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    return el ? el.getAttribute("content") : null;
  }
  let title = meta("og:title") || (document.title || "").split("|")[0].trim();
  let price = null, currency = null;
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      for (const it of Array.isArray(data) ? data : [data]) {
        const graph = it["@graph"] || [it];
        for (const n of Array.isArray(graph) ? graph : [graph]) {
          if (!n || !/Product/i.test(n["@type"] || "")) continue;
          const offers = n.offers ? (Array.isArray(n.offers) ? n.offers[0] : n.offers) : null;
          if (offers && offers.price != null) { price = String(offers.price); currency = offers.priceCurrency || currency; }
        }
      }
      if (price) break;
    }
  } catch (e) {}
  if (price == null) {
    price = meta("product:price:amount") || (document.querySelector("[itemprop=price]") || {}).content || null;
  }
  if (price == null) {
    const m = (document.body.innerText || "").match(/[$€£₹]\s?[\d,]+(?:\.\d{2})?/);
    if (m) price = m[0];
  }
  const num = price ? parseFloat(String(price).replace(/[^0-9.]/g, "")) : NaN;
  const key = location.origin + location.pathname;
  return {
    key, title: title || null, price: isNaN(num) ? null : num,
    currency: currency || null, url: location.href,
    host: location.hostname.replace(/^www\./, ""),
  };
}

const $ = (id) => document.getElementById(id);
let current = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("log").addEventListener("click", logPrice);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  renderHistory();
}

async function logPrice() {
  const btn = $("log");
  btn.disabled = true; btn.textContent = "Logging…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectProduct });
    const p = res && res.result;
    if (!p || !p.title || p.price == null) throw new Error("no-product");
    const { products = [] } = await chrome.storage.local.get("products");
    let prod = products.find((x) => x.key === p.key);
    if (!prod) {
      prod = { key: p.key, title: p.title, url: p.url, host: p.host, currency: p.currency, prices: [] };
      products.unshift(prod);
    }
    prod.prices.push({ price: p.price, at: Date.now() });
    prod.prices = prod.prices.slice(-200);
    await chrome.storage.local.set({ products: products.slice(0, 60) });
    current = prod;
    renderProduct();
    renderHistory();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t read a price here — try a product page on a regular store.";
  } finally {
    btn.disabled = false; btn.textContent = "Log price";
  }
}

function fmt(n, cur) {
  return (cur ? cur + " " : "") + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderProduct() {
  if (!current || !current.prices.length) return;
  $("empty").style.display = "none";
  $("product").hidden = false;
  const ps = current.prices.map((x) => x.price);
  const latest = ps[ps.length - 1];
  $("prodTitle").textContent = current.title;
  $("prodTitle").title = current.title;
  $("prodPrice").textContent = fmt(latest, current.currency);
  const low = Math.min(...ps), high = Math.max(...ps);
  const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
  $("stLow").textContent = fmt(low, current.currency);
  $("stAvg").textContent = fmt(avg, current.currency);
  $("stHigh").textContent = fmt(high, current.currency);
  $("stN").textContent = ps.length;
  // drop badge
  const badge = $("dropBadge");
  const prev = ps.slice(0, -1);
  const prevLow = prev.length ? Math.min(...prev) : Infinity;
  if (ps.length > 1 && latest < prevLow) {
    badge.hidden = false;
    badge.textContent = "▼ New all-time low!";
  } else if (ps.length > 1 && latest < avg * 0.92) {
    badge.hidden = false;
    badge.textContent = `▼ ${Math.round((1 - latest / avg) * 100)}% below average`;
  } else badge.hidden = true;
  // sparkline
  const svg = $("spark");
  svg.innerHTML = "";
  const W = 340, H = 90, PAD = 8;
  const min = Math.min(...ps), max = Math.max(...ps);
  const span = max - min || 1;
  const pts = ps.map((v, i) => {
    const x = PAD + (i / Math.max(ps.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const NS = "http://www.w3.org/2000/svg";
  const poly = document.createElementNS(NS, "polyline");
  poly.setAttribute("points", pts.join(" "));
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "#8b5cf6");
  poly.setAttribute("stroke-width", "2.5");
  poly.setAttribute("stroke-linejoin", "round");
  svg.appendChild(poly);
  const last = pts[pts.length - 1].split(",");
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("cx", last[0]); dot.setAttribute("cy", last[1]);
  dot.setAttribute("r", "4"); dot.setAttribute("fill", "#8b5cf6");
  svg.appendChild(dot);
}

async function renderHistory() {
  const { products = [] } = await chrome.storage.local.get("products");
  const card = $("histCard"), box = $("history");
  box.innerHTML = "";
  card.hidden = products.length === 0;
  for (const p of products) {
    if (!p.prices.length) continue;
    const latest = p.prices[p.prices.length - 1].price;
    const first = p.prices[0].price;
    const chg = first ? ((latest - first) / first) * 100 : 0;
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = p.title; b.title = p.title;
    const s = document.createElement("span");
    s.textContent = `${p.prices.length} logs · ${chg >= 0 ? "+" : ""}${chg.toFixed(1)}% since first`;
    s.style.color = chg <= 0 ? "#4ade80" : "#9aa3b5";
    t.append(b, s);
    const pr = document.createElement("div"); pr.className = "p";
    pr.textContent = fmt(latest, p.currency);
    const view = document.createElement("button"); view.className = "x"; view.textContent = "↗"; view.title = "View chart";
    view.addEventListener("click", () => { current = p; renderProduct(); });
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { products: cur = [] } = await chrome.storage.local.get("products");
      await chrome.storage.local.set({ products: cur.filter((i) => i.key !== p.key) });
      if (current && current.key === p.key) { current = null; $("product").hidden = true; $("empty").style.display = ""; }
      renderHistory();
    });
    row.append(t, pr, view, x);
    box.appendChild(row);
  }
}
