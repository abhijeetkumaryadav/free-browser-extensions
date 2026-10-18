/* Zen Mode — engine (testable, no DOM access) */
// ENGINE-START
"use strict";

// Heuristic CSS selectors for distracting/recommendation panels.
// Pure heuristics — nothing is "blocked", only dimmed, and only when the user asks.
const ZEN_SELECTORS = [
  '[aria-label*="recommend"]',
  '[aria-label*="suggested"]',
  '[id*="recommend"]',
  '[id*="sidebar"]',
  '[class*="recommend"]',
  '[class*="suggested"]',
  '[class*="trending"]',
  'aside',
  '[role="complementary"]'
];

// Injected CSS that dims matches. Reversible: removed entirely when Zen is off.
function zenStyleText(selectors) {
  const sel = selectors.join(", ");
  return (
    sel + " { filter: blur(6px) saturate(0.3) !important; " +
    "opacity: 0.35 !important; transition: filter .3s, opacity .3s !important; pointer-events: none !important; }"
  );
}

const ZEN_STYLE_ID = "zen-mode-dim-style";

function makeStatusMessage(isOn, dimmedCount) {
  if (isOn) return "Zen on — " + dimmedCount + " region" + (dimmedCount === 1 ? "" : "s") + " dimmed.";
  return "Zen off — page restored.";
}

// ENGINE-END
/* global chrome */
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("toggleBtn");
  const statusEl = document.getElementById("status");
  const dimmedEl = document.getElementById("dimmedCount");
  const noticeEl = document.getElementById("notice");

  // Restore last state
  chrome.storage.local.get({ zenOn: false, lastDimmed: 0 }, (data) => {
    updateUI(data.zenOn, data.lastDimmed);
  });

  toggleBtn.addEventListener("click", () => {
    chrome.storage.local.get({ zenOn: false }, (data) => {
      const next = !data.zenOn;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) {
          noticeEl.textContent = "No active tab available.";
          return;
        }
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: next ? injectZen : removeZen,
          args: next ? [ZEN_SELECTORS] : []
        }, (results) => {
          if (chrome.runtime.lastError) {
            noticeEl.textContent = "Cannot run on this page (browser page or restricted tab).";
            return;
          }
          noticeEl.textContent = "";
          const count = (results && results[0] && results[0].result) || 0;
          chrome.storage.local.set({ zenOn: next, lastDimmed: count }, () => {
            updateUI(next, count);
          });
        });
      });
    });
  });

  function updateUI(isOn, count) {
    statusEl.textContent = makeStatusMessage(isOn, count);
    dimmedEl.textContent = String(count);
    toggleBtn.textContent = isOn ? "Zen off" : "Zen on";
    toggleBtn.classList.toggle("active", isOn);
  }
});

// Runs inside the page — defined here so it can be injected via scripting.executeScript.
function injectZen(selectors) {
  if (document.getElementById("zen-mode-dim-style")) return document.querySelectorAll(selectors.join(", ")).length;
  const style = document.createElement("style");
  style.id = "zen-mode-dim-style";
  style.textContent = selectors.join(", ") +
    " { filter: blur(6px) saturate(0.3) !important; opacity: 0.35 !important; " +
    "transition: filter .3s, opacity .3s !important; pointer-events: none !important; }";
  document.documentElement.appendChild(style);
  return document.querySelectorAll(selectors.join(", ")).length;
}

function removeZen() {
  const el = document.getElementById("zen-mode-dim-style");
  if (el) el.remove();
  return 0;
}
