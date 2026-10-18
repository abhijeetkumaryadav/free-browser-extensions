/* DualSubs overlay — injected on demand into the page's isolated world.
 * Finds the largest visible <video>, tracks its rect, and renders two
 * user-provided SRT cue lines synced to playback time. Read-only overlay;
 * never touches page scripts or network. Safe to inject twice. */
"use strict";

(() => {
  if (window.__dualSubs) {
    // Already injected: the popup will just re-send state via messages.
    return;
  }

  const S = (window.__dualSubs = {
    primary: null,      // { name, cues: [{start,end,text}] } | null
    secondary: null,
    settings: {
      enabled: true,
      primaryOffset: 0,
      secondaryOffset: 0,
      fontSize: 20,
      bgOpacity: 55,
    },
    overlay: null,
    linePrimary: null,
    lineSecondary: null,
    rafId: 0,
  });

  /* ---------- DOM ---------- */

  function buildOverlay() {
    const el = document.createElement("div");
    el.id = "__dualsubs_overlay";
    el.style.cssText = [
      "position:fixed", "z-index:2147483647", "pointer-events:none",
      "display:none", "text-align:center",
    ].join(";");
    const mkLine = () => {
      const d = document.createElement("div");
      d.style.cssText = [
        "display:inline-block", "color:#fff", "font-weight:600",
        "line-height:1.35", "padding:0.15em 0.5em", "border-radius:0.3em",
        "white-space:pre-wrap", "max-width:92%",
      ].join(";");
      el.appendChild(d);
      el.appendChild(document.createElement("br"));
      return d;
    };
    S.linePrimary = mkLine();
    S.lineSecondary = mkLine();
    document.documentElement.appendChild(el);
    S.overlay = el;
  }

  function applyStyle() {
    const { fontSize, bgOpacity } = S.settings;
    const bg = `rgba(0,0,0,${(bgOpacity / 100).toFixed(2)})`;
    for (const [line, scale] of [[S.linePrimary, 1], [S.lineSecondary, 0.72]]) {
      line.style.fontSize = `${Math.round(fontSize * scale)}px`;
      line.style.background = bg;
      line.style.textShadow = "0 1px 3px rgba(0,0,0,.8)";
    }
  }

  /** Pick the largest visible video on the page. */
  function findVideo() {
    let best = null, bestArea = 0;
    for (const v of document.querySelectorAll("video")) {
      const r = v.getBoundingClientRect();
      if (r.width < 120 || r.height < 60) continue;
      const area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = v; }
    }
    return best;
  }

  /** Binary search: cue active at time t (ms), or null. */
  function cueAt(cues, t) {
    let lo = 0, hi = cues.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= t) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (ans < 0) return null;
    const c = cues[ans];
    return t < c.end ? c : null;
  }

  /* ---------- Render loop ---------- */

  function tick() {
    const video = findVideo();
    const on = S.settings.enabled && (S.primary?.cues.length || S.secondary?.cues.length);
    if (!on || !video) {
      if (S.overlay) S.overlay.style.display = "none";
      S.rafId = requestAnimationFrame(tick);
      return;
    }
    const r = video.getBoundingClientRect();
    const o = S.overlay;
    o.style.display = "block";
    o.style.left = `${r.left + window.scrollX}px`;
    o.style.top = `${r.bottom + window.scrollY - Math.min(r.height * 0.28, 220)}px`;
    o.style.width = `${r.width}px`;

    const t = video.currentTime * 1000;
    const p = S.primary?.cues.length
      ? cueAt(S.primary.cues, t + S.settings.primaryOffset) : null;
    const s = S.secondary?.cues.length
      ? cueAt(S.secondary.cues, t + S.settings.secondaryOffset) : null;

    S.linePrimary.textContent = p ? p.text : "";
    S.linePrimary.style.display = p ? "" : "none";
    S.lineSecondary.textContent = s ? s.text : "";
    S.lineSecondary.style.display = s ? "" : "none";
    o.style.display = (p || s) ? "block" : "none";

    S.rafId = requestAnimationFrame(tick);
  }

  /* ---------- Messaging ---------- */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "init") {
      if (!S.overlay) { buildOverlay(); }
      S.primary = msg.primary;
      S.secondary = msg.secondary;
      if (msg.settings) S.settings = { ...S.settings, ...msg.settings };
      applyStyle();
      if (!S.rafId) S.rafId = requestAnimationFrame(tick);
      sendResponse({ ok: true, videoFound: !!findVideo() });
    } else if (msg.type === "updateSettings") {
      S.settings = { ...S.settings, ...msg.settings };
      applyStyle();
      sendResponse({ ok: true });
    } else if (msg.type === "clear") {
      S.primary = null;
      S.secondary = null;
      if (S.overlay) S.overlay.style.display = "none";
      sendResponse({ ok: true });
    }
    return false;
  });
})();
