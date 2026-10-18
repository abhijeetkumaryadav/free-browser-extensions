// TabTree side panel — renders open tabs as a hierarchy tree:
// Window -> Domain -> Tabs, with live updates, search, switch and close.
(function () {
  "use strict";

  var treeEl = document.getElementById("tree");
  var searchEl = document.getElementById("search");
  var totalBadge = document.getElementById("totalBadge");
  var collapsedWins = {};   // windowId -> true when collapsed
  var query = "";

  /** Extract a readable domain label from a tab URL. */
  function domainOf(tab) {
    try {
      if (!tab.url) return "Other";
      var u = new URL(tab.url);
      if (u.protocol === "chrome:" || u.protocol === "edge:" || u.protocol === "about:") {
        return "Browser";
      }
      return u.hostname.replace(/^www\./, "");
    } catch (e) {
      return "Other";
    }
  }

  /** Escape HTML to keep titles safe in the tree. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Build the hierarchy model: [{ window, domains: [{ name, tabs }] }]. */
  async function buildModel() {
    var wins = await chrome.windows.getAll({ populate: true });
    wins.sort(function (a, b) { return a.id - b.id; });
    var total = 0;
    var model = wins.map(function (w) {
      var byDomain = {};
      (w.tabs || []).forEach(function (t) {
        total++;
        var d = domainOf(t);
        (byDomain[d] = byDomain[d] || []).push(t);
      });
      var domains = Object.keys(byDomain).sort().map(function (name) {
        return { name: name, tabs: byDomain[name] };
      });
      return { window: w, domains: domains, count: (w.tabs || []).length };
    });
    return { model: model, total: total };
  }

  /** Create a single tab row element. */
  function tabRow(tab) {
    var row = document.createElement("div");
    row.className = "tab-row" + (tab.active ? " active" : "");
    row.title = tab.title || tab.url || "";

    if (tab.favIconUrl) {
      var img = document.createElement("img");
      img.className = "fav";
      img.src = tab.favIconUrl;
      img.alt = "";
      img.onerror = function () { img.replaceWith(placeholder()); };
      row.appendChild(img);
    } else {
      row.appendChild(placeholder());
    }

    var label = document.createElement("span");
    label.className = "t-title";
    label.textContent = tab.title || tab.url || "(untitled)";
    row.appendChild(label);

    var close = document.createElement("button");
    close.className = "close";
    close.textContent = "✕";
    close.title = "Close tab";
    close.addEventListener("click", function (ev) {
      ev.stopPropagation();
      chrome.tabs.remove(tab.id).catch(function () {});
    });
    row.appendChild(close);

    row.addEventListener("click", function () {
      chrome.tabs.update(tab.id, { active: true }).catch(function () {});
      chrome.windows.update(tab.windowId, { focused: true }).catch(function () {});
    });
    return row;
  }

  function placeholder() {
    var d = document.createElement("span");
    d.className = "no-fav";
    return d;
  }

  /** Render the whole tree into the panel. */
  async function render() {
    var data = await buildModel();
    totalBadge.textContent = data.total;
    treeEl.innerHTML = "";

    if (data.total === 0) {
      treeEl.innerHTML = '<div class="empty">No open tabs.</div>';
      return;
    }

    var q = query.trim().toLowerCase();

    data.model.forEach(function (wg, wi) {
      // Filter tabs by search query first.
      var domains = wg.domains.map(function (dg) {
        var tabs = q
          ? dg.tabs.filter(function (t) {
              return ((t.title || "") + " " + (t.url || "")).toLowerCase().indexOf(q) !== -1;
            })
          : dg.tabs;
        return { name: dg.name, tabs: tabs };
      }).filter(function (dg) { return dg.tabs.length > 0; });

      var shown = domains.reduce(function (n, dg) { return n + dg.tabs.length; }, 0);
      if (shown === 0) return;

      var wrap = document.createElement("div");
      wrap.className = "win-group";

      var head = document.createElement("button");
      head.className = "group-head" + (collapsedWins[wg.window.id] ? " collapsed" : "");
      head.innerHTML =
        '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '<span class="win-dot"></span><span>' + esc(q ? "Matches" : "Window " + (wi + 1)) + "</span>" +
        '<span class="count">' + shown + "</span>";
      head.addEventListener("click", function () {
        collapsedWins[wg.window.id] = !collapsedWins[wg.window.id];
        chrome.storage.local.set({ collapsedWins: collapsedWins }).catch(function () {});
        render();
      });
      wrap.appendChild(head);

      if (!collapsedWins[wg.window.id]) {
        domains.forEach(function (dg) {
          var dl = document.createElement("div");
          dl.className = "domain-label";
          dl.textContent = dg.name;
          wrap.appendChild(dl);
          dg.tabs.forEach(function (t) { wrap.appendChild(tabRow(t)); });
        });
      }
      treeEl.appendChild(wrap);
    });

    if (!treeEl.children.length) {
      treeEl.innerHTML = '<div class="empty">No tabs match "' + esc(query.trim()) + '".</div>';
    }
  }

  // Debounced search.
  var deb = null;
  searchEl.addEventListener("input", function () {
    clearTimeout(deb);
    deb = setTimeout(function () {
      query = searchEl.value;
      render();
    }, 120);
  });

  document.getElementById("expandAll").addEventListener("click", function () {
    collapsedWins = {};
    chrome.storage.local.set({ collapsedWins: collapsedWins }).catch(function () {});
    render();
  });
  document.getElementById("collapseAll").addEventListener("click", async function () {
    var wins = await chrome.windows.getAll({});
    wins.forEach(function (w) { collapsedWins[w.id] = true; });
    chrome.storage.local.set({ collapsedWins: collapsedWins }).catch(function () {});
    render();
  });

  // Live updates: re-render on any tab/window change.
  ["onCreated", "onRemoved", "onUpdated", "onMoved", "onActivated", "onAttached", "onDetached"]
    .forEach(function (ev) {
      if (chrome.tabs[ev]) chrome.tabs[ev].addListener(function () { render(); });
    });
  ["onCreated", "onRemoved"].forEach(function (ev) {
    if (chrome.windows[ev]) chrome.windows[ev].addListener(function () { render(); });
  });

  // Restore collapsed state, then render.
  chrome.storage.local.get({ collapsedWins: {} }).then(function (res) {
    collapsedWins = res.collapsedWins || {};
    render();
  }).catch(function () { render(); });
})();
