// Dark Mode Inverter Engine — auto-apply content script.
// Runs at document_start on remembered sites; reads this site's
// settings from on-device storage and installs the inversion style.

(function () {
  const STYLE_ID = "dmi-dark-style";
  const host = location.hostname.replace(/^www\./, "");

  function buildCss(dim, contrast) {
    const b = (dim / 100).toFixed(2);
    const c = (contrast / 100).toFixed(2);
    return (
      `html.dmi-on { filter: invert(1) hue-rotate(180deg) brightness(${b}) contrast(${c}) !important; background: #0b0b0f !important; }\n` +
      `html.dmi-on img, html.dmi-on video, html.dmi-on picture, html.dmi-on svg, html.dmi-on canvas, html.dmi-on [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }`
    );
  }

  chrome.storage.local.get("sites").then(({ sites = {} }) => {
    const s = sites[host];
    if (!s) return;
    const root = document.documentElement;
    root.classList.add("dmi-on");
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = buildCss(s.dim, s.contrast);
    (document.head || root).appendChild(el);
  }).catch(() => {});
})();
