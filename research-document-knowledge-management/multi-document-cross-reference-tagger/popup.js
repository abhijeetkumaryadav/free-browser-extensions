/* LinkNotes — wiki-style cross-referenced notes. All on-device via chrome.storage.
   [[Note Name]] links, backlinks, Markdown export. No network, no tracking. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var listView = $("listView"), editorView = $("editorView"),
      notesList = $("notesList"), emptyState = $("emptyState"), searchInput = $("searchInput"),
      newNoteBtn = $("newNoteBtn"), exportAllBtn = $("exportAllBtn"),
      backListBtn = $("backListBtn"), titleInput = $("titleInput"), bodyInput = $("bodyInput"),
      editTab = $("editTab"), previewTab = $("previewTab"), previewPane = $("previewPane"),
      wordCount = $("wordCount"), linkCount = $("linkCount"),
      backlinkList = $("backlinkList"), backlinkNum = $("backlinkNum"),
      saveNoteBtn = $("saveNoteBtn"), exportNoteBtn = $("exportNoteBtn"),
      deleteNoteBtn = $("deleteNoteBtn"), saveState = $("saveState"), footCount = $("footCount");

  var notes = [];          // [{id, title, body, updatedAt}]
  var editingId = null;    // id of note in editor, or "new"
  var STORAGE_KEY = "linkNotesData";

  /* ---------------- storage ---------------- */
  function load(cb) {
    chrome.storage.local.get(STORAGE_KEY, function (r) {
      notes = Array.isArray(r[STORAGE_KEY]) ? r[STORAGE_KEY] : [];
      cb();
    });
  }
  function persist(cb) {
    chrome.storage.local.set({ linkNotesData: notes }, function () { if (cb) cb(); });
  }

  /* ---------------- wiki links ---------------- */
  var LINK_RE = /\[\[\s*([^\[\]]+?)\s*\]\]/g;

  function extractLinks(text) {
    var out = [], m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) out.push(m[1].trim());
    return out;
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function findByTitle(title) {
    var t = title.trim().toLowerCase();
    return notes.find(function (n) { return n.title.trim().toLowerCase() === t; }) || null;
  }

  // Render body text as HTML with clickable [[links]].
  function renderBody(text) {
    var html = "", last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      html += esc(text.slice(last, m.index));
      var name = m[1].trim();
      var exists = !!findByTitle(name);
      html += '<button class="wiki-link' + (exists ? "" : " missing") + '" data-link="' +
              esc(name).replace(/"/g, "&quot;") + '" title="' +
              (exists ? "Open note" : "Create note") + '">' + esc(name) + "</button>";
      last = m.index + m[0].length;
    }
    html += esc(text.slice(last));
    return html;
  }

  function bindWikiLinks(container) {
    container.querySelectorAll(".wiki-link").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openNoteByTitle(btn.getAttribute("data-link"));
      });
    });
  }

  // Backlinks: notes (other than current) whose body links to `title`.
  function getBacklinks(title, excludeId) {
    var t = title.trim().toLowerCase();
    return notes.filter(function (n) {
      if (n.id === excludeId) return false;
      return extractLinks(n.body).some(function (l) { return l.toLowerCase() === t; });
    });
  }

  /* ---------------- list view ---------------- */
  function snippet(body) {
    return (body || "").replace(/\s+/g, " ").trim().slice(0, 90);
  }

  function renderList() {
    var q = searchInput.value.trim().toLowerCase();
    var shown = notes
      .filter(function (n) {
        return !q || n.title.toLowerCase().indexOf(q) > -1 || n.body.toLowerCase().indexOf(q) > -1;
      })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });

    notesList.innerHTML = "";
    emptyState.classList.toggle("hidden", notes.length > 0);

    shown.forEach(function (n) {
      var backs = getBacklinks(n.title, n.id).length;
      var card = document.createElement("button");
      card.className = "note-card";
      card.innerHTML =
        "<h3>" + esc(n.title || "Untitled") + "</h3>" +
        "<p>" + esc(snippet(n.body) || "Empty note") + "</p>" +
        '<div class="meta"><span>' + extractLinks(n.body).length + ' links</span>' +
        (backs ? '<span class="badge">' + backs + " backlink" + (backs === 1 ? "" : "s") + "</span>" : "") +
        "<span>" + new Date(n.updatedAt).toLocaleDateString() + "</span></div>";
      card.addEventListener("click", function () { openEditor(n.id); });
      notesList.appendChild(card);
    });

    footCount.textContent = notes.length + " note" + (notes.length === 1 ? "" : "s");
  }

  /* ---------------- editor ---------------- */
  function openEditor(id) {
    editingId = id;
    var n = notes.find(function (x) { return x.id === id; });
    titleInput.value = n ? n.title : "";
    bodyInput.value = n ? n.body : "";
    deleteNoteBtn.style.display = n ? "" : "none";
    setTab("edit");
    updateMeta();
    renderBacklinks();
    listView.classList.add("hidden");
    editorView.classList.remove("hidden");
    saveState.textContent = "";
    titleInput.focus();
  }

  function openNoteByTitle(title) {
    var n = findByTitle(title);
    if (n) { persist(function () { openEditor(n.id); }); }
    else {
      // create a stub note with that title, then edit it
      var stub = { id: "n" + Date.now(), title: title, body: "", updatedAt: Date.now() };
      notes.push(stub);
      persist(function () { openEditor(stub.id); });
    }
  }

  function currentDraft() {
    return {
      title: titleInput.value.trim() || "Untitled",
      body: bodyInput.value
    };
  }

  function saveCurrent(silent) {
    var d = currentDraft();
    if (editingId === "new") {
      notes.push({ id: "n" + Date.now(), title: d.title, body: d.body, updatedAt: Date.now() });
      editingId = notes[notes.length - 1].id;
      deleteNoteBtn.style.display = "";
    } else {
      var n = notes.find(function (x) { return x.id === editingId; });
      if (n) { n.title = d.title; n.body = d.body; n.updatedAt = Date.now(); }
    }
    persist(function () {
      if (!silent) {
        saveState.textContent = "Saved ✓";
        saveState.classList.add("ok");
        setTimeout(function () { saveState.textContent = ""; saveState.classList.remove("ok"); }, 1600);
      }
      renderBacklinks();
    });
  }

  function setTab(which) {
    var isEdit = which === "edit";
    editTab.classList.toggle("active", isEdit);
    previewTab.classList.toggle("active", !isEdit);
    bodyInput.classList.toggle("hidden", !isEdit);
    previewPane.classList.toggle("hidden", isEdit);
    if (!isEdit) {
      previewPane.innerHTML = renderBody(bodyInput.value) || '<span class="muted">Nothing to preview.</span>';
      bindWikiLinks(previewPane);
    }
  }

  function updateMeta() {
    var words = bodyInput.value.trim().split(/\s+/).filter(Boolean).length;
    wordCount.textContent = words + (words === 1 ? " word" : " words");
    var links = extractLinks(bodyInput.value).length;
    linkCount.textContent = links + (links === 1 ? " link" : " links");
  }

  function renderBacklinks() {
    var title = currentDraft().title;
    var backs = getBacklinks(title, editingId === "new" ? null : editingId);
    backlinkNum.textContent = backs.length;
    backlinkList.innerHTML = "";
    if (!backs.length) {
      backlinkList.innerHTML = '<p class="muted">No notes link to this one yet.</p>';
      return;
    }
    backs.forEach(function (n) {
      var chip = document.createElement("button");
      chip.className = "backlink-chip";
      chip.textContent = n.title;
      chip.addEventListener("click", function () { saveCurrent(true); openEditor(n.id); });
      backlinkList.appendChild(chip);
    });
  }

  /* ---------------- Markdown export ---------------- */
  function noteToMarkdown(n) {
    return "# " + n.title + "\n\n" + n.body + "\n";
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "note";
  }

  /* ---------------- events ---------------- */
  newNoteBtn.addEventListener("click", function () { openEditor("new"); });
  backListBtn.addEventListener("click", function () {
    editorView.classList.add("hidden");
    listView.classList.remove("hidden");
    renderList();
  });
  saveNoteBtn.addEventListener("click", function () { saveCurrent(false); });
  deleteNoteBtn.addEventListener("click", function () {
    if (editingId === "new") return;
    if (!confirm("Delete this note? Links to it from other notes will become dangling.")) return;
    notes = notes.filter(function (n) { return n.id !== editingId; });
    persist(function () {
      editorView.classList.add("hidden");
      listView.classList.remove("hidden");
      renderList();
    });
  });
  editTab.addEventListener("click", function () { setTab("edit"); });
  previewTab.addEventListener("click", function () { setTab("preview"); });
  bodyInput.addEventListener("input", function () { updateMeta(); });
  titleInput.addEventListener("input", function () { renderBacklinks(); });
  searchInput.addEventListener("input", renderList);

  exportNoteBtn.addEventListener("click", function () {
    var d = currentDraft();
    download(slug(d.title) + ".md", noteToMarkdown(d));
  });
  exportAllBtn.addEventListener("click", function () {
    if (!notes.length) return;
    var md = notes
      .slice()
      .sort(function (a, b) { return a.title.localeCompare(b.title); })
      .map(noteToMarkdown)
      .join("\n---\n\n");
    download("linknotes-export.md", md);
  });

  // Ctrl/Cmd+S saves inside the editor
  editorView.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveCurrent(false);
    }
  });

  /* ---------------- init ---------------- */
  load(renderList);
})();
