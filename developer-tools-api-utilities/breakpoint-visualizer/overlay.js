// Breakpoint Visualizer — overlay content script (injected on demand via chrome.scripting).
// Toggles itself: removes the panel if already present, otherwise renders it.
// Self-contained IIFE with scoped styles; no external dependencies.

(() => {
  const ROOT_ID = "__bpv-root";

  // Toggle off if already injected.
  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    existing.remove();
    window.removeEventListener("resize", window.__bpvResize);
    window.__bpvResize = null;
    return;
  }

  const DEFAULTS = [
    { name: "Mobile", min: 0 },
    { name: "Tablet", min: 640 },
    { name: "Desktop", min: 1024 },
    { name: "Wide", min: 1440 },
  ];
  const POSITIONS = {
    "top-left": "top:12px;left:12px;",
    "top-right": "top:12px;right:12px;",
    "bottom-left": "bottom:12px;left:12px;",
    "bottom-right": "bottom:12px;right:12px;",
  };

  const state = { breakpoints: DEFAULTS, position: "bottom-right" };

  const css = `
    #${ROOT_ID} { position: fixed; z-index: 2147483647; font-family: -apple-system,"Segoe UI",Roboto,Inter,sans-serif;
      background: rgba(20,20,26,.78); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 12px 14px; color: #f4f6fb;
      box-shadow: 0 8px 28px rgba(0,0,0,.45); min-width: 190px; }
    #${ROOT_ID} .bpv-size { font-size: 19px; font-weight: 700; letter-spacing: .3px; }
    #${ROOT_ID} .bpv-size span { color: #10b981; }
    #${ROOT_ID} .bpv-active { font-size: 11px; color: #9aa3b5; margin-top: 2px; }
    #${ROOT_ID} .bpv-active b { color: #10b981; }
    #${ROOT_ID} .bpv-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    #${ROOT_ID} .bpv-chip { font-size: 10px; font-weight: 600; border-radius: 6px; padding: 3px 7px;
      background: rgba(255,255,255,.06); color: #9aa3b5; border: 1px solid rgba(255,255,255,.07); }
    #${ROOT_ID} .bpv-chip.on { background: rgba(16,185,129,.16); color: #10b981; border-color: rgba(16,185,129,.4); }
    #${ROOT_ID} .bpv-close { position: absolute; top: 6px; right: 8px; background: none; border: 0;
      color: #9aa3b5; cursor: pointer; font-size: 14px; line-height: 1; padding: 2px; }
    #${ROOT_ID} .bpv-close:hover { color: #f06666; }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  const root = document.createElement("div");
  root.id = ROOT_ID;

  function activeBp() {
    const w = window.innerWidth;
    const sorted = [...state.breakpoints].sort((a, b) => a.min - b.min);
    let cur = sorted[0] || null;
    for (const bp of sorted) if (w >= bp.min) cur = bp;
    return cur;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function render() {
    const w = window.innerWidth, h = window.innerHeight;
    const active = activeBp();
    const chips = [...state.breakpoints]
      .sort((a, b) => a.min - b.min)
      .map((bp) => `<span class="bpv-chip${active && bp.name === active.name && bp.min === active.min ? " on" : ""}">${esc(bp.name)} ${bp.min}</span>`)
      .join("");
    root.innerHTML = `
      <button class="bpv-close" title="Close">×</button>
      <div class="bpv-size"><span>${w}</span> × ${h}</div>
      <div class="bpv-active">active: <b>${active ? esc(active.name) : "—"}</b></div>
      <div class="bpv-chips">${chips}</div>`;
    root.querySelector(".bpv-close").addEventListener("click", () => {
      root.remove();
      const st = document.querySelector("style[data-bpv]");
      if (st) st.remove();
      window.removeEventListener("resize", window.__bpvResize);
      window.__bpvResize = null;
    });
  }

  function applyPosition() {
    root.style.cssText = POSITIONS[state.position] || POSITIONS["bottom-right"];
  }

  async function loadSettings() {
    try {
      const { bv } = await chrome.storage.local.get("bv");
      if (bv) {
        if (Array.isArray(bv.breakpoints) && bv.breakpoints.length) state.breakpoints = bv.breakpoints;
        if (bv.position) state.position = bv.position;
      }
    } catch (e) { /* storage unavailable — keep defaults */ }
    applyPosition();
    render();
  }

  // Live updates when the popup edits breakpoints or position.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.bv || !document.getElementById(ROOT_ID)) return;
    const bv = changes.bv.newValue || {};
    if (Array.isArray(bv.breakpoints) && bv.breakpoints.length) state.breakpoints = bv.breakpoints;
    if (bv.position) state.position = bv.position;
    applyPosition();
    render();
  });

  window.__bpvResize = render;
  window.addEventListener("resize", window.__bpvResize);

  style.setAttribute("data-bpv", "1");
  document.documentElement.appendChild(style);
  document.documentElement.appendChild(root);
  loadSettings();
})();
