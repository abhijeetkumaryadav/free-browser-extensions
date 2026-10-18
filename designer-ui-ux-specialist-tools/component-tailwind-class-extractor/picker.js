/* Component Class Extractor — on-demand element picker (injected via scripting).
 * Read-only: highlights hovered elements, and on click extracts tag, classes,
 * id and key computed styles. Nothing on the page is modified. */
(() => {
  // Avoid double-injection if the user spams the pick button.
  if (window.__ctePicking) return;
  window.__ctePicking = true;

  const OVERLAY_ID = "__cte_highlight";

  // Reusable highlight box.
  const box = document.createElement("div");
  box.id = OVERLAY_ID;
  Object.assign(box.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483647",
    border: "2px solid #8b5cf6",
    background: "rgba(139,92,246,.12)",
    borderRadius: "4px",
    display: "none",
  });
  document.documentElement.appendChild(box);

  /** Key computed styles worth keeping in a component snippet. */
  const STYLE_KEYS = [
    "display", "position", "flex-direction", "align-items", "justify-content",
    "gap", "margin", "padding", "width", "height",
    "font-size", "font-weight", "line-height", "color",
    "background-color", "border", "border-radius",
    "text-align", "cursor", "opacity",
  ];

  function pickStyles(el) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const k of STYLE_KEYS) {
      const v = cs.getPropertyValue(k);
      if (v && v !== "" && v !== "none" && v !== "normal" && v !== "0px" &&
          v !== "rgba(0, 0, 0, 0)" && v !== "auto" && v !== "static" &&
          v !== "start" && v !== "stretch") {
        out[k] = v.trim();
      }
    }
    return out;
  }

  function describe(el) {
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: Array.from(el.classList),
      styles: pickStyles(el),
      text: (el.innerText || "").trim().slice(0, 80) || null,
    };
  }

  /** Compact child tree (depth-limited) for the "With children" mode. */
  function describeTree(el, depth, maxDepth) {
    const node = describe(el);
    if (depth >= maxDepth) return node;
    const kids = [];
    for (const child of el.children) {
      if (kids.length >= 30) break; // sanity cap
      kids.push(describeTree(child, depth + 1, maxDepth));
    }
    if (kids.length) node.children = kids;
    return node;
  }

  function cleanup() {
    window.__ctePicking = false;
    box.remove();
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
    const t = e.target;
    const depth = document.documentElement.dataset.cteDepth === "tree" ? 3 : 0;
    const data = depth > 0 ? describeTree(t, 0, depth) : describe(t);
    cleanup();
    chrome.runtime.sendMessage({ type: "cte-result", data });
  }

  function onKey(e) {
    if (e.key === "Escape") {
      cleanup();
      chrome.runtime.sendMessage({ type: "cte-cancel" });
    }
  }

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
})();
