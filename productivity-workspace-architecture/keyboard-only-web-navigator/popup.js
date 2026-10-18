/* Keyboard-Only Web Navigator — popup: enable toggle, scroll step, cheatsheet. */
"use strict";

const CHEAT = [
  ["j", "Scroll down"], ["k", "Scroll up"],
  ["d", "Half-page down"], ["u", "Half-page up"],
  ["g g", "Top of page"], ["G", "Bottom of page"],
  ["r", "Reload page"], ["x", "Close tab"],
  ["[", "Previous tab"], ["]", "Next tab"],
  ["?", "Toggle cheatsheet"],
];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  // Build the cheatsheet grid from the same source the content script uses.
  const box = $("cheat");
  for (const [k, d] of CHEAT) {
    const item = document.createElement("div");
    item.className = "item";
    const key = document.createElement("kbd");
    key.textContent = k;
    const label = document.createElement("span");
    label.textContent = d;
    item.append(key, label);
    box.appendChild(item);
  }

  const s = await chrome.storage.local.get({ kbnavEnabled: true, kbnavStep: 120 });
  $("enabled").checked = s.kbnavEnabled !== false;
  $("step").value = s.kbnavStep;

  $("enabled").addEventListener("change", (e) => {
    chrome.storage.local.set({ kbnavEnabled: e.target.checked });
  });
  $("step").addEventListener("change", (e) => {
    const v = Math.max(20, Math.min(600, parseInt(e.target.value, 10) || 120));
    e.target.value = v;
    chrome.storage.local.set({ kbnavStep: v });
  });
});
