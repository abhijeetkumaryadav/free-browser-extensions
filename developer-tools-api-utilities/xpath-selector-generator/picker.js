/* XPath Selector Generator — element picker (content script).
 * Injected on demand by the popup. Self-contained: toggles itself via a
 * window flag so re-injection cancels picking. The popup closes when the
 * user clicks the page, so results are saved to chrome.storage for the
 * popup to read when reopened.
 */
(() => {
  "use strict";

  const FLAG = "__xpathPickerActive";
  const OVERLAY_ID = "__xpathPickerOverlay";
  const TOAST_ID = "__xpathPickerToast";

  /* ---------- teardown ---------- */

  function removeEl(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function deactivate() {
    window[FLAG] = false;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    removeEl(OVERLAY_ID);
    document.documentElement.style.cursor = "";
  }

  // Toggle: if already picking, this injection cancels it.
  if (window[FLAG]) {
    deactivate();
    toast("Picking cancelled");
    return;
  }

  /* ---------- toast + overlay ---------- */

  function toast(msg) {
    removeEl(TOAST_ID);
    const t = document.createElement("div");
    t.id = TOAST_ID;
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "background:rgba(20,16,28,.92);color:#f4f2f7;font:600 13px/1.4 system-ui;" +
      "padding:10px 18px;border-radius:12px;border:1px solid rgba(139,92,246,.5);" +
      "z-index:2147483647;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.5);";
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function overlay() {
    let o = document.getElementById(OVERLAY_ID);
    if (!o) {
      o = document.createElement("div");
      o.id = OVERLAY_ID;
      o.style.cssText =
        "position:fixed;pointer-events:none;z-index:2147483646;" +
        "border:2px solid #8b5cf6;border-radius:4px;" +
        "background:rgba(139,92,246,.12);" +
        "box-shadow:0 0 0 1px rgba(139,92,246,.35);transition:all .06s;";
      document.documentElement.appendChild(o);
    }
    return o;
  }

  /* ---------- events ---------- */

  function onMove(e) {
    const el = e.target;
    if (!el || el.id === OVERLAY_ID || el.id === TOAST_ID) return;
    if (el.nodeType !== 1) return;
    const r = el.getBoundingClientRect();
    const o = overlay();
    o.style.left = r.left + "px";
    o.style.top = r.top + "px";
    o.style.width = r.width + "px";
    o.style.height = r.height + "px";
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (!el || el.nodeType !== 1 || el.id === OVERLAY_ID) { deactivate(); return; }
    const xpaths = buildXPaths(el);
    const data = {
      xpaths: xpaths.map((x) => ({ ...x, count: countMatches(x.xpath) })),
      tag: el.tagName.toLowerCase(),
      url: location.href,
      at: Date.now(),
    };
    chrome.storage.local.set({ lastPick: data }).then(() => {
      deactivate();
      toast("Captured — reopen the extension to copy the XPaths");
    });
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      deactivate();
      toast("Picking cancelled");
    }
  }

  /* ---------- XPath builders ---------- */

  function segment(el) {
    let idx = 1;
    let sib = el.previousElementSibling;
    while (sib) {
      if (sib.tagName === el.tagName) idx++;
      sib = sib.previousElementSibling;
    }
    return el.tagName.toLowerCase() + "[" + idx + "]";
  }

  function absoluteXPath(el) {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1) {
      parts.unshift(segment(n));
      n = n.parentElement;
    }
    return "/" + parts.join("/");
  }

  function idXPath(el) {
    const down = [];
    let n = el;
    while (n && n.nodeType === 1) {
      if (n.id) {
        const safe = n.id.replace(/"/g, "");
        return '//*[@id="' + safe + '"]' + (down.length ? "/" + down.join("/") : "");
      }
      down.unshift(segment(n));
      n = n.parentElement;
    }
    return absoluteXPath(el);
  }

  function robustXPath(el) {
    const tag = el.tagName.toLowerCase();
    const preds = [];
    const attrs = ["data-testid", "data-test", "data-qa", "name", "aria-label", "title", "alt", "type", "placeholder"];
    for (const a of attrs) {
      const v = el.getAttribute(a);
      if (v && v.trim()) { preds.push("@" + a + '="' + v.trim().replace(/"/g, "") + '"'); break; }
    }
    if (!preds.length) {
      const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean);
      if (cls.length) preds.push('contains(@class,"' + cls[0].replace(/"/g, "") + '")');
    }
    if (!preds.length) {
      const text = (el.innerText || "").trim().split("\n")[0].slice(0, 40).replace(/"/g, "");
      if (text) preds.push('contains(.,"' + text + '")');
    }
    return "//" + tag + (preds.length ? "[" + preds.join(" and ") + "]" : "");
  }

  function buildXPaths(el) {
    return [
      { label: "Robust", xpath: robustXPath(el) },
      { label: "ID-based", xpath: idXPath(el) },
      { label: "Absolute", xpath: absoluteXPath(el) },
    ];
  }

  function countMatches(xpath) {
    try {
      const r = document.evaluate(
        "count(" + xpath + ")", document, null,
        XPathResult.NUMBER_TYPE, null
      );
      return Math.round(r.numberValue);
    } catch (e) {
      return -1;
    }
  }

  /* ---------- activate ---------- */

  window[FLAG] = true;
  document.documentElement.style.cursor = "crosshair";
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  toast("Click an element — Esc to cancel");
})();
