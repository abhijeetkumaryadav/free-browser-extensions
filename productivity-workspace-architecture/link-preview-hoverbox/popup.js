/* Link Preview Hoverbox — popup: enable toggle + hover delay. */
"use strict";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  const s = await chrome.storage.local.get({ lphEnabled: true, lphDelay: 600 });
  $("enabled").checked = s.lphEnabled !== false;
  $("delay").value = s.lphDelay;
  $("delayVal").textContent = s.lphDelay;

  $("enabled").addEventListener("change", (e) => {
    chrome.storage.local.set({ lphEnabled: e.target.checked });
  });
  $("delay").addEventListener("input", (e) => {
    $("delayVal").textContent = e.target.value;
    chrome.storage.local.set({ lphDelay: parseInt(e.target.value, 10) });
  });
});
