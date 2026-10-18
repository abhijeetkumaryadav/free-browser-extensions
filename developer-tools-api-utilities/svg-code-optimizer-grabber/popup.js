// SVG Code Optimizer Grabber — popup logic.
// collectSvgs() is injected into the page; keep it self-contained.

function collectSvgs() {
  const out = [];
  const nodes = document.querySelectorAll("svg");
  for (let i = 0; i < Math.min(nodes.length, 60); i++) {
    const el = nodes[i];
    const r = el.getBoundingClientRect();
    out.push({
      html: el.outerHTML,
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  }
  return out;
}

const $ = (id) => document.getElementById(id);
let found = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("back").addEventListener("click", showList);
  $("copyBtn").addEventListener("click", copyCode);
  $("dlBtn").addEventListener("click", downloadSvg);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
}

// --- basic, safe optimizer: comments, whitespace, decimal rounding, default attrs ---
function optimizeSvg(src) {
  let s = src;
  s = s.replace(/<!--[\s\S]*?-->/g, "");                 // strip comments
  s = s.replace(/>\s+</g, "><");                          // collapse between tags
  s = s.replace(/\s{2,}/g, " ");                          // collapse whitespace runs
  s = s.replace(/(\d+\.\d{3,})/g, (m) =>                  // round long decimals to 2dp
    String(parseFloat(parseFloat(m).toFixed(2))));
  s = s.replace(/\s(fill="#000"|fill="#000000"|fill="black")/gi, ""); // default fill
  s = s.replace(/\sstroke="none"/gi, "");                 // default stroke
  s = s.replace(/\sstroke-width="1"/gi, "");              // default stroke-width
  s = s.replace(/\s(opacity|fill-opacity|stroke-opacity)="1"/gi, "");
  s = s.replace(/"\s+>/g, '">');
  return s.trim();
}

function byteLen(s) {
  return new TextEncoder().encode(s).length;
}

function fmtBytes(n) {
  return n < 1024 ? n + " B" : (n / 1024).toFixed(1) + " KB";
}

function dataUri(svg) {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: collectSvgs,
    });
    found = (res && res.result) || [];
    renderList();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t scan this page — try a regular website tab.";
  } finally {
    btn.disabled = false; btn.textContent = "Scan";
  }
}

function renderList() {
  const box = $("list");
  box.innerHTML = "";
  $("empty").style.display = found.length ? "none" : "";
  if (!found.length) {
    $("empty").innerHTML = "No inline <b>&lt;svg&gt;</b> elements found on this page.";
    return;
  }
  found.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "svg-row";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.alt = "";
    try { img.src = dataUri(item.html); } catch (e) {}
    thumb.appendChild(img);
    const meta = document.createElement("div");
    meta.className = "meta";
    const b = document.createElement("b");
    b.textContent = `SVG #${i + 1}`;
    const sp = document.createElement("span");
    sp.textContent = `${item.w || "?"}×${item.h || "?"} px · ${fmtBytes(byteLen(item.html))}`;
    meta.append(b, sp);
    const chev = document.createElement("div");
    chev.className = "chev"; chev.textContent = "›";
    row.append(thumb, meta, chev);
    row.addEventListener("click", () => showDetail(i));
    box.appendChild(row);
  });
}

function showList() {
  $("detailView").hidden = true;
  $("listView").hidden = false;
}

function showDetail(i) {
  const item = found[i];
  if (!item) return;
  $("listView").hidden = true;
  $("detailView").hidden = false;
  const before = byteLen(item.html);
  const optimized = optimizeSvg(item.html);
  const after = byteLen(optimized);
  const saved = before - after;
  $("preview").src = dataUri(optimized);
  $("stBefore").textContent = fmtBytes(before);
  $("stAfter").textContent = fmtBytes(after);
  $("stSaved").textContent = (saved >= 0 ? "−" : "+") + fmtBytes(Math.abs(saved)) +
    ` (${before ? Math.round((saved / before) * 100) : 0}%)`;
  $("code").value = optimized;
  $("code").dataset.index = i;
}

async function copyCode() {
  const btn = $("copyBtn");
  try {
    await navigator.clipboard.writeText($("code").value);
    btn.textContent = "Copied!";
  } catch (e) {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => { btn.textContent = "Copy code"; }, 1400);
}

function downloadSvg() {
  const i = parseInt($("code").dataset.index || "0", 10);
  let code = $("code").value;
  if (!/xmlns=/.test(code)) {
    code = code.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([code], { type: "image/svg+xml" }));
  a.download = `svg-${i + 1}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
