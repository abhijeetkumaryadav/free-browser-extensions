// PaletteSwap popup — presets, custom colors, per-site memory, reset.
(function () {
  "use strict";

  var PRESETS = [
    { name: "Sunset", bg: "#2b1a2e", text: "#ffe8d6", link: "#ff9e64" },
    { name: "Ocean",  bg: "#0b2239", text: "#d6f0ff", link: "#38bdf8" },
    { name: "Forest", bg: "#12291c", text: "#e2f3d8", link: "#4ade80" },
    { name: "Mono",   bg: "#141414", text: "#f5f5f5", link: "#a3a3a3" }
  ];

  var tabId = null;
  var hostname = "";
  var activePreset = -1;

  var presetsEl = document.getElementById("presets");
  var siteLabel = document.getElementById("siteLabel");
  var statusDot = document.getElementById("statusDot");
  var rememberEl = document.getElementById("remember");

  /** Ensure the content script is present, then run fn via messaging. */
  async function withPage(fn) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["content.js"] });
    } catch (e) {
      // Already injected or not injectable (chrome:// pages etc.).
    }
    try {
      return await chrome.tabs.sendMessage(tabId, fn());
    } catch (e) {
      return null;
    }
  }

  function setStatus(on) {
    statusDot.classList.toggle("on", !!on);
    statusDot.title = on ? "Palette applied" : "No palette applied";
  }

  function markActive(idx) {
    activePreset = idx;
    Array.prototype.forEach.call(presetsEl.children, function (el, i) {
      el.classList.toggle("active", i === idx);
    });
  }

  async function applyPalette(palette, presetIdx) {
    var res = await withPage(function () {
      return { type: "paletteswap-apply", palette: palette };
    });
    if (res && res.ok) {
      setStatus(true);
      markActive(presetIdx);
      if (rememberEl.checked && hostname) {
        var saved = (await chrome.storage.local.get({ sites: {} })).sites;
        saved[hostname] = palette;
        await chrome.storage.local.set({ sites: saved });
      }
    }
  }

  async function resetPage() {
    await withPage(function () { return { type: "paletteswap-reset" }; });
    setStatus(false);
    markActive(-1);
    if (hostname) {
      var saved = (await chrome.storage.local.get({ sites: {} })).sites;
      if (saved[hostname]) {
        delete saved[hostname];
        await chrome.storage.local.set({ sites: saved });
      }
    }
  }

  function renderPresets() {
    presetsEl.innerHTML = "";
    PRESETS.forEach(function (p, i) {
      var btn = document.createElement("button");
      btn.className = "preset";
      btn.title = "Apply " + p.name;
      btn.innerHTML =
        '<span class="swatches">' +
        [p.bg, p.text, p.link].map(function (c) {
          return '<i style="background:' + c + '"></i>';
        }).join("") +
        "</span><span>" + p.name + "</span>";
      btn.addEventListener("click", function () { applyPalette(p, i); });
      presetsEl.appendChild(btn);
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    renderPresets();

    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        tabId = tabs[0].id;
        try { hostname = new URL(tabs[0].url).hostname; } catch (e) { hostname = ""; }
        siteLabel.textContent = hostname || "this page";

        // Restore remembered palette for this site.
        var saved = (await chrome.storage.local.get({ sites: {} })).sites;
        if (hostname && saved[hostname]) {
          rememberEl.checked = true;
          var p = saved[hostname];
          document.getElementById("cBg").value = p.bg;
          document.getElementById("cText").value = p.text;
          document.getElementById("cLink").value = p.link;
          var idx = PRESETS.findIndex(function (pr) {
            return pr.bg === p.bg && pr.text === p.text && pr.link === p.link;
          });
          await applyPalette(p, idx);
        } else {
          // Reflect live status if a palette was applied manually before.
          var st = await withPage(function () { return { type: "paletteswap-status" }; });
          if (st) setStatus(st.applied);
        }
      }
    } catch (e) {
      siteLabel.textContent = "this page";
    }

    document.getElementById("applyCustom").addEventListener("click", function () {
      applyPalette({
        bg: document.getElementById("cBg").value,
        text: document.getElementById("cText").value,
        link: document.getElementById("cLink").value
      }, -1);
    });

    document.getElementById("resetBtn").addEventListener("click", resetPage);
  });
})();
