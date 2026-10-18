// GamutCheck popup — reports browser-exposed display color info + visual swatch comparison.
// Purely informational: no tabs, no scripting, no network. Only storage for nothing critical
// (kept for consistency of permissions; actually unused — see README).
(function () {
  "use strict";

  // --- What the browser actually exposes ------------------------------------
  function setReport(id, text, ok) {
    const el = document.getElementById(id);
    el.innerHTML = "";
    const badge = document.createElement("span");
    badge.className = "badge " + (ok ? "yes" : "no");
    badge.textContent = text;
    el.appendChild(badge);
  }

  const colorDepth = (typeof screen !== "undefined" && screen.colorDepth) || "unknown";
  const pixelDepth = (typeof screen !== "undefined" && screen.pixelDepth) || "unknown";

  document.getElementById("colorDepth").textContent = String(colorDepth) + "-bit";
  document.getElementById("pixelDepth").textContent = String(pixelDepth) + "-bit";

  // CSS media feature: does the UA claim a wide-gamut display?
  let gamut = "srgb only";
  let wide = false;
  try {
    if (window.matchMedia("(color-gamut: rec2020)").matches) { gamut = "rec2020"; wide = true; }
    else if (window.matchMedia("(color-gamut: p3)").matches) { gamut = "display-p3"; wide = true; }
  } catch (e) { /* matchMedia unavailable */ }
  setReport("gamutMedia", gamut, wide);

  // Does CSS color() with display-p3 parse? (syntax support, not display proof)
  let p3ok = false;
  try {
    p3ok = typeof CSS !== "undefined" && CSS.supports("color", "color(display-p3 1 0 0)");
  } catch (e) { /* CSS.supports unavailable */ }
  setReport("p3Support", p3ok ? "supported" : "not supported", p3ok);

  // --- Swatch comparison: sRGB vs Display-P3 ---------------------------------
  // Pairs chosen where P3 can show visibly richer color than sRGB.
  var pairs = [
    { name: "Crimson", srgb: "rgb(220, 20, 60)",   p3: "color(display-p3 0.9 0.05 0.25)" },
    { name: "Emerald", srgb: "rgb(0, 150, 80)",    p3: "color(display-p3 0.0 0.65 0.35)" },
    { name: "Azure",   srgb: "rgb(0, 120, 255)",   p3: "color(display-p3 0.0 0.45 1.0)" },
    { name: "Magenta", srgb: "rgb(200, 0, 180)",   p3: "color(display-p3 0.85 0.0 0.75)" },
    { name: "Lime",    srgb: "rgb(120, 200, 0)",   p3: "color(display-p3 0.45 0.85 0.0)" },
  ];
  var wrap = document.getElementById("swatches");
  pairs.forEach(function (p) {
    var row = document.createElement("div");
    row.className = "swatch-row";

    var name = document.createElement("div");
    name.className = "swatch-name";
    name.textContent = p.name;

    var a = document.createElement("div");
    a.className = "swatch";
    a.style.background = p.srgb;
    a.textContent = "sRGB";

    var b = document.createElement("div");
    b.className = "swatch";
    // Fall back to the sRGB value where color() is unsupported.
    b.style.background = p3ok ? p.p3 : p.srgb;
    b.textContent = "P3";

    row.appendChild(name);
    row.appendChild(a);
    row.appendChild(b);
    wrap.appendChild(row);
  });
})();
