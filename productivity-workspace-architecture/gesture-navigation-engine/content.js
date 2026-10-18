/* Gesture Navigation Engine — content script.
   Hold the RIGHT mouse button and draw on any page. A glowing trail follows
   the cursor; on release the stroke is reduced to a direction sequence
   (L/R/U/D) and the mapped action runs.
   Purely user-initiated: nothing is recorded, nothing leaves the page. */
(() => {
  "use strict";

  const SEGMENT_PX = 30; // travel needed to register one direction segment
  const MIN_MOVE_PX = 8; // below this it is a plain right-click (menu shows)

  const DEFAULT_MAP = {
    L:  { action: "back",   label: "Go back",         hint: "Draw ←",        enabled: true },
    R:  { action: "forward",label: "Go forward",      hint: "Draw →",        enabled: true },
    UD: { action: "reload", label: "Reload page",     hint: "Draw ↑ then ↓", enabled: true },
    DR: { action: "close",  label: "Close tab",       hint: "Draw ↓ then →", enabled: true },
    U:  { action: "top",    label: "Scroll to top",   hint: "Draw ↑",        enabled: true },
    D:  { action: "bottom", label: "Scroll to bottom",hint: "Draw ↓",        enabled: true },
  };

  let map = structuredClone(DEFAULT_MAP);
  let enabled = true;
  let showTrail = true;

  let drawing = false;
  let moved = false;
  let points = [];
  let canvas = null, ctx = null, label = null;

  loadSettings();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") loadSettings();
  });

  async function loadSettings() {
    try {
      const s = await chrome.storage.local.get({ gneEnabled: true, gneTrail: true, gneMap: null });
      enabled = s.gneEnabled !== false;
      showTrail = s.gneTrail !== false;
      if (s.gneMap) {
        for (const k of Object.keys(DEFAULT_MAP)) {
          map[k] = { ...DEFAULT_MAP[k], enabled: s.gneMap[k] ? s.gneMap[k].enabled !== false : true };
        }
      }
    } catch (e) { /* storage unavailable: keep defaults */ }
  }

  document.addEventListener("mousedown", (e) => {
    if (e.button !== 2 || !enabled || drawing) return;
    drawing = true;
    moved = false;
    points = [{ x: e.clientX, y: e.clientY }];
    if (showTrail) startOverlay();
  }, true);

  document.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const last = points[points.length - 1];
    if (Math.hypot(e.clientX - last.x, e.clientY - last.y) < 4) return;
    points.push({ x: e.clientX, y: e.clientY });
    const fromStart = Math.hypot(e.clientX - points[0].x, e.clientY - points[0].y);
    if (fromStart > MIN_MOVE_PX) moved = true;
    if (canvas) drawSegment(last, points[points.length - 1]);
  }, true);

  document.addEventListener("mouseup", (e) => {
    if (e.button !== 2 || !drawing) return;
    stopOverlay();
    drawing = false;
    if (!moved) { points = []; return; } // plain right-click: menu will open
    e.preventDefault();
    e.stopPropagation();
    const seq = recognize(points).join("");
    points = [];
    const entry = map[seq];
    if (entry && entry.enabled) run(entry.action);
  }, true);

  // Suppress the context menu only when a gesture was actually drawn.
  document.addEventListener("contextmenu", (e) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }
  }, true);

  // Reduce a stroke to a compressed direction sequence, e.g. ["D","R"].
  function recognize(pts) {
    const seq = [];
    let ax = 0, ay = 0, px = pts[0].x, py = pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      ax += pts[i].x - px;
      ay += pts[i].y - py;
      px = pts[i].x; py = pts[i].y;
      if (Math.hypot(ax, ay) >= SEGMENT_PX) {
        const dir = Math.abs(ax) >= Math.abs(ay)
          ? (ax > 0 ? "R" : "L")
          : (ay > 0 ? "D" : "U");
        if (seq[seq.length - 1] !== dir) seq.push(dir);
        ax = 0; ay = 0;
      }
    }
    return seq;
  }

  function run(action) {
    switch (action) {
      case "back": history.back(); break;
      case "forward": history.forward(); break;
      case "reload": location.reload(); break;
      case "top": window.scrollTo({ top: 0, behavior: "smooth" }); break;
      case "bottom":
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        break;
      case "close":
        chrome.runtime.sendMessage({ type: "gne-close-tab" });
        break;
    }
  }

  function startOverlay() {
    const dpr = window.devicePixelRatio || 1;
    canvas = document.createElement("canvas");
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    Object.assign(canvas.style, {
      position: "fixed", inset: "0", width: "100vw", height: "100vh",
      zIndex: "2147483647", pointerEvents: "none",
    });
    document.documentElement.appendChild(canvas);
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(139,92,246,.65)";
    ctx.shadowBlur = 8;

    label = document.createElement("div");
    Object.assign(label.style, {
      position: "fixed", zIndex: "2147483647", pointerEvents: "none",
      background: "rgba(14,14,20,.88)", color: "#fff",
      font: "600 12px/1 -apple-system,'Segoe UI',sans-serif",
      padding: "7px 11px", borderRadius: "8px",
      border: "1px solid rgba(139,92,246,.55)",
    });
    label.textContent = "…";
    document.documentElement.appendChild(label);
  }

  function drawSegment(a, b) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    label.textContent = recognize(points).join(" → ") || "…";
    label.style.left = Math.min(b.x + 14, window.innerWidth - 70) + "px";
    label.style.top = (b.y + 16) + "px";
  }

  function stopOverlay() {
    if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    if (label) { label.remove(); label = null; }
  }
})();
