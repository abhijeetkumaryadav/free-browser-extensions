/* Markdown Toolbar — content script: floating markdown toolbar above the focused field.
   Boot-once guard; everything removable; page content never touched. */
"use strict";
if (!window.__mdToolbarLoaded) {
  window.__mdToolbarLoaded = true;

  const ACCENT = "#a78bfa";
  let bar = null;      // toolbar element
  let active = false;  // attach mode armed

  /** CSS injected once for the toolbar. */
  function ensureStyle() {
    if (document.getElementById("__mdtb-style")) return;
    const s = document.createElement("style");
    s.id = "__mdtb-style";
    s.textContent = `
      .__mdtb { position: absolute; z-index: 2147483647; display: flex; gap: 4px;
        background: rgba(20,20,27,.95); border: 1px solid rgba(167,139,250,.35);
        border-radius: 10px; padding: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
        backdrop-filter: blur(12px); font-family: system-ui, sans-serif; }
      .__mdtb button { background: transparent; border: 1px solid transparent; color: #e8e8ef;
        font-size: 12px; font-weight: 700; border-radius: 6px; padding: 5px 9px; cursor: pointer;
        font-family: system-ui, sans-serif; }
      .__mdtb button:hover { border-color: rgba(167,139,250,.5); background: rgba(167,139,250,.12); }
      .__mdtb .__mdtb-x { color: #9a9aad; }
    `;
    document.documentElement.appendChild(s);
  }

  /** Markdown wrappers: [before, after, placeholder]. */
  const ACTIONS = [
    ["B", ["**", "**", "bold"]],
    ["I", ["*", "*", "italic"]],
    ["</>", ["`", "`", "code"]],
    ["🔗", ["[", "](url)", "link text"]],
    ["•", ["- ", "", "list item"]],
    ["H", ["## ", "", "heading"]],
  ];

  /** Wrap the selection of a textarea/input with markdown markers. */
  function wrapSelection(el, before, after, placeholder) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const sel = el.value.slice(start, end) || placeholder;
    const out = el.value.slice(0, start) + before + sel + after + el.value.slice(end);
    el.value = out;
    const caret = start + before.length + sel.length + after.length;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  }

  /** Handle contenteditable elements. */
  function wrapEditable(el, before, after, placeholder) {
    const sel = window.getSelection();
    const text = sel && sel.toString() ? sel.toString() : placeholder;
    if (sel && sel.rangeCount) sel.deleteContents();
    const node = document.createTextNode(before + text + after);
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range) { range.insertNode(node); range.collapse(false); }
    else el.appendChild(node);
  }

  /** Build the toolbar element. */
  function buildBar() {
    ensureStyle();
    bar = document.createElement("div");
    bar.className = "__mdtb";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Markdown formatting toolbar");
    for (const [label, [before, after, ph]] of ACTIONS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = "Wrap selection: " + ph;
      b.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus on field
      b.addEventListener("click", () => {
        const t = currentTarget();
        if (!t) return;
        if (t.isContentEditable) wrapEditable(t, before, after, ph);
        else wrapSelection(t, before, after, ph);
      });
      bar.appendChild(b);
    }
    const x = document.createElement("button");
    x.type = "button"; x.textContent = "✕"; x.className = "__mdtb-x"; x.title = "Remove toolbar";
    x.addEventListener("click", removeBar);
    bar.appendChild(x);
    document.documentElement.appendChild(bar);
  }

  let lastTarget = null;
  function currentTarget() {
    const el = document.activeElement;
    if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable)) return el;
    return lastTarget;
  }

  /** Position the toolbar just above the target element. */
  function placeBar(el) {
    const r = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - 320, r.left + window.scrollX));
    const y = Math.max(8, r.top + window.scrollY - bar.offsetHeight - 8);
    bar.style.left = x + "px";
    bar.style.top = y + "px";
  }

  function onFocusIn(e) {
    const t = e.target;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) {
      lastTarget = t;
      if (active && bar) { bar.style.display = "flex"; placeBar(t); }
    }
  }

  function removeBar() {
    if (bar) { bar.remove(); bar = null; }
    active = false;
    document.removeEventListener("focusin", onFocusIn, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.cmd === "attach") {
      if (!bar) buildBar();
      active = true;
      document.addEventListener("focusin", onFocusIn, true);
      const t = currentTarget();
      if (t) { bar.style.display = "flex"; placeBar(t); }
      sendResponse({ ok: true });
    } else if (msg.cmd === "remove") {
      removeBar();
      sendResponse({ ok: true });
    }
    return true;
  });
}
