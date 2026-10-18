// PanelGlow — filter.js (content script)
// Applies the user's display settings to the page via CSS filters.
// Everything is reversible: resetting restores the original page exactly.
(function () {
  "use strict";

  const STYLE_ID = "panelglow-filter-style";

  /**
   * Build a CSS filter string from settings.
   * @param {object} s { brightness, contrast, grayscale, invert } each in percent
   */
  function buildFilter(s) {
    return (
      "brightness(" + s.brightness / 100 + ") " +
      "contrast(" + s.contrast / 100 + ") " +
      "grayscale(" + s.grayscale / 100 + ") " +
      "invert(" + s.invert / 100 + ")"
    );
  }

  function isDefault(s) {
    return s.brightness === 100 && s.contrast === 100 && s.grayscale === 0 && s.invert === 0;
  }

  function apply(s) {
    remove();
    if (isDefault(s)) return; // nothing to change
    const style = document.createElement("style");
    style.id = STYLE_ID;
    // Apply to the root element so fixed overlays match the rest of the page.
    style.textContent =
      "html { filter: " + buildFilter(s) + " !important; }";
    (document.head || document.documentElement).appendChild(style);
  }

  function remove() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  // Single entry point called by the popup via chrome.scripting.
  window.__panelGlowApply = apply;
  window.__panelGlowRemove = remove;

  // Apply stored settings for this host automatically when the page loads.
  try {
    const host = location.hostname;
    chrome.storage.local.get(["panelglow_sites"], (res) => {
      const sites = res.panelglow_sites || {};
      if (sites[host]) apply(sites[host]);
    });
  } catch (e) {
    /* storage unavailable — popup can still apply manually */
  }
})();
