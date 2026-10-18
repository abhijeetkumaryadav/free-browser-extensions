// Popup logic for Circadian Warm Tint.
// Persists settings and applies/removes the overlay on the active tab.
(() => {
  "use strict";

  const DEFAULTS = { enabled: false, strength: 60, circadian: true };

  const toggle = document.getElementById("toggle");
  const strength = document.getElementById("strength");
  const strengthVal = document.getElementById("strengthVal");
  const circadian = document.getElementById("circadian");
  const disableBtn = document.getElementById("disable");

  let settings = { ...DEFAULTS };

  function render() {
    toggle.setAttribute("aria-pressed", String(settings.enabled));
    strength.value = settings.strength;
    strengthVal.textContent = `${settings.strength}%`;
    circadian.checked = settings.circadian;
  }

  function save() {
    chrome.storage.local.set({ csh_settings: settings });
  }

  /** Run a content-script action on the active tab (skip internal pages). */
  async function runOnTab(type) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:|^file:|^ftp:/.test(tab.url || "")) {
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    chrome.tabs.sendMessage(tab.id, { type, settings }).catch(() => {});
  }

  toggle.addEventListener("click", async () => {
    settings.enabled = !settings.enabled;
    render();
    save();
    await runOnTab("csh_apply");
  });

  strength.addEventListener("input", async () => {
    settings.strength = Number(strength.value);
    strengthVal.textContent = `${settings.strength}%`;
    save();
    if (settings.enabled) await runOnTab("csh_apply");
  });

  circadian.addEventListener("change", async () => {
    settings.circadian = circadian.checked;
    save();
    if (settings.enabled) await runOnTab("csh_apply");
  });

  disableBtn.addEventListener("click", async () => {
    settings.enabled = false;
    render();
    save();
    await runOnTab("csh_remove");
  });

  chrome.storage.local.get(["csh_settings"], (res) => {
    if (res.csh_settings) settings = { ...DEFAULTS, ...res.csh_settings };
    render();
  });
})();
