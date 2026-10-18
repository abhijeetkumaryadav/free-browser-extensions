/* PopDock — pop the active tab out into its own standalone window.
 * Everything is user-gesture-driven: nothing moves unless a button is clicked. */
(function () {
  "use strict";

  var COMPACT_W = 640; // compact video-friendly window size
  var COMPACT_H = 360;

  var el = function (id) { return document.getElementById(id); };
  var statusEl = el("status");

  var state = {
    compactDefault: false,
    lastPopout: null // { tabId, originWindowId } — remembered so "send back" works
  };

  /** Show a transient status line. */
  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", !!isError);
    if (msg) {
      setTimeout(function () {
        statusEl.textContent = "";
        statusEl.classList.remove("error");
      }, 3200);
    }
  }

  /** Get the active tab in the current window. */
  function getActiveTab() {
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      return tabs[0] || null;
    });
  }

  /** True when the URL is one the extension is allowed to move. */
  function isMovable(tab) {
    if (!tab || !tab.url) return false;
    return /^(https?|file|ftp):/i.test(tab.url);
  }

  /** Compact windows open near the bottom-right of the screen, out of the way. */
  function compactPosition() {
    return chrome.system && chrome.system.display && chrome.permissions
      ? chrome.permissions.contains({ permissions: ["system.display"] }).then(function (granted) {
          if (!granted) return { left: null, top: null };
          return chrome.system.display.getInfo().then(function (displays) {
            var work = (displays[0] && displays[0].workArea) || { left: 0, top: 0, width: 1280, height: 800 };
            return {
              left: Math.max(work.left, work.left + work.width - COMPACT_W - 40),
              top: Math.max(work.top, work.top + work.height - COMPACT_H - 60)
            };
          });
        }).catch(function () { return { left: null, top: null }; })
      : Promise.resolve({ left: null, top: null });
  }

  /** Pop `tab` out into a standalone window. */
  function popOut(tab, compact) {
    if (!tab) { setStatus("No active tab found.", true); return; }
    if (!isMovable(tab)) {
      setStatus("This page can't be popped out (restricted page).", true);
      return;
    }
    // If the tab already sits alone in its own window, just resize it.
    chrome.windows.get(tab.windowId, { populate: true }).then(function (win) {
      if (win.tabs.length === 1) {
        if (compact) {
          return chrome.windows.update(win.id, { width: COMPACT_W, height: COMPACT_H, focused: true });
        }
        return chrome.windows.update(win.id, { focused: true, state: "maximized" });
      }
      return compactPosition().then(function (pos) {
        var createOpts = { tabId: tab.id, focused: true };
        if (compact) {
          createOpts.width = COMPACT_W;
          createOpts.height = COMPACT_H;
          if (pos.left !== null) { createOpts.left = pos.left; createOpts.top = pos.top; }
        } else {
          createOpts.state = "maximized";
        }
        return chrome.windows.create(createOpts).then(function () {
          // Remember where it came from so "send back" is possible.
          return chrome.storage.local.set({
            lastPopout: { tabId: tab.id, originWindowId: tab.windowId }
          });
        }).then(function () { return refreshRestore(); });
      });
    }).then(function () {
      setStatus(compact ? "Popped out to a compact video window." : "Popped out to its own window.");
      window.close();
    }).catch(function (err) {
      setStatus("Couldn't pop out: " + (err && err.message ? err.message : err), true);
    });
  }

  /** Send the last popped tab back to its original window. */
  function restoreTab() {
    if (!state.lastPopout) return;
    var info = state.lastPopout;
    chrome.tabs.get(info.tabId).then(function (tab) {
      return chrome.windows.get(info.originWindowId).then(function () {
        return chrome.tabs.move(tab.id, { windowId: info.originWindowId, index: -1 })
          .then(function () { return chrome.tabs.update(tab.id, { active: true }); })
          .then(function () { return chrome.windows.update(info.originWindowId, { focused: true }); });
      }, function () {
        // Original window is gone — just focus the tab where it is.
        return chrome.tabs.update(tab.id, { active: true });
      });
    }).then(function () {
      return chrome.storage.local.remove("lastPopout");
    }).then(function () {
      state.lastPopout = null;
      refreshRestore();
      setStatus("Tab moved back.");
    }).catch(function (err) {
      setStatus("Couldn't move tab back: " + (err && err.message ? err.message : err), true);
    });
  }

  /** Show/hide the restore panel based on stored state. */
  function refreshRestore() {
    return chrome.storage.local.get("lastPopout").then(function (res) {
      state.lastPopout = res.lastPopout || null;
      el("restorePanel").hidden = !state.lastPopout;
    });
  }

  /** Render the current tab's title + hostname. */
  function renderCurrentTab() {
    getActiveTab().then(function (tab) {
      if (!tab) { el("tabTitle").textContent = "No active tab"; return; }
      el("tabTitle").textContent = tab.title || "Untitled tab";
      try {
        el("tabUrl").textContent = new URL(tab.url).hostname || tab.url;
      } catch (e) {
        el("tabUrl").textContent = tab.url || "";
      }
    });
  }

  // ---- wiring ----
  el("btnPopout").addEventListener("click", function () {
    getActiveTab().then(function (tab) {
      popOut(tab, state.compactDefault);
    });
  });

  el("btnCompact").addEventListener("click", function () {
    getActiveTab().then(function (tab) { popOut(tab, true); });
  });

  el("btnRestore").addEventListener("click", restoreTab);

  el("chkCompactDefault").addEventListener("change", function (e) {
    state.compactDefault = e.target.checked;
    chrome.storage.local.set({ compactDefault: state.compactDefault });
  });

  // ---- init ----
  chrome.storage.local.get(["compactDefault"]).then(function (res) {
    state.compactDefault = !!res.compactDefault;
    el("chkCompactDefault").checked = state.compactDefault;
  });
  renderCurrentTab();
  refreshRestore();
})();
