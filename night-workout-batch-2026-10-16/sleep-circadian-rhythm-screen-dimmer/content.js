// Circadian Dimmer — content script (injected on demand only)
// Draws a warm, pointer-transparent overlay over the page.

const OVERLAY_ID = "__circadian_dimmer_overlay__";

// Create or update the overlay with the given opacity (0-100).
function applyOverlay(opacity) {
  removeOverlay();
  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  // Warm amber wash; opacity scaled to a fraction.
  el.style.cssText = [
    "position:fixed", "inset:0", "pointer-events:none",
    "z-index:2147483647",
    `background:rgba(255,150,50,${Math.min(100, Math.max(0, opacity)) / 100})`,
    "mix-blend-mode:multiply",
  ].join(";");
  document.documentElement.appendChild(el);
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CIRCADIAN_APPLY") applyOverlay(msg.opacity ?? 30);
  if (msg.type === "CIRCADIAN_REMOVE") removeOverlay();
});
