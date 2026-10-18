/* Keyboard-Only Web Navigator — content script.
 * Binds Vim-style shortcuts on every page. Shortcuts only: nothing is
 * recorded, nothing leaves the page. Skips when the user is typing. */
(() => {
  "use strict";

  const CHEAT = [
    ["j / k", "Scroll down / up"],
    ["d / u", "Half-page down / up"],
    ["g g", "Top of page"],
    ["G", "Bottom of page"],
    ["r", "Reload page"],
    ["x", "Close tab"],
    ["[ / ]", "Previous / next tab"],
    ["?", "Toggle cheatsheet"],
  ];

  let enabled = true;
  let scrollStep = 120;
  let lastG = 0; // timestamp of previous "g" for the "gg" sequence
  let overlay = null;

  /* ---------- settings ---------- */
  async function loadSettings() {
    try {
      const s = await chrome.storage.local.get({ kbnavEnabled: true, kbnavStep: 120 });
      enabled = s.kbnavEnabled !== false;
      scrollStep = Math.max(20, Math.min(600, parseInt(s.kbnavStep, 10) || 120));
    } catch (e) { /* storage unavailable: fall back to defaults */ }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.kbnavEnabled) enabled = changes.kbnavEnabled.newValue !== false;
    if (changes.kbnavStep) scrollStep = Math.max(20, Math.min(600, parseInt(changes.kbnavStep.newValue, 10) || 120));
  });

  /* ---------- helpers ---------- */
  // Never hijack keys while the user is typing (also avoids password fields).
  function isTypingTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
  }

  function scrollPage(frac) {
    window.scrollBy({ top: frac * window.innerHeight, behavior: "smooth" });
  }

  /* ---------- cheatsheet overlay ---------- */
  function buildOverlay() {
    const el = document.createElement("div");
    el.id = "__kbnav_cheat__";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Keyboard shortcuts");
    const rows = CHEAT.map(([k, d]) =>
      `<div class="__kbnav_row__"><kbd>${k}</kbd><span>${d}</span></div>`).join("");
    el.innerHTML = `<div class="__kbnav_title__">Keyboard shortcuts</div>${rows}` +
      `<div class="__kbnav_hint__">Press <kbd>?</kbd> or Esc to close</div>`;
    const css = document.createElement("style");
    css.textContent = `
      #__kbnav_cheat__{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        z-index:2147483647;background:rgba(18,18,26,.92);backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);border:1px solid rgba(139,92,246,.35);
        border-radius:16px;padding:20px 22px;color:#f4f6fb;min-width:320px;max-width:90vw;
        font:13px/1.6 -apple-system,"Segoe UI",Roboto,sans-serif;
        box-shadow:0 24px 64px rgba(0,0,0,.6);}
      #__kbnav_cheat__ .__kbnav_title__{font-weight:700;font-size:15px;margin-bottom:12px;color:#a78bfa;}
      #__kbnav_cheat__ .__kbnav_row__{display:flex;align-items:center;gap:12px;padding:5px 0;}
      #__kbnav_cheat__ kbd{font:600 11px/1 ui-monospace,Menlo,monospace;background:rgba(139,92,246,.15);
        color:#a78bfa;border:1px solid rgba(139,92,246,.4);border-radius:6px;padding:5px 9px;min-width:44px;text-align:center;}
      #__kbnav_cheat__ .__kbnav_hint__{margin-top:12px;font-size:11px;color:#9aa3b5;}
      #__kbnav_cheat__ .__kbnav_hint__ kbd{min-width:0;}`;
    document.documentElement.appendChild(css);
    return el;
  }

  function toggleOverlay() {
    if (overlay) { overlay.remove(); overlay = null; return; }
    overlay = buildOverlay();
    document.documentElement.appendChild(overlay);
  }

  /* ---------- key handling ---------- */
  document.addEventListener("keydown", (e) => {
    if (!enabled || e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser chords alone
    if (isTypingTarget(e.target)) return;

    // Esc always closes the cheatsheet overlay
    if (e.key === "Escape" && overlay) { toggleOverlay(); return; }

    const now = Date.now();
    switch (e.key) {
      case "j": window.scrollBy({ top: scrollStep, behavior: "smooth" }); e.preventDefault(); break;
      case "k": window.scrollBy({ top: -scrollStep, behavior: "smooth" }); e.preventDefault(); break;
      case "d": scrollPage(0.5); e.preventDefault(); break;
      case "u": scrollPage(-0.5); e.preventDefault(); break;
      case "g":
        if (now - lastG < 600) { window.scrollTo({ top: 0, behavior: "smooth" }); lastG = 0; e.preventDefault(); }
        else lastG = now;
        break;
      case "G": window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); e.preventDefault(); break;
      case "r": location.reload(); break;
      case "x": chrome.runtime.sendMessage({ action: "closeTab" }); break;
      case "[": chrome.runtime.sendMessage({ action: "prevTab" }); break;
      case "]": chrome.runtime.sendMessage({ action: "nextTab" }); break;
      case "?": toggleOverlay(); e.preventDefault(); break;
      default: break;
    }
  }, true);

  loadSettings();
})();
