// Zero-Stock Alert — popup logic.
// detectState() is injected into the page; keep it fully self-contained.

function detectState() {
  function meta(prop) {
    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    return el ? el.getAttribute("content") : null;
  }
  let title = meta("og:title") || (document.title || "").split("|")[0].trim();
  let price = null, currency = null, availability = "unknown";
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      for (const it of Array.isArray(data) ? data : [data]) {
        const graph = it["@graph"] || [it];
        for (const n of Array.isArray(graph) ? graph : [graph]) {
          if (!n || !/Product/i.test(n["@type"] || "")) continue;
          const offers = n.offers ? (Array.isArray(n.offers) ? n.offers[0] : n.offers) : null;
          if (offers) {
            if (price == null && offers.price != null) { price = String(offers.price); currency = offers.priceCurrency || currency; }
            const av = String(offers.availability || "");
            if (/InStock/i.test(av)) availability = "in";
            else if (/OutOfStock|SoldOut/i.test(av)) availability = "out";
          }
        }
      }
    }
  } catch (e) {}
  if (price == null) price = meta("product:price:amount") || (document.querySelector("[itemprop=price]") || {}).content || null;
  if (price == null) {
    const m = (document.body.innerText || "").match(/[$€£₹]\s?[\d,]+(?:\.\d{2})?/);
    if (m) price = m[0];
  }
  if (availability === "unknown") {
    const btns = [...document.querySelectorAll("button, input[type=submit], a")];
    const buyable = btns.some((b) => !b.disabled && /add to (cart|bag|basket)|buy now|add to order/i.test(b.textContent || b.value || ""));
    const txt = (document.body.innerText || "").slice(0, 20000);
    if (/out of stock|sold out|currently unavailable|notify me when (it|this)/i.test(txt)) availability = "out";
    else if (buyable || /in stock|ready to ship|ships within/i.test(txt)) availability = "in";
  }
  const num = price ? parseFloat(String(price).replace(/[^0-9.]/g, "")) : NaN;
  const key = location.origin + location.pathname.replace(/\/$/, "");
  return {
    key, title: title || null, price: isNaN(num) ? null : num,
    currency: currency || null, availability, url: location.href,
    host: location.hostname.replace(/^www\./, ""),
  };
}

const $ = (id) => document.getElementById(id);
const fmt = (n, cur) => (cur ? cur + " " : "") + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const availLabel = (a) => (a === "in" ? "in stock" : a === "out" ? "out of stock" : "unknown");

let activeTab = null;
let matched = null;   // watched item for the current page
let current = null;   // freshly detected state

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("watch").addEventListener("click", watchPage);
  $("rebase").addEventListener("click", rebase);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  await checkCurrentPage();
  renderList();
}

async function readPage() {
  if (!activeTab || !activeTab.id) throw new Error("no-tab");
  const [res] = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: detectState });
  return res && res.result;
}

async function getList() {
  const { watchlist = [] } = await chrome.storage.local.get("watchlist");
  return watchlist;
}
async function setList(list) {
  await chrome.storage.local.set({ watchlist: list.slice(0, 100) });
}

async function checkCurrentPage() {
  try {
    const state = await readPage();
    current = state;
    const list = await getList();
    matched = list.find((w) => w.key === state.key) || null;
  } catch (e) {
    current = null; matched = null;
  }
  if (matched && current) {
    $("notWatched").style.display = "none";
    $("currentCard").hidden = false;
    renderComparison();
  }
}

function renderComparison() {
  $("cTitle").textContent = matched.title;
  $("cTitle").title = matched.title;
  $("cSaved").textContent = matched.price != null ? fmt(matched.price, matched.currency) : "—";
  $("cNow").textContent = current.price != null ? fmt(current.price, current.currency) : "—";
  const box = $("badges");
  box.innerHTML = "";
  const add = (text, cls) => {
    const d = document.createElement("div");
    d.className = "badge " + cls;
    d.textContent = text;
    box.appendChild(d);
  };
  let flagged = false;
  if (matched.price != null && current.price != null) {
    if (current.price < matched.price * 0.99) {
      const pct = Math.round((1 - current.price / matched.price) * 100);
      add(`▼ PRICE DROP −${pct}%`, "drop"); flagged = true;
    } else if (current.price > matched.price * 1.01) {
      const pct = Math.round((current.price / matched.price - 1) * 100);
      add(`▲ Price up +${pct}%`, "up"); flagged = true;
    }
  }
  if (matched.availability === "out" && current.availability === "in") {
    add("✔ BACK IN STOCK", "stock"); flagged = true;
  } else if (matched.availability === "in" && current.availability === "out") {
    add("● OUT OF STOCK", "oos"); flagged = true;
  }
  if (!flagged) add("No change since saved", "same");
}

async function watchPage() {
  const btn = $("watch");
  btn.disabled = true; btn.textContent = "Watching…";
  try {
    const state = await readPage();
    if (!state || !state.title) throw new Error("no-product");
    const list = await getList();
    if (!list.some((w) => w.key === state.key)) {
      list.unshift({ ...state, savedAt: Date.now() });
      await setList(list);
    }
    matched = list.find((w) => w.key === state.key);
    current = state;
    $("notWatched").style.display = "none";
    $("currentCard").hidden = false;
    renderComparison();
    renderList();
  } catch (e) {
    $("notWatched").style.display = "";
    $("notWatched").innerHTML = "Can’t read this page — try a product page on a regular store.";
  } finally {
    btn.disabled = false; btn.textContent = "Watch page";
  }
}

async function rebase() {
  if (!matched || !current) return;
  const list = await getList();
  const it = list.find((w) => w.key === matched.key);
  if (it) {
    it.price = current.price; it.currency = current.currency;
    it.availability = current.availability; it.savedAt = Date.now();
    await setList(list);
    matched = it;
    renderComparison();
    renderList();
  }
}

async function renderList() {
  const list = await getList();
  const card = $("listCard"), box = $("list");
  box.innerHTML = "";
  card.hidden = list.length === 0;
  for (const w of list) {
    const row = document.createElement("div");
    row.className = "row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = w.title; b.title = w.title;
    const s = document.createElement("span");
    s.textContent = `${w.host} · saved ${availLabel(w.availability)}`;
    t.append(b, s);
    const p = document.createElement("div"); p.className = "p";
    p.textContent = w.price != null ? fmt(w.price, w.currency) : "—";
    const open = document.createElement("button"); open.textContent = "↗"; open.title = "Open page";
    open.addEventListener("click", () => chrome.tabs.create({ url: w.url }));
    const del = document.createElement("button"); del.className = "del"; del.textContent = "×"; del.title = "Remove";
    del.addEventListener("click", async () => {
      await setList((await getList()).filter((i) => i.key !== w.key));
      if (matched && matched.key === w.key) { matched = null; $("currentCard").hidden = true; $("notWatched").style.display = ""; }
      renderList();
    });
    row.append(t, p, open, del);
    box.appendChild(row);
  }
}
