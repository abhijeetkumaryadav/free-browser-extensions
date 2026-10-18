// Interactive CSS Grid Peeper — popup logic.
// The three gp* functions below are injected into the page via
// chrome.scripting.executeScript, so each must be fully self-contained
// (no references to anything outside their own body).

/* Injected: scan the page for grid containers and return metadata. */
function gpScan() {
  function selectorFor(el) {
    if (el.id) return "#" + el.id;
    var cls = "";
    if (el.className && typeof el.className === "string") {
      cls = el.className.trim().split(/\s+/).slice(0, 2).map(function (c) { return "." + c; }).join("");
    }
    var s = el.tagName.toLowerCase() + cls;
    var p = el.parentElement;
    if (p) {
      var sibs = Array.prototype.filter.call(p.children, function (c) { return c.tagName === el.tagName; });
      if (sibs.length > 1) s += ":nth-of-type(" + (sibs.indexOf(el) + 1) + ")";
    }
    return s;
  }
  var out = [];
  var all = document.querySelectorAll("*");
  for (var k = 0; k < all.length && out.length < 150; k++) {
    var el = all[k], d;
    try { d = getComputedStyle(el).display; } catch (e) { continue; }
    if (d !== "grid" && d !== "inline-grid") continue;
    var cs = getComputedStyle(el);
    out.push({
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      columns: cs.gridTemplateColumns,
      rows: cs.gridTemplateRows,
      gap: cs.gap,
      items: el.children.length,
    });
  }
  return out;
}

/* Injected: draw (or remove) a numbered grid-line overlay on every grid container. */
function gpToggle(show) {
  var NS = "__gridPeeper";
  var st = (window[NS] = window[NS] || {});
  var ACC = "#22d3ee";

  function clear() {
    (st.layers || []).forEach(function (l) { l.remove(); });
    st.layers = [];
    if (st.onScroll) {
      window.removeEventListener("scroll", st.onScroll, true);
      window.removeEventListener("resize", st.onScroll);
      st.onScroll = null;
    }
  }
  clear();
  st.on = !!show;
  if (!show) return 0;

  function pxList(str) {
    return String(str || "").split(" ").map(parseFloat).filter(function (v) { return !isNaN(v); });
  }
  function line(x1, y1, x2, y2) {
    var d = document.createElement("div");
    d.style.cssText = "position:absolute;background:" + ACC + ";opacity:.85;" +
      "left:" + Math.min(x1, x2) + "px;top:" + Math.min(y1, y2) + "px;" +
      "width:" + Math.max(Math.abs(x2 - x1), 1) + "px;height:" + Math.max(Math.abs(y2 - y1), 1) + "px;";
    return d;
  }
  function label(text, x, y) {
    var s = document.createElement("span");
    s.textContent = text;
    s.style.cssText = "position:absolute;left:" + x + "px;top:" + y + "px;background:" + ACC +
      ";color:#062b33;font:700 9px/1.4 sans-serif;padding:1px 5px;border-radius:4px;transform:translate(-50%,-110%);";
    return s;
  }
  function draw() {
    (st.layers || []).forEach(function (l) { l.remove(); });
    st.layers = [];
    var all = document.querySelectorAll("*");
    var n = 0;
    for (var k = 0; k < all.length && n < 150; k++) {
      var el = all[k], d;
      try { d = getComputedStyle(el).display; } catch (e) { continue; }
      if (d !== "grid" && d !== "inline-grid") continue;
      n++;
      var cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      var layer = document.createElement("div");
      layer.style.cssText = "position:fixed;left:" + r.left + "px;top:" + r.top + "px;" +
        "width:" + r.width + "px;height:" + r.height + "px;pointer-events:none;z-index:2147483647;";
      var box = document.createElement("div");
      box.style.cssText = "position:absolute;inset:0;border:2px dashed " + ACC + ";border-radius:4px;";
      layer.appendChild(box);
      // column lines, numbered 1..n+1
      var x = 0, i;
      layer.appendChild(line(0, 0, 0, r.height));
      layer.appendChild(label("1", 0, 2));
      pxList(cs.gridTemplateColumns).forEach(function (w, idx) {
        x += w;
        layer.appendChild(line(x, 0, x, r.height));
        layer.appendChild(label(String(idx + 2), x, 2));
      });
      // row lines, numbered 1..m+1 (labels on the left edge)
      var y = 0;
      layer.appendChild(line(0, 0, r.width, 0));
      var rl = label("1", 2, 0); rl.style.transform = "translate(0,-50%)"; layer.appendChild(rl);
      pxList(cs.gridTemplateRows).forEach(function (h, idx) {
        y += h;
        layer.appendChild(line(0, y, r.width, y));
        var l = label(String(idx + 2), 2, y); l.style.transform = "translate(0,-50%)"; layer.appendChild(l);
      });
      document.documentElement.appendChild(layer);
      st.layers.push(layer);
    }
  }
  draw();
  var t = null;
  st.onScroll = function () { clearTimeout(t); t = setTimeout(function () { if (st.on) draw(); }, 120); };
  window.addEventListener("scroll", st.onScroll, true);
  window.addEventListener("resize", st.onScroll);
  return st.layers.length;
}

/* Injected: flash-highlight the i-th grid container (scan order). */
function gpFlash(i) {
  var all = document.querySelectorAll("*");
  var n = -1;
  for (var k = 0; k < all.length; k++) {
    var el = all[k], d;
    try { d = getComputedStyle(el).display; } catch (e) { continue; }
    if (d !== "grid" && d !== "inline-grid") continue;
    n++;
    if (n === i) {
      try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
      var prev = el.style.outline;
      el.style.outline = "3px solid #22d3ee";
      el.style.outlineOffset = "2px";
      setTimeout(function () { el.style.outline = prev; el.style.outlineOffset = ""; }, 1200);
      return true;
    }
  }
  return false;
}

// ---------- popup side ----------

const $ = (id) => document.getElementById(id);
let grids = [];
let overlayOn = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("host").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  $("scan").addEventListener("click", scan);
  $("toggle").addEventListener("click", toggleOverlay);
  await scan();
}

async function runInPage(func, args) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("no-tab");
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args: args || [] });
  return res && res.result;
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    grids = (await runInPage(gpScan)) || [];
    overlayOn = false;
    updateToggle();
    renderList();
  } catch (e) {
    grids = [];
    renderList("Couldn’t scan this page — try a regular website tab.");
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

async function toggleOverlay() {
  try {
    const n = await runInPage(gpToggle, [!overlayOn]);
    overlayOn = !overlayOn && n > 0;
  } catch (e) {
    overlayOn = false;
  }
  updateToggle();
}

function updateToggle() {
  const t = $("toggle");
  t.setAttribute("aria-pressed", String(overlayOn));
  t.textContent = overlayOn ? "Hide grid lines" : "Show grid lines";
}

function summarizeTracks(str) {
  if (!str || str === "none") return "auto";
  const parts = str.trim().split(/\s+/);
  return parts.length + (parts.length === 1 ? " track" : " tracks");
}

function renderList(msg) {
  const box = $("list");
  box.innerHTML = "";
  const count = $("count");
  if (grids.length) {
    count.hidden = false;
    count.textContent = grids.length + (grids.length === 1 ? " grid container" : " grid containers") + " — click one to flash it.";
    $("empty").style.display = "none";
  } else {
    count.hidden = true;
    $("empty").style.display = "";
    if (msg) $("empty").textContent = msg;
    return;
  }
  grids.forEach((g, i) => {
    const row = document.createElement("div");
    row.className = "grid-row";
    const idx = document.createElement("div");
    idx.className = "idx"; idx.textContent = i + 1;
    const meta = document.createElement("div");
    meta.className = "meta";
    const sel = document.createElement("div");
    sel.className = "sel"; sel.textContent = g.selector; sel.title = g.selector;
    const detail = document.createElement("div");
    detail.className = "detail";
    detail.innerHTML =
      "<b>" + summarizeTracks(g.columns) + "</b> cols · <b>" + summarizeTracks(g.rows) + "</b> rows · " +
      "gap " + (g.gap || "0px") + " · " + g.items + (g.items === 1 ? " item" : " items");
    meta.append(sel, detail);
    row.append(idx, meta);
    row.addEventListener("click", async () => {
      try { await runInPage(gpFlash, [i]); } catch (e) {}
    });
    box.appendChild(row);
  });
}
