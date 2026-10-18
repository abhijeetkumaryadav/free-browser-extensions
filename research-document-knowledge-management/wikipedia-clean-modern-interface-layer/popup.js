/* WikiClean popup logic — per-wiki preferences, CSS-only reading layer. */
(() => {
  "use strict";

  const DEFAULTS = {
    enabled: false,
    theme: "light",
    hideSidebar: true,
    hideToc: true,
    hideHeader: true,
    fontSize: 18
  };

  const els = {
    enabled: document.getElementById("enabled"),
    fontSize: document.getElementById("fontSize"),
    fontSizeVal: document.getElementById("fontSizeVal"),
    hideSidebar: document.getElementById("hideSidebar"),
    hideToc: document.getElementById("hideToc"),
    hideHeader: document.getElementById("hideHeader"),
    themes: [...document.querySelectorAll(".theme")],
    controls: document.getElementById("controls"),
    notWiki: document.getElementById("notWiki")
  };

  let host = null;
  let prefs = { ...DEFAULTS };

  /** Load the whole per-host preference map. */
  async function getStore() {
    const { wikiclean } = await chrome.storage.local.get("wikiclean");
    return wikiclean || {};
  }

  async function savePrefs() {
    const store = await getStore();
    store[host] = prefs;
    await chrome.storage.local.set({ wikiclean: store });
    // Tell the active tab to re-apply immediately.
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id != null) {
        await chrome.tabs.sendMessage(tab.id, { type: "wikiclean-refresh" }).catch(() => {});
      }
    } catch { /* tab may not have the content script (e.g. chrome://) */ }
  }

  function render() {
    els.enabled.checked = prefs.enabled;
    els.fontSize.value = prefs.fontSize;
    els.fontSizeVal.textContent = `${prefs.fontSize}px`;
    els.hideSidebar.checked = prefs.hideSidebar;
    els.hideToc.checked = prefs.hideToc;
    els.hideHeader.checked = prefs.hideHeader;
    els.themes.forEach((b) => b.classList.toggle("active", b.dataset.theme === prefs.theme));
    els.controls.classList.toggle("disabled", !prefs.enabled);
  }

  function bind() {
    els.enabled.addEventListener("change", () => { prefs.enabled = els.enabled.checked; render(); savePrefs(); });
    els.fontSize.addEventListener("input", () => {
      prefs.fontSize = Number(els.fontSize.value);
      els.fontSizeVal.textContent = `${prefs.fontSize}px`;
    });
    els.fontSize.addEventListener("change", savePrefs);
    els.hideSidebar.addEventListener("change", () => { prefs.hideSidebar = els.hideSidebar.checked; savePrefs(); });
    els.hideToc.addEventListener("change", () => { prefs.hideToc = els.hideToc.checked; savePrefs(); });
    els.hideHeader.addEventListener("change", () => { prefs.hideHeader = els.hideHeader.checked; savePrefs(); });
    els.themes.forEach((b) => b.addEventListener("click", () => {
      prefs.theme = b.dataset.theme;
      render();
      savePrefs();
    }));
  }

  async function init() {
    bind();
    let url = "";
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      url = tab && tab.url ? tab.url : "";
    } catch { /* ignore */ }

    const m = /^https?:\/\/([^/]*\.wikipedia\.org)/i.exec(url);
    if (!m) {
      els.notWiki.classList.remove("hidden");
      els.controls.classList.add("disabled");
      return;
    }
    host = m[1].toLowerCase();
    const store = await getStore();
    prefs = { ...DEFAULTS, ...(store[host] || {}) };
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
