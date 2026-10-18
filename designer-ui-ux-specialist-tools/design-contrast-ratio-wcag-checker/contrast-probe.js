/* Contrast Ratio WCAG Checker — on-demand content probe (injected via scripting).
 * Read-only: computes WCAG contrast ratios for picked text elements or scans
 * the page for the worst offenders. Nothing on the page is modified. */
(() => {
  if (window.__dccActive) return; // already injected
  window.__dccActive = true;

  /* ---------- WCAG math ---------- */

  function parseColor(str) {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
  }

  function luminance({ r, g, b }) {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function ratio(fg, bg) {
    const l1 = luminance(fg), l2 = luminance(bg);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function toHex({ r, g, b }) {
    const h = (c) => Math.round(c).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  /** Walk up the DOM for the first non-transparent background color. */
  function effectiveBackground(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) return { r: bg.r, g: bg.g, b: bg.b };
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255 }; // page default
  }

  function isLargeText(el) {
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize) || 16;
    const bold = parseInt(cs.fontWeight, 10) >= 700 || cs.fontWeight === "bold";
    return px >= 24 || (bold && px >= 18.66);
  }

  function describe(el) {
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color) || { r: 0, g: 0, b: 0 };
    const bg = effectiveBackground(el);
    const r = ratio(fg, bg);
    const large = isLargeText(el);
    return {
      ratio: Math.round(r * 100) / 100,
      fg: toHex(fg),
      bg: toHex(bg),
      large,
      fontSize: cs.fontSize,
      tag: el.tagName.toLowerCase(),
      classes: Array.from(el.classList).slice(0, 4),
      text: (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 60) || null,
    };
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }

  /* ---------- page scan ---------- */

  function scanPage() {
    const seen = new Set();
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && out.length < 400) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (!isVisible(el)) continue;
      const d = describe(el);
      out.push(d);
    }
    out.sort((a, b) => a.ratio - b.ratio);
    return out.slice(0, 25);
  }

  /* ---------- element picker ---------- */

  const OVERLAY_ID = "__dcc_highlight";
  let picking = false;
  let box = null;

  function startPicking() {
    if (picking) return;
    picking = true;
    box = document.createElement("div");
    box.id = OVERLAY_ID;
    Object.assign(box.style, {
      position: "fixed", pointerEvents: "none", zIndex: "2147483647",
      border: "2px solid #f59e0b", background: "rgba(245,158,11,.12)",
      borderRadius: "4px", display: "none",
    });
    document.documentElement.appendChild(box);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  }

  function stopPicking() {
    picking = false;
    if (box) box.remove();
    box = null;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
  }

  function onMove(e) {
    const t = e.target;
    if (!t || t === box || !(t instanceof Element)) { box.style.display = "none"; return; }
    const r = t.getBoundingClientRect();
    Object.assign(box.style, {
      display: "block",
      left: r.left + "px", top: r.top + "px",
      width: r.width + "px", height: r.height + "px",
    });
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const data = describe(e.target);
    stopPicking();
    chrome.runtime.sendMessage({ type: "dcc-result", data });
  }

  function onKey(e) {
    if (e.key === "Escape") {
      stopPicking();
      chrome.runtime.sendMessage({ type: "dcc-cancel" });
    }
  }

  /* ---------- message interface ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "dcc-pick") { startPicking(); sendResponse({ ok: true }); }
    else if (msg.type === "dcc-scan") { sendResponse({ ok: true, results: scanPage() }); }
    return true;
  });
})();
