// Arbitrage Retail Scanner — popup logic.
// detectProduct() is injected into the page; keep it self-contained.

function detectProduct() {
  function meta(prop) {
    const el = document.querySelector(
      `meta[property="${prop}"], meta[name="${prop}"]`
    );
    return el ? el.getAttribute("content") : null;
  }
  let title =
    meta("og:title") || (document.title || "").split("|")[0].trim();
  let price = null;
  let currency = null;

  // JSON-LD Product
  try {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const g = it["@graph"] || [it];
        for (const n of Array.isArray(g) ? g : [g]) {
          if (n && /Product/i.test(n["@type"] || "")) {
            if (!title && n.name) title = n.name;
            const offers = n.offers
              ? Array.isArray(n.offers)
                ? n.offers[0]
                : n.offers
              : null;
            if (offers) {
              if (offers.price) price = String(offers.price);
              if (offers.priceCurrency) currency = offers.priceCurrency;
            }
          }
        }
      }
      if (price) break;
    }
  } catch (e) {
    /* ignore malformed JSON-LD */
  }

  if (!price) {
    price =
      meta("product:price:amount") ||
      meta("og:price:amount") ||
      (document.querySelector("[itemprop=price]") || {}).content ||
      null;
  }
  if (!currency) {
    currency =
      meta("product:price:currency") ||
      meta("og:price:currency") ||
      (document.querySelector("[itemprop=priceCurrency]") || {}).content ||
      null;
  }
  // last resort: first $-style price in visible text
  if (!price) {
    const m = (document.body.innerText || "").match(
      /[$€£₹]\s?[\d,]+(?:\.\d{2})?/
    );
    if (m) price = m[0];
  }
  return {
    title: title || null,
    price: price ? String(price).replace(/[^0-9.,]/g, "").replace(/,/g, "") : null,
    priceRaw: price,
    currency: currency,
    host: location.hostname.replace(/^www\./, ""),
    url: location.href,
  };
}

const $ = (id) => document.getElementById(id);
let product = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  document.querySelectorAll("[data-cmp]").forEach((b) =>
    b.addEventListener("click", () => compare(b.dataset.cmp))
  );
  ["buy", "sell", "fee", "ship"].forEach((id) =>
    $(id).addEventListener("input", calculate)
  );
  $("saveScan").addEventListener("click", saveScan);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try {
      $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, "");
    } catch (e) {}
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
      func: detectProduct,
    });
    product = res && res.result;
    if (!product || !product.title) throw new Error("no-product");
    $("empty").style.display = "none";
    $("product").hidden = false;
    $("prodTitle").textContent = product.title;
    $("prodTitle").title = product.title;
    $("prodPrice").textContent = product.priceRaw || "price not found";
    $("prodCur").textContent = product.currency || "";
    if (product.price && !$("buy").value) {
      $("buy").value = parseFloat(product.price) || "";
      calculate();
    }
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML =
      "Couldn’t read this page — try a product page on a regular store.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Scan page";
  }
}

function compare(where) {
  if (!product || !product.title) return;
  const q = encodeURIComponent(product.title.slice(0, 80));
  const urls = {
    google: `https://www.google.com/search?tbm=shop&q=${q}`,
    amazon: `https://www.amazon.com/s?k=${q}`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
  };
  chrome.tabs.create({ url: urls[where] });
}

function num(id) {
  return parseFloat($(id).value) || 0;
}

function calculate() {
  const buy = num("buy");
  const sell = num("sell");
  const feePct = num("fee");
  const ship = num("ship");
  const box = $("result");
  if (!buy && !sell) {
    box.hidden = true;
    return;
  }
  const net = sell * (1 - feePct / 100) - ship;
  const profit = net - buy;
  const margin = sell ? (profit / sell) * 100 : 0;
  const roi = buy ? (profit / buy) * 100 : 0;
  box.hidden = false;
  $("rProfit").textContent =
    (profit >= 0 ? "+" : "−") + Math.abs(profit).toFixed(2);
  $("rProfit").style.color = profit >= 0 ? "var(--good)" : "var(--bad)";
  $("rMargin").textContent = margin.toFixed(1) + "%";
  $("rRoi").textContent = roi.toFixed(1) + "%";
  const v = $("verdict");
  let cls, txt;
  if (margin >= 30) [cls, txt] = ["strong", "STRONG OPPORTUNITY"];
  else if (margin >= 15) [cls, txt] = ["decent", "DECENT MARGIN"];
  else if (margin >= 0) [cls, txt] = ["thin", "THIN — BE CAREFUL"];
  else [cls, txt] = ["loss", "LOSS — SKIP IT"];
  v.className = "verdict " + cls;
  v.textContent = txt;
}

async function saveScan() {
  const buy = num("buy");
  const sell = num("sell");
  if (!buy && !sell) return;
  const feePct = num("fee");
  const ship = num("ship");
  const profit = sell * (1 - feePct / 100) - ship - buy;
  const margin = sell ? (profit / sell) * 100 : 0;
  const { scans = [] } = await chrome.storage.local.get("scans");
  scans.unshift({
    id: "scan-" + Date.now(),
    title: (product && product.title) || "Manual entry",
    buy,
    sell,
    profit: +profit.toFixed(2),
    margin: +margin.toFixed(1),
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
    const t = document.createElement("div");
    t.className = "t";
    const b = document.createElement("b");
    b.textContent = s.title;
    b.title = s.title;
    const sp = document.createElement("span");
    sp.textContent = `${new Date(s.at).toLocaleDateString()} · margin ${s.margin}%`;
    t.append(b, sp);
    const p = document.createElement("div");
    p.className = "p";
    p.textContent = (s.profit >= 0 ? "+" : "−") + Math.abs(s.profit).toFixed(2);
    p.style.color = s.profit >= 0 ? "var(--good)" : "var(--bad)";
    const x = document.createElement("button");
    x.className = "x";
    x.textContent = "×";
    x.addEventListener("click", async () => {
      const { scans: cur = [] } = await chrome.storage.local.get("scans");
      await chrome.storage.local.set({
        scans: cur.filter((i) => i.id !== s.id),
      });
      renderHistory();
    });
    row.append(t, p, x);
    box.appendChild(row);
  }
}
