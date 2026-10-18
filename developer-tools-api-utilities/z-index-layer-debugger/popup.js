// Z-Index Layer Debugger — popup logic.
// The two functions injected into the page (scanLayers / toggleZOverlay)
// are fully self-contained: no closures, no extension APIs.

const PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#f87171", "#60a5fa", "#fb923c"];

function cssPath(el) {
  // Build a short, unique-ish selector for display purposes.
  const parts = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && parts.length < 4) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) { part += "#" + cur.id; parts.unshift(part); break; }
    const cls = (cur.className && typeof cur.className === "string")
      ? cur.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    if (cls) part += "." + cls;
    else {
      const sibs = cur.parentNode ? [...cur.parentNode.children].filter((s) => s.tagName === cur.tagName) : [];
      if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = cur.parentNode;
  }
  return parts.join(" > ");
}

function scanLayers() {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.position === "static" || cs.zIndex === "auto") continue;
    const r = el.getBoundingClientRect();
    out.push({
      sel: cssPath(el),
      z: parseInt(cs.zIndex, 10) || 0,
      position: cs.position,
      x: r.x, y: r.y, w: r.width, h: r.height,
    });
  }
  return out;
}

function toggleZOverlay(args) {
  // args: { layers: [{sel,z,x,y,w,h}], palette: [...] }
  const ID = "__zld_overlay__";
  const old = document.getElementById(ID);
  if (old) {
    window.removeEventListener("scroll", window.__zldRedraw, true);
    window.removeEventListener("resize", window.__zldRedraw, true);
    old.remove();
    return { on: false };
  }
  const layers = args.layers;
  const palette = args.palette;
  const root = document.createElement("div");
  root.id = ID;
  root.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  document.documentElement.appendChild(root);

  function draw() {
    root.innerHTML = "";
    layers.forEach((l, i) => {
      const color = palette[i % palette.length];
      const box = document.createElement("div");
      box.style.cssText =
        `position:absolute;left:${l.x}px;top:${l.y}px;width:${Math.max(l.w, 4)}px;height:${Math.max(l.h, 4)}px;` +
        `border:2px solid ${color};background:${color}22;border-radius:3px;box-sizing:border-box;`;
      const tag = document.createElement("div");
      tag.textContent = "z:" + l.z;
      tag.style.cssText =
        `position:absolute;top:-20px;left:-2px;font:600 10px/1.4 monospace;color:#fff;` +
        `background:${color};padding:1px 6px;border-radius:4px;white-space:nowrap;`;
      box.appendChild(tag);
      root.appendChild(box);
    });
  }
  window.__zldRedraw = draw;
  window.addEventListener("scroll", draw, true);
  window.addEventListener("resize", draw, true);
  draw();
  return { on: true };
}

const $ = (id) => document.getElementById(id);
let layers = [];

document.addEventListener("DOMContentLoaded", async () => {
  $("scan").addEventListener("click", scanPage);
  $("overlay").addEventListener("click", toggleOverlay);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
});

async function scanPage() {
  const err = $("error");
  err.hidden = true;
  const btn = $("scan");
  btn.disabled = true;
  btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanLayers });
    layers = (res && res.result ? res.result : []).sort((a, b) => b.z - a.z);
    render();
  } catch (e) {
    err.textContent = "Couldn't scan this page (system pages like chrome:// block extensions).";
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Scan page";
  }
}

function render() {
  const box = $("rows");
  box.innerHTML = "";
  const count = $("count");
  const ov = $("overlay");
  if (!layers.length) {
    count.hidden = true;
    ov.disabled = true;
    const d = document.createElement("div");
    d.className = "empty";
    d.textContent = "No positioned elements with an explicit z-index found.";
    box.appendChild(d);
    return;
  }
  count.hidden = false;
  count.innerHTML = `Found <b>${layers.length}</b> layered elements`;
  ov.disabled = false;
  ov.classList.remove("active");
  ov.textContent = "Show overlay";
  layers.forEach((l, i) => {
    const row = document.createElement("div");
    row.className = "lrow";
    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = PALETTE[i % PALETTE.length];
    const z = document.createElement("div");
    z.className = "zval";
    z.textContent = l.z;
    const sel = document.createElement("div");
    sel.className = "sel";
    sel.textContent = l.sel;
    sel.title = l.sel;
    const tag = document.createElement("span");
    tag.className = "ptag";
    tag.textContent = l.position;
    row.append(sw, z, sel, tag);
    box.appendChild(row);
  });
}

async function toggleOverlay() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !layers.length) return;
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleZOverlay,
      args: [{ layers, palette: PALETTE }],
    });
    const on = res && res.result && res.result.on;
    const ov = $("overlay");
    ov.classList.toggle("active", !!on);
    ov.textContent = on ? "Hide overlay" : "Show overlay";
  } catch (e) {
    /* overlay failed — page may have navigated; scan again */
  }
}
