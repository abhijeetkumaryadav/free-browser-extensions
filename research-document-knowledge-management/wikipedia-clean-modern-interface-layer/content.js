/* WikiClean — content script
 * Applies a CSS-only reading layer on wikipedia.org pages.
 * Runs at document_start; preferences are per-wiki (host) and stored locally.
 * Everything is reversible: disabling removes the injected <style> element.
 */
(() => {
  "use strict";

  const STYLE_ID = "wikiclean-style";
  const CLASS_ON = "wikiclean-on";
  const HOST = location.hostname;

  const DEFAULTS = {
    enabled: false,
    theme: "light",      // light | dark | sepia
    hideSidebar: true,
    hideToc: true,
    hideHeader: true,
    fontSize: 18         // px
  };

  /* ---------- CSS builder ---------- */
  function buildCss(prefs) {
    const fs = Number(prefs.fontSize) || 18;
    const lineHeight = (fs * 1.75).toFixed(1);

    // Theme palettes: page background, text, muted, link, panel/card
    const themes = {
      light: { bg: "#fafaf8", ink: "#1f2937", muted: "#6b7280", link: "#0d6efd", card: "#ffffff", border: "#e5e7eb", note: "#f3f4f6" },
      dark:  { bg: "#121417", ink: "#e5e7eb", muted: "#9ca3af", link: "#7dd3fc", card: "#1a1d21", border: "#2a2e35", note: "#1a1d21" },
      sepia: { bg: "#f4ecd8", ink: "#433422", muted: "#8a7a5c", link: "#8b5e34", card: "#faf3e3", border: "#e0d3b3", note: "#ece0c6" }
    };
    const t = themes[prefs.theme] || themes.light;

    let css = `
/* ==== WikiClean reading layer ==== */
html.${CLASS_ON} {
  background: ${t.bg} !important;
}
html.${CLASS_ON} body {
  background: ${t.bg} !important;
  color: ${t.ink} !important;
}
html.${CLASS_ON} .mw-page-container,
html.${CLASS_ON} #content,
html.${CLASS_ON} .mw-body {
  background: ${t.bg} !important;
  border: none !important;
  box-shadow: none !important;
}
/* Center the article column, comfortable measure */
html.${CLASS_ON} .mw-body-content,
html.${CLASS_ON} #bodyContent {
  max-width: 74ch !important;
  margin: 0 auto !important;
  padding: 2.5rem 1.5rem 6rem !important;
  font-size: ${fs}px !important;
  line-height: ${lineHeight}px !important;
  font-family: "Charter", "Georgia", "Source Serif 4", serif !important;
  color: ${t.ink} !important;
}
html.${CLASS_ON} .mw-body h1,
html.${CLASS_ON} .mw-body h2,
html.${CLASS_ON} .mw-body h3 {
  font-family: -apple-system, "Segoe UI", "Inter", sans-serif !important;
  color: ${t.ink} !important;
  border-bottom: 1px solid ${t.border} !important;
  letter-spacing: -0.01em;
}
html.${CLASS_ON} .mw-body p,
html.${CLASS_ON} .mw-body li {
  color: ${t.ink} !important;
}
html.${CLASS_ON} .mw-body a { color: ${t.link} !important; }
html.${CLASS_ON} .mw-body a:visited { opacity: 0.75; }
/* Tables, infoboxes, navboxes → cards */
html.${CLASS_ON} .infobox,
html.${CLASS_ON} .navbox,
html.${CLASS_ON} table.wikitable,
html.${CLASS_ON} .ambox,
html.${CLASS_ON} .hatnote {
  background: ${t.card} !important;
  color: ${t.ink} !important;
  border: 1px solid ${t.border} !important;
  border-radius: 10px !important;
  overflow: hidden;
}
html.${CLASS_ON} table.wikitable th,
html.${CLASS_ON} .infobox th {
  background: ${t.note} !important;
  color: ${t.ink} !important;
}
html.${CLASS_ON} table.wikitable td,
html.${CLASS_ON} .infobox td { color: ${t.ink} !important; border-color: ${t.border} !important; }
/* Images */
html.${CLASS_ON} .thumb, html.${CLASS_ON} .thumbinner {
  background: ${t.card} !important;
  border: 1px solid ${t.border} !important;
  border-radius: 10px !important;
}
html.${CLASS_ON} .thumbcaption { color: ${t.muted} !important; }
/* References / footnotes */
html.${CLASS_ON} .references, html.${CLASS_ON} .reflist {
  font-size: 0.82em !important;
  color: ${t.muted} !important;
}
html.${CLASS_ON} .mw-editsection, html.${CLASS_ON} .mw-editsection-bracket { display: none !important; }
`;

    if (prefs.hideSidebar) {
      css += `
html.${CLASS_ON} #mw-panel, html.${CLASS_ON} .vector-sidebar,
html.${CLASS_ON} #p-navigation, html.${CLASS_ON} #p-tb { display: none !important; }
`;
    }
    if (prefs.hideToc) {
      css += `
html.${CLASS_ON} #toc, html.${CLASS_ON} .toc,
html.${CLASS_ON} #vector-toc, html.${CLASS_ON} .vector-toc { display: none !important; }
`;
    }
    if (prefs.hideHeader) {
      css += `
html.${CLASS_ON} .vector-header, html.${CLASS_ON} #mw-head,
html.${CLASS_ON} #mw-page-base, html.${CLASS_ON} #mw-head-base { display: none !important; }
`;
    }
    return css;
  }

  /* ---------- apply / remove ---------- */
  function apply(prefs) {
    const root = document.documentElement;
    let style = document.getElementById(STYLE_ID);
    if (!prefs.enabled) {
      if (style) style.remove();
      root.classList.remove(CLASS_ON);
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    style.textContent = buildCss(prefs);
    root.classList.add(CLASS_ON);
  }

  async function loadPrefs() {
    const stored = await chrome.storage.local.get("wikiclean");
    const all = stored.wikiclean || {};
    return { ...DEFAULTS, ...(all[HOST] || {}) };
  }

  async function refresh() {
    apply(await loadPrefs());
  }

  // Apply as early as possible, then again when the DOM is ready.
  refresh();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  }

  // Popup tells us when preferences change.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "wikiclean-refresh") refresh();
  });
})();
