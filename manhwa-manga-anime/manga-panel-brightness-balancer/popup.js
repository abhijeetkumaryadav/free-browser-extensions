// PanelGlow — popup.js
// Reads/writes per-site display settings and applies them to the active tab
// via the filter.js content script (injected on demand, user-initiated only).
(function () {
  "use strict";

  const STORE_KEY = "panelglow_sites";
  const DEFAULTS = { brightness: 100, contrast: 100, grayscale: 0, invert: 0 };

  const PRESETS = {
    day:   { brightness: 100, contrast: 100, grayscale: 0,   invert: 0 },
    night: { brightness: 70,  contrast: 110, grayscale: 0,   invert: 0 },
    paper: { brightness: 105, contrast: 95,  grayscale: 100, invert: 0 },
  };

  const els = {
    site: document.getElementById("siteLabel"),
    toggle: document.getElementById("enabledToggle"),
    brightness: document.getElementById("brightness"),
    contrast: document.getElementById("contrast"),
    grayscale: document.getElementById("grayscale"),
    invert: document.getElementById("invert"),
    brightnessVal: document.getElementById("brightnessVal"),
    contrastVal: document.getElementById("contrastVal"),
    grayscaleVal: document.getElementById("grayscaleVal"),
    invertVal: document.getElementById("invertVal"),
    reset: document.getElementById("resetBtn"),
    presets: Array.from(document.querySelectorAll(".preset")),
  };

  let host = null;
  let tabId = null;
  let saveTimer = null;

  function paintSlider(el) {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty("--fill", pct + "%");
  }

  function currentSettings() {
    return {
      brightness: +els.brightness.value,
      contrast: +els.contrast.value,
      grayscale: +els.grayscale.value,
      invert: +els.invert.value,
    };
  }

  function syncUI(s) {
    els.brightness.value = s.brightness;
    els.contrast.value = s.contrast;
    els.grayscale.value = s.grayscale;
    els.invert.value = s.invert;
    els.brightnessVal.textContent = s.brightness + "%";
    els.contrastVal.textContent = s.contrast + "%";
    els.grayscaleVal.textContent = s.grayscale + "%";
    els.invertVal.textContent = s.invert + "%";
    [els.brightness, els.contrast, els.grayscale, els.invert].forEach(paintSlider);
    // Highlight the matching preset, if any.
    els.presets.forEach((btn) => {
      const p = PRESETS[btn.dataset.preset];
      const match = p &&
        p.brightness === s.brightness && p.contrast === s.contrast &&
        p.grayscale === s.grayscale && p.invert === s.invert;
      btn.classList.toggle("active", match);
    });
  }

  // Inject filter.js (if needed) and apply settings in the active tab.
  function applyToTab(settings) {
    if (tabId == null) return;
    const enabled = els.toggle.checked;
    const payload = enabled ? settings : DEFAULTS;
    chrome.scripting.executeScript(
      { target: { tabId }, files: ["filter.js"] },
      () => {
        chrome.scripting.executeScript({
          target: { tabId },
          func: (s) => { window.__panelGlowApply && window.__panelGlowApply(s); },
          args: [payload],
        });
      }
    );
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  }

  function persist() {
    const settings = currentSettings();
    chrome.storage.local.get([STORE_KEY], (res) => {
      const sites = res[STORE_KEY] || {};
      if (els.toggle.checked) {
        sites[host] = settings;
      } else {
        delete sites[host];
      }
      chrome.storage.local.set({ [STORE_KEY]: sites });
    });
    applyToTab(settings);
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;
    tabId = tab.id;
    try {
      host = new URL(tab.url).hostname;
    } catch (e) {
      host = tab.url;
    }
    els.site.textContent = host || "this site";

    const res = await chrome.storage.local.get([STORE_KEY]);
    const saved = (res[STORE_KEY] || {})[host];
    els.toggle.checked = !!saved;
    syncUI(saved || { ...DEFAULTS });

    // Live preview while dragging; save debounced.
    ["brightness", "contrast", "grayscale", "invert"].forEach((key) => {
      els[key].addEventListener("input", () => {
        const s = currentSettings();
        els[key + "Val"].textContent = s[key] + "%";
        paintSlider(els[key]);
        if (!els.toggle.checked) els.toggle.checked = true;
        applyToTab(s);
        scheduleSave();
      });
    });

    els.toggle.addEventListener("change", () => {
      persist(); // persist() applies the effective (on/off) settings to the tab
    });

    els.presets.forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = PRESETS[btn.dataset.preset];
        if (!p) return;
        if (!els.toggle.checked) els.toggle.checked = true;
        syncUI(p);
        persist();
      });
    });

    els.reset.addEventListener("click", () => {
      els.toggle.checked = false;
      syncUI({ ...DEFAULTS });
      persist();
    });
  }

  init();
})();
