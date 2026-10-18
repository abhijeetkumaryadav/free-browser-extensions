// popup.js — ComicSansify: inject or remove the Comic Sans stylesheet on the
// active tab. Fully self-contained injection functions (no popup-scope
// references) so chrome.scripting can run them in the page context.

(function () {
  "use strict";

  var STYLE_ID = "comicsansify-injected-style";

  var pageUrlEl = document.getElementById("pageUrl");
  var pageStateEl = document.getElementById("pageState");
  var prankBtn = document.getElementById("prankBtn");
  var prankBtnText = document.getElementById("prankBtnText");
  var restoreBtn = document.getElementById("restoreBtn");

  // --- injected functions (must stay self-contained) ---

  // Applies the prank: a <style> tag forcing Comic Sans-style fallbacks
  // everywhere. Uses !important so it wins over page styles.
  function applyPrank() {
    if (document.getElementById("comicsansify-injected-style")) return false;
    var style = document.createElement("style");
    style.id = "comicsansify-injected-style";
    style.textContent =
      "* { font-family: 'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', 'Segoe Print', cursive !important; }";
    document.documentElement.appendChild(style);
    return true;
  }

  // Removes the prank stylesheet, restoring the page's original fonts.
  function removePrank() {
    var el = document.getElementById("comicsansify-injected-style");
    if (el) {
      el.remove();
      return true;
    }
    return false;
  }

  // Reports whether the prank stylesheet is currently present.
  function isPranked() {
    return !!document.getElementById("comicsansify-injected-style");
  }

  // --- popup logic ---

  function getActiveTab(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      cb(tabs && tabs[0] ? tabs[0] : null);
    });
  }

  // Pages where content-script injection is forbidden.
  function isRestricted(url) {
    return !url || /^(chrome|chrome-extension|edge|about|opera|moz-extension):\/\//.test(url);
  }

  function refresh() {
    getActiveTab(function (tab) {
      if (!tab) {
        pageUrlEl.textContent = "No active tab";
        pageStateEl.textContent = "—";
        prankBtn.disabled = true;
        return;
      }
      try {
        var host = new URL(tab.url).hostname || tab.url;
        pageUrlEl.textContent = host;
      } catch (e) {
        pageUrlEl.textContent = tab.url;
      }
      if (isRestricted(tab.url)) {
        pageStateEl.textContent = "Can't run on this page (browser UI page).";
        pageStateEl.className = "page-state";
        prankBtnText.textContent = "Comic Sans-ify this page";
        return;
      }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: isPranked },
        function (results) {
          if (chrome.runtime.lastError) {
            pageStateEl.textContent = "Can't run on this page.";
            return;
          }
          var pranked = results && results[0] && results[0].result === true;
          pageStateEl.textContent = pranked ? "Prank active — Comic Sans everywhere" : "Fonts are normal";
          pageStateEl.className = "page-state" + (pranked ? " on" : "");
          prankBtnText.textContent = pranked
            ? "It's already Comic Sans… keep it"
            : "Comic Sans-ify this page";
        }
      );
    });
  }

  prankBtn.addEventListener("click", function () {
    getActiveTab(function (tab) {
      if (!tab || isRestricted(tab.url)) return;
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: applyPrank },
        function () {
          chrome.storage.local.get({ prankCount: 0 }, function (res) {
            chrome.storage.local.set({ prankCount: res.prankCount + 1 });
          });
          refresh();
        }
      );
    });
  });

  restoreBtn.addEventListener("click", function () {
    getActiveTab(function (tab) {
      if (!tab || isRestricted(tab.url)) return;
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: removePrank },
        function () { refresh(); }
      );
    });
  });

  refresh();
})();
