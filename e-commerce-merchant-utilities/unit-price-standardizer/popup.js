// Unit Price Standardizer — popup logic.
// detectListing() is injected into the page; keep it self-contained.

function detectListing() {
  function meta(prop) {
    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    return el ? el.getAttribute("content") : null;
  }
  let title = meta("og:title") || (document.title || "").split("|")[0].trim();
  let price = null, currency = null;
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    outer: for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      for (const it of Array.isArray(data) ? data : [data]) {
        const graph = it["@graph"] || [it];
        for (const n of Array.isArray(graph) ? graph : [graph]) {
          if (!n || !/Product/i.test(n["@type"] || "")) continue;
          const offers = n.offers ? (Array.isArray(n.offers) ? n.offers[0] : n.offers) : null;
          if (offers && offers.price != null) { price = String(offers.price); currency = offers.priceCurrency || currency; break outer; }
        }
      }
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
  const text = ((title || "") + " " + (document.body.innerText || "").slice(0, 4000)).toLowerCase();
  // quantity detection, best-effort: 500g, 1.5 kg, 2l, 250ml, 750 ml, pack of 12, 12 pcs
  let qty = null;
  const patterns = [
    /(\d+(?:\.\d+)?)\s?(kg|kilogram)\b/, /(\d+(?:\.\d+)?)\s?g\b(?!\s?bp)/,
    /(\d+(?:\.\d+)?)\s?(l|litre|liter)\b/, /(\d+(?:\.\d+)?)\s?(ml|millilitre|milliliter)\b/,
    /(\d+(?:\.\d+)?)\s?(oz|ounce)\b/, /(\d+(?:\.\d+)?)\s?(lb|pound)\b/,
    /pack\s?of\s?(\d+)/, /(\d+)\s?(pcs|pieces|pack|ct|count)\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { qty = { amount: parseFloat(m[1]), unit: (m[2] || "pcs").toLowerCase() }; break; }
  }
  return {
    title: title || null, price: isNaN(num) ? null : num, currency: currency || null,
    qty, host: location.hostname.replace(/^www\./, ""),
  };
}

const $ = (id) => document.getElementById(id);
let listing = null;

document.addEventListener("DOMContentLoaded", () => {
  $("scan").addEventListener("click", scan);
  $("cPrice").addEventListener("input", renderCompare);
  $("cQty").addEventListener("input", renderCompare);
});

function fmt(n, cur) {
  return (cur ? cur + " " : "") + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectListing });
    const l = res && res.result;
    if (!l || !l.title || l.price == null) throw new Error("no-product");
    listing = l;
    renderListing();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t read a product here — try a regular product page.";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

// Normalize quantity to a canonical base so different listings compare fairly.
function normalize(q) {
  if (!q) return null;
  const { amount, unit } = q;
  if (["kg", "kilogram"].includes(unit)) return { base: amount * 1000, kind: "weight", label: `${amount} kg` };
  if (unit === "g") return { base: amount, kind: "weight", label: `${amount} g` };
  if (["l", "litre", "liter"].includes(unit)) return { base: amount * 1000, kind: "volume", label: `${amount} L` };
  if (["ml", "millilitre", "milliliter"].includes(unit)) return { base: amount, kind: "volume", label: `${amount} ml` };
  if (["oz", "ounce"].includes(unit)) return { base: amount * 28.3495, kind: "weight", label: `${amount} oz` };
  if (["lb", "pound"].includes(unit)) return { base: amount * 453.592, kind: "weight", label: `${amount} lb` };
  return { base: amount, kind: "count", label: `${amount} pcs` };
}

function unitRowsFor(price, n, cur) {
  // returns [{label, value}] per relevant unit
  const rows = [];
  if (!n) return rows;
  if (n.kind === "weight") {
    rows.push({ label: "per 100 g", value: (price / n.base) * 100 });
    rows.push({ label: "per 1 kg", value: (price / n.base) * 1000 });
  } else if (n.kind === "volume") {
    rows.push({ label: "per 100 ml", value: (price / n.base) * 100 });
    rows.push({ label: "per 1 L", value: (price / n.base) * 1000 });
  } else {
    rows.push({ label: "per piece", value: price / n.base });
    if (n.base >= 6) rows.push({ label: "per 6 pcs", value: (price / n.base) * 6 });
  }
  return rows;
}

function renderListing() {
  $("empty").style.display = "none";
  $("product").hidden = false;
  $("prodTitle").textContent = listing.title;
  $("prodTitle").title = listing.title;
  $("prodPrice").textContent = fmt(listing.price, listing.currency);
  const n = normalize(listing.qty);
  $("qtyVal").textContent = n ? n.label : "not found";
  const conf = $("confNote");
  if (!n) {
    conf.hidden = false;
    conf.textContent = "No pack size found on the page — unit prices unavailable. Use the compare box below with a manual quantity like “500g”.";
  } else {
    conf.hidden = false;
    conf.textContent = "Best-effort parsing: quantity read from page text. Always confirm against the product label.";
  }
  const box = $("unitRows");
  box.innerHTML = "";
  for (const r of unitRowsFor(listing.price, n, listing.currency)) {
    const d = document.createElement("div");
    d.className = "urow";
    d.innerHTML = `<span class="lbl">${r.label}</span><span class="val">${fmt(r.value, listing.currency)}</span>`;
    box.appendChild(d);
  }
  $("compareCard").hidden = false;
  renderCompare();
}

function parseManualQty(s) {
  // reuse detectListing patterns on arbitrary text
  const m = String(s || "").toLowerCase().match(/(\d+(?:\.\d+)?)\s?(kg|kilogram|g|l|litre|liter|ml|millilitre|milliliter|oz|ounce|lb|pound|pcs|pieces|pack|ct|count)?/);
  if (!m || !m[1]) return null;
  return normalize({ amount: parseFloat(m[1]), unit: (m[2] || "pcs").toLowerCase() });
}

function renderCompare() {
  const box = $("cmpResult");
  const p2 = parseFloat($("cPrice").value);
  const n2 = parseManualQty($("cQty").value);
  const n1 = listing ? normalize(listing.qty) : null;
  if (!listing || !p2 || !n2 || !n1) { box.hidden = true; return; }
  if (n1.kind !== n2.kind) {
    box.hidden = false;
    box.innerHTML = "Different product types (weight vs. volume vs. count) — not comparable.";
    return;
  }
  // compare per base unit
  const u1 = listing.price / n1.base, u2 = p2 / n2.base;
  const cheaper = u1 < u2 ? "This page" : "The other listing";
  const pct = Math.abs(1 - Math.min(u1, u2) / Math.max(u1, u2));
  box.hidden = false;
  box.innerHTML = `<b>${cheaper}</b> is cheaper per unit — by about <b>${(pct * 100).toFixed(1)}%</b>.`;
}
