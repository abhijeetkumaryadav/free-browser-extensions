// Popup logic for Clickbait Demoter.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);

  function refreshStats() {
    chrome.storage.local.get({ demotedSession: 0, demotedLifetime: 0 }, d => {
      $("demoted").textContent = d.demotedSession;
      $("lifetime").textContent = d.demotedLifetime;
    });
  }

  async function withTab(fn) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab.");
    if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      throw new Error("Can't run on this internal page.");
    }
    return fn(tab.id);
  }

  // Ensure engine is present, then run the named function in the page.
  async function runInPage(name) {
    return withTab(async tabId => {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: n => window[n](),
        args: [name]
      });
      return result;
    });
  }

  $("scan").addEventListener("click", async () => {
    $("scan").disabled = true;
    try {
      const res = await runInPage("__clickbaitDemote");
      chrome.storage.local.get({ demotedSession: 0, demotedLifetime: 0 }, d => {
        chrome.storage.local.set({
          demotedSession: d.demotedSession + res.demoted,
          demotedLifetime: d.demotedLifetime + res.demoted
        }, refreshStats);
      });
      $("scan").textContent = res.demoted ? `Demoted ${res.demoted} card${res.demoted > 1 ? "s" : ""}` : "No clickbait found";
      setTimeout(() => { $("scan").textContent = "Scan & demote clickbait"; }, 2200);
    } catch (e) {
      $("scan").textContent = "Couldn't run: " + e.message;
      setTimeout(() => { $("scan").textContent = "Scan & demote clickbait"; }, 2200);
    } finally {
      $("scan").disabled = false;
    }
  });

  $("restore").addEventListener("click", async () => {
    try {
      const n = await runInPage("__clickbaitRestore");
      $("restore").textContent = n ? `Restored ${n}` : "Nothing to restore";
      chrome.storage.local.set({ demotedSession: 0 }, refreshStats);
      setTimeout(() => { $("restore").textContent = "Restore page"; }, 1800);
    } catch (e) { /* page without engine or internal */ }
  });

  refreshStats();
})();
