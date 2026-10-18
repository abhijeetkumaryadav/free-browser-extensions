/* Bubble Wrap Popper — popup logic.
 * Explicit user clicks only: inject the overlay on the active tab, or
 * message it to remove itself. Guarded against chrome:// internal pages. */
(function () {
  "use strict";

  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const soundToggle = document.getElementById("soundToggle");
  const sizeRange = document.getElementById("sizeRange");
  const popCount = document.getElementById("popCount");

  function isInternal(url) {
    return !url || /^(chrome|chrome-extension|edge|about|view-source):/.test(url);
  }

  function loadPrefs() {
    chrome.storage.local.get(["bw_sound", "bw_size", "bw_pops"], (res) => {
      soundToggle.checked = res.bw_sound !== false;
      sizeRange.value = res.bw_size || 56;
      popCount.textContent = String(res.bw_pops || 0);
    });
  }

  function savePrefs() {
    chrome.storage.local.set({ bw_sound: soundToggle.checked, bw_size: +sizeRange.value });
  }

  // Live-refresh the counter while the popup is open.
  setInterval(() => {
    chrome.storage.local.get(["bw_pops"], (res) => {
      popCount.textContent = String(res.bw_pops || 0);
    });
  }, 500);

  soundToggle.addEventListener("change", savePrefs);
  sizeRange.addEventListener("change", savePrefs);

  startBtn.addEventListener("click", () => {
    savePrefs();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || isInternal(tab.url)) {
        startBtn.textContent = "Can't run here";
        setTimeout(() => { startBtn.innerHTML = ""; startBtn.appendChild(playIcon()); startBtn.append(" Pop on this tab"); }, 1200);
        return;
      }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ["content.js"] },
        () => { window.close(); }
      );
    });
  });

  function playIcon() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "icon sm");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    const p = document.createElementNS(ns, "polygon");
    p.setAttribute("points", "5 3 19 12 5 21 5 3");
    svg.appendChild(p);
    return svg;
  }

  stopBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && !isInternal(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { type: "BW_REMOVE" }, () => {});
      }
      window.close();
    });
  });

  loadPrefs();
})();
