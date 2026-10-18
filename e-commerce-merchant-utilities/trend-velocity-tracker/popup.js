// Trend Velocity Tracker — popup logic.
// detectProduct() is injected into the page; keep it self-contained.

function detectProduct() {
  function meta(prop) {
    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    return el ? el.getAttribute("content") : null;
  }
  let title = meta("og:title") || (document.title || "").split("|")[0].trim();
  let price = null, currency = null, rating = null, reviews = null;
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      const items = [];
      for (const it of Array.isArray(data) ? data : [data]) {
        if (it["@graph"]) items.push(...(Array.isArray(it["@graph"]) ? it["@graph"] : [it["@graph"]]));
        else items.push(it);
      }
      for (const n of items) {
        if (!n || !/Product/i.test(n["@type"] || "")) continue;
        const offers = n.offers ? (Array.isArray(n.offers) ? n.offers[0] : n.offers) : null;
        if (offers && offers.price != null && price == null) {
          price = String(offers.price); currency = offers.priceCurrency || currency;
        }
        if (n.aggregateRating && rating == null) {
          rating = parseFloat(n.aggregateRating.ratingValue) || null;
          reviews = parseInt(n.aggregateRating.reviewCount, 10) || null;
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
  if (rating == null) {
    rating = parseFloat((document.querySelector("[itemprop=ratingValue]") || {}).content) || null;
    reviews = parseInt((document.querySelector("[itemprop=reviewCount]") || {}).content, 10) || null;
  }
  const num = price ? parseFloat(String(price).replace(/[^0-9.]/g, "")) : NaN;
  return {
    key: location.origin + location.pathname,
    title: title || null,
    price: isNaN(num) ? null : num,
    currency: currency || null,
    rating, reviews,
    url: location.href,
    host: location.hostname.replace(/^www\./, ""),
  };
}

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
let currentKey = null;

const METRICS = [
  { key: "price", label: "Price", fmt: (v, cur) => (cur ? cur + " " : "$") + v.toFixed(2), delta: (v) => (v >= 0 ? "+" : "") + v.toFixed(2) + " /wk" },
  { key: "rating", label: "Rating", fmt: (v) => v.toFixed(1) + " ★", delta: (v) => (v >= 0 ? "+" : "") + v.toFixed(2) + " /wk" },
  { key: "reviews", label: "Reviews", fmt: (v) => Math.round(v).toLocaleString(), delta: (v) => (v >= 0 ? "+" : "") + Math.round(v).toLocaleString() + " /wk" },
  { key: "rank", label: "Rank", fmt: (v) => "#" + Math.round(v).toLocaleString(), delta: (v) => (v >= 0 ? "+" : "") + Math.round(v).toLocaleString() + " /wk" },
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scanPage);
  $("logSnap").addEventListener("click", logSnapshot);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  renderHistory();
}

async function scanPage() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectProduct });
    const p = res && res.result;
    if (!p || !p.title) throw new Error("no-product");
    currentKey = p.key;
    if (p.price != null) $("sPrice").value = p.price;
    if (p.rating != null) $("sRating").value = p.rating;
    if (p.reviews != null) $("sReviews").value = p.reviews;
    const { products = [] } = await chrome.storage.local.get("products");
    let prod = products.find((x) => x.key === p.key);
    if (!prod) {
      prod = { key: p.key, title: p.title, url: p.url, host: p.host, currency: p.currency, snapshots: [] };
      products.unshift(prod);
      await chrome.storage.local.set({ products: products.slice(0, 40) });
    }
    renderProduct(prod);
    renderHistory();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t scan this page — try a product page on a regular store.";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

async function logSnapshot() {
  if (!currentKey) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Scan a page first, then log a snapshot.";
    return;
  }
  const snap = {
    at: Date.now(),
    price: $("sPrice").value === "" ? null : parseFloat($("sPrice").value),
    rating: $("sRating").value === "" ? null : parseFloat($("sRating").value),
    reviews: $("sReviews").value === "" ? null : parseInt($("sReviews").value, 10),
    rank: $("sRank").value === "" ? null : parseInt($("sRank").value, 10),
  };
  if (snap.price == null && snap.rating == null && snap.reviews == null && snap.rank == null) return;
  const { products = [] } = await chrome.storage.local.get("products");
  const prod = products.find((x) => x.key === currentKey);
  if (!prod) return;
  prod.snapshots.push(snap);
  prod.snapshots = prod.snapshots.slice(-120);
  await chrome.storage.local.set({ products });
  renderProduct(prod);
  renderHistory();
}

function series(snaps, key) {
  return snaps.filter((s) => s[key] != null).map((s) => ({ t: s.at, v: s[key] }));
}

// velocity = change per week over the whole series
function velocity(pts) {
  if (pts.length < 2) return null;
  const first = pts[0], last = pts[pts.length - 1];
  const days = Math.max((last.t - first.t) / 86400000, 1 / 24);
  return ((last.v - first.v) / days) * 7;
}

function badgeFor(pts) {
  if (pts.length < 2) return null;
  const overall = velocity(pts);
  const first = pts[0].v;
  if (!isFinite(overall) || Math.abs(overall) < Math.abs(first || 1) * 0.01) {
    return { cls: "steady", text: "Steady" };
  }
  if (pts.length >= 3) {
    const recent = velocity(pts.slice(-2));
    const sameDir = Math.sign(recent) === Math.sign(overall);
    if (sameDir && Math.abs(recent) > Math.abs(overall) * 1.5) return { cls: "acc", text: "Accelerating" };
    if (!sameDir || Math.abs(recent) < Math.abs(overall) * 0.5) return { cls: "cool", text: "Cooling" };
  }
  return { cls: "steady", text: "Steady" };
}

function sparkline(svg, pts) {
  svg.innerHTML = "";
  if (!pts.length) return;
  const W = 340, H = 56, PAD = 6;
  if (pts.length === 1) {
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", W / 2); dot.setAttribute("cy", H / 2);
    dot.setAttribute("r", "4"); dot.setAttribute("fill", "#d946ef");
    svg.appendChild(dot);
    return;
  }
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const coords = pts.map((p, i) => {
    const x = PAD + (i / (pts.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((p.v - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const poly = document.createElementNS(NS, "polyline");
  poly.setAttribute("points", coords.join(" "));
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "#d946ef");
  poly.setAttribute("stroke-width", "2.5");
  poly.setAttribute("stroke-linejoin", "round");
  svg.appendChild(poly);
  const [lx, ly] = coords[coords.length - 1].split(",");
  const dot = document.createElementNS(NS, "circle");
  dot.setAttribute("cx", lx); dot.setAttribute("cy", ly);
  dot.setAttribute("r", "4"); dot.setAttribute("fill", "#d946ef");
  svg.appendChild(dot);
}

function renderProduct(prod) {
  $("empty").style.display = "none";
  $("product").hidden = false;
  $("prodTitle").textContent = prod.title;
  $("prodTitle").title = prod.title;
  const box = $("metrics");
  box.innerHTML = "";
  const snaps = prod.snapshots;
  for (const m of METRICS) {
    const pts = series(snaps, m.key);
    if (!pts.length) continue;
    const div = document.createElement("div");
    div.className = "metric";
    const head = document.createElement("div");
    head.className = "mhead";
    const b = document.createElement("b"); b.textContent = m.label;
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = m.fmt(pts[pts.length - 1].v, prod.currency);
    head.append(b, val);
    const badge = badgeFor(pts);
    if (badge) {
      const bd = document.createElement("span");
      bd.className = "badge " + badge.cls;
      bd.textContent = badge.text;
      head.insertBefore(bd, val);
    }
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 340 56");
    svg.classList.add("spark");
    sparkline(svg, pts);
    div.append(head, svg);
    const v = velocity(pts);
    const vd = document.createElement("div");
    vd.className = "velo";
    vd.innerHTML = snaps.length < 2
      ? "Log at least 2 snapshots to see velocity."
      : `Velocity: <b>${m.delta(v)}</b> · ${snaps.length} snapshots`;
    div.appendChild(vd);
    box.appendChild(div);
  }
  if (!box.children.length) {
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "No snapshots yet — fill the form and hit Log snapshot.";
    box.appendChild(d);
  }
}

async function renderHistory() {
  const { products = [] } = await chrome.storage.local.get("products");
  const card = $("histCard"), box = $("history");
  box.innerHTML = "";
  card.hidden = products.length === 0;
  for (const p of products) {
    const row = document.createElement("div");
    row.className = "hist-row";
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = p.title; b.title = p.title;
    const s = document.createElement("span");
    const n = p.snapshots.length;
    const last = n ? new Date(p.snapshots[n - 1].at).toLocaleDateString() : "never";
    s.textContent = `${n} snapshot${n === 1 ? "" : "s"} · last ${last}`;
    t.append(b, s);
    const view = document.createElement("button");
    view.className = "x"; view.textContent = "↗"; view.title = "View";
    view.addEventListener("click", () => { currentKey = p.key; renderProduct(p); });
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const { products: cur = [] } = await chrome.storage.local.get("products");
      await chrome.storage.local.set({ products: cur.filter((i) => i.key !== p.key) });
      if (currentKey === p.key) { currentKey = null; $("product").hidden = true; $("empty").style.display = ""; }
      renderHistory();
    });
    row.append(t, view, x);
    box.appendChild(row);
  }
}
