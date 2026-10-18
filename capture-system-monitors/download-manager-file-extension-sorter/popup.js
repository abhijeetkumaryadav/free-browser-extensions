/* ExtSort — read-only download history viewer, grouped by file extension.
 * chrome.downloads is read-only here: ExtSort never moves, renames, or opens files. */
(function () {
  "use strict";

  var LIMIT = 500; // downloads.search page size

  var el = function (id) { return document.getElementById(id); };

  var state = {
    items: [],        // raw DownloadItem list
    groups: [],       // [{ ext, count, bytes }]
    activeExt: null,  // active extension filter (null = all)
    query: "",
    sortBy: "date-desc"
  };

  // ---------- helpers ----------

  /** Extract lowercase extension from a filename; "" if none. */
  function extOf(filename) {
    var base = (filename || "").split(/[\\/]/).pop();
    var dot = base.lastIndexOf(".");
    if (dot <= 0 || dot === base.length - 1) return "";
    return base.slice(dot + 1).toLowerCase().slice(0, 12);
  }

  /** Human-readable byte size. */
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }

  /** Human-readable relative date. */
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    var y = new Date(now); y.setDate(y.getDate() - 1);
    var time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return "Today " + time;
    if (d.toDateString() === y.toDateString()) return "Yesterday " + time;
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + time;
  }

  /** Sort a copy of `items` per the active sort key. */
  function sortItems(items) {
    var arr = items.slice();
    switch (state.sortBy) {
      case "date-asc":
        arr.sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime); });
        break;
      case "size-desc":
        arr.sort(function (a, b) { return (b.totalBytes || 0) - (a.totalBytes || 0); });
        break;
      case "name-asc":
        arr.sort(function (a, b) { return (a.filename || "").localeCompare(b.filename || ""); });
        break;
      default: // date-desc
        arr.sort(function (a, b) { return new Date(b.startTime) - new Date(a.startTime); });
    }
    return arr;
  }

  /** Apply query + extension filter, then sort. */
  function visibleItems() {
    var q = state.query.trim().toLowerCase();
    var items = state.items.filter(function (it) {
      var name = (it.filename || "").toLowerCase();
      if (q && name.indexOf(q) === -1) return false;
      if (state.activeExt !== null && it._ext !== state.activeExt) return false;
      return true;
    });
    return sortItems(items);
  }

  // ---------- render ----------

  function renderStats() {
    var totalBytes = state.items.reduce(function (sum, it) { return sum + (it.totalBytes || 0); }, 0);
    el("statTotal").textContent = state.items.length;
    el("statBytes").textContent = fmtBytes(totalBytes);
    el("statExts").textContent = state.groups.length;
  }

  function renderChips() {
    var box = el("extChips");
    box.innerHTML = "";
    var all = document.createElement("button");
    all.className = "chip" + (state.activeExt === null ? " active" : "");
    all.textContent = "All";
    all.addEventListener("click", function () { state.activeExt = null; refresh(); });
    box.appendChild(all);

    state.groups.forEach(function (g) {
      var chip = document.createElement("button");
      chip.className = "chip" + (state.activeExt === g.ext ? " active" : "");
      var label = document.createElement("span");
      label.textContent = g.ext === "" ? "(none)" : "." + g.ext;
      chip.appendChild(label);
      var count = document.createElement("span");
      count.className = "count";
      count.textContent = " " + g.count;
      chip.appendChild(count);
      chip.title = fmtBytes(g.bytes) + " total";
      chip.addEventListener("click", function () {
        state.activeExt = (state.activeExt === g.ext) ? null : g.ext;
        refresh();
      });
      box.appendChild(chip);
    });
  }

  function renderList() {
    var list = el("list");
    list.innerHTML = "";
    var items = visibleItems();
    el("empty").hidden = items.length > 0;

    items.forEach(function (it) {
      var row = document.createElement("div");
      row.className = "item";

      var badge = document.createElement("div");
      badge.className = "ext-badge";
      badge.textContent = it._ext === "" ? "—" : it._ext;
      row.appendChild(badge);

      var meta = document.createElement("div");
      meta.className = "item-meta";

      var name = document.createElement("div");
      name.className = "item-name";
      name.textContent = (it.filename || "unknown").split(/[\\/]/).pop();
      name.title = it.filename || "";
      meta.appendChild(name);

      var sub = document.createElement("div");
      sub.className = "item-sub";
      var bits = [fmtBytes(it.totalBytes), fmtDate(it.startTime)];
      if (it.state === "interrupted") bits.push("interrupted");
      sub.textContent = bits.join(" · ");
      meta.appendChild(sub);

      row.appendChild(meta);
      list.appendChild(row);
    });
  }

  function refresh() {
    renderChips();
    renderList();
  }

  // ---------- load ----------

  function load() {
    // Read-only search over recent history. No download is modified or opened.
    chrome.downloads.search({ limit: LIMIT, orderBy: ["-startTime"] }).then(function (results) {
      state.items = (results || []).map(function (it) {
        it._ext = extOf(it.filename);
        return it;
      });
      var byExt = {};
      state.items.forEach(function (it) {
        if (!byExt[it._ext]) byExt[it._ext] = { ext: it._ext, count: 0, bytes: 0 };
        byExt[it._ext].count += 1;
        byExt[it._ext].bytes += it.totalBytes || 0;
      });
      state.groups = Object.keys(byExt).map(function (k) { return byExt[k]; })
        .sort(function (a, b) { return b.count - a.count || a.ext.localeCompare(b.ext); });
      renderStats();
      refresh();
    }).catch(function (err) {
      el("empty").hidden = false;
      el("empty").textContent = "Couldn't read downloads: " + (err && err.message ? err.message : err);
    });
  }

  // ---------- wiring ----------

  el("search").addEventListener("input", function (e) {
    state.query = e.target.value;
    renderList();
  });

  el("sortBy").addEventListener("change", function (e) {
    state.sortBy = e.target.value;
    chrome.storage.local.set({ sortBy: state.sortBy });
    renderList();
  });

  el("btnRefresh").addEventListener("click", load);

  // ---------- init ----------

  chrome.storage.local.get(["sortBy"]).then(function (res) {
    if (res.sortBy) {
      state.sortBy = res.sortBy;
      el("sortBy").value = res.sortBy;
    }
  });
  load();
})();
